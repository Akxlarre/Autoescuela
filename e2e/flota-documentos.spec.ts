/**
 * Documentos y página de mantenimientos de Flota (ASG-i-032, fix-220-b; hotfix-074-b).
 * IDs del checklist specs/testing-piloto/032-flota-mantenimientos.md. Solo lee: las fechas de
 * vencimiento se cambian en la RESPUESTA del servidor, no en la BD.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };

test.describe.configure({ timeout: 120_000 });

/** Día de calendario de Chile a N días de hoy (YYYY-MM-DD). */
function enDias(n: number): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Hace que el primer vehículo del listado tenga 3 documentos: uno vencido, uno por vencer (a 10
 * días) y uno vigente. Devuelve la patente de ese vehículo.
 */
async function conDocumentosDePrueba(page: Page): Promise<() => string> {
  let patente = '';
  await page.route('**/rest/v1/vehicles?*vehicle_documents*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const fila = Array.isArray(body) ? body[0] : body;
    if (fila && Array.isArray(fila.vehicle_documents)) {
      patente = fila.license_plate;
      fila.vehicle_documents = [
        { type: 'soap', expiry_date: enDias(-5), status: null, file_url: null },
        { type: 'technical_inspection', expiry_date: enDias(10), status: null, file_url: null },
        { type: 'circulation_permit', expiry_date: enDias(200), status: null, file_url: null },
      ];
    }
    await route.fulfill({ response, json: body });
  });
  return () => patente;
}

test('H/S8: el drawer de Documentos distingue Vencido, Por vencer y Vigente', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const patente = await conDocumentosDePrueba(page);
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/flota');
  await expect(page.getByText(/Mostrando \d+ a \d+ de \d+ vehículos/)).toBeVisible(CARGA);

  const fila = page.locator('p-table tbody tr').filter({ hasText: patente() });
  await fila.locator('[data-llm-action="gestionar-documentos-vehiculo"]').click();

  const drawer = page.locator('app-vehicle-documents-drawer');
  await expect(drawer.getByText('Vencido', { exact: true })).toHaveCount(1, CARGA);
  // Antes un documento a 10 días de vencer salía "Vigente" en verde.
  await expect(drawer.getByText('Por vencer', { exact: true })).toHaveCount(1);
  await expect(drawer.getByText('Vigente', { exact: true })).toHaveCount(1);
});

test('L08/S15: mantenimientos — los KPIs llevan el nombre de lo que miden', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const patente = await conDocumentosDePrueba(page);
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/flota');
  await expect(page.getByText(/Mostrando \d+ a \d+ de \d+ vehículos/)).toBeVisible(CARGA);
  expect(patente()).not.toBe('');

  // El detalle usa la misma consulta interceptada (primer y único vehículo de la respuesta).
  await page.goto('/app/admin/flota/1/mantenimientos');
  await expect(page.getByText('Costo prom. por servicio')).toBeVisible(CARGA);
  await expect(page.getByText('Kilometraje actual')).toBeVisible();
  await expect(page.getByText('Costo p/Mes')).toHaveCount(0);
  await expect(page.getByText('KM Recorridos')).toHaveCount(0);
});
