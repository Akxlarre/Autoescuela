/**
 * Agenda Clase B y Triple Match (fix-186-b, ASG-i-026) — grupo 3: iniciar y finalizar la clase.
 * Casos K de specs/testing-piloto/026-agenda-triple-match.md que ningún otro archivo cubre; el ID
 * de cada caso va en el título.
 *
 * Ya cubiertos en otros lugares (no se repiten acá):
 * - K01, K04, K09 → `asistencia-clase-b.spec.ts` C01 (ciclo completo como secretaria).
 * - K10 → `asistencia-clase-b.spec.ts` C07 (exclusión mutua del instructor, spec 0001-i).
 * - K02, K15 → `dashboards.spec.ts` M14 · M16 (finalizar desde "Clases Actuales", corte de red).
 * - K05 → `asistencia-clase-b.spec.ts` C01 (km vacío, negativo y > 999.999).
 * - K08 → `asistencia-clase-b.spec.ts` N03 (fix-388-m, pestaña sin actualizar).
 * - K17 → `supabase/tests/rls/fix-460-m-certificate-enabled.sql` (trigger del certificado).
 *
 * Usa las clases sembradas AYER de `support/asistencia-seed.ts` (hora pasada, sin choques reales).
 */
import type { Locator, Page } from '@playwright/test';
import { chileToday } from '../src/app/core/utils/chile-time.utils';
import {
  SEDE_A,
  ayer,
  estadoClase,
  limpiarAsistencia,
  seedClase,
  type ClaseSembrada,
} from './support/asistencia-seed';
import { expect, test } from './support/fixtures';
import { getAdminClient } from './support/supabase-admin';

const DESKTOP = { width: 1440, height: 900 };
const CARGA = { timeout: 30_000 };

test.describe.configure({ timeout: 120_000 });
test.afterEach(limpiarAsistencia);

const tabla = (page: Page) => page.locator('main table');
const fila = (page: Page, clase: ClaseSembrada): Locator =>
  tabla(page).locator('tbody tr').filter({ hasText: clase.alumno.paternalLastName });
const accion = (scope: Page | Locator, name: string) =>
  scope.locator(`[data-llm-action="${name}"]`);
const drawer = (page: Page) => page.locator('[data-drawer-panel]');
const toasts = (page: Page, text: string | RegExp) =>
  page.locator('.p-toast-message').filter({ hasText: text });

async function tablaLista(page: Page): Promise<void> {
  await expect(page.locator('main app-skeleton-block')).toHaveCount(0, CARGA);
  await expect(tabla(page).or(page.getByText('Sin resultados')).first()).toBeVisible(CARGA);
}

/** Abre Asistencia de la secretaria en AYER (el día de las clases sembradas). */
async function abrirAyer(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/secretaria/asistencia');
  await expect(accion(page, 'tab-practicas')).toBeVisible(CARGA);
  await tablaLista(page);

  const [year, month, day] = ayer().split('-').map(Number);
  const [todayYear, todayMonth] = chileToday().split('-').map(Number);
  const saltos = (year - todayYear) * 12 + (month - todayMonth);
  await page
    .locator('[data-llm-description="Selector de fecha para clases prácticas"]')
    .locator('xpath=descendant-or-self::input')
    .first()
    .click();
  const panel = page.locator('.p-datepicker-panel');
  await expect(panel).toBeVisible();
  for (let i = 0; i < Math.abs(saltos); i++)
    await panel.locator('.p-datepicker-prev-button').click();
  await panel
    .locator('td:not(.p-datepicker-other-month) .p-datepicker-day')
    .getByText(String(day), { exact: true })
    .click();
  await tablaLista(page);
}

async function patente(vehicleId: number): Promise<string> {
  const sb = await getAdminClient();
  const { data, error } = await sb
    .from('vehicles')
    .select('license_plate')
    .eq('id', vehicleId)
    .single();
  expect(error, 'no se pudo leer la patente').toBeNull();
  return data!.license_plate as string;
}

test('K06: iniciar cambiando a un vehículo que está en otra clase a esa hora se bloquea', async ({
  pageAs,
  cleanup,
}) => {
  // Dos instructores con clase a la misma hora, cada uno con su vehículo (V1 y V2).
  const conV1 = await seedClase(
    { label: 'AgK06Uno', branchId: SEDE_A, cupo: { inst: 1, hora: 6 } },
    cleanup,
  );
  const conV2 = await seedClase(
    { label: 'AgK06Dos', branchId: SEDE_A, cupo: { inst: 2, hora: 6 } },
    cleanup,
  );
  expect(conV1.vehicleId).not.toBe(conV2.vehicleId);

  // La del instructor 1 ya está en curso con V1.
  const sb = await getAdminClient();
  const { error } = await sb
    .from('class_b_sessions')
    .update({ status: 'in_progress', start_time: '06:02:00', km_start: 1 })
    .eq('id', conV1.sessionId);
  expect(error, 'no se pudo dejar la clase con V1 en curso').toBeNull();
  const v1 = await patente(conV1.vehicleId);

  const page = await pageAs('secretariaA');
  await abrirAyer(page);

  // Iniciar la del instructor 2 eligiendo V1 en el selector.
  await accion(fila(page, conV2), 'iniciar-clase-practica').click();
  const comenzar = accion(page, 'admin-start-class');
  await expect(comenzar).toBeEnabled(CARGA);
  await drawer(page)
    .locator('[data-llm-description="Selector de vehículo para la clase práctica"]')
    .click();
  await page.getByRole('option', { name: new RegExp('^' + v1) }).click();
  await comenzar.click();

  // Bloqueado: el panel lo dice y la clase sigue pendiente con su vehículo.
  await expect(drawer(page)).toContainText(/vehículo/i, CARGA);
  await expect(toasts(page, 'Clase iniciada')).toHaveCount(0);
  const despues = await estadoClase(conV2.sessionId);
  expect(despues.status).toBe('scheduled');
  const { data: fila2 } = await sb
    .from('class_b_sessions')
    .select('vehicle_id')
    .eq('id', conV2.sessionId)
    .single();
  expect(fila2!.vehicle_id, 'la clase conserva V2').toBe(conV2.vehicleId);
});

test('K07 (fix-247-b): el selector de vehículo avisa el SOAP vencido sin bloquear el inicio', async ({
  pageAs,
  cleanup,
}) => {
  const clase = await seedClase(
    { label: 'AgK07', branchId: SEDE_A, cupo: { inst: 3, hora: 4 } },
    cleanup,
  );
  const otra = await seedClase(
    { label: 'AgK07Otro', branchId: SEDE_A, cupo: { inst: 1, hora: 4 } },
    cleanup,
  );
  const [conSoap, alDia] = [await patente(clase.vehicleId), await patente(otra.vehicleId)];

  // La sede 1 no tiene hoy vehículos con documentos vencidos: se simula la respuesta, sin tocar
  // datos reales. Solo el vehículo de la clase tiene el SOAP vencido.
  const page = await pageAs('secretariaA');
  await page.route('**/rest/v1/vehicle_documents*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { vehicle_id: clase.vehicleId, type: 'soap', expiry_date: '2020-01-01', status: 'valid' },
      ]),
    }),
  );
  await abrirAyer(page);
  await accion(fila(page, clase), 'iniciar-clase-practica').click();
  const comenzar = accion(page, 'admin-start-class');
  await expect(comenzar).toBeEnabled(CARGA);

  // K07-a · K07-b: el aviso nombra la patente y el documento, y se puede comenzar igual.
  const aviso = drawer(page).locator('[data-testid="vehiculo-documentos"]');
  await expect(aviso).toHaveText(`Vehículo ${conSoap}: SOAP vencido`);
  await expect(comenzar).toBeEnabled();

  // K07-c: con un vehículo al día el aviso desaparece.
  await drawer(page)
    .locator('[data-llm-description="Selector de vehículo para la clase práctica"]')
    .click();
  await page.getByRole('option', { name: new RegExp('^' + alDia) }).click();
  await expect(aviso).toHaveCount(0);

  // Y vuelve al elegir de nuevo el del SOAP vencido.
  await drawer(page)
    .locator('[data-llm-description="Selector de vehículo para la clase práctica"]')
    .click();
  await page.getByRole('option', { name: new RegExp('^' + conSoap) }).click();
  await expect(aviso).toBeVisible();
  await comenzar.click();
  await expect(toasts(page, 'Clase iniciada').first()).toBeVisible(CARGA);
  expect((await estadoClase(clase.sessionId)).status).toBe('in_progress');
});

test('K18: doble clic en "Comenzar Clase" y en "Cerrar Clase" hace una sola acción', async ({
  pageAs,
  cleanup,
}) => {
  const clase = await seedClase(
    { label: 'AgK18', branchId: SEDE_A, cupo: { inst: 3, hora: 5 } },
    cleanup,
  );
  const page = await pageAs('secretariaA');
  await abrirAyer(page);

  // Comenzar con doble clic.
  await accion(fila(page, clase), 'iniciar-clase-practica').click();
  const kmSalida = page.locator('[data-llm-description^="Odómetro inicial"]');
  await expect(kmSalida).not.toHaveValue('', CARGA);
  const km = Number(await kmSalida.inputValue());
  await accion(page, 'admin-start-class').dblclick();
  await expect(toasts(page, 'Clase iniciada').first()).toBeVisible(CARGA);
  await page.waitForTimeout(2_000);
  await expect(toasts(page, 'Clase iniciada')).toHaveCount(1);
  await expect(toasts(page, /La clase cambió|Error al iniciar/)).toHaveCount(0);
  await expect(fila(page, clase)).toContainText('En curso');
  expect((await estadoClase(clase.sessionId)).status).toBe('in_progress');

  // Cerrar con doble clic.
  await accion(fila(page, clase), 'finalizar-clase-practica').click();
  const finalizar = accion(page, 'admin-finish-class');
  await expect(finalizar).toBeVisible(CARGA);
  await page.locator('[data-llm-description^="Odómetro final"]').fill(String(km + 7));
  await finalizar.dblclick();
  await expect(toasts(page, 'Clase finalizada').first()).toBeVisible(CARGA);
  await page.waitForTimeout(2_000);
  await expect(toasts(page, 'Clase finalizada')).toHaveCount(1);
  await expect(toasts(page, /La clase cambió|Error al finalizar/)).toHaveCount(0);
  const final = await estadoClase(clase.sessionId);
  expect(final.status).toBe('completed');
  expect(final.kmEnd).toBe(km + 7);
  expect(final.asistencias, 'una sola asistencia').toHaveLength(1);
});
