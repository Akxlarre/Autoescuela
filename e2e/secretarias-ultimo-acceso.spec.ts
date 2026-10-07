/**
 * Último acceso real de la secretaria (ASG-i-034 S14, fix-212-b).
 *
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. Solo lectura.
 * secretaria@test.com inicia sesión en cada corrida de la suite (setup), así que su último acceso
 * es de hoy; antes la ficha mostraba la fecha de creación (03/03/2026).
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

test('S14: la ficha muestra el último inicio de sesión real, no la fecha de creación', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const rpc = page.waitForResponse((r) => r.url().includes('/rpc/secretary_last_sign_in'));
  await page.goto('/app/admin/secretarias');
  await page
    .locator('.secretaria-row', { hasText: 'secretaria@test.com' })
    .locator('[data-llm-action="ver-detalle-secretaria"]')
    .click();

  expect((await rpc).status()).toBe(200);
  const hoy = new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(new Date())
    .replace(/-/g, '/');
  const celda = page.locator('[data-llm-description="último inicio de sesión de la secretaria"]');
  await expect(celda).toContainText(hoy);
  await expect(celda).not.toContainText('03/03/2026');
});
