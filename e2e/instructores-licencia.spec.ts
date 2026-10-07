/**
 * Número de licencia obligatorio al editar (ASG-i-034 S20, fix-211-b).
 *
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. `update-instructor` se intercepta y
 * se cuenta: nunca llega a guardarse nada.
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

test('S20: Editar no guarda con el número de licencia vacío', async ({ pageAs }) => {
  const page = await pageAs('admin');
  let llamadas = 0;
  await page.route('**/functions/v1/update-instructor', (route) => {
    llamadas++;
    return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"e2e"}' });
  });

  await page.goto('/app/admin/instructores');
  await page
    .locator('tr', { hasText: 'Instructor2 Apellido2' })
    .locator('[data-llm-action="editar-instructor"]')
    .click();

  await page.locator('#e-license-num').fill('');
  await page.locator('[data-llm-action="guardar-editar-instructor"]').click();

  await expect(page.getByText('Ingresa el número de licencia.')).toBeVisible();
  await page.waitForTimeout(1000); // margen por si el submit llegara a disparar la función
  expect(llamadas).toBe(0);
});
