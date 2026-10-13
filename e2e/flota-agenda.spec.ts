/**
 * Agenda del vehículo (ASG-i-032, fix-220-b; fix-221-b). Casos K del checklist
 * specs/testing-piloto/032-flota-mantenimientos.md. Solo lee: las clases y el mantenimiento del día
 * se ponen en la RESPUESTA del servidor, no en la BD.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };

test.describe.configure({ timeout: 120_000 });

/** Instante (ISO, UTC) de una hora de pared de Chile de HOY. */
function hoyALas(hhmm: string): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  // Desfase de Chile respecto de UTC hoy (3 o 4 horas).
  const enChile = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const enUtc = new Date(new Date().toLocaleString('en-US', { timeZone: 'UTC' }));
  const desfaseMin = Math.round((enUtc.getTime() - enChile.getTime()) / 60_000);
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(
    Date.parse(`${hoy}T00:00:00Z`) + (h * 60 + m + desfaseMin) * 60_000,
  ).toISOString();
}

function clase(hora: string, alumno: string, status = 'scheduled') {
  return {
    id: Math.floor(Math.random() * 1e6),
    scheduled_at: hoyALas(hora),
    status,
    class_number: 3,
    duration_min: 50,
    enrollments: { students: { users: { first_names: alumno, paternal_last_name: 'Prueba' } } },
  };
}

async function conAgenda(page: Page, clases: unknown[], mantenimientos: unknown[]): Promise<void> {
  await page.route('**/rest/v1/class_b_sessions?*vehicle_id=eq.*', (route) =>
    route.request().method() === 'GET' && route.request().url().includes('scheduled_at=gte.')
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(clases),
        })
      : route.continue(),
  );
  await page.route('**/rest/v1/maintenance_records?*scheduled_date=eq.*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mantenimientos),
    }),
  );
}

async function abrirAgenda(page: Page) {
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/flota');
  await expect(page.getByText(/Mostrando \d+ a \d+ de \d+ vehículos/)).toBeVisible(CARGA);
  await page.locator('[data-llm-action="ver-agenda-vehiculo"]').first().click();
  const drawer = page.locator('app-vehicle-agenda-drawer');
  await expect(drawer).toBeVisible(CARGA);
  return drawer;
}

test('K03/S13: se ven todas las clases del día, en orden, sin las canceladas, y el mantenimiento', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await conAgenda(
    page,
    [
      clase('11:50', 'Segundo'),
      clase('11:00', 'Primero'),
      clase('18:20', 'Tarde'),
      clase('21:30', 'Noche'),
      clase('09:00', 'Cancelado', 'cancelled'),
    ],
    [{ id: 1, scheduled_date: '2026-01-01', type: 'Cambio de aceite', description: 'Taller' }],
  );
  const drawer = await abrirAgenda(page);

  // Las dos de la misma hora "en punto" (antes la de 11:50 pisaba a la de 11:00).
  await expect(drawer.getByText('Primero Prueba')).toBeVisible(CARGA);
  await expect(drawer.getByText('Segundo Prueba')).toBeVisible();
  // Las de la tarde y la noche (antes el día terminaba a las 17:00).
  await expect(drawer.getByText('Tarde Prueba')).toBeVisible();
  await expect(drawer.getByText('Noche Prueba')).toBeVisible();
  // La cancelada no ocupa el vehículo.
  await expect(drawer.getByText('Cancelado Prueba')).toHaveCount(0);
  // El mantenimiento del día (antes se consultaba y no se mostraba).
  await expect(drawer.getByText('Cambio de aceite — Taller')).toBeVisible();

  // Hora real de inicio y de término, y en orden.
  await expect(drawer.getByText('hasta las 12:40')).toBeVisible();
  const texto = await drawer.innerText();
  const posiciones = ['Cambio de aceite', 'Primero', 'Segundo', 'Tarde', 'Noche'].map((t) =>
    texto.indexOf(t),
  );
  expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
  for (const hora of ['11:00', '11:50', '18:20', '21:30']) {
    await expect(drawer.getByText(hora, { exact: true })).toBeVisible();
  }
});

test('K: sin clases ni mantenimientos se dice "Sin actividad hoy"', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await conAgenda(page, [], []);
  const drawer = await abrirAgenda(page);

  await expect(drawer.getByText('Sin actividad hoy')).toBeVisible(CARGA);
  await expect(drawer.getByText('Sin datos')).toHaveCount(0);
});
