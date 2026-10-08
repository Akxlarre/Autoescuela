/**
 * Una escritura rechazada por la base no termina en aviso de éxito (ASG-i-055, fix-362-m).
 *
 * El fallo se simula interceptando la petición: NINGUNA escritura de estos tests llega a la
 * base (la que debe "salir bien" se responde acá, la que debe fallar se responde con 403).
 * Por eso no crean ni limpian datos.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const rlsDenied = {
  status: 403,
  contentType: 'application/json',
  body: JSON.stringify({ code: '42501', message: 'e2e: permission denied' }),
};

/**
 * Deja pasar las lecturas y responde acá toda escritura: 403 si la ruta coincide con
 * `failing`, éxito vacío en cualquier otro caso. Devuelve las escrituras vistas.
 */
async function interceptWrites(page: Page, failing: string): Promise<string[]> {
  const seen: string[] = [];
  await page.route(/\/(rest|functions)\/v1\//, (route) => {
    const request = route.request();
    const method = request.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return route.continue();

    const path = new URL(request.url()).pathname;
    seen.push(`${method} ${path}`);
    if (path.includes(failing)) return route.fulfill(rlsDenied);
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  return seen;
}

/** Retrocede meses hasta encontrar una fila con el botón pedido. */
async function findMonthWith(page: Page, action: string): Promise<boolean> {
  const button = page.locator(`[data-llm-action="${action}"]:visible`).first();
  for (let month = 0; month < 12; month++) {
    await expect(page.getByLabel('Tabla de liquidaciones de instructores')).toBeVisible();
    await page.waitForLoadState('networkidle');
    if (await button.isVisible()) return true;
    await page.getByLabel('Mes anterior').click();
  }
  return false;
}

test('pagar una liquidación: si los anticipos no se marcan como descontados, no dice que se registró', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const writes = await interceptWrites(page, 'instructor_advances');
  await page.goto('/app/admin/contabilidad/liquidaciones');

  const found = await findMonthWith(page, 'pagar-instructor');
  test.skip(!found, 'No hay ninguna liquidación pendiente en los últimos 12 meses');

  await page.locator('[data-llm-action="pagar-instructor"]:visible').first().click();
  await page.locator('[data-llm-action="confirmar-pago-instructor"]').click();

  await expect(page.locator('.p-toast-message-error')).toBeVisible();
  await expect(page.getByText(/registrada correctamente/)).toHaveCount(0);
  expect(writes.some((w) => w.includes('instructor_advances'))).toBe(true);
});

test('revertir un pago: si los anticipos no vuelven a pendientes, no dice que se revirtió', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const writes = await interceptWrites(page, 'instructor_advances');
  // En desarrollo no hay liquidaciones pagadas (instructor_monthly_payments está vacía), así
  // que la lectura se responde acá: todo instructor figura como pagado en el mes consultado.
  await page.route(/\/rest\/v1\/instructor_monthly_payments/, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const period = new URL(route.request().url()).searchParams.get('period')?.replace('eq.', '');
    const paid = Array.from({ length: 3000 }, (_, i) => ({
      id: i + 1,
      instructor_id: i + 1,
      period,
      payment_status: 'paid',
      paid_at: '2026-01-01T12:00:00Z',
    }));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(paid),
    });
  });
  await page.goto('/app/admin/contabilidad/liquidaciones');

  const found = await findMonthWith(page, 'deshacer-pago-instructor');
  test.skip(!found, 'No hay instructores con liquidación en los últimos 12 meses');

  await page.locator('[data-llm-action="deshacer-pago-instructor"]:visible').first().click();

  await expect(page.locator('.p-toast-message-error')).toBeVisible();
  await expect(page.getByText(/revertido\./)).toHaveCount(0);
  expect(writes.some((w) => w.includes('instructor_advances'))).toBe(true);
});
