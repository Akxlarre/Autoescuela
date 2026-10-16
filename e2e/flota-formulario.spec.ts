/**
 * Formulario de vehículo de Flota (ASG-i-032, fix-220-b; hotfix-075-b). IDs del checklist
 * specs/testing-piloto/032-flota-mantenimientos.md. Nada se guarda: las escrituras a `vehicles`
 * se interceptan y los tests no llegan a confirmar.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };

test.describe.configure({ timeout: 120_000 });

/** Bloquea cualquier escritura a vehicles y cuenta los intentos. */
async function bloquearEscrituras(page: Page): Promise<() => number> {
  let escrituras = 0;
  await page.route('**/rest/v1/vehicles*', (route) => {
    if (route.request().method() === 'GET') return route.continue();
    escrituras++;
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  return () => escrituras;
}

async function abrirFlota(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/flota');
  await expect(page.getByText(/Mostrando \d+ a \d+ de \d+ vehículos/)).toBeVisible(CARGA);
}

async function abrirEdicion(page: Page): Promise<void> {
  await abrirFlota(page);
  await page.locator('[data-llm-action="editar-vehiculo"]').first().click();
  await expect(page.locator('#vf-plate')).not.toHaveValue('', CARGA);
}

test('E/S19: la patente se normaliza al escribir y solo acepta formatos reales; el año tiene tope', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const escrituras = await bloquearEscrituras(page);
  await abrirFlota(page);
  await page
    .getByRole('button', { name: /Nuevo Vehículo/i })
    .first()
    .click();
  const patente = page.locator('#vf-plate');
  await expect(patente).toBeVisible(CARGA);

  // Con guion, espacio y minúsculas: queda normalizada y es válida.
  await patente.pressSequentially('ab-cd 12');
  await expect(patente).toHaveValue('ABCD12');
  await patente.blur();
  await expect(page.getByText(/Patente inválida/)).toHaveCount(0);

  // Formato antiguo.
  await patente.fill('zz4103');
  await patente.blur();
  await expect(patente).toHaveValue('ZZ4103');
  await expect(page.getByText(/Patente inválida/)).toHaveCount(0);

  // 3 letras + 3 números no existe (antes se aceptaba).
  await patente.fill('ABC123');
  await patente.blur();
  await expect(page.getByText(/Patente inválida/)).toBeVisible();

  // Año absurdo (la columna es SMALLINT): no deja guardar.
  const anio = page.locator('#vf-year');
  await anio.fill('99999');
  await anio.blur();
  await expect(page.getByText(/Año entre 1900 y \d{4}\./)).toBeVisible();
  await expect(page.locator('[data-llm-action="save-vehicle"]')).toBeDisabled();
  expect(escrituras()).toBe(0);
});

test('F06/S18: refrescar la lista no pisa lo que se está escribiendo al editar', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await bloquearEscrituras(page);
  await abrirEdicion(page);

  const marca = page.locator('#vf-brand');
  await marca.fill('Marca escrita a mano');

  // La lista del facade se vuelve a cargar (lo mismo que un evento en vivo o un cambio de sede).
  const recarga = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/vehicles') && r.request().method() === 'GET',
  );
  await page
    .locator('[data-llm-action="actualizar-lista-flota"]')
    .evaluate((b) => (b as HTMLElement).click());
  await recarga;
  await page.waitForLoadState('networkidle');

  await expect(marca).toHaveValue('Marca escrita a mano');
});

test('F05/S3: bajar el kilometraje pide confirmación; al cancelar no se guarda', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const escrituras = await bloquearEscrituras(page);
  await abrirEdicion(page);

  const km = page.locator('#vf-km');
  await expect(km).not.toHaveValue('');
  const actual = Number(await km.inputValue());
  test.skip(actual < 1, 'El primer vehículo de la lista tiene kilometraje 0: no se puede bajar');

  await km.fill(String(actual - 1));
  await page.locator('[data-llm-action="save-vehicle"]').click();

  await expect(page.getByText('Bajar el kilometraje')).toBeVisible();
  await expect(
    page.getByText(`El kilometraje registrado es ${actual} km y vas a guardar ${actual - 1} km.`, {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .locator('[aria-labelledby="confirm-modal-title"]')
    .getByRole('button', { name: 'Cancelar' })
    .click();
  await expect(page.getByText('Bajar el kilometraje')).toHaveCount(0);
  expect(escrituras()).toBe(0);
});

test('G09 (hotfix-083-b): quitar "Ambas" a un vehículo con instructor pide confirmación', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const escrituras = await bloquearEscrituras(page);
  // El primer vehículo con instructor asignado pasa a ser "Ambas" en la respuesta (sin tocar la BD).
  let patente = '';
  await page.route('**/rest/v1/vehicles?*vehicle_assignments*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const conInstructor = Array.isArray(body)
      ? body.find((v: any) => v.vehicle_assignments?.some((a: any) => a.end_date === null))
      : null;
    if (conInstructor) {
      conInstructor.both_branches = true;
      patente = conInstructor.license_plate;
    }
    await route.fulfill({ response, json: body });
  });
  await abrirFlota(page);
  test.skip(!patente, 'Ningún vehículo tiene instructor asignado');

  await page
    .locator('[data-llm-description="input for searching vehicles by plate, brand or model"]')
    .fill(patente);
  await page.locator('[data-llm-action="editar-vehiculo"]').first().click();
  await expect(page.locator('#vf-plate')).toHaveValue(patente, CARGA);

  await page.locator('label[for="branch-scope-both"]').click();
  await page.locator('[data-llm-action="save-vehicle"]').click();

  const modal = page.locator('[aria-labelledby="confirm-modal-title"]');
  await expect(modal.getByText('Quitar "Ambas sedes"')).toBeVisible();
  await expect(modal.getByText(/sus horarios en la otra sede dejan de ofrecerse/)).toBeVisible();
  await modal.getByRole('button', { name: 'Cancelar' }).click();
  expect(escrituras()).toBe(0);
});
