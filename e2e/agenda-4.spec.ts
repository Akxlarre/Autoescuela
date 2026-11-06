/**
 * Agenda semanal — cuarta tanda (ASG-i-026, fix-186-b), grupo 1 que seguía abierto: semana sin
 * clases (B03), "Ir a fecha" (C09, C10), días fuera del límite (E07), aviso del botón "siguiente"
 * bloqueado (P07), cambio de sede (F02, F06, F07) y cierre del canal de tiempo real (G06). Los IDs
 * son los del checklist specs/testing-piloto/026-agenda-triple-match.md.
 *
 * Solo lectura: no siembra ni modifica datos (la BD del piloto es producción).
 */
import type { Page, WebSocket } from '@playwright/test';
import { createE2eAlumno } from './support/alumnos-seed';
import {
  diaDelMesChile,
  horaChile,
  instructorSembrable,
  sembrarClase,
} from './support/agenda-seed';
import { expect, test } from './support/fixtures';
import { getAdminClient } from './support/supabase-admin';

test.describe.configure({ mode: 'default', timeout: 150_000 });

const CARGA = { timeout: 30_000 };
const FILTRO = '[data-llm-description="Filtrar calendario por instructor"]';
const VISIBILITY_KEY = 'app-agenda-visibility-months';
const SEDE_A = 'Autoescuela Chillán';
const SEDE_B = 'Conductores Chillán';
const SEDE1_INSTRUCTOR = 'Instructor1 Apellido1';
const SEDE2_INSTRUCTOR = 'Instructor9 Apellido9';

const grid = (page: Page) => page.getByRole('grid');
const weekLabel = (page: Page) => page.locator('.agenda-week-label');
const next = (page: Page) => page.locator('[data-llm-action="next-week"]');

async function abrirAgenda(page: Page, url: string): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(url);
  await expect(grid(page)).toBeVisible(CARGA);
}

/** Avanza hasta la última semana navegable; devuelve cuántas semanas avanzó. */
async function irAlLimite(page: Page): Promise<number> {
  let semanas = 0;
  while (!(await next(page).isDisabled()) && semanas < 30) {
    const antes = await weekLabel(page).innerText();
    await next(page).click();
    await expect(weekLabel(page)).not.toHaveText(antes, CARGA);
    await expect(grid(page)).toBeVisible(CARGA);
    semanas++;
  }
  return semanas;
}

/** Abre el selector "Ir a fecha" y devuelve su panel. */
async function abrirIrAFecha(page: Page) {
  await page
    .locator('.agenda-jump-date button, .agenda-jump-date .p-datepicker-dropdown')
    .first()
    .click();
  const panel = page
    .locator('.p-datepicker-panel, .p-datepicker')
    .filter({ visible: true })
    .first();
  await expect(panel).toBeVisible();
  return panel;
}

/** Lleva el panel del selector al mes pedido ("febrero 2027"). */
async function irAMes(
  panel: ReturnType<Page['locator']>,
  mesAnio: RegExp,
  hacia: 'next' | 'prev',
): Promise<void> {
  for (let i = 0; i < 12; i++) {
    if (mesAnio.test(await panel.locator('.p-datepicker-title').innerText())) return;
    await panel.locator(`.p-datepicker-${hacia}-button, .p-datepicker-${hacia}`).first().click();
  }
  throw new Error(`El selector no llegó a ${mesAnio}`);
}

/** Días del mes visible en el selector, con si están bloqueados. */
async function diasDelMes(panel: ReturnType<Page['locator']>) {
  return panel.locator('td:not(.p-datepicker-other-month) span').evaluateAll((spans) =>
    spans.map((s) => ({
      dia: Number(s.textContent?.trim()),
      bloqueado: s.classList.contains('p-disabled') || s.getAttribute('aria-disabled') === 'true',
    })),
  );
}

/** Día del mes (número) y mes en español de una fecha YYYY-MM-DD. */
function partes(iso: string): { dia: number; mes: RegExp } {
  const [y, m, d] = iso.split('-').map(Number);
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  return { dia: d, mes: new RegExp(`${meses[m - 1]}\\s+${y}`, 'i') };
}

/** Fecha límite (YYYY-MM-DD) que muestra "Mostrando horarios hasta el …". */
async function fechaLimite(page: Page): Promise<string> {
  const texto = await page.locator('.agenda-visibility-hint').innerText();
  const m = texto.match(/hasta el (\d{1,2}) de (\w+),? (\d{4})/i);
  if (!m) throw new Error(`No se pudo leer el límite: "${texto}"`);
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const mes = meses.indexOf(m[2].toLowerCase()) + 1;
  return `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

async function opcionesInstructor(page: Page): Promise<string[]> {
  await page.locator(FILTRO).click();
  // Esperar a que el desplegable termine de abrir: leído en la animación, sale vacío.
  await expect(page.getByRole('option').first()).toBeVisible(CARGA);
  const opciones = await page.getByRole('option').allInnerTexts();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('option')).toHaveCount(0);
  return opciones.map((o) => o.trim());
}

async function elegirSede(page: Page, nombre: string): Promise<void> {
  const boton = page.locator('header button[aria-label^="Sede activa"]');
  if ((await boton.getAttribute('aria-expanded')) !== 'true') await boton.click();
  await page.getByRole('option', { name: nombre, exact: true }).click();
}

/** Marca la ventana para detectar si la página se recargó entera. */
async function marcarVentana(page: Page): Promise<void> {
  await page.evaluate(() => ((window as unknown as { __e2eMarca: boolean }).__e2eMarca = true));
}
const sigueLaMismaVentana = (page: Page) =>
  page.evaluate(() => (window as unknown as { __e2eMarca?: boolean }).__e2eMarca === true);

async function elegirInstructor(page: Page, nombre: string): Promise<void> {
  await page.locator(FILTRO).click();
  await page.getByRole('option', { name: nombre, exact: true }).click();
  await expect(page.locator(FILTRO)).toContainText(nombre);
  await expect(grid(page)).toBeVisible(CARGA);
}

/** La celda de la grilla (vista filtrada por instructor) del día y la hora de un instante. */
const celda = (page: Page, instante: string) =>
  grid(page).locator(
    `[role="gridcell"][aria-label*=" ${diaDelMesChile(instante)} "][aria-label$=" ${horaChile(instante)}"]`,
  );

const clasesDe = (page: Page, alumno: string) =>
  grid(page).locator(`app-agenda-slot[aria-label^="${alumno},"]`);

// ── B. Grilla ─────────────────────────────────────────────────────────────────────────────

test('B03: una semana sin clases muestra la grilla completa, no un estado vacío', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  await abrirAgenda(page, '/app/secretaria/agenda');
  // Las semanas siguientes del piloto no tienen clases ocupadas (consulta del 2026-11-06); se
  // busca una entre las próximas 4 para no depender de una fecha fija.
  let ocupadas = -1;
  for (let i = 0; i < 4; i++) {
    await next(page).click();
    await expect(grid(page)).toBeVisible(CARGA);
    ocupadas = await page.locator('[data-llm-action="view-slot-detail"]').count();
    if (ocupadas === 0) break;
  }
  test.skip(ocupadas !== 0, 'Ninguna de las próximas 4 semanas está sin clases');

  await expect(page.getByText('No hay clases en esta semana')).toHaveCount(0);
  const filas = await page.locator('[role="rowheader"], .agenda-time-label').count();
  expect(filas, 'una fila por bloque horario').toBeGreaterThanOrEqual(9);
  const libres = await page.locator('[data-llm-action="view-available-slot"]').count();
  expect(libres, 'la grilla de una semana sin clases ofrece horarios libres').toBeGreaterThan(0);
});

test('B08: el horario de una clase de matrícula en curso no se ofrece como libre', async ({
  pageAs,
  cleanup,
}) => {
  // S14: una clase "reserved" de un borrador de matrícula bloquea el horario, pero la Agenda no
  // la dibuja. Lo que importa es que no se ofrezca "Disponible"; qué se ve en su lugar se anota.
  const inst = await instructorSembrable();
  const alumno = await createE2eAlumno(
    { label: 'AgendaReserva', branchId: 1, enrollments: [{ status: 'draft' }] },
    cleanup,
  );
  const nombre = `${alumno.firstNames} ${alumno.paternalLastName}`;
  const horario = inst.libresProxSemana[1];

  const page = await pageAs('secretariaA');
  await abrirAgenda(page, '/app/secretaria/agenda');
  await elegirInstructor(page, inst.nombre);
  await next(page).click();
  await expect(grid(page)).toBeVisible(CARGA);
  const libre = celda(page, horario).locator('[data-llm-action="view-available-slot"]');
  await expect(libre).toHaveCount(1, CARGA);

  await sembrarClase(
    alumno.enrollmentIds[0],
    inst,
    { scheduled_at: horario, status: 'reserved', class_number: 1 },
    cleanup,
  );
  await expect(libre, 'deja de ofrecerse como libre').toHaveCount(0, CARGA);

  const ocupados = await celda(page, horario).locator('app-agenda-slot').count();
  test.info().annotations.push({
    type: 'B08 qué se ve',
    description:
      ocupados === 0
        ? 'celda vacía: ni libre ni la clase (S14 sigue igual)'
        : `${ocupados} slot(s), ${await clasesDe(page, nombre).count()} con el nombre del alumno`,
  });
});

test('B12/P07: un vehículo con un documento vencido marca sus horarios con un aviso', async ({
  pageAs,
}) => {
  // Datos reales del piloto (2026-11-06): Instructor9 (sede 2) usa el RTRE29, con el SOAP vencido
  // desde el 2025-05-06. Si se renueva, el test se salta en vez de fallar.
  const page = await pageAs('admin');
  await abrirAgenda(page, '/app/admin/agenda');
  await elegirSede(page, SEDE_B);
  await expect.poll(() => opcionesInstructor(page), CARGA).toContain(SEDE2_INSTRUCTOR);
  await elegirInstructor(page, SEDE2_INSTRUCTOR);
  await next(page).click();
  await expect(grid(page)).toBeVisible(CARGA);

  const avisos = grid(page).locator('[data-llm-description*="vencido"]');
  await page.waitForTimeout(1_500);
  test.skip(
    (await avisos.count()) === 0,
    'El vehículo de Instructor9 ya no tiene documentos vencidos',
  );
  const texto = (await avisos.first().getAttribute('data-llm-description')) ?? '';
  test.info().annotations.push({ type: 'B12 aviso', description: texto });
  expect(texto).toMatch(/RTRE29/);
});

// ── D. Datos ──────────────────────────────────────────────────────────────────────────────

test('D08: una sede sin instructores muestra un estado vacío coherente, sin errores', async ({
  pageAs,
}) => {
  // Sin crear una sede en producción: se responde vacío a lo que una sede sin instructores
  // devolvería (instructores, disponibilidad y clases).
  const page = await pageAs('secretariaA');
  const errores: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  const vacio = (route: Parameters<Parameters<Page['route']>[1]>[0]) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '*/0' },
      body: '[]',
    });
  for (const tabla of ['instructors', 'v_class_b_schedule_availability', 'class_b_sessions']) {
    await page.route(`**/rest/v1/${tabla}?*`, vacio);
  }

  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/app/secretaria/agenda');
  // Los horarios salen de los cursos, no de los instructores: se ve la grilla, con las celdas
  // vacías ("No hay clases en esta semana" queda para cuando no hay horarios, ver B03).
  await expect(grid(page)).toBeVisible(CARGA);
  await expect(page.getByText('No se pudo cargar la agenda')).toHaveCount(0);
  await expect(page.locator('app-agenda-slot')).toHaveCount(0);

  await next(page).click();
  await expect(grid(page)).toBeVisible(CARGA);
  await expect(page.locator('app-agenda-slot')).toHaveCount(0);

  await page.locator(FILTRO).click();
  await page.waitForTimeout(500);
  const opciones = (await page.getByRole('option').allInnerTexts()).map((o) => o.trim());
  await page.keyboard.press('Escape');
  test.info().annotations.push({
    type: 'D08 filtro',
    description: opciones.length ? opciones.join(' | ') : '(sin opciones)',
  });
  expect(opciones.filter((o) => /Instructor\d/.test(o))).toHaveLength(0);
  expect(errores, 'consola sin errores').toEqual([]);
});

// ── C. "Ir a fecha" ───────────────────────────────────────────────────────────────────────

test('C09: "Ir a fecha" con un día de otra semana salta a esa semana', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await abrirAgenda(page, '/app/admin/agenda');
  const actual = await weekLabel(page).innerText();

  const panel = await abrirIrAFecha(page);
  // Un día libre 10+ días adelante: siempre está en otra semana.
  const dias = await diasDelMes(panel);
  const hoy = await panel.locator('.p-datepicker-today span, [data-p-today="true"] span').first();
  const diaHoy = Number((await hoy.innerText()).trim());
  let destino = dias.find((d) => !d.bloqueado && d.dia >= diaHoy + 10);
  if (!destino) {
    await panel.locator('.p-datepicker-next-button, .p-datepicker-next').first().click();
    destino = (await diasDelMes(panel)).find((d) => !d.bloqueado && d.dia >= 10);
  }
  expect(destino, 'un día elegible en otra semana').toBeDefined();
  await panel
    .locator('td:not(.p-datepicker-other-month) span')
    .getByText(String(destino!.dia), { exact: true })
    .click();

  await expect(weekLabel(page)).not.toHaveText(actual, CARGA);
  const etiqueta = await weekLabel(page).innerText();
  // "16 nov – 20 nov": el día elegido cae dentro del rango de la semana mostrada (si es fin de
  // semana, la semana es la de ese lunes; lo anotamos sin exigirlo).
  const [desde, hasta] = etiqueta.split('–').map((p) => Number(p.trim().split(' ')[0]));
  test
    .info()
    .annotations.push({ type: 'C09 semana', description: `${destino!.dia} → ${etiqueta}` });
  const enRango =
    desde <= hasta
      ? destino!.dia >= desde && destino!.dia <= hasta + 2
      : destino!.dia >= desde || destino!.dia <= hasta + 2;
  expect(enRango, `el ${destino!.dia} cae en la semana "${etiqueta}"`).toBe(true);
});

test('C10: "Ir a fecha" no deja elegir días antes de hoy ni después del límite', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirAgenda(page, '/app/admin/agenda');
  const limite = await fechaLimite(page);

  const panel = await abrirIrAFecha(page);
  const diaHoy = Number(
    (
      await panel
        .locator('.p-datepicker-today span, [data-p-today="true"] span')
        .first()
        .innerText()
    ).trim(),
  );
  const esteMes = await diasDelMes(panel);
  expect(
    esteMes.filter((d) => d.dia < diaHoy).every((d) => d.bloqueado),
    'antes de hoy',
  ).toBe(true);
  expect(esteMes.find((d) => d.dia === diaHoy)?.bloqueado, 'hoy se puede elegir').toBe(false);

  const { dia, mes } = partes(limite);
  await irAMes(panel, mes, 'next');
  const mesLimite = await diasDelMes(panel);
  expect(mesLimite.find((d) => d.dia === dia)?.bloqueado, `el límite (${limite}) se puede`).toBe(
    false,
  );
  expect(
    mesLimite.filter((d) => d.dia > dia).every((d) => d.bloqueado),
    `después del ${limite} está bloqueado`,
  ).toBe(true);
});

// ── E. Detalle ────────────────────────────────────────────────────────────────────────────

test('E07: los horarios de un día fuera del límite no abren el detalle', async ({ pageAs }) => {
  const page = await pageAs('secretariaA');
  // Con 2 meses el límite cae a mitad de semana (con 3 meses, el 2026-11-06, caía un sábado).
  await page.addInitScript(([key]) => localStorage.setItem(key, '2'), [VISIBILITY_KEY] as const);
  await abrirAgenda(page, '/app/secretaria/agenda');
  await irAlLimite(page);

  const bloqueados = page.locator('.agenda-cell--beyond-limit app-agenda-slot');
  test.skip(
    (await bloqueados.count()) === 0,
    'El límite cae en fin de semana: la última semana no tiene días bloqueados',
  );
  await expect(page.locator('.agenda-day-header--disabled').first()).toBeVisible();
  await expect(bloqueados.first().locator('.slot-block')).toHaveClass(/slot-block--disabled/);

  await bloqueados.first().click({ force: true });
  await page.waitForTimeout(1_000);
  await expect(page.locator('app-agenda-slot-detail-drawer')).toHaveCount(0);

  // Control: un horario dentro del límite sí abre el detalle.
  await page
    .locator('app-agenda-slot')
    .filter({ has: page.locator('.slot-block--available:not(.slot-block--disabled)') })
    .first()
    .click();
  await expect(page.locator('app-agenda-slot-detail-drawer')).toBeVisible(CARGA);
});

// ── P. Pulido ─────────────────────────────────────────────────────────────────────────────

test('P07: el botón "siguiente" bloqueado explica por qué', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await abrirAgenda(page, '/app/admin/agenda');
  await irAlLimite(page);
  await expect(next(page)).toBeDisabled();
  await expect(next(page)).toHaveAttribute('aria-disabled', 'true');

  // Un botón deshabilitado no recibe eventos del mouse: el tooltip se ve al pasar por su borde.
  await next(page).locator('xpath=..').hover();
  await next(page).hover({ force: true });
  const tooltip = page.locator('.p-tooltip').filter({ visible: true });
  await expect(tooltip).toBeVisible({ timeout: 5_000 });
  test.info().annotations.push({ type: 'P07 tooltip', description: await tooltip.innerText() });
  await expect(tooltip).not.toBeEmpty();
});

// ── F. Sedes ──────────────────────────────────────────────────────────────────────────────

test('F02: el admin cambia de sede y la Agenda recarga sola con los instructores de esa sede', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirAgenda(page, '/app/admin/agenda');
  await marcarVentana(page);

  await elegirSede(page, SEDE_A);
  await expect(grid(page)).toBeVisible(CARGA);
  await expect.poll(() => opcionesInstructor(page), CARGA).toContain(SEDE1_INSTRUCTOR);
  expect(await opcionesInstructor(page)).not.toContain(SEDE2_INSTRUCTOR);

  await elegirSede(page, SEDE_B);
  await expect(grid(page)).toBeVisible(CARGA);
  await expect.poll(() => opcionesInstructor(page), CARGA).toContain(SEDE2_INSTRUCTOR);
  expect(await opcionesInstructor(page)).not.toContain(SEDE1_INSTRUCTOR);
  await expect(page.locator(FILTRO)).not.toContainText(SEDE1_INSTRUCTOR);

  expect(await sigueLaMismaVentana(page), 'sin recargar la página').toBe(true);
  await expect(page).toHaveURL(/\/app\/admin\/agenda/);
});

test('F06: la secretaria con acceso a las dos sedes cambia de sede sin salir de la Agenda', async ({
  pageAs,
}) => {
  // S16, corregido en hotfix-171-b: antes la Agenda de secretaria cargaba una sola vez (ngOnInit) y
  // elegir otra sede dejaba los instructores de la anterior.
  const page = await pageAs('secretariaMultisede');
  await abrirAgenda(page, '/app/secretaria/agenda');
  await marcarVentana(page);

  await elegirSede(page, SEDE_B);
  await expect(grid(page)).toBeVisible(CARGA);
  await expect.poll(() => opcionesInstructor(page), CARGA).toContain(SEDE2_INSTRUCTOR);
  expect(await opcionesInstructor(page)).not.toContain(SEDE1_INSTRUCTOR);

  await elegirSede(page, SEDE_A);
  await expect.poll(() => opcionesInstructor(page), CARGA).toContain(SEDE1_INSTRUCTOR);
  expect(await opcionesInstructor(page)).not.toContain(SEDE2_INSTRUCTOR);

  expect(await sigueLaMismaVentana(page), 'sin recargar la página').toBe(true);
  await expect(page).toHaveURL(/\/app\/secretaria\/agenda/);
});

test('F07: cambiar de sede A→B→A rápido con red lenta termina en A sin mezclar', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirAgenda(page, '/app/admin/agenda');
  await elegirSede(page, SEDE_A);
  await expect.poll(() => opcionesInstructor(page), CARGA).toContain(SEDE1_INSTRUCTOR);

  await page.route('**/rest/v1/**', async (route) => {
    await new Promise((r) => setTimeout(r, 1_500));
    return route.continue();
  });
  await elegirSede(page, SEDE_B);
  await elegirSede(page, SEDE_A);
  await page.waitForTimeout(8_000);
  await page.unroute('**/rest/v1/**');
  await expect(grid(page)).toBeVisible(CARGA);

  const opciones = await opcionesInstructor(page);
  expect(opciones).toContain(SEDE1_INSTRUCTOR);
  expect(opciones, 'no quedan instructores de la sede B').not.toContain(SEDE2_INSTRUCTOR);
  await expect(page.locator(FILTRO)).not.toContainText(SEDE2_INSTRUCTOR);
});

test('F08/F03: un instructor "ambas sedes" aparece en las dos; sin vehículo de la otra, sin horarios', async ({
  pageAs,
}) => {
  // Marca temporalmente un instructor (y después su vehículo) como "ambas sedes" y los restaura
  // al terminar, pase lo que pase: la BD del piloto es producción.
  const inst = await instructorSembrable();
  const sb = await getAdminClient();
  const { data: antesInst } = await sb
    .from('instructors')
    .select('both_branches')
    .eq('id', inst.id)
    .single();
  const { data: antesVeh } = await sb
    .from('vehicles')
    .select('both_branches')
    .eq('id', inst.vehicleId)
    .single();
  expect(antesInst?.both_branches, 'el instructor elegido es de una sola sede').toBe(false);

  const libresDeLaSemanaSiguiente = async (page: Page): Promise<number> => {
    await elegirInstructor(page, inst.nombre);
    await next(page).click();
    await expect(grid(page)).toBeVisible(CARGA);
    await page.waitForTimeout(1_500);
    return page.locator('[data-llm-action="view-available-slot"]').count();
  };

  try {
    // F08: instructor "ambas sedes", vehículo solo de la sede 1, mirado desde la sede 2.
    const marcar = await sb.from('instructors').update({ both_branches: true }).eq('id', inst.id);
    expect(marcar.error?.message).toBeUndefined();

    const admin = await pageAs('admin');
    await abrirAgenda(admin, '/app/admin/agenda');
    await elegirSede(admin, SEDE_B);
    await expect.poll(() => opcionesInstructor(admin), CARGA).toContain(inst.nombre);
    const libresF08 = await libresDeLaSemanaSiguiente(admin);
    test.info().annotations.push({
      type: 'F08 sede 2, vehículo de la sede 1',
      description: `${libresF08} horarios "Disponible" la semana siguiente`,
    });

    // F03: con el vehículo también "ambas sedes", aparece en las dos con horarios.
    const marcarVeh = await sb
      .from('vehicles')
      .update({ both_branches: true })
      .eq('id', inst.vehicleId);
    expect(marcarVeh.error?.message).toBeUndefined();

    await admin.reload();
    await expect(grid(admin)).toBeVisible(CARGA);
    for (const sede of [SEDE_A, SEDE_B]) {
      await elegirSede(admin, sede);
      await expect.poll(() => opcionesInstructor(admin), CARGA).toContain(inst.nombre);
      const libres = await libresDeLaSemanaSiguiente(admin);
      test.info().annotations.push({
        type: `F03 admin en ${sede}`,
        description: `${libres} horarios "Disponible" la semana siguiente`,
      });
      expect(libres, `con horarios en ${sede}`).toBeGreaterThan(0);
    }

    const secB = await pageAs('secretariaB');
    await abrirAgenda(secB, '/app/secretaria/agenda');
    await expect.poll(() => opcionesInstructor(secB), CARGA).toContain(inst.nombre);
  } finally {
    await sb
      .from('vehicles')
      .update({ both_branches: antesVeh?.both_branches ?? false })
      .eq('id', inst.vehicleId);
    await sb
      .from('instructors')
      .update({ both_branches: antesInst?.both_branches ?? false })
      .eq('id', inst.id);
  }
});

// ── G. Tiempo real ────────────────────────────────────────────────────────────────────────

test('G06: al salir de la Agenda se cierra su canal de tiempo real', async ({ pageAs }) => {
  const page = await pageAs('admin');
  const enviados: string[] = [];
  page.on('websocket', (ws: WebSocket) => {
    if (!ws.url().includes('/realtime/')) return;
    ws.on('framesent', (f) => {
      if (typeof f.payload === 'string') enviados.push(f.payload);
    });
  });

  await abrirAgenda(page, '/app/admin/agenda');
  const de = (evento: string) => () =>
    enviados.filter((p) => p.includes('agenda-sessions') && p.includes(evento)).length;
  const joins = de('phx_join');
  const leaves = de('phx_leave');
  // En la Agenda: el canal queda abierto (más entradas que salidas). La primera carga entra,
  // sale y vuelve a entrar (ensureRealtime + subscribeRealtime en initialize): se anota.
  await expect.poll(() => joins() - leaves(), CARGA).toBe(1);
  test.info().annotations.push({
    type: 'G06 en la Agenda',
    description: `${joins()} phx_join, ${leaves()} phx_leave`,
  });

  await page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/admin\/dashboard/, CARGA);
  // Al salir: cada entrada tiene su salida, el canal ya no está abierto.
  await expect.poll(() => joins() - leaves(), CARGA).toBe(0);
});

test('G07: cerrar la Agenda del drawer no deja sin tiempo real a la Agenda de la página', async ({
  pageAs,
  cleanup,
}) => {
  // El drawer se cierra al navegar, así que en una pestaña las dos Agendas nunca están abiertas a
  // la vez. Lo que sí pasa: comparten el AgendaFacade, y cerrar el drawer llama a dispose(). Se
  // comprueba que la página, abierta después, vuelve a suscribirse.
  const inst = await instructorSembrable();
  const alumno = await createE2eAlumno(
    { label: 'AgendaDrawer', branchId: 1, enrollments: [{}] },
    cleanup,
  );
  const nombre = `${alumno.firstNames} ${alumno.paternalLastName}`;

  const page = await pageAs('secretariaA');
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/app/secretaria/dashboard');
  await page.locator('[data-llm-action="qa2"]').first().click();
  const drawer = page.locator('app-layout-drawer');
  await expect(drawer.getByRole('grid')).toBeVisible(CARGA);
  await drawer.getByRole('button', { name: 'Cerrar panel' }).click();
  await expect(drawer.getByRole('grid')).toHaveCount(0, CARGA);

  await page.getByRole('navigation').getByRole('link', { name: 'Agenda', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/secretaria\/agenda/, CARGA);
  await expect(grid(page)).toBeVisible(CARGA);
  await elegirInstructor(page, inst.nombre);
  await next(page).click();
  await expect(grid(page)).toBeVisible(CARGA);
  await expect(clasesDe(page, nombre)).toHaveCount(0);

  await sembrarClase(
    alumno.enrollmentIds[0],
    inst,
    { scheduled_at: inst.libresProxSemana[3], status: 'scheduled', class_number: 1 },
    cleanup,
  );
  await expect(clasesDe(page, nombre), 'llega sin recargar').toHaveCount(1, CARGA);
});
