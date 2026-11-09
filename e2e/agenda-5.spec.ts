/**
 * Agenda Clase B y Triple Match (fix-186-b, ASG-i-026) — grupo 2: reprogramar y reagendar desde
 * la ficha del alumno, y reactivar un horario con un choque. Casos I, J y N de
 * specs/testing-piloto/026-agenda-triple-match.md; el ID de cada caso va en el título.
 *
 * La BD del piloto es producción: cada test siembra sus alumnos E2E- y borra todo lo que la app les
 * cuelga (historial, asistencias, avisos al alumno y al instructor). Las clases "reales" de los
 * tests de reprogramar ocupan horarios libres de la semana siguiente de un instructor de la sede 1
 * (`instructorSembrable()`), solo mientras dura el test.
 *
 * Ya cubiertos en otros archivos (no se repiten acá):
 * - I07, I11, I14 → `alumnos-b-ficha.spec.ts` (F04 · F11 · F13 · E09, fix-279-m).
 * - J02, J09 → `asistencia-clase-b.spec.ts` (J04 · J11 · J12, fix-382-m).
 * - J05 → `supabase/tests/asistencia/fix-383-m-reagendar-todo-o-nada.sql` (RPC en una transacción).
 * - N01, N02 (fechas pasadas), N04 → `acciones-masivas-clases.spec.ts` (H06/H09) y
 *   `asistencia-clase-b.spec.ts` (H05 · H06 · H08 · fix-391-m).
 */
import type { Locator, Page } from '@playwright/test';
import {
  addDaysIso,
  chileToday,
  formatChileDate,
  toChileDate,
} from '../src/app/core/utils/chile-time.utils';
import {
  horaChile,
  instructorSembrable,
  sembrarClase,
  type InstructorSembrable,
} from './support/agenda-seed';
import { createE2eAlumno, type E2eAlumno } from './support/alumnos-seed';
import { SEDE_A, SEDE_B, limpiarAsistencia, seedClase } from './support/asistencia-seed';
import { expect, test, type Cleanup } from './support/fixtures';
import { getAdminClient } from './support/supabase-admin';

const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };

test.describe.configure({ mode: 'default', timeout: 150_000 });

// ── Limpieza de lo que crea la app ────────────────────────────────────────────

const rastros = { sesiones: [] as number[], alumnos: [] as E2eAlumno[] };

/** Borra historial, asistencias y avisos de las clases y alumnos del test (antes que el cleanup). */
test.afterEach(async () => {
  const sb = await getAdminClient();
  // Las sembradas las borra el `cleanup`; acá solo las que creó la app (reprogramar un número
  // sin sesión).
  const sembradas = new Set(rastros.sesiones.splice(0));
  const sesiones = [...sembradas];
  const deLaApp: number[] = [];
  const alumnos = rastros.alumnos.splice(0);
  for (const a of alumnos) {
    const { data } = await sb
      .from('class_b_sessions')
      .select('id')
      .in('enrollment_id', a.enrollmentIds);
    for (const s of data ?? []) {
      if (!sembradas.has(s.id)) deLaApp.push(s.id);
      if (!sesiones.includes(s.id)) sesiones.push(s.id);
    }
  }
  if (sesiones.length) {
    await sb.from('class_b_reschedule_history').delete().in('class_session_id', sesiones);
    await sb.from('class_b_practice_attendance').delete().in('class_b_session_id', sesiones);
    await sb
      .from('notifications')
      .delete()
      .eq('reference_type', 'class_b')
      .in('reference_id', sesiones);
  }
  for (const a of alumnos) {
    await sb.from('notifications').delete().eq('recipient_id', a.userId);
    // Avisos al instructor ("Se te asignó la clase de E2E-…"): llevan el nombre del alumno.
    await sb.from('notifications').delete().ilike('message', `%${a.paternalLastName}%`);
  }
  if (deLaApp.length) await sb.from('class_b_sessions').delete().in('id', deLaApp);
  await limpiarAsistencia();
});

async function alumnoE2e(label: string, branchId: number, cleanup: Cleanup): Promise<E2eAlumno> {
  const alumno = await createE2eAlumno({ label, branchId, enrollments: [{}] }, cleanup);
  rastros.alumnos.push(alumno);
  return alumno;
}

async function clase(
  alumno: E2eAlumno,
  inst: { id: number; vehicleId: number },
  fila: Record<string, unknown>,
  cleanup: Cleanup,
): Promise<number> {
  const id = await sembrarClase(
    alumno.enrollmentIds[0],
    { ...inst, nombre: '', libresProxSemana: [] },
    { status: 'scheduled', ...fila },
    cleanup,
  );
  rastros.sesiones.push(id);
  return id;
}

/** Un instante a las 03:15–03:59 de Chile, `dias` desde hoy: sin clases reales ni bloques. */
function madrugada(dias: number): string {
  const dia = addDaysIso(chileToday(), dias);
  const min = 15 + Math.floor(Math.random() * 40);
  return new Date(`${dia}T03:${String(min).padStart(2, '0')}:00-03:00`).toISOString();
}

// ── Ayudas de pantalla ────────────────────────────────────────────────────────

const accion = (scope: Page | Locator, name: string) =>
  scope.locator(`[data-llm-action="${name}"]`);
const toast = (page: Page, text: string | RegExp) =>
  page.locator('.p-toast-message').filter({ hasText: text }).first();
const panelReprogramar = (page: Page) => page.locator('app-admin-reprogramar-clase-drawer');

async function abrirFicha(page: Page, studentId: number): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(`/app/secretaria/alumnos/${studentId}`);
  await expect(page.locator('[data-llm-info="matricula"]')).toBeVisible(CARGA);
}

/** Ficha técnica → lápiz de la clase N (las tarjetas son las visibles dentro del drawer). */
function tarjetaClase(page: Page, numero: number): Locator {
  return page
    .locator('app-admin-ficha-tecnica .ficha-tarjetas > div')
    .filter({ has: page.getByText(`SESIÓN #${numero}`, { exact: true }) });
}

async function abrirReprogramar(page: Page, numero: number): Promise<Locator> {
  await accion(page, 'ver-ficha-tecnica').click();
  await accion(tarjetaClase(page, numero), 'reprogramar-clase').click(CARGA);
  const panel = panelReprogramar(page);
  await expect(panel).toBeVisible();
  return panel;
}

function botonInstructor(panel: Locator, nombre: string): Locator {
  return accion(panel, 'seleccionar-instructor-reprogramar').filter({ hasText: nombre });
}

/** Etiqueta de la pestaña de un día, igual que la arma el facade ("9 nov"). */
function etiquetaDia(iso: string): string {
  return formatChileDate(iso, { day: 'numeric', month: 'short' });
}

/** Avanza semanas en el panel hasta que aparezca la pestaña del día y la elige. */
async function irADia(panel: Locator, iso: string): Promise<void> {
  await expect(panel.getByText(/^Semana \d+ de \d+$/)).toBeVisible(CARGA);
  const pestana = panel
    .locator('button')
    .filter({ hasText: new RegExp(`(^|\\D)${etiquetaDia(iso)}$`) });
  for (let i = 0; i < 20 && !(await pestana.count()); i++) {
    await panel.getByRole('button', { name: 'Semana siguiente' }).click();
  }
  await pestana.first().click();
}

/** El horario "HH:MM – HH:MM" del día elegido: como botón (libre) o como celda ocupada. */
function slotLibre(panel: Locator, hhmm: string): Locator {
  return accion(panel, 'seleccionar-slot-reprogramar').filter({ hasText: `${hhmm} –` });
}
function slotOcupado(panel: Locator, hhmm: string): Locator {
  return panel.locator('div.cursor-not-allowed').filter({ hasText: `${hhmm} –` });
}

async function elegirRazon(page: Page, scope: Locator, razon: string): Promise<void> {
  const select = scope.locator('p-select').first();
  const opcion = page.getByRole('option', { name: razon, exact: true });
  // Con una razón ya elegida, el primer clic a veces solo enfoca: se reintenta.
  for (let i = 0; i < 3 && !(await opcion.isVisible()); i++) {
    await select.locator('.p-select-dropdown, [role="combobox"]').first().click();
    await opcion.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => undefined);
  }
  await opcion.click();
}

async function estadoVista(instructorId: number, slotStart: string): Promise<string | null> {
  const sb = await getAdminClient();
  const { data } = await sb
    .from('v_class_b_schedule_availability')
    .select('slot_status')
    .eq('instructor_id', instructorId)
    .eq('slot_start', slotStart);
  return (data?.[0]?.slot_status as string | undefined) ?? null;
}

/** Otro instructor de la sede 1 (no "ambas", no el 223) que tiene libre ese horario. */
async function otroInstructorLibreEn(
  slotStart: string,
  excluir: number[],
): Promise<{ id: number; vehicleId: number; nombre: string }> {
  const sb = await getAdminClient();
  const { data: deSede1 } = await sb
    .from('instructors')
    .select('id, users!inner(branch_id, first_names, paternal_last_name)')
    .eq('users.branch_id', SEDE_A)
    .eq('active', true)
    .eq('both_branches', false);
  const candidatos = (deSede1 ?? []).filter((r) => ![...excluir, 223].includes(r.id as number));
  const { data: libres } = await sb
    .from('v_class_b_schedule_availability')
    .select('instructor_id, vehicle_id')
    .eq('slot_start', slotStart)
    .eq('slot_status', 'available')
    .in(
      'instructor_id',
      candidatos.map((c) => c.id),
    );
  const libre = libres?.[0];
  if (!libre) throw new Error(`[e2e] Ningún otro instructor de la sede 1 libre en ${slotStart}`);
  const fila = candidatos.find((c) => c.id === libre.instructor_id)!;
  const u = fila.users as unknown as { first_names: string; paternal_last_name: string };
  return {
    id: libre.instructor_id as number,
    vehicleId: libre.vehicle_id as number,
    nombre: `${u.first_names} ${u.paternal_last_name}`,
  };
}

// ── I · Reprogramación individual ─────────────────────────────────────────────

test('I01 · I02 · I03 · I11 · I13 · I17 · J01: reprogramar una clase agendada a otro horario', async ({
  pageAs,
  cleanup,
}) => {
  const inst = await instructorSembrable();
  const [origen, , destino] = inst.libresProxSemana;
  const alumno = await alumnoE2e('Reprog', SEDE_A, cleanup);
  const sessionId = await clase(alumno, inst, { class_number: 1, scheduled_at: origen }, cleanup);
  const sb = await getAdminClient();

  const page = await pageAs('secretariaA');
  await abrirFicha(page, alumno.studentId);
  // J01: sin inasistencias ni clases penalizadas no hay "Reagendar Clases".
  await expect(page.getByRole('button', { name: /Reagendar Clases/ })).toHaveCount(0);

  const panel = await abrirReprogramar(page, 1);
  // I01
  await expect(panel).toContainText(`Clase #1 — ${alumno.firstNames}`);
  // I02: instructores de la sede 1 (y "ambas sedes"); ninguno solo de la sede 2.
  const instructores = accion(panel, 'seleccionar-instructor-reprogramar');
  await expect(instructores.first()).toBeVisible(CARGA);
  await expect(botonInstructor(panel, inst.nombre)).toHaveCount(1);
  const { data: soloSedeB } = await sb
    .from('instructors')
    .select('users!inner(first_names, paternal_last_name, branch_id)')
    .eq('users.branch_id', SEDE_B)
    .eq('active', true)
    .eq('both_branches', false)
    .limit(3);
  for (const r of soloSedeB ?? []) {
    const u = r.users as unknown as { first_names: string; paternal_last_name: string };
    await expect(botonInstructor(panel, `${u.first_names} ${u.paternal_last_name}`)).toHaveCount(0);
  }

  // I13: se elige otro instructor (con la grilla lenta) y enseguida el definitivo.
  const otroBoton = instructores.filter({ hasNotText: inst.nombre }).first();
  await page.route('**/rest/v1/v_class_b_schedule_availability*', async (route) => {
    if (!route.request().url().includes(`instructor_id=eq.${inst.id}`)) {
      await new Promise((r) => setTimeout(r, 3_000));
    }
    await route.continue().catch(() => undefined);
  });
  await otroBoton.click();
  await botonInstructor(panel, inst.nombre).click();
  await irADia(panel, toChileDate(destino));
  await slotLibre(panel, horaChile(destino)).click();
  await elegirRazon(page, panel, 'Médica');
  // Se espera a que la respuesta lenta del otro instructor llegue antes de confirmar.
  await page.waitForTimeout(3_500);
  await expect(slotLibre(panel, horaChile(destino))).toHaveClass(/bg-brand/);

  await accion(panel, 'confirmar-reprogramar-clase').click();
  await expect(toast(page, 'Clase reprogramada correctamente.')).toBeVisible(CARGA);
  await page.waitForTimeout(2_000);

  // I03 · I13: la clase quedó en el horario nuevo con el vehículo del instructor elegido.
  const { data: sesion } = await sb
    .from('class_b_sessions')
    .select('status, scheduled_at, instructor_id, vehicle_id')
    .eq('id', sessionId)
    .single();
  expect(sesion!.status).toBe('scheduled');
  expect(new Date(sesion!.scheduled_at).toISOString()).toBe(new Date(destino).toISOString());
  expect(sesion!.instructor_id).toBe(inst.id);
  expect(sesion!.vehicle_id).toBe(inst.vehicleId);
  // I03 (Agenda): el horario anterior vuelve a estar libre y el nuevo, ocupado.
  expect(await estadoVista(inst.id, origen)).toBe('available');
  expect(await estadoVista(inst.id, destino)).toBe('occupied');

  // I11: una sola fila en el historial, con fecha anterior y nueva.
  const { data: historial } = await sb
    .from('class_b_reschedule_history')
    .select('old_scheduled_at, new_scheduled_at, reason')
    .eq('class_session_id', sessionId);
  expect(historial, 'historial de reagendamientos').toHaveLength(1);
  expect(new Date(historial![0].old_scheduled_at).toISOString()).toBe(
    new Date(origen).toISOString(),
  );
  expect(historial![0].reason).toBe('medica');

  // I17: avisos al alumno y al instructor (aunque sus portales estén bloqueados en el piloto).
  const { data: instUser } = await sb
    .from('instructors')
    .select('user_id')
    .eq('id', inst.id)
    .single();
  await expect
    .poll(async () => {
      const { data } = await sb
        .from('notifications')
        .select('recipient_id')
        .in('recipient_id', [alumno.userId, instUser!.user_id])
        .eq('reference_type', 'class_b')
        .eq('reference_id', sessionId);
      return [...new Set((data ?? []).map((n) => n.recipient_id))].sort();
    })
    .toEqual([alumno.userId, instUser!.user_id].sort());
});

test('I16: doble clic en "Confirmar Reprogramación" reprograma una sola vez', async ({
  pageAs,
  cleanup,
}) => {
  const inst = await instructorSembrable();
  const destino = inst.libresProxSemana[3];
  const alumno = await alumnoE2e('DobleClic', SEDE_A, cleanup);
  const sessionId = await clase(
    alumno,
    inst,
    { class_number: 1, scheduled_at: madrugada(320) },
    cleanup,
  );
  const page = await pageAs('secretariaA');
  await abrirFicha(page, alumno.studentId);
  const panel = await abrirReprogramar(page, 1);
  await botonInstructor(panel, inst.nombre).click(CARGA);
  await irADia(panel, toChileDate(destino));
  await slotLibre(panel, horaChile(destino)).click();
  await elegirRazon(page, panel, 'Médica');
  await accion(panel, 'confirmar-reprogramar-clase').dblclick();
  await expect(toast(page, 'Clase reprogramada correctamente.')).toBeVisible(CARGA);
  await page.waitForTimeout(2_000);
  const sb = await getAdminClient();
  const { data: historial } = await sb
    .from('class_b_reschedule_history')
    .select('id')
    .eq('class_session_id', sessionId);
  expect(historial, 'filas en el historial').toHaveLength(1);
});

test('I04 · I05: la grilla no ofrece la hora de otra clase del alumno ni un día con 2 clases', async ({
  pageAs,
  cleanup,
}) => {
  const inst = await instructorSembrable();
  const choque = inst.libresProxSemana[0];
  const diaChoque = toChileDate(choque);
  const diaLleno = inst.libresProxSemana.map((s) => toChileDate(s)).find((d) => d !== diaChoque);
  expect(diaLleno, 'un segundo día con horarios libres').toBeTruthy();
  const otro = await otroInstructorLibreEn(choque, [inst.id]);

  const alumno = await alumnoE2e('Choque', SEDE_A, cleanup);
  // Clase 1 a la hora del choque, con OTRO instructor.
  await clase(alumno, otro, { class_number: 1, scheduled_at: choque }, cleanup);
  // Clases 3 y 4 el día lleno, de madrugada (fuera de la grilla).
  const lleno = (hh: string) => new Date(`${diaLleno}T${hh}:00-03:00`).toISOString();
  await clase(alumno, otro, { class_number: 3, scheduled_at: lleno('03:15') }, cleanup);
  await clase(alumno, otro, { class_number: 4, scheduled_at: lleno('04:05') }, cleanup);
  // Clase 2, la que se mueve: lejos en el futuro.
  await clase(alumno, otro, { class_number: 2, scheduled_at: madrugada(300) }, cleanup);

  const page = await pageAs('secretariaA');
  await abrirFicha(page, alumno.studentId);
  const panel = await abrirReprogramar(page, 2);
  await botonInstructor(panel, inst.nombre).click(CARGA);

  // I04: la hora de la clase 1 sale ocupada con este instructor, aunque él esté libre.
  expect(await estadoVista(inst.id, choque)).toBe('available');
  await irADia(panel, diaChoque);
  await expect(slotOcupado(panel, horaChile(choque))).toBeVisible();
  await expect(slotLibre(panel, horaChile(choque))).toHaveCount(0);
  // Con una sola clase ese día, el resto del día se puede elegir (tope de 2 por día).
  const libresDelDia = await accion(panel, 'seleccionar-slot-reprogramar').count();

  // I05: el día con 2 clases sale entero ocupado.
  await irADia(panel, diaLleno!);
  await expect(panel.locator('div.cursor-not-allowed').first()).toBeVisible();
  await expect(accion(panel, 'seleccionar-slot-reprogramar')).toHaveCount(0);

  test.info().annotations.push({
    type: 'tope por día',
    description: `día con 1 clase: ${libresDelDia} horarios elegibles (la app usa tope 2; courses.max_classes_per_day = 1)`,
  });
});

test('I09 · I10: una clase completada no se reprograma; un número sin sesión crea la clase', async ({
  pageAs,
  cleanup,
}) => {
  const inst = await instructorSembrable();
  const alumno = await alumnoE2e('SinSesion', SEDE_A, cleanup);
  await clase(
    alumno,
    inst,
    { class_number: 1, scheduled_at: madrugada(-5), status: 'completed' },
    cleanup,
  );
  const destino = inst.libresProxSemana[1];

  const page = await pageAs('secretariaA');
  await abrirFicha(page, alumno.studentId);
  await accion(page, 'ver-ficha-tecnica').click();
  // I09
  await expect(tarjetaClase(page, 1)).toBeVisible(CARGA);
  await expect(accion(tarjetaClase(page, 1), 'reprogramar-clase')).toHaveCount(0);

  // I10: la clase 2 no tiene sesión → agendarla no pide razón y crea la fila.
  await accion(tarjetaClase(page, 2), 'reprogramar-clase').click();
  const panel = panelReprogramar(page);
  await expect(panel).toContainText('Clase #2');
  await expect(panel.locator('p-select')).toHaveCount(0);
  await botonInstructor(panel, inst.nombre).click(CARGA);
  await irADia(panel, toChileDate(destino));
  await slotLibre(panel, horaChile(destino)).click();
  await accion(panel, 'confirmar-reprogramar-clase').click();
  await expect(toast(page, 'Clase reprogramada correctamente.')).toBeVisible(CARGA);

  const sb = await getAdminClient();
  const { data } = await sb
    .from('class_b_sessions')
    .select('class_number, status, scheduled_at, instructor_id')
    .eq('enrollment_id', alumno.enrollmentIds[0])
    .eq('class_number', 2);
  expect(data).toHaveLength(1);
  expect(data![0].status).toBe('scheduled');
  expect(new Date(data![0].scheduled_at).toISOString()).toBe(new Date(destino).toISOString());
});

test('I19 · I20: instructor sin horarios y navegación de semanas y días del panel', async ({
  pageAs,
  cleanup,
}) => {
  const inst = await instructorSembrable();
  const alumno = await alumnoE2e('Panel', SEDE_A, cleanup);
  const page = await pageAs('secretariaA');
  await abrirFicha(page, alumno.studentId);

  // I20: con un instructor con horarios, las flechas se deshabilitan en los extremos y al
  // cambiar de semana queda elegido el primer día.
  const panel = await abrirReprogramar(page, 1);
  await botonInstructor(panel, inst.nombre).click(CARGA);
  const anterior = panel.getByRole('button', { name: 'Semana anterior' });
  const siguiente = panel.getByRole('button', { name: 'Semana siguiente' });
  const indicador = panel.getByText(/^Semana \d+ de \d+$/);
  await expect(indicador).toBeVisible(CARGA);
  await expect(anterior).toBeDisabled();
  const total = Number((await indicador.innerText()).match(/de (\d+)/)![1]);
  expect(total).toBeGreaterThan(1);
  const pestanas = panel.locator('.flex.overflow-x-auto > button');
  await pestanas.nth(1).click();
  for (let i = 1; i < total; i++) {
    await siguiente.click();
    await expect(indicador).toHaveText(`Semana ${i + 1} de ${total}`);
    await expect(pestanas.first()).toHaveClass(/border-brand/);
  }
  await expect(siguiente).toBeDisabled();
  await expect(anterior).toBeEnabled();

  // I19: un instructor sin horarios muestra "Sin disponibilidad" con la explicación.
  await page.route('**/rest/v1/v_class_b_schedule_availability*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await accion(panel, 'seleccionar-instructor-reprogramar')
    .filter({ hasNotText: inst.nombre })
    .first()
    .click();
  await expect(panel.getByText('Sin disponibilidad')).toBeVisible(CARGA);
  await expect(panel).toContainText('no tiene horarios disponibles en las próximas semanas');
});

test('I18: mientras cargan los instructores no se dice "No hay instructores disponibles"', async ({
  pageAs,
  cleanup,
}) => {
  const alumno = await alumnoE2e('PanelCarga', SEDE_A, cleanup);
  const page = await pageAs('secretariaA');
  await page.route('**/rest/v1/instructors*', async (route) => {
    await new Promise((r) => setTimeout(r, 2_500));
    await route.continue().catch(() => undefined);
  });
  await abrirFicha(page, alumno.studentId);
  await accion(page, 'ver-ficha-tecnica').click();
  await accion(tarjetaClase(page, 1), 'reprogramar-clase').click(CARGA);
  const panel = panelReprogramar(page);
  const vacio = panel.getByText('No hay instructores disponibles.');
  let seVioVacio = false;
  const hasta = Date.now() + 15_000;
  while (Date.now() < hasta) {
    if (await vacio.isVisible()) seVioVacio = true;
    if (await accion(panel, 'seleccionar-instructor-reprogramar').count()) break;
    await page.waitForTimeout(100);
  }
  expect(seVioVacio, '"No hay instructores disponibles." mientras cargaban').toBe(false);
});

test('I12: un horario cuyo vehículo tiene el SOAP vencido lleva el triángulo con el aviso', async ({
  pageAs,
  cleanup,
}) => {
  const sb = await getAdminClient();
  const { data: veh } = await sb
    .from('vehicles')
    .select('id, license_plate, vehicle_documents(type, expiry_date)')
    .eq('license_plate', 'RTRE29')
    .maybeSingle();
  const soap = (
    veh?.vehicle_documents as { type: string; expiry_date: string }[] | undefined
  )?.find((d) => d.type === 'soap');
  test.skip(
    !veh || !soap || soap.expiry_date >= chileToday(),
    'RTRE29 ya no tiene el SOAP vencido',
  );
  const { data: asig } = await sb
    .from('vehicle_assignments')
    .select('instructors!inner(active, users!inner(first_names, paternal_last_name))')
    .eq('vehicle_id', veh!.id)
    .is('end_date', null)
    .limit(1)
    .single();
  const u = (
    asig!.instructors as unknown as { users: { first_names: string; paternal_last_name: string } }
  ).users;

  const alumno = await alumnoE2e('Soap', SEDE_B, cleanup);
  const page = await pageAs('secretariaB');
  await abrirFicha(page, alumno.studentId);
  const panel = await abrirReprogramar(page, 1);
  await botonInstructor(panel, `${u.first_names} ${u.paternal_last_name}`).click(CARGA);
  const triangulo = accion(panel, 'seleccionar-slot-reprogramar')
    .first()
    .locator('[data-llm-description]');
  await expect(triangulo).toBeVisible(CARGA);
  await expect(triangulo).toHaveAttribute('data-llm-description', /SOAP|venc/i);
});

test('I15: si la BD rechaza el horario al guardar, el error se lee en el panel y no se cierra', async ({
  pageAs,
  cleanup,
}) => {
  const inst = await instructorSembrable();
  const destino = inst.libresProxSemana[2];
  const alumno = await alumnoE2e('Rechazo', SEDE_A, cleanup);
  const sessionId = await clase(
    alumno,
    inst,
    { class_number: 1, scheduled_at: madrugada(310) },
    cleanup,
  );

  const page = await pageAs('secretariaA');
  await abrirFicha(page, alumno.studentId);
  const panel = await abrirReprogramar(page, 1);
  await botonInstructor(panel, inst.nombre).click(CARGA);
  await irADia(panel, toChileDate(destino));
  await slotLibre(panel, horaChile(destino)).click();
  await elegirRazon(page, panel, 'Médica');

  // Otra persona toma ese horario mientras el panel sigue abierto.
  const otroAlumno = await alumnoE2e('Gana', SEDE_A, cleanup);
  await clase(otroAlumno, inst, { class_number: 1, scheduled_at: destino }, cleanup);

  await accion(panel, 'confirmar-reprogramar-clase').click();
  await expect(panel.locator('p.text-error')).toBeVisible(CARGA);
  await expect(panel.locator('p.text-error')).toContainText(/instructor|horario|clase/i);
  await expect(panel.locator('p.text-error')).not.toContainText(/P0001|violates|trigger/i);
  await expect(panel).toBeVisible();
  const sb = await getAdminClient();
  const { data } = await sb
    .from('class_b_sessions')
    .select('scheduled_at')
    .eq('id', sessionId)
    .single();
  expect(new Date(data!.scheduled_at).getTime()).toBeGreaterThan(Date.now() + 200 * 86_400_000);
});

// ── J · Reagendamiento masivo ─────────────────────────────────────────────────

/** Alumno con 2 inasistencias seguidas (clases 1 y 2) y la clase 3 agendada `dia3`. */
async function alumnoConFaltas(
  label: string,
  inst: InstructorSembrable,
  clase3: string,
  cleanup: Cleanup,
): Promise<{ alumno: E2eAlumno; faltas: number[] }> {
  const otro = await otroInstructorLibreEn(clase3, [inst.id]).catch(() => null);
  const deOtro = otro ?? inst;
  const alumno = await alumnoE2e(label, SEDE_A, cleanup);
  const sb = await getAdminClient();
  const faltas: number[] = [];
  for (const [n, dias] of [
    [1, -6],
    [2, -5],
  ] as const) {
    const id = await clase(
      alumno,
      deOtro,
      { class_number: n, scheduled_at: madrugada(dias), status: 'no_show' },
      cleanup,
    );
    const { error } = await sb
      .from('class_b_practice_attendance')
      .insert({ class_b_session_id: id, student_id: alumno.studentId, status: 'absent' });
    if (error) throw new Error(`[e2e] inasistencia: ${error.message}`);
    faltas.push(id);
  }
  // La clase 3, agendada a la hora de madrugada del día `clase3` (no ocupa ningún bloque).
  const dia = toChileDate(clase3);
  await clase(
    alumno,
    deOtro,
    { class_number: 3, scheduled_at: new Date(`${dia}T03:30:00-03:00`).toISOString() },
    cleanup,
  );
  return { alumno, faltas };
}

async function abrirPaso2(page: Page, inst: InstructorSembrable): Promise<Locator> {
  await page.getByRole('button', { name: /Reagendar Clases/ }).click(CARGA);
  const paso1 = page.locator('app-admin-reagendar-clases-drawer');
  await accion(paso1, 'continuar-seleccion-reagendar').click(CARGA);
  const paso2 = page.locator('app-admin-reagendar-horarios-drawer');
  await expect(paso2).toBeVisible(CARGA);
  await paso2.locator('#adm-instructor').click();
  await page.getByRole('option').filter({ hasText: inst.nombre }).first().click();
  await expect(accion(paso2, 'toggle-schedule-slot').first()).toBeVisible(CARGA);
  return paso2;
}

/** Botones de la columna de un día en la grilla del paso 2 (avanza semanas si hace falta). */
async function columnaDelDia(paso2: Locator, iso: string): Promise<Locator[]> {
  const [, m, d] = iso.split('-').map(Number);
  const cabeceras = paso2.locator('.grid.text-xs.font-semibold > span');
  for (let i = 0; i < 20; i++) {
    const textos = await cabeceras.allInnerTexts();
    const idx = textos.findIndex((t) => t.trim().endsWith(` ${d}/${m}`));
    if (idx > 0) {
      const filas = paso2.locator('.grid.text-xs:not(.font-semibold)');
      const n = await filas.count();
      const celdas: Locator[] = [];
      for (let f = 0; f < n; f++) celdas.push(filas.nth(f).locator(':scope > *').nth(idx));
      return celdas;
    }
    await accion(paso2, 'schedule-next-week').click();
  }
  throw new Error(`[e2e] No se encontró el día ${iso} en la grilla del paso 2`);
}

test('J07: el reagendamiento masivo no deja una 3ª clase el día en que el alumno ya tiene una', async ({
  pageAs,
  cleanup,
}) => {
  const inst = await instructorSembrable();
  const dia = toChileDate(inst.libresProxSemana[0]);
  const { alumno } = await alumnoConFaltas('ReagTope', inst, inst.libresProxSemana[0], cleanup);

  const page = await pageAs('secretariaA');
  await abrirFicha(page, alumno.studentId);
  const paso2 = await abrirPaso2(page, inst);
  const celdas = await columnaDelDia(paso2, dia);
  const libre = paso2.locator('[data-llm-action="toggle-schedule-slot"]:not([disabled])');
  const libresDelDia = async () => {
    const out = [];
    for (const c of celdas) if (await c.and(libre).count()) out.push(c.and(libre));
    return out;
  };
  const antes = await libresDelDia();
  expect(antes.length, 'horarios libres ese día').toBeGreaterThanOrEqual(2);
  await antes[0].click();
  // Con la clase 3 ya ese día, al elegir una más el día llega al tope (máx. 2): solo queda
  // habilitada la elegida (para poder deseleccionarla), ninguna otra.
  await expect.poll(async () => (await libresDelDia()).length).toBe(1);
  await expect(paso2.getByText(/Clases seleccionadas/).locator('..')).toContainText(/\b1\b/);
});

test('J03 · J04 · J06 · J10: reagendar dos inasistencias pide la razón y deja el historial', async ({
  pageAs,
  cleanup,
}) => {
  const inst = await instructorSembrable();
  const { alumno, faltas } = await alumnoConFaltas(
    'ReagOk',
    inst,
    inst.libresProxSemana[5] ?? inst.libresProxSemana[0],
    cleanup,
  );
  const sb = await getAdminClient();

  const page = await pageAs('secretariaA');
  await abrirFicha(page, alumno.studentId);
  const paso2 = await abrirPaso2(page, inst);

  // Dos horarios en días distintos de la semana siguiente.
  const dias = [...new Set(inst.libresProxSemana.map((s) => toChileDate(s)))].slice(0, 2);
  const elegidos: string[] = [];
  for (const dia of dias) {
    const celdas = await columnaDelDia(paso2, dia);
    for (const c of celdas) {
      const boton = c.and(
        paso2.locator('[data-llm-action="toggle-schedule-slot"]:not([disabled])'),
      );
      if (await boton.count()) {
        elegidos.push(`${dia} ${(await boton.innerText()).trim()}`);
        await boton.click();
        break;
      }
    }
  }
  expect(elegidos).toHaveLength(2);

  const guardar = accion(paso2, 'submit-assignment');
  const error = page.locator('app-admin-reagendar-horarios-drawer p.text-error');
  // J03
  await guardar.click();
  await expect(error).toHaveText('Selecciona una razón para el reagendamiento.');
  // J04
  await elegirRazon(page, paso2, 'Otro');
  await guardar.click();
  await expect(error).toHaveText('Especifica el motivo cuando eliges "Otro".');
  // J06: con el detalle de "Otro" se guarda.
  await paso2
    .locator('[data-llm-description="Detalle del motivo cuando la razón es Otro"]')
    .fill('Prueba E2E fix-186-b');
  await guardar.click();
  await expect(toast(page, 'Clases reagendadas correctamente.')).toBeVisible(CARGA);

  const { data: sesiones } = await sb
    .from('class_b_sessions')
    .select('id, status, scheduled_at, instructor_id')
    .in('id', faltas);
  expect(sesiones!.map((s) => s.status)).toEqual(['scheduled', 'scheduled']);
  for (const s of sesiones!) {
    expect(s.instructor_id).toBe(inst.id);
    expect(new Date(s.scheduled_at).getTime()).toBeGreaterThan(Date.now());
  }
  const { data: historial } = await sb
    .from('class_b_reschedule_history')
    .select('class_session_id, old_scheduled_at, new_scheduled_at, reason')
    .in('class_session_id', faltas);
  expect(historial).toHaveLength(2);
  for (const h of historial!) {
    expect(h.old_scheduled_at).not.toBeNull();
    expect(h.reason).toBe('otro');
  }
  // J06 · J10 (fix-191-m): la asistencia "Ausente" queda archivada, no vigente; sin faltas
  // vigentes el par ya no puede volver a penalizar.
  const { data: asistencia } = await sb
    .from('class_b_practice_attendance')
    .select('archived_at')
    .in('class_b_session_id', faltas);
  expect(asistencia).toHaveLength(2);
  expect(asistencia!.every((a) => a.archived_at !== null)).toBe(true);
  // La ficha deja de ofrecer "Reagendar Clases".
  await page.reload();
  await expect(page.locator('[data-llm-info="matricula"]')).toBeVisible(CARGA);
  await expect(page.getByRole('button', { name: /Reagendar Clases/ })).toHaveCount(0);
});

// ── N · Reactivar horario ─────────────────────────────────────────────────────

test('N03: reactivar cuando otro alumno ya tomó uno de esos horarios', async ({
  pageAs,
  cleanup,
}) => {
  const dia = addDaysIso(chileToday(), 450 + Math.floor(Math.random() * 100));
  const base = { branchId: SEDE_A, label: 'ReactChoque' } as const;
  const falta1 = await seedClase(
    { ...base, cupo: { inst: 3, hora: 4 }, classNumber: 1, status: 'no_show', falta: 'vigente' },
    cleanup,
  );
  rastros.alumnos.push(falta1.alumno);
  const falta2 = await seedClase(
    {
      ...base,
      cupo: { inst: 3, hora: 5 },
      classNumber: 2,
      status: 'no_show',
      falta: 'vigente',
      de: falta1,
    },
    cleanup,
  );
  const futura3 = await seedClase(
    { ...base, cupo: { inst: 3, hora: 4 }, classNumber: 3, dia, de: falta1 },
    cleanup,
  );
  const futura4 = await seedClase(
    { ...base, cupo: { inst: 3, hora: 5 }, classNumber: 4, dia, de: falta1 },
    cleanup,
  );

  const page = await pageAs('secretariaA');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/secretaria/asistencia');
  const alerta = page
    .locator('main aside .list-item-hover')
    .filter({ hasText: falta1.alumno.paternalLastName });
  await accion(alerta, 'remove-schedule').click(CARGA);
  await accion(page, 'confirm-modal-accept').click();
  await expect(toast(page, 'Horario eliminado')).toBeVisible(CARGA);

  // Otro alumno toma el horario de la clase 3 con el mismo instructor.
  const otro = await seedClase(
    { ...base, label: 'ReactGana', cupo: { inst: 3, hora: 4 }, classNumber: 1, dia },
    cleanup,
  );
  rastros.alumnos.push(otro.alumno);
  // Las sembró seedClase (las borra el cleanup), no la app.
  rastros.sesiones.push(
    falta1.sessionId,
    falta2.sessionId,
    futura3.sessionId,
    futura4.sessionId,
    otro.sessionId,
  );

  await accion(alerta, 'reactivate-schedule').click();
  await accion(page, 'confirm-modal-accept').click();
  const aviso = toast(page, 'No se pudo reactivar el horario');
  await expect(aviso).toBeVisible(CARGA);
  const texto = await aviso.innerText();
  test.info().annotations.push({ type: 'mensaje N03', description: texto.replace(/\s+/g, ' ') });

  // Todo o nada: ninguna de las dos vuelve.
  const sb = await getAdminClient();
  const { data } = await sb
    .from('class_b_sessions')
    .select('id, status')
    .in('id', [futura3.sessionId, futura4.sessionId]);
  expect(data!.map((s) => s.status)).toEqual(['cancelled', 'cancelled']);
  // El checklist esperaba que el aviso dijera cuál choca: hoy es el mensaje genérico del trigger
  // ("El instructor ya tiene una clase agendada que se solapa…"), sin fecha ni número de clase.
  expect(texto).toContain('se solapa');
});
