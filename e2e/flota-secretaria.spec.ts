/**
 * Flota para la secretaria, limitada a su sede (spec 0051-b). ACs de
 * specs/specs/0051-b-flota-secretaria/spec.md. Solo lee: no crea ni edita vehículos (los permisos
 * de escritura se prueban en supabase/tests/rls/0051-b-flota-secretaria.sql).
 */
import type { Page } from '@playwright/test';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };
const BUSCADOR = '[data-llm-description="input for searching vehicles by plate, brand or model"]';
const SEDE_A = 1;
const SEDE_B = 2;

test.describe.configure({ timeout: 120_000 });

interface Vehiculo {
  id: number;
  license_plate: string;
  branch_id: number | null;
  both_branches: boolean;
}

async function vehiculos(): Promise<Vehiculo[]> {
  const sb = await getAdminClient();
  const { data } = await sb.from('vehicles').select('id, license_plate, branch_id, both_branches');
  return data as Vehiculo[];
}

async function total(page: Page): Promise<number> {
  const pie = page.getByText(/Mostrando \d+ a \d+ de \d+ vehículos/);
  await expect(pie).toBeVisible(CARGA);
  return Number((await pie.innerText()).match(/de (\d+) vehículos/)![1]);
}

async function abrirFlota(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/secretaria/flota');
  await total(page);
}

function fila(page: Page, patente: string) {
  return page.locator('p-table tbody tr').filter({ hasText: patente });
}

test('AC1 + AC2: la secretaria tiene Flota en el menú y ve solo su sede (y los "Ambas")', async ({
  pageAs,
}) => {
  const todos = await vehiculos();
  const visibles = todos.filter((v) => v.both_branches || v.branch_id === SEDE_A);
  const ajeno = todos.find((v) => !v.both_branches && v.branch_id === SEDE_B)!;

  const page = await pageAs('secretariaA');
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/secretaria/dashboard');
  await page.locator('a[href="/app/secretaria/flota"]').first().click();
  await expect(page).toHaveURL(/\/app\/secretaria\/flota$/);

  expect(await total(page)).toBe(visibles.length);
  // Un vehículo exclusivo de la otra sede no aparece ni buscándolo.
  await page.locator(BUSCADOR).fill(ajeno.license_plate);
  await expect(fila(page, ajeno.license_plate)).toHaveCount(0);
});

test('AC2: por URL, el detalle de un vehículo de la otra sede dice "Vehículo no encontrado"', async ({
  pageAs,
}) => {
  const ajeno = (await vehiculos()).find((v) => !v.both_branches && v.branch_id === SEDE_B)!;
  const page = await pageAs('secretariaA');
  await page.setViewportSize(DESKTOP);
  await page.goto(`/app/secretaria/flota/${ajeno.id}/mantenimientos`);

  await expect(page.getByText('Vehículo no encontrado.')).toBeVisible(CARGA);
  await expect(page.getByText(ajeno.license_plate)).toHaveCount(0);
});

test('AC3 + AC4: opera los vehículos de su sede; un "Ambas" queda en solo lectura', async ({
  pageAs,
}) => {
  const propios = (await vehiculos()).filter((v) => !v.both_branches && v.branch_id === SEDE_A);
  const [propio, compartido] = propios;
  expect(compartido, 'Hacen falta 2 vehículos en la sede A').toBeTruthy();

  const page = await pageAs('secretariaA');
  // En la BD no hay vehículos "Ambas": uno de la sede A se presenta como tal en la respuesta.
  await page.route('**/rest/v1/vehicles?*vehicle_documents*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const v of Array.isArray(body) ? body : [body]) {
      if (v?.id === compartido.id) v.both_branches = true;
    }
    await route.fulfill({ response, json: body });
  });
  await abrirFlota(page);

  // Su sede: puede editar, y en Documentos puede cargar o renovar.
  await page.locator(BUSCADOR).fill(propio.license_plate);
  await expect(fila(page, propio.license_plate)).toHaveCount(1);
  await expect(
    fila(page, propio.license_plate).locator('[data-llm-action="editar-vehiculo"]'),
  ).toHaveCount(1);

  // "Ambas": se ve, pero sin Editar; en Documentos no hay nada que cargar.
  await page.locator(BUSCADOR).fill(compartido.license_plate);
  const filaAmbas = fila(page, compartido.license_plate);
  await expect(filaAmbas).toHaveCount(1);
  await expect(filaAmbas.locator('[data-llm-action="editar-vehiculo"]')).toHaveCount(0);
  await filaAmbas.locator('[data-llm-action="gestionar-documentos-vehiculo"]').click();
  const drawer = page.locator('app-vehicle-documents-drawer');
  await expect(drawer).toBeVisible(CARGA);
  await expect(drawer.locator('[data-llm-action="edit-vehicle-document"]')).toHaveCount(0);

  // Y en su página de mantenimientos no puede registrar.
  await page.goto(`/app/secretaria/flota/${compartido.id}/mantenimientos`);
  await expect(page.getByText('Kilometraje actual')).toBeVisible(CARGA);
  await expect(page.getByRole('button', { name: /Registrar Servicio/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Hoja de Ruta/ })).toHaveCount(1);
});

test('AC3: en un vehículo de su sede puede registrar mantenimientos y volver a su Flota', async ({
  pageAs,
}) => {
  const propio = (await vehiculos()).find((v) => !v.both_branches && v.branch_id === SEDE_A)!;
  const page = await pageAs('secretariaA');
  await page.setViewportSize(DESKTOP);
  await page.goto(`/app/secretaria/flota/${propio.id}/mantenimientos`);

  await expect(page.getByRole('button', { name: /Registrar Servicio/ })).toBeVisible(CARGA);
  // El "volver" lleva a SU Flota, no a la del admin.
  await expect(page.locator('a[href="/app/secretaria/flota"]').first()).toBeVisible();
  await expect(page.locator('a[href="/app/admin/flota"]')).toHaveCount(0);
});

test('AC3 + AC6: crea vehículos en SU sede — sin selector de sede ni "Ambas sedes"', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  // La creación se intercepta: se mira qué enviaría, sin crear nada.
  let enviado: Record<string, unknown> | null = null;
  await page.route('**/rest/v1/vehicles*', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    enviado = route.request().postDataJSON();
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await abrirFlota(page);
  await page
    .getByRole('button', { name: /Nuevo Vehículo/i })
    .first()
    .click();
  await expect(page.locator('#vf-plate')).toBeVisible(CARGA);

  // Anclada a su sede: no elige sede ni puede marcar "Ambas".
  await expect(page.locator('app-branch-scope-selector')).toHaveCount(0);
  await expect(page.locator('#branch-scope-both')).toHaveCount(0);

  await page.locator('#vf-plate').fill('ZZZZ99');
  await page.locator('#vf-brand').fill('Prueba');
  await page.locator('#vf-model').fill('E2E');
  const guardar = page.locator('[data-llm-action="save-vehicle"]');
  await expect(guardar).toBeEnabled();
  await guardar.click();

  await expect.poll(() => enviado, { timeout: 15_000 }).not.toBeNull();
  const fila = (Array.isArray(enviado) ? enviado[0] : enviado) as Record<string, unknown>;
  expect(fila['branch_id']).toBe(SEDE_A);
  expect(fila['both_branches']).toBe(false);
});

test('AC7: la búsqueda global lleva a una Flota que existe', async ({ pageAs }) => {
  const page = await pageAs('secretariaA');
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/secretaria/dashboard');
  await page.locator('[data-llm-action="open-search-panel"] button').click();
  await page
    .locator('[data-llm-description="Global command palette — alumnos, acciones, vistas"]')
    .fill('flota');
  await page
    .locator('[data-llm-action="search-result-item"]')
    .filter({ hasText: 'Flota Vehicular' })
    .first()
    .click();

  await expect(page).toHaveURL(/\/app\/secretaria\/flota$/);
  await total(page);
});

test('AC-E2: con grant multi-sede ve las dos sedes y puede editar las dos', async ({ pageAs }) => {
  const todos = await vehiculos();
  const deB = todos.find((v) => !v.both_branches && v.branch_id === SEDE_B)!;

  const page = await pageAs('secretariaMultisede');
  await abrirFlota(page);
  expect(await total(page)).toBe(todos.length);

  await page.locator(BUSCADOR).fill(deB.license_plate);
  await expect(
    fila(page, deB.license_plate).locator('[data-llm-action="editar-vehiculo"]'),
  ).toHaveCount(1);
});

test('AC8: el admin sigue viendo todo y editando todo', async ({ pageAs }) => {
  const todos = await vehiculos();
  const page = await pageAs('admin');
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/flota');
  expect(await total(page)).toBe(todos.length);
  await expect(page.locator('[data-llm-action="editar-vehiculo"]').first()).toBeVisible();
});
