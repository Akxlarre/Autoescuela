/**
 * Listado de Flota (ASG-i-032, fix-220-b). Checklist: specs/testing-piloto/032-flota-mantenimientos.md
 * — los IDs son los del checklist. Solo lee: no crea ni edita vehículos.
 */
import type { Page } from '@playwright/test';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };
const BUSCADOR = '[data-llm-description="input for searching vehicles by plate, brand or model"]';

test.describe.configure({ timeout: 120_000 });

/** Total que informa el paginador ("Mostrando 1 a 10 de N vehículos"). */
async function total(page: Page): Promise<number> {
  const pie = page.getByText(/Mostrando \d+ a \d+ de \d+ vehículos/);
  await expect(pie).toBeVisible(CARGA);
  return Number((await pie.innerText()).match(/de (\d+) vehículos/)![1]);
}

async function abrirFlota(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/flota');
  await total(page);
}

test('D01 (S4): el buscador filtra por patente, marca y modelo, y al borrarlo vuelven todos', async ({
  pageAs,
}) => {
  const sb = await getAdminClient();
  const { data: vehiculos } = await sb.from('vehicles').select('license_plate, brand, model');
  const uno = vehiculos![0];
  const conEsaMarca = vehiculos!.filter((v) =>
    `${v.brand}`.toLowerCase().includes(uno.brand.toLowerCase()),
  ).length;

  const page = await pageAs('admin');
  await abrirFlota(page);
  const todos = await total(page);
  expect(todos).toBe(vehiculos!.length);

  // Por patente, en minúsculas: queda ese vehículo.
  await page.locator(BUSCADOR).fill(uno.license_plate.toLowerCase());
  await expect.poll(() => total(page)).toBe(1);
  await expect(page.locator('p-table tbody tr').first()).toContainText(uno.license_plate);

  // Por marca.
  await page.locator(BUSCADOR).fill(uno.brand);
  await expect.poll(() => total(page)).toBe(conEsaMarca);

  // Sin coincidencias: lista vacía, sin romper.
  await page.locator(BUSCADOR).fill('zzzz-no-existe');
  await expect(page.locator('p-table tbody tr').filter({ hasText: uno.license_plate })).toHaveCount(
    0,
  );

  // Al borrar vuelven todos.
  await page.locator(BUSCADOR).fill('');
  await expect.poll(() => total(page)).toBe(todos);
});

test('D01: al volver a Flota la lista no queda filtrada con el buscador vacío', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirFlota(page);
  const todos = await total(page);

  await page.locator(BUSCADOR).fill('zzzz-no-existe');
  await page.locator('a[href="/app/admin/dashboard"]').first().click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.locator('a[href="/app/admin/flota"]').first().click();
  await expect(page.locator(BUSCADOR)).toHaveValue('');
  expect(await total(page)).toBe(todos);
});

test('S20: ya no existe el filtro "Tipo" (adivinaba Clase B / Profesional por la marca)', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirFlota(page);
  await expect(page.locator('[data-llm-action="filtrar-flota-por-tipo"]')).toHaveCount(0);
  await expect(page.getByText('Todos los tipos')).toHaveCount(0);
});
