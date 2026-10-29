/**
 * Agenda semanal — tercera tanda (ASG-i-026, fix-186-b): estados de clase en la grilla (B05, B07,
 * B10, E06), nombre largo (B09), tiempo real (G01, G02, con E05), la Agenda dentro del drawer del
 * dashboard (A07, E10), semanas pasadas (C12) y quién aparece en el filtro (D05). Los IDs son los
 * del checklist specs/testing-piloto/026-agenda-triple-match.md.
 *
 * Los tests con clases siembran un alumno E2E- y sus clases con el admin por API, y las borran al
 * terminar. Usan un instructor de la sede 1 distinto del de `agenda.spec.ts` (223), para no
 * chocar con los tests que inician clases de ese instructor.
 */
import type { Page } from '@playwright/test';
import { createE2eAlumno } from './support/alumnos-seed';
import { getAdminClient } from './support/supabase-admin';
import { expect, test, type Cleanup } from './support/fixtures';

// En orden en un solo worker: los tests comparten el instructor elegido.
test.describe.configure({ mode: 'default', timeout: 150_000 });

const CARGA = { timeout: 30_000 };
const FILTRO = '[data-llm-description="Filtrar calendario por instructor"]';
const AGENDA_INSTRUCTOR_223 = 223;
/** Bloques de 45 min de Clase B (indices/DATABASE.md, `courses.schedule_blocks`). */
const BLOQUES = ['08:30', '09:20', '10:10', '11:00', '11:50', '12:40', '15:00', '15:50', '16:40'];

const grid = (page: Page) => page.getByRole('grid');
const drawerDetalle = (page: Page) => page.locator('app-agenda-slot-detail-drawer');

async function abrirAgenda(page: Page, url = '/app/admin/agenda'): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(url);
  await expect(grid(page)).toBeVisible(CARGA);
}

async function elegirInstructor(page: Page, nombre: string): Promise<void> {
  await page.locator(FILTRO).click();
  await page.getByRole('option', { name: nombre, exact: true }).click();
  await expect(page.locator(FILTRO)).toContainText(nombre);
  await expect(grid(page)).toBeVisible(CARGA);
}

async function semana(page: Page, dir: 'next-week' | 'prev-week', veces = 1): Promise<void> {
  for (let i = 0; i < veces; i++) {
    await page.locator(`[data-llm-action="${dir}"]`).click();
    await expect(grid(page)).toBeVisible(CARGA);
  }
}

/** YYYY-MM-DD en hora Chile, desplazado `dias` desde el lunes de esta semana. */
function diaDeEstaSemana(dias: number): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  const d = new Date(`${hoy}T12:00:00Z`);
  const lunes = new Date(d);
  lunes.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + dias);
  return lunes.toISOString().slice(0, 10);
}

/** "HH:MM" en hora Chile de un instante. */
function horaChile(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

interface InstructorSembrable {
  id: number;
  vehicleId: number;
  nombre: string;
  /** Horarios libres (instantes ISO) de la semana siguiente, según la vista de disponibilidad. */
  libresProxSemana: string[];
}

let instructorCache: InstructorSembrable | null = null;

/** Un instructor activo de la sede 1 con vehículo, que no sea el 223, y 4+ horarios libres. */
async function instructorSembrable(): Promise<InstructorSembrable> {
  if (instructorCache) return instructorCache;
  const sb = await getAdminClient();
  const lunes = diaDeEstaSemana(7);
  const viernes = diaDeEstaSemana(11);
  // La vista no tiene sede: se eligen instructores de la sede 1 que no sean "ambas sedes".
  const { data: deSede1 } = await sb
    .from('instructors')
    .select('id, users!inner(branch_id)')
    .eq('users.branch_id', 1)
    .eq('both_branches', false)
    .neq('id', AGENDA_INSTRUCTOR_223);
  const ids = (deSede1 ?? []).map((r) => r.id as number);
  const { data: slots, error } = await sb
    .from('v_class_b_schedule_availability')
    .select('instructor_id, vehicle_id, slot_start')
    .eq('slot_status', 'available')
    .in('instructor_id', ids)
    .gte('slot_start', `${lunes}T00:00:00-03:00`)
    .lt('slot_start', `${viernes}T23:59:00-03:00`)
    .order('slot_start');
  if (error) throw new Error(`[e2e] Vista de disponibilidad: ${error.message}`);
  const porInstructor = new Map<number, { vehicleId: number; libres: string[] }>();
  for (const s of (slots ?? []) as {
    instructor_id: number;
    vehicle_id: number;
    slot_start: string;
  }[]) {
    const e = porInstructor.get(s.instructor_id) ?? { vehicleId: s.vehicle_id, libres: [] };
    e.libres.push(s.slot_start);
    porInstructor.set(s.instructor_id, e);
  }
  const elegido = [...porInstructor.entries()].find(([, e]) => e.libres.length >= 6);
  if (!elegido) throw new Error('[e2e] Ningún instructor de la sede 1 con horarios libres');
  const [id, { vehicleId, libres }] = elegido;
  const { data: inst } = await sb
    .from('instructors')
    .select('users!inner(first_names, paternal_last_name)')
    .eq('id', id)
    .single();
  const u = (inst as unknown as { users: { first_names: string; paternal_last_name: string } })
    .users;
  // No contiguos entre sí: la regla de clases por día no afecta a la vista.
  const espaciados = libres.filter((_, i) => i % 2 === 0);
  instructorCache = {
    id,
    vehicleId,
    nombre: `${u.first_names} ${u.paternal_last_name}`,
    libresProxSemana: espaciados,
  };
  return instructorCache;
}

/** Un horario de la semana pasada en que ni el instructor ni su vehículo tienen clase. */
async function horarioLibrePasado(inst: InstructorSembrable, indice = 0): Promise<string> {
  const sb = await getAdminClient();
  const dia = diaDeEstaSemana(-6); // martes de la semana pasada
  const { data } = await sb
    .from('class_b_sessions')
    .select('scheduled_at')
    .or(`instructor_id.eq.${inst.id},vehicle_id.eq.${inst.vehicleId}`)
    .gte('scheduled_at', `${dia}T00:00:00-03:00`)
    .lt('scheduled_at', `${dia}T23:59:00-03:00`);
  const ocupadas = new Set((data ?? []).map((r) => horaChile(r.scheduled_at)));
  const libres = BLOQUES.filter((b) => !ocupadas.has(b));
  if (libres.length <= indice) throw new Error(`[e2e] Sin horarios libres el ${dia}`);
  return `${dia}T${libres[indice]}:00-03:00`;
}

async function sembrarClase(
  enrollmentId: number,
  inst: InstructorSembrable,
  fila: Record<string, unknown>,
  cleanup: Cleanup,
): Promise<number> {
  const sb = await getAdminClient();
  const { data, error } = await sb
    .from('class_b_sessions')
    .insert({
      ...fila,
      enrollment_id: enrollmentId,
      instructor_id: inst.id,
      vehicle_id: inst.vehicleId,
    })
    .select('id')
    .single();
  if (error) throw new Error(`[e2e] No se pudo sembrar la clase: ${error.message}`);
  cleanup.track('class_b_sessions', data.id);
  return data.id;
}

const clasesDe = (page: Page, alumno: string) =>
  grid(page).locator(`app-agenda-slot[aria-label^="${alumno},"]`);

test('B05/B07/B09/B10/E06: estados en la grilla, cancelada fuera, hora Chile y nombre largo', async ({
  pageAs,
  cleanup,
}) => {
  const inst = await instructorSembrable();
  const alumno = await createE2eAlumno(
    {
      label: 'AgendaEstados',
      branchId: 1,
      paternalLastName: 'Apellidolarguisimo-Compuesto-DeVerdadMuyLargo',
      enrollments: [{}],
    },
    cleanup,
  );
  const nombre = `${alumno.firstNames} ${alumno.paternalLastName}`;
  const enr = alumno.enrollmentIds[0];
  const [agendada, , cancelada] = inst.libresProxSemana;
  const pasada = await horarioLibrePasado(inst);

  await sembrarClase(
    enr,
    inst,
    { scheduled_at: agendada, status: 'scheduled', class_number: 1 },
    cleanup,
  );
  await sembrarClase(
    enr,
    inst,
    { scheduled_at: cancelada, status: 'cancelled', class_number: 2 },
    cleanup,
  );
  await sembrarClase(
    enr,
    inst,
    { scheduled_at: pasada, status: 'no_show', class_number: 3 },
    cleanup,
  );

  const page = await pageAs('admin');
  await abrirAgenda(page);
  await elegirInstructor(page, inst.nombre);

  // Semana siguiente: solo la agendada (B07), en la fila de su hora Chile (B10).
  await semana(page, 'next-week');
  const prox = clasesDe(page, nombre);
  await expect(prox).toHaveCount(1, CARGA);
  await expect(prox).toHaveAttribute(
    'aria-label',
    new RegExp(`^${nombre}, ${horaChile(agendada)} `),
  );
  await expect(prox.locator('.slot-block')).toHaveClass(/slot-block--scheduled/);
  // B07: el horario de la cancelada vuelve a ofrecerse.
  await expect(
    grid(page).locator(`app-agenda-slot[aria-label^="Slot disponible ${horaChile(cancelada)} "]`),
  ).not.toHaveCount(0);

  // B09: el nombre largo no desborda su celda.
  const desborde = await prox.evaluate((el) => {
    const celda = el.closest('[role="gridcell"]') ?? el.parentElement!;
    return el.getBoundingClientRect().right - celda.getBoundingClientRect().right;
  });
  expect(desborde).toBeLessThanOrEqual(1);

  // Semana pasada: "No asistió" tachado y apagado (B05/E06).
  await semana(page, 'prev-week', 2);
  const falta = clasesDe(page, nombre);
  await expect(falta).toHaveCount(1, CARGA);
  await expect(falta.locator('.slot-block')).toHaveClass(/slot-block--no_show/);
  await expect(falta.locator('.slot-student')).toHaveCSS('text-decoration-line', 'line-through');
  await falta.click();
  await expect(drawerDetalle(page).locator('.status-pill')).toHaveText(/No asisti/);
});

test('G01/G02/E05: con la Agenda abierta, una clase nueva aparece y cambia de estado sin recargar', async ({
  pageAs,
  cleanup,
}) => {
  const inst = await instructorSembrable();
  const alumno = await createE2eAlumno(
    { label: 'AgendaRealtime', branchId: 1, enrollments: [{}] },
    cleanup,
  );
  const nombre = `${alumno.firstNames} ${alumno.paternalLastName}`;
  const horario = inst.libresProxSemana[2];

  const page = await pageAs('secretariaA');
  await abrirAgenda(page, '/app/secretaria/agenda');
  await elegirInstructor(page, inst.nombre);
  await semana(page, 'next-week');
  await expect(clasesDe(page, nombre)).toHaveCount(0);

  // G01: "otra sesión" agenda una clase (por API, como la matrícula de otra secretaria).
  const id = await sembrarClase(
    alumno.enrollmentIds[0],
    inst,
    { scheduled_at: horario, status: 'scheduled', class_number: 1 },
    cleanup,
  );
  const clase = clasesDe(page, nombre);
  await expect(clase).toHaveCount(1, CARGA);

  // G02: se inicia y se cierra en "otra sesión". El KM es el actual del vehículo: cerrar la clase
  // sube `vehicles.current_km` si el km final es mayor (fix-222-b), y eso no se puede deshacer
  // sin saber el valor anterior.
  const sb = await getAdminClient();
  const desde = new Date().toISOString();
  const { data: vehiculo } = await sb
    .from('vehicles')
    .select('current_km')
    .eq('id', inst.vehicleId)
    .single();
  const km = Number(vehiculo?.current_km ?? 0);
  const iniciar = await sb
    .from('class_b_sessions')
    .update({ status: 'in_progress', km_start: km, start_time: '10:00:00' })
    .eq('id', id);
  expect(iniciar.error?.message).toBeUndefined();
  await expect(clase.locator('.slot-block')).toHaveClass(/slot-block--in_progress/, CARGA);

  // E05: el detalle de una clase en curso, ¿muestra el KM inicial? (anotar)
  await clase.click();
  await expect(drawerDetalle(page).locator('.status-pill')).toHaveText(/En (curso|progreso)/);
  const muestraKm = await drawerDetalle(page).getByText(`${km} km`).isVisible();
  test.info().annotations.push({
    type: 'E05 KM inicial en clase en curso',
    description: muestraKm ? 'se muestra' : 'no se muestra',
  });
  await page.getByRole('button', { name: 'Cerrar detalle' }).click();

  const cerrar = await sb
    .from('class_b_sessions')
    .update({
      status: 'completed',
      km_end: km,
      end_time: '10:45:00',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id);
  expect(cerrar.error?.message).toBeUndefined();
  await expect(clase.locator('.slot-block')).toHaveClass(/slot-block--completed/, CARGA);

  // Cerrar la clase le avisa al alumno: sin borrar el aviso, el alumno E2E- no se puede borrar.
  const { data: avisos } = await sb
    .from('notifications')
    .select('id')
    .eq('recipient_id', alumno.userId)
    .gte('created_at', desde);
  for (const n of avisos ?? []) cleanup.track('notifications', n.id);
});

test('A07/E10: la Agenda abre en el drawer del dashboard; el detalle se apila y "Volver" regresa', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/app/secretaria/dashboard');
  await page.locator('[data-llm-action="qa2"]').first().click();
  const drawer = page.locator('app-layout-drawer');
  await expect(drawer.getByRole('grid')).toBeVisible(CARGA);

  await drawer.locator('app-agenda-slot[role="button"]').first().click();
  await expect(drawerDetalle(page)).toBeVisible(CARGA);
  await page.locator('[data-llm-action="drawer-back"]').click();
  await expect(drawer.getByRole('grid')).toBeVisible(CARGA);
  await expect(drawerDetalle(page)).toHaveCount(0);
});

test('C12: retroceder muchas semanas no tiene tope y las pasadas no ofrecen "Disponible"', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirAgenda(page);
  await elegirInstructor(page, (await instructorSembrable()).nombre);
  await semana(page, 'prev-week', 8);
  await expect(page.locator('[data-llm-action="prev-week"]')).toBeEnabled();
  await expect(grid(page).locator('app-agenda-slot[aria-label^="Slot disponible"]')).toHaveCount(0);
});

test('D05: el filtro de la Agenda (admin, todas las sedes) no ofrece instructores teóricos', async ({
  pageAs,
}) => {
  const sb = await getAdminClient();
  const { data, error } = await sb
    .from('instructors')
    .select('id, type, users!inner(first_names, paternal_last_name)')
    .eq('type', 'theory');
  expect(error?.message).toBeUndefined();
  const teoricos = (data ?? []).map((r) => {
    const u = r.users as unknown as { first_names: string; paternal_last_name: string };
    return `${u.first_names} ${u.paternal_last_name}`;
  });

  const page = await pageAs('admin');
  await abrirAgenda(page);
  await page.locator(FILTRO).click();
  const opciones = (await page.getByRole('option').allInnerTexts()).map((o) => o.trim());
  await page.keyboard.press('Escape');
  for (const t of teoricos) expect(opciones).not.toContain(t);
  test.info().annotations.push({
    type: 'D05',
    description: `${teoricos.length} instructores teóricos en la BD, ninguno en el filtro (${opciones.length} opciones)`,
  });
});
