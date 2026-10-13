/**
 * Asistencia Clase B (fix-366-m, ASG-i-027) — casos "Auto ✓" del checklist
 * specs/testing-piloto/027-asistencia-clase-b.md, más la regresión de los fixes 385 a 391.
 *
 * Cada test siembra sus alumnos E2E- con clases de AYER (ver e2e/support/asistencia-seed.ts) y
 * mira ese día en la pantalla. No se automatiza acá:
 * - La penalización automática (F01–F04): la regla está apagada en las sedes de desarrollo y solo
 *   se prende dentro de transacciones que se revierten (tests SQL de fix-384-m).
 * - El panel de inasistencias y justificar desde la ficha (J01, J02): e2e/alumnos-b-ficha.spec.ts.
 * - El reagendamiento masivo completo (J05, J06, J09): se ejecuta a mano; acá solo su paso 1.
 * - El envío real de correos Zoom (L07) y el cierre nocturno (I).
 */
import type { Locator, Page } from '@playwright/test';
import { addDaysIso, chileToday } from '../src/app/core/utils/chile-time.utils';
import { ACCOUNTS } from './support/accounts';
import {
  SEDE_A,
  SEDE_B,
  ayer,
  estadoClase,
  limpiarAsistencia,
  seedClase,
  type ClaseSembrada,
} from './support/asistencia-seed';
import { expect, test, watchErrors } from './support/fixtures';
import { getAdminClient, getClientFor } from './support/supabase-admin';

const DESKTOP = { width: 1440, height: 900 };
const CARGA = { timeout: 30_000 };
const SEDE_A_NOMBRE = 'Autoescuela Chillán';
const SEDE_B_NOMBRE = 'Conductores Chillán';

test.describe.configure({ timeout: 120_000 });
test.afterEach(limpiarAsistencia);

// ── Ayudas de pantalla ────────────────────────────────────────────────────────

const tabla = (page: Page) => page.locator('main table');
const fila = (page: Page, clase: ClaseSembrada): Locator =>
  tabla(page).locator('tbody tr').filter({ hasText: clase.alumno.paternalLastName });
const alerta = (page: Page, clase: ClaseSembrada): Locator =>
  page.locator('main aside .list-item-hover').filter({ hasText: clase.alumno.paternalLastName });
const accion = (scope: Page | Locator, name: string) =>
  scope.locator(`[data-llm-action="${name}"]`);
/** Filtro de estado de la tabla ("Ausente (2)"); el contador lo distingue del botón de cada fila. */
const filtro = (page: Page, estado: string) =>
  page.getByRole('button', { name: new RegExp('^' + estado + ' \\(\\d+\\)$') });
const toast = (page: Page, text: string | RegExp) =>
  page.locator('.p-toast-message').filter({ hasText: text }).first();

/** Espera a que la tabla del día termine de cargar (con filas o con "Sin resultados"). */
async function tablaLista(page: Page): Promise<void> {
  await expect(page.locator('main app-skeleton-block')).toHaveCount(0, CARGA);
  await expect(tabla(page).or(page.getByText('Sin resultados')).first()).toBeVisible(CARGA);
}

/** Elige un día en el selector de fecha de la tabla (a lo más un mes de distancia de hoy). */
async function elegirDia(page: Page, iso: string): Promise<void> {
  const [year, month, day] = iso.split('-').map(Number);
  const [todayYear, todayMonth] = chileToday().split('-').map(Number);
  const saltos = (year - todayYear) * 12 + (month - todayMonth);

  await page
    .locator('[data-llm-description="Selector de fecha para clases prácticas"]')
    .locator('xpath=descendant-or-self::input')
    .first()
    .click();
  const panel = page.locator('.p-datepicker-panel');
  await expect(panel).toBeVisible();
  const boton = saltos < 0 ? '.p-datepicker-prev-button' : '.p-datepicker-next-button';
  for (let i = 0; i < Math.abs(saltos); i++) await panel.locator(boton).click();
  await panel
    .locator('td:not(.p-datepicker-other-month) .p-datepicker-day')
    .getByText(String(day), { exact: true })
    .click();
  await tablaLista(page);
}

/** Abre Asistencia en el día de las clases sembradas (por defecto, ayer). */
async function abrir(page: Page, path: string, dia: string | null = ayer()): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(path);
  await expect(accion(page, 'tab-practicas')).toBeVisible(CARGA);
  await tablaLista(page);
  if (dia) await elegirDia(page, dia);
}

async function elegirSede(page: Page, nombre: string): Promise<void> {
  const boton = page.locator('header button[aria-label^="Sede activa"]');
  if ((await boton.getAttribute('aria-expanded')) !== 'true') await boton.click();
  await page.getByRole('option', { name: nombre, exact: true }).click();
  await tablaLista(page);
}

const encabezados = (page: Page) => tabla(page).locator('thead th').allInnerTexts();

// ── A · B · M: carga, acceso, tabla y sedes ──────────────────────────────────

test('A01 · B01 · B02 · M01 · M02: el admin ve las dos sedes con columna Sede y filtra al cambiar', async ({
  pageAs,
  cleanup,
}) => {
  const enA = await seedClase(
    { label: 'AsisAdmA', branchId: SEDE_A, cupo: { inst: 4, hora: 1 } },
    cleanup,
  );
  const enB = await seedClase(
    { label: 'AsisAdmB', branchId: SEDE_B, cupo: { inst: 4, hora: 1 } },
    cleanup,
  );
  const page = await pageAs('admin');
  const errors = watchErrors(page);

  await abrir(page, '/app/admin/asistencia', null);
  await elegirSede(page, 'Todas las sedes');
  await elegirDia(page, ayer());

  expect(await encabezados(page)).toEqual([
    'Agendada',
    'Inicio',
    'Fin',
    'Sede',
    'Instructor',
    'Alumno',
    'Vehículo',
    'Estado',
    'Acciones',
  ]);
  await expect(fila(page, enA)).toContainText(SEDE_A_NOMBRE);
  await expect(fila(page, enA).locator('td').first()).toHaveText(enA.hora);
  await expect(fila(page, enB)).toContainText(SEDE_B_NOMBRE);

  // M02: al elegir una sede la tabla se recarga sola y pierde la columna Sede.
  await elegirSede(page, SEDE_B_NOMBRE);
  await elegirDia(page, ayer());
  await expect(fila(page, enB)).toBeVisible();
  await expect(fila(page, enA)).toHaveCount(0);
  expect(await encabezados(page)).not.toContain('Sede');
  errors.expectClean();
});

test('A02 · A05 · B04 · B05: la secretaria ve solo su sede, sin canceladas ni matrículas retiradas', async ({
  pageAs,
  cleanup,
}) => {
  const propia = await seedClase(
    { label: 'AsisSecA', branchId: SEDE_A, cupo: { inst: 5, hora: 1 } },
    cleanup,
  );
  const otraSede = await seedClase(
    { label: 'AsisSecB', branchId: SEDE_B, cupo: { inst: 5, hora: 1 } },
    cleanup,
  );
  const cancelada = await seedClase(
    { label: 'AsisSecCanc', branchId: SEDE_A, cupo: { inst: 5, hora: 2 }, status: 'cancelled' },
    cleanup,
  );
  const retirada = await seedClase(
    {
      label: 'AsisSecRet',
      branchId: SEDE_A,
      cupo: { inst: 5, hora: 3 },
      enrollmentStatus: 'withdrawn',
    },
    cleanup,
  );
  const page = await pageAs('secretariaA');

  for (const vez of ['al entrar', 'tras recargar']) {
    if (vez === 'tras recargar') await page.reload();
    await abrir(page, '/app/secretaria/asistencia');
    await expect(fila(page, propia), vez).toBeVisible();
    await expect(fila(page, otraSede), vez).toHaveCount(0);
    await expect(fila(page, cancelada), vez).toHaveCount(0);
    await expect(fila(page, retirada), vez).toHaveCount(0);
    expect(await encabezados(page), vez).not.toContain('Sede');
  }
});

test('A03 · A06: la secretaria no entra a la ruta del admin y llega a Asistencia por el menú', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/asistencia');
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard/, CARGA);

  await page.locator('a[href$="/secretaria/asistencia"]').first().click();
  await expect(page).toHaveURL(/\/app\/secretaria\/asistencia/);
  await expect(accion(page, 'tab-practicas')).toHaveAttribute('aria-selected', 'true', CARGA);
});

test('A08: a 1440×900 la página no scrollea y la cabecera de la tabla queda fija', async ({
  pageAs,
  cleanup,
}) => {
  await seedClase({ label: 'AsisFill', branchId: SEDE_A, cupo: { inst: 6, hora: 1 } }, cleanup);
  const page = await pageAs('secretariaA');
  await abrir(page, '/app/secretaria/asistencia');

  const medidas = await page.evaluate(() => ({
    docScrollH: document.documentElement.scrollHeight,
    docScrollW: document.documentElement.scrollWidth,
    theadPosition: getComputedStyle(document.querySelector('main table thead')!).position,
  }));
  expect(medidas.docScrollH).toBeLessThanOrEqual(DESKTOP.height);
  expect(medidas.docScrollW).toBeLessThanOrEqual(DESKTOP.width);
  expect(medidas.theadPosition).toBe('sticky');
});

test('B07: mañana se ve en "Solo lectura", sin Iniciar ni Ausente', async ({ pageAs, cleanup }) => {
  const manana = addDaysIso(chileToday(), 1);
  const clase = await seedClase(
    { label: 'AsisManana', branchId: SEDE_A, cupo: { inst: 6, hora: 3 }, dia: manana },
    cleanup,
  );
  const page = await pageAs('secretariaA');
  await abrir(page, '/app/secretaria/asistencia', manana);

  await expect(page.getByText('Solo lectura')).toBeVisible();
  await expect(fila(page, clase)).toBeVisible();
  await expect(accion(fila(page, clase), 'iniciar-clase-practica')).toHaveCount(0);
  await expect(accion(fila(page, clase), 'mark-ausente')).toHaveCount(0);
});

test('B10 · B14: los filtros de estado separan pendientes de ausentes y "Actualizar" trae los cambios', async ({
  pageAs,
  cleanup,
}) => {
  const pendiente = await seedClase(
    { label: 'AsisFiltroP', branchId: SEDE_A, cupo: { inst: 7, hora: 1 } },
    cleanup,
  );
  const ausente = await seedClase(
    {
      label: 'AsisFiltroA',
      branchId: SEDE_A,
      cupo: { inst: 7, hora: 2 },
      status: 'no_show',
      falta: 'vigente',
    },
    cleanup,
  );
  const page = await pageAs('secretariaA');
  await abrir(page, '/app/secretaria/asistencia');

  await filtro(page, 'Ausente').click();
  await expect(fila(page, ausente)).toBeVisible();
  await expect(fila(page, pendiente)).toHaveCount(0);

  await filtro(page, 'Pendiente').click();
  await expect(fila(page, pendiente)).toBeVisible();
  await expect(fila(page, ausente)).toHaveCount(0);

  await filtro(page, 'Todos').click();
  await expect(fila(page, pendiente)).toBeVisible();
  await expect(fila(page, ausente)).toBeVisible();

  // B14: otra persona cancela la clase pendiente; "Actualizar" la saca de la tabla.
  const sb = await getAdminClient();
  await sb.from('class_b_sessions').update({ status: 'cancelled' }).eq('id', pendiente.sessionId);
  await accion(page, 'refresh-attendance').click();
  await expect(fila(page, pendiente)).toHaveCount(0, CARGA);
  await expect(fila(page, ausente)).toBeVisible();
});

// ── C · D: iniciar y finalizar ────────────────────────────────────────────────

test('C01 · C02 · C03 · C10 · D01 · D02 · D04: iniciar y finalizar una clase desde Asistencia', async ({
  pageAs,
  cleanup,
}) => {
  const clase = await seedClase(
    { label: 'AsisIniciar', branchId: SEDE_A, cupo: { inst: 0, hora: 1 } },
    cleanup,
  );
  const page = await pageAs('secretariaA');
  await abrir(page, '/app/secretaria/asistencia');

  const kmSalida = page.locator('[data-llm-description^="Odómetro inicial"]');
  const comenzar = accion(page, 'admin-start-class');

  // C01: el panel abre con el alumno y el kilometraje del vehículo precargado.
  await accion(fila(page, clase), 'iniciar-clase-practica').click();
  await expect(comenzar).toBeVisible(CARGA);
  await expect(page.locator('[data-drawer-panel]')).toContainText(clase.alumno.paternalLastName);
  await expect(kmSalida).not.toHaveValue('', CARGA);
  const km = Number(await kmSalida.inputValue());

  // C03: sin kilometraje, negativo o fuera de rango no se puede comenzar.
  for (const invalido of ['', '-5', '1000000']) {
    await kmSalida.fill(invalido);
    await expect(comenzar, `km "${invalido}"`).toBeDisabled();
  }

  // C10: cancelar deja la clase pendiente.
  await page
    .locator('[data-drawer-panel]')
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  await expect(comenzar).toHaveCount(0);
  await expect(fila(page, clase)).toContainText('Pendiente');

  // C02: comenzar la deja en curso.
  await accion(fila(page, clase), 'iniciar-clase-practica').click();
  await expect(kmSalida).not.toHaveValue('', CARGA);
  await kmSalida.fill(String(km));
  await comenzar.click();
  await expect(toast(page, 'Clase iniciada')).toBeVisible();
  await expect(fila(page, clase)).toContainText('En curso');
  expect((await estadoClase(clase.sessionId)).status).toBe('in_progress');

  // D01 · D02: el km de retorno tiene que ser mayor al de salida.
  await accion(fila(page, clase), 'finalizar-clase-practica').click();
  const kmRetorno = page.locator('[data-llm-description^="Odómetro final"]');
  const finalizar = accion(page, 'admin-finish-class');
  await expect(finalizar).toBeVisible(CARGA);
  await kmRetorno.fill(String(km));
  await expect(finalizar).toBeDisabled();
  await expect(page.locator('[data-drawer-panel]')).toContainText('Debe ser mayor al inicial');

  // D04: cerrar la clase la deja presente y finalizada.
  await kmRetorno.fill(String(km + 7));
  await finalizar.click();
  await expect(toast(page, 'Clase finalizada')).toBeVisible();
  await expect(fila(page, clase)).toContainText('Finalizada');
  const final = await estadoClase(clase.sessionId);
  expect(final.status).toBe('completed');
  expect(final.kmEnd).toBe(km + 7);
  expect(final.asistencias).toEqual([{ status: 'present', archived: false, justification: null }]);
});

test('C07: no se inicia una segunda clase del mismo instructor con otra en curso', async ({
  pageAs,
  cleanup,
}) => {
  const primera = await seedClase(
    { label: 'AsisDobleUno', branchId: SEDE_A, cupo: { inst: 3, hora: 1 } },
    cleanup,
  );
  const segunda = await seedClase(
    { label: 'AsisDobleDos', branchId: SEDE_A, cupo: { inst: 3, hora: 2 } },
    cleanup,
  );
  // La primera ya está en curso (sembrada por API, con la sesión del admin).
  const sb = await getAdminClient();
  const { error } = await sb
    .from('class_b_sessions')
    .update({ status: 'in_progress', start_time: '01:05:00', km_start: 1 })
    .eq('id', primera.sessionId);
  expect(error, 'no se pudo dejar la primera clase en curso').toBeNull();

  const page = await pageAs('secretariaA');
  await abrir(page, '/app/secretaria/asistencia');
  await accion(fila(page, segunda), 'iniciar-clase-practica').click();
  const comenzar = accion(page, 'admin-start-class');
  await expect(comenzar).toBeEnabled(CARGA);
  await comenzar.click();

  await expect(page.locator('[data-drawer-panel]')).toContainText(/clase en curso/i);
  expect((await estadoClase(segunda.sessionId)).status).toBe('scheduled');
});

// ── E · H: marcar ausente y alertas ───────────────────────────────────────────

test('E03 · E04 · E05 · E10 · H02: marcar ausente pide confirmación y deja la alerta amarilla sin "Recordar"', async ({
  pageAs,
  cleanup,
}) => {
  const clase = await seedClase(
    { label: 'AsisAusente', branchId: SEDE_A, cupo: { inst: 8, hora: 1 } },
    cleanup,
  );
  const page = await pageAs('secretariaA');
  await abrir(page, '/app/secretaria/asistencia');

  // E04: cancelar la confirmación no cambia nada.
  await accion(fila(page, clase), 'mark-ausente').click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Marcar inasistencia' })).toBeVisible();
  await accion(page, 'confirm-modal-cancel').click();
  await expect(fila(page, clase)).toContainText('Pendiente');
  expect((await estadoClase(clase.sessionId)).status).toBe('scheduled');

  // E05: confirmar la deja ausente, con una sola inasistencia.
  await accion(fila(page, clase), 'mark-ausente').click();
  await accion(page, 'confirm-modal-accept').click();
  await expect(toast(page, 'Asistencia marcada como Ausente')).toBeVisible();
  await expect(fila(page, clase)).toContainText('Ausente');
  const estado = await estadoClase(clase.sessionId);
  expect(estado.status).toBe('no_show');
  expect(estado.asistencias).toEqual([{ status: 'absent', archived: false, justification: null }]);

  // H02: alerta de 1 falta; en el piloto no ofrece "Recordar" (fix-380-m) ni "Eliminar".
  await expect(alerta(page, clase)).toContainText('1 falta', CARGA);
  await expect(accion(alerta(page, clase), 'send-reminder')).toHaveCount(0);
  await expect(accion(alerta(page, clase), 'remove-schedule')).toHaveCount(0);
});

test('E01: una clase de hoy que todavía no empieza no ofrece "Ausente"', async ({
  pageAs,
  cleanup,
}) => {
  const hoy = chileToday();
  const enUnaHora = new Date(Date.now() + 60 * 60 * 1000);
  test.skip(
    chileToday(enUnaHora) !== hoy,
    'Falta menos de una hora para la medianoche de Chile: no hay hora futura de hoy.',
  );
  const sb = await getAdminClient();
  const clase = await seedClase(
    {
      label: 'AsisFutura',
      branchId: SEDE_A,
      cupo: { inst: 8, hora: 2 },
      dia: addDaysIso(hoy, 400),
    },
    cleanup,
  );
  // Se mueve a hoy, una hora más adelante (la siembra solo sabe de horas en punto).
  const { error } = await sb
    .from('class_b_sessions')
    .update({ scheduled_at: enUnaHora.toISOString() })
    .eq('id', clase.sessionId);
  test.skip(!!error, `El instructor de prueba tiene otra clase a esa hora: ${error?.message}`);

  const page = await pageAs('secretariaA');
  await abrir(page, '/app/secretaria/asistencia', null);
  await expect(fila(page, clase)).toBeVisible(CARGA);
  await expect(accion(fila(page, clase), 'iniciar-clase-practica')).toBeVisible();
  await expect(accion(fila(page, clase), 'mark-ausente')).toHaveCount(0);
});

test('G01 · G02 · G04 · G10: justificar una inasistencia', async ({ pageAs, cleanup }) => {
  const clase = await seedClase(
    {
      label: 'AsisJustif',
      branchId: SEDE_A,
      cupo: { inst: 8, hora: 3 },
      status: 'no_show',
      falta: 'vigente',
    },
    cleanup,
  );
  const page = await pageAs('secretariaA');
  await abrir(page, '/app/secretaria/asistencia');

  const motivo = page.locator('[data-llm-description="textarea for absence justification reason"]');
  const guardar = accion(page, 'submit-justification');

  // G01: sin texto, o con solo espacios, no se puede guardar.
  await accion(fila(page, clase), 'justify-absence').click();
  await expect(guardar).toBeDisabled();
  await motivo.fill('   ');
  await expect(guardar).toBeDisabled();

  // G04: Escape cierra sin guardar.
  await page.keyboard.press('Escape');
  await expect(guardar).toHaveCount(0);
  await expect(accion(fila(page, clase), 'justify-absence')).toBeVisible();

  // G02: guardar deja "Justificada" y "Ver motivo".
  await accion(fila(page, clase), 'justify-absence').click();
  await motivo.fill('Certificado médico E2E');
  await guardar.click();
  await expect(toast(page, 'Justificación registrada')).toBeVisible();
  await expect(fila(page, clase)).toContainText('Justificada');
  await expect(accion(fila(page, clase), 'view-justification')).toBeVisible();

  // G10: persiste al recargar.
  await page.reload();
  await abrir(page, '/app/secretaria/asistencia');
  await expect(fila(page, clase)).toContainText('Justificada');
  expect((await estadoClase(clase.sessionId)).asistencias[0]).toMatchObject({
    status: 'excused',
    justification: 'Certificado médico E2E',
  });
});

test('H05 · H06 · H08 · fix-391-m: "Eliminar" pasa a "Reactivar" y, ya penalizado, no se vuelve a ofrecer', async ({
  pageAs,
  cleanup,
}) => {
  const base = { branchId: SEDE_A, status: 'no_show', falta: 'vigente' } as const;
  const falta1 = await seedClase(
    { ...base, label: 'AsisPenal', cupo: { inst: 2, hora: 4 }, classNumber: 1 },
    cleanup,
  );
  await seedClase(
    { ...base, label: 'AsisPenal', cupo: { inst: 2, hora: 5 }, classNumber: 2, de: falta1 },
    cleanup,
  );
  const futura = await seedClase(
    {
      label: 'AsisPenal',
      branchId: SEDE_A,
      cupo: { inst: 2, hora: 4 },
      classNumber: 3,
      dia: addDaysIso(chileToday(), 400),
      de: falta1,
    },
    cleanup,
  );
  const page = await pageAs('secretariaA');
  await abrir(page, '/app/secretaria/asistencia', null);

  // H05 · H06: faltas en las clases 1 y 2 → alerta roja con "Eliminar".
  await expect(alerta(page, falta1)).toContainText('2 faltas', CARGA);
  await accion(alerta(page, falta1), 'remove-schedule').click();
  await accion(page, 'confirm-modal-accept').click();
  await expect(toast(page, 'Horario eliminado')).toBeVisible();
  await expect(accion(alerta(page, falta1), 'reactivate-schedule')).toBeVisible();
  expect((await estadoClase(futura.sessionId)).status).toBe('cancelled');

  // H08: tras recargar sigue ofreciendo "Reactivar" (fix-365-m).
  await page.reload();
  await abrir(page, '/app/secretaria/asistencia', null);
  await expect(accion(alerta(page, falta1), 'reactivate-schedule')).toBeVisible(CARGA);

  // fix-391-m: con las clases de vuelta, esas faltas ya penalizadas no ofrecen "Eliminar".
  await accion(alerta(page, falta1), 'reactivate-schedule').click();
  await accion(page, 'confirm-modal-accept').click();
  await expect(toast(page, 'Horario reactivado')).toBeVisible();
  expect((await estadoClase(futura.sessionId)).status).toBe('scheduled');
  await page.reload();
  await abrir(page, '/app/secretaria/asistencia', null);
  await expect(alerta(page, falta1)).toContainText('Ya penalizado', CARGA);
  await expect(accion(alerta(page, falta1), 'remove-schedule')).toHaveCount(0);
  await expect(accion(alerta(page, falta1), 'reactivate-schedule')).toHaveCount(0);
});

test('H11 · H12: una falta archivada no genera alerta y las alertas siguen a la sede', async ({
  pageAs,
  cleanup,
}) => {
  const archivada = await seedClase(
    { label: 'AsisArchiv', branchId: SEDE_A, cupo: { inst: 7, hora: 4 }, falta: 'archivada' },
    cleanup,
  );
  const deSedeB = await seedClase(
    {
      label: 'AsisAlertaB',
      branchId: SEDE_B,
      cupo: { inst: 5, hora: 4 },
      status: 'no_show',
      falta: 'vigente',
    },
    cleanup,
  );
  const deSedeA = await seedClase(
    {
      label: 'AsisAlertaA',
      branchId: SEDE_A,
      cupo: { inst: 7, hora: 5 },
      status: 'no_show',
      falta: 'vigente',
    },
    cleanup,
  );

  const secretaria = await pageAs('secretariaA');
  await abrir(secretaria, '/app/secretaria/asistencia', null);
  await expect(alerta(secretaria, deSedeA)).toBeVisible(CARGA);
  await expect(alerta(secretaria, deSedeB)).toHaveCount(0);
  await expect(alerta(secretaria, archivada)).toHaveCount(0);

  const admin = await pageAs('admin');
  await abrir(admin, '/app/admin/asistencia', null);
  await elegirSede(admin, SEDE_B_NOMBRE);
  await expect(alerta(admin, deSedeB)).toBeVisible(CARGA);
  await expect(alerta(admin, deSedeA)).toHaveCount(0);
});

// ── J: ficha del alumno, paso 1 de "Reagendar Clases" ─────────────────────────

test('J04 · J11 · J12 (fix-382-m): el paso 1 de "Reagendar Clases" parte con todo marcado y "Volver" conserva la selección', async ({
  pageAs,
  cleanup,
}) => {
  const falta = await seedClase(
    {
      label: 'AsisReag',
      branchId: SEDE_A,
      cupo: { inst: 2, hora: 1 },
      classNumber: 1,
      status: 'no_show',
      falta: 'vigente',
    },
    cleanup,
  );
  await seedClase(
    {
      label: 'AsisReag',
      branchId: SEDE_A,
      cupo: { inst: 2, hora: 2 },
      classNumber: 2,
      status: 'cancelled',
      de: falta,
    },
    cleanup,
  );
  const page = await pageAs('secretariaA');
  await page.setViewportSize(DESKTOP);
  await page.goto(`/app/secretaria/alumnos/${falta.alumno.studentId}`);
  await page.getByRole('button', { name: /Reagendar Clases/ }).click(CARGA);

  const paso1 = page.locator('app-admin-reagendar-clases-drawer');
  const casillas = accion(paso1, 'toggle-clase-reagendar');
  const continuar = accion(paso1, 'continuar-seleccion-reagendar');

  // J04: las dos clases vienen marcadas, cada una con su origen.
  await expect(casillas).toHaveCount(2, CARGA);
  await expect(casillas.nth(0)).toBeChecked();
  await expect(casillas.nth(1)).toBeChecked();
  await expect(continuar).toContainText('Seleccionar Horarios (2)');
  const origenes = await paso1.locator('.reagendar-origen-badge').allInnerTexts();
  expect(origenes.join(' | ')).toMatch(/inasistencia/i);
  expect(origenes.join(' | ')).toMatch(/cancelada/i);

  // J11: sin ninguna marcada no se puede seguir.
  await casillas.nth(0).uncheck();
  await casillas.nth(1).uncheck();
  await expect(continuar).toBeDisabled();
  await expect(continuar).toContainText('Seleccionar Horarios (0)');

  // J12: con una marcada, ir al paso 2 y volver conserva esa selección.
  await casillas.nth(1).check();
  await continuar.click();
  await expect(paso1).toHaveCount(0, CARGA);
  await page
    .locator('[data-drawer-panel]')
    .getByRole('button', { name: /^(Volver|Atrás|Anterior)/ })
    .first()
    .click();
  await expect(casillas).toHaveCount(2, CARGA);
  await expect(casillas.nth(0)).not.toBeChecked();
  await expect(casillas.nth(1)).toBeChecked();
  await expect(continuar).toContainText('Seleccionar Horarios (1)');
});

// ── M: sedes y roles ──────────────────────────────────────────────────────────

test('M04 (fix-385-m): la secretaria multi-sede ve la sede que elige en el selector', async ({
  pageAs,
  cleanup,
}) => {
  const enA = await seedClase(
    { label: 'AsisMultiA', branchId: SEDE_A, cupo: { inst: 4, hora: 3 } },
    cleanup,
  );
  const enB = await seedClase(
    { label: 'AsisMultiB', branchId: SEDE_B, cupo: { inst: 4, hora: 3 } },
    cleanup,
  );
  const page = await pageAs('secretariaMultisede');
  await abrir(page, '/app/secretaria/asistencia', null);

  await elegirSede(page, SEDE_B_NOMBRE);
  await elegirDia(page, ayer());
  await expect(fila(page, enB)).toBeVisible();
  await expect(fila(page, enA)).toHaveCount(0);

  await elegirSede(page, 'Todas las sedes');
  await elegirDia(page, ayer());
  await expect(fila(page, enA)).toBeVisible();
  await expect(fila(page, enB)).toBeVisible();
  expect(await encabezados(page)).toContain('Sede');
});

test('M06: por API, la secretaria de una sede no lee ni modifica clases de la otra', async ({
  cleanup,
}) => {
  const enB = await seedClase(
    { label: 'AsisRlsB', branchId: SEDE_B, cupo: { inst: 6, hora: 4 } },
    cleanup,
  );
  const sb = await getClientFor(ACCOUNTS.secretariaA.email, ACCOUNTS.secretariaA.password);

  const lectura = await sb.from('class_b_sessions').select('id').eq('id', enB.sessionId);
  expect(lectura.error).toBeNull();
  expect(lectura.data).toEqual([]);

  const escritura = await sb
    .from('class_b_sessions')
    .update({ status: 'no_show' })
    .eq('id', enB.sessionId)
    .select('id');
  expect(escritura.data ?? []).toEqual([]);
  expect((await estadoClase(enB.sessionId)).status).toBe('scheduled');
});

// ── N: dos sesiones ───────────────────────────────────────────────────────────

test('N02: dos personas marcan ausente la misma clase y queda una sola inasistencia', async ({
  pageAs,
  cleanup,
}) => {
  const clase = await seedClase(
    { label: 'AsisDosAus', branchId: SEDE_A, cupo: { inst: 1, hora: 3 } },
    cleanup,
  );
  const a = await pageAs('admin');
  const b = await pageAs('secretariaA');
  await abrir(a, '/app/admin/asistencia', null);
  await elegirSede(a, SEDE_A_NOMBRE);
  await elegirDia(a, ayer());
  await abrir(b, '/app/secretaria/asistencia');

  await accion(fila(a, clase), 'mark-ausente').click();
  await accion(fila(b, clase), 'mark-ausente').click();
  await accion(a, 'confirm-modal-accept').click();
  await expect(toast(a, 'Asistencia marcada como Ausente')).toBeVisible();
  await accion(b, 'confirm-modal-accept').click();
  await expect(toast(b, 'La inasistencia ya estaba registrada')).toBeVisible();

  await expect(fila(b, clase)).toContainText('Ausente');
  const estado = await estadoClase(clase.sessionId);
  expect(estado.status).toBe('no_show');
  expect(estado.asistencias).toHaveLength(1);
});

test('N03 (fix-388-m): una pestaña sin actualizar no pisa el inicio que registró otra persona', async ({
  pageAs,
  cleanup,
}) => {
  const clase = await seedClase(
    { label: 'AsisDosIni', branchId: SEDE_A, cupo: { inst: 1, hora: 1 } },
    cleanup,
  );
  const a = await pageAs('admin');
  const b = await pageAs('secretariaA');
  await abrir(a, '/app/admin/asistencia', null);
  await elegirSede(a, SEDE_A_NOMBRE);
  await elegirDia(a, ayer());
  await abrir(b, '/app/secretaria/asistencia');

  // Las dos abren el panel de Iniciar con la clase todavía pendiente.
  for (const page of [a, b]) {
    await accion(fila(page, clase), 'iniciar-clase-practica').click();
    await expect(page.locator('[data-llm-description^="Odómetro inicial"]')).not.toHaveValue(
      '',
      CARGA,
    );
  }
  await accion(a, 'admin-start-class').click();
  await expect(toast(a, 'Clase iniciada')).toBeVisible();
  const trasA = await estadoClase(clase.sessionId);
  expect(trasA.status).toBe('in_progress');

  await b.locator('[data-llm-description^="Odómetro inicial"]').fill('999');
  await accion(b, 'admin-start-class').click();
  await expect(toast(b, 'La clase cambió')).toBeVisible();
  await expect(b.locator('[data-drawer-panel]')).toContainText('ya fue iniciada');

  const trasB = await estadoClase(clase.sessionId);
  expect(trasB.kmStart).toBe(trasA.kmStart);
  expect(trasB.startTime).toBe(trasA.startTime);
});

// ── L: ciclos teóricos ────────────────────────────────────────────────────────

const selectorCiclo = (page: Page) =>
  page.locator('p-select[data-llm-description="Selector de ciclo teórico"]');
const buscarEnRoster = (page: Page) =>
  page.locator('[data-llm-description="Buscar alumno dentro del roster del ciclo"]');
const enRoster = (page: Page, clase: ClaseSembrada) =>
  page.locator('main .list-item-hover').filter({ hasText: clase.alumno.paternalLastName });

async function abrirCiclos(page: Page): Promise<void> {
  await accion(page, 'tab-ciclos').click();
  await expect(selectorCiclo(page)).toBeVisible(CARGA);
  await expect(page.locator('main app-skeleton-block')).toHaveCount(0, CARGA);
}

/** Ciclo teórico al que quedó asignada la matrícula sembrada, y otro de la misma sede. */
async function ciclosDe(clase: ClaseSembrada): Promise<{ propio: number; otro: number }> {
  const sb = await getAdminClient();
  const { data: enr } = await sb
    .from('enrollments')
    .select('theory_cycle_id, branch_id')
    .eq('id', clase.enrollmentId)
    .single();
  const { data: otros } = await sb
    .from('class_b_theory_cycles')
    .select('id')
    .eq('branch_id', enr!.branch_id)
    .neq('id', enr!.theory_cycle_id)
    .order('start_date', { ascending: false })
    .limit(1);
  return { propio: enr!.theory_cycle_id, otro: otros![0].id };
}

test('L01 · L03 · L06 · L10 · L11 · L12 · L13 (fix-387-m): ciclos teóricos — roster, cambio de ciclo y "Actualizar"', async ({
  pageAs,
  cleanup,
}) => {
  const clase = await seedClase(
    { label: 'AsisCiclo', branchId: SEDE_A, cupo: { inst: 6, hora: 5 } },
    cleanup,
  );
  const { propio, otro } = await ciclosDe(clase);
  expect(propio, 'la matrícula sembrada debió quedar en un ciclo teórico').toBeTruthy();
  const page = await pageAs('admin');
  await abrir(page, '/app/admin/asistencia', null);
  await elegirSede(page, 'Todas las sedes');
  await abrirCiclos(page);

  // L01: hay un ciclo elegido al abrir. Se pasa al ciclo de la matrícula sembrada.
  await expect(selectorCiclo(page)).toContainText('Ciclo —');
  const sb = await getAdminClient();
  const { data: ciclo } = await sb
    .from('class_b_theory_cycles')
    .select('start_date')
    .eq('id', propio)
    .single();
  const [, mes, dia] = ciclo!.start_date.split('-').map(Number);
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
  const etiqueta = new RegExp(`${dia} de ${meses[mes - 1]} · ${SEDE_A_NOMBRE}`);
  await selectorCiclo(page).click();
  await page.getByRole('option', { name: etiqueta }).click();
  await expect(page.locator('main app-skeleton-block')).toHaveCount(0, CARGA);

  // L03 · L06: seis clases, y sin enlace no se puede enviar.
  await expect(page.locator('main p.item-title').filter({ hasText: /^Clase \d —/ })).toHaveCount(6);
  await buscarEnRoster(page).fill(clase.alumno.paternalLastName);
  await expect(enRoster(page, clase)).toHaveCount(1);

  // L11: en "Todas las sedes" solo se ofrecen ciclos de la sede del ciclo elegido.
  await accion(enRoster(page, clase), 'cambiar-alumno-de-ciclo').click();
  await page.locator('p-select[data-llm-description^="Ciclo destino"]').click();
  const destinos = await page.getByRole('option').allInnerTexts();
  expect(destinos.length).toBeGreaterThan(0);
  expect(destinos.filter((d) => !d.includes(SEDE_A_NOMBRE))).toEqual([]);

  // L10: moverlo lo saca del roster.
  await page.getByRole('option').first().click();
  await accion(page, 'confirmar-mover-alumno').click();
  await expect(toast(page, 'Alumno reasignado de ciclo')).toBeVisible();
  await expect(enRoster(page, clase)).toHaveCount(0);

  // L12: se incorpora de vuelta desde "Incorporar".
  await accion(page, 'abrir-incorporar-alumno').click();
  const buscarCandidato = page.locator(
    '[data-llm-description="Buscar alumno candidato a incorporar"]',
  );
  await expect(buscarCandidato).toBeVisible(CARGA);
  await buscarCandidato.fill(clase.alumno.paternalLastName);
  await accion(page, 'incorporar-alumno').first().click();
  await expect(toast(page, 'Alumno reasignado de ciclo')).toBeVisible();
  await page.keyboard.press('Escape');
  await buscarEnRoster(page).fill(clase.alumno.paternalLastName);
  await expect(enRoster(page, clase)).toHaveCount(1);

  // L13: otra persona lo mueve; "Actualizar" lo refleja sin cambiar de ciclo.
  await sb.from('enrollments').update({ theory_cycle_id: otro }).eq('id', clase.enrollmentId);
  await page
    .locator('main [role="group"][aria-label="Acciones principales"] button')
    .first()
    .click();
  await expect(enRoster(page, clase)).toHaveCount(0, CARGA);
});

test('L04: el tema y el enlace Zoom de una clase se guardan y persisten', async ({
  pageAs,
  cleanup,
}) => {
  const clase = await seedClase(
    { label: 'AsisZoom', branchId: SEDE_B, cupo: { inst: 6, hora: 6 } },
    cleanup,
  );
  const { propio } = await ciclosDe(clase);
  const sb = await getAdminClient();
  const { data: original } = await sb
    .from('class_b_theory_sessions')
    .select('id, topic, zoom_link')
    .eq('cycle_id', propio)
    .eq('class_number', 6)
    .single();
  const tema = `E2E tema ${Date.now()}`;

  try {
    const page = await pageAs('secretariaB');
    await abrir(page, '/app/secretaria/asistencia', null);
    await abrirCiclos(page);
    const tarjeta = page
      .locator('main p.item-title')
      .filter({ hasText: /^Clase 6 —/ })
      .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    const campoTema = tarjeta.locator(
      '[data-llm-description="Tema opcional de la clase del ciclo"]',
    );
    const campoEnlace = tarjeta.locator('[data-llm-description="URL del enlace Zoom de la clase"]');

    // Un enlace que no es https no se guarda (fix-367-m).
    await campoEnlace.fill('hola');
    await accion(tarjeta, 'guardar-clase-ciclo').click();
    await expect(toast(page, 'El enlace Zoom debe empezar con https://')).toBeVisible();

    await campoTema.fill(tema);
    await campoEnlace.fill('https://zoom.us/j/e2e-asistencia');
    await accion(tarjeta, 'guardar-clase-ciclo').click();
    await expect(toast(page, 'Enlace Zoom guardado')).toBeVisible();

    await page.reload();
    await abrir(page, '/app/secretaria/asistencia', null);
    await abrirCiclos(page);
    await expect(campoTema).toHaveValue(tema, CARGA);
    await expect(campoEnlace).toHaveValue('https://zoom.us/j/e2e-asistencia');
  } finally {
    await sb
      .from('class_b_theory_sessions')
      .update({ topic: original!.topic, zoom_link: original!.zoom_link })
      .eq('id', original!.id);
  }
});

// ── O: móvil y teclado ────────────────────────────────────────────────────────

test('O02 · O03: a 375 px muestra 6 filas con "Cargar más" y vuelve a 6 al cambiar el filtro', async ({
  pageAs,
  cleanup,
}) => {
  const clases: ClaseSembrada[] = [];
  for (let i = 0; i < 7; i++) {
    clases.push(
      await seedClase(
        { label: `AsisMovil${i}`, branchId: SEDE_A, cupo: { inst: i, hora: 6 } },
        cleanup,
      ),
    );
  }
  const page = await pageAs('secretariaA');
  await abrir(page, '/app/secretaria/asistencia');
  await page.setViewportSize({ width: 375, height: 812 });

  const filas = tabla(page).locator('tbody tr');
  const cargarMas = accion(page, 'load-more-practicas');
  await expect(filas).toHaveCount(6, CARGA);
  await expect(cargarMas).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  // El panel de alertas queda debajo de la tabla.
  const posiciones = await page.evaluate(() => ({
    tabla: document.querySelector('main table')!.getBoundingClientRect().top,
    alertas: document.querySelector('main aside')?.getBoundingClientRect().top ?? Infinity,
  }));
  expect(posiciones.alertas).toBeGreaterThan(posiciones.tabla);

  await cargarMas.click();
  expect(await filas.count()).toBeGreaterThan(6);
  await filtro(page, 'Pendiente').click();
  await filtro(page, 'Todos').click();
  await expect(filas).toHaveCount(6);
});

test('O05 (fix-389-m · fix-390-m): con teclado se llega a la tabla antes que a las alertas y los modales toman el foco', async ({
  pageAs,
  cleanup,
}) => {
  const clase = await seedClase(
    { label: 'AsisTeclado', branchId: SEDE_A, cupo: { inst: 8, hora: 5 } },
    cleanup,
  );
  const page = await pageAs('secretariaA');
  await abrir(page, '/app/secretaria/asistencia');

  // fix-389-m: desde las pestañas, Tab entra a la tarjeta de la tabla, no al panel de alertas.
  await accion(page, 'tab-ciclos').focus();
  await page.keyboard.press('Tab');
  const dondeQuedo = await page.evaluate(() => {
    const el = document.activeElement;
    return el?.closest('aside') ? 'alertas' : el?.closest('section') ? 'tabla' : 'otro';
  });
  expect(dondeQuedo).toBe('tabla');

  // fix-390-m: la confirmación toma el foco, no lo deja salir y Escape la cierra.
  const ausente = accion(fila(page, clase), 'mark-ausente');
  await ausente.focus();
  await page.keyboard.press('Enter');
  await expect(accion(page, 'confirm-modal-cancel')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(accion(page, 'confirm-modal-accept')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(accion(page, 'confirm-modal-cancel')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(accion(page, 'confirm-modal-accept')).toHaveCount(0);
  await expect(ausente).toBeFocused();
  expect((await estadoClase(clase.sessionId)).status).toBe('scheduled');
});
