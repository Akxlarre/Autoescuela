/**
 * Secretaria con acceso multisede crea un instructor eligiendo la sede (ASG-i-034 D04/D05,
 * fix-215-b). ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. `create-instructor` se
 * intercepta: no se crea nada.
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

test('D05: con "Todas las sedes" en el topbar, la secretaria multisede elige la sede y se envía', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaMultisede');
  let body: Record<string, unknown> | null = null;
  await page.route('**/functions/v1/create-instructor', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"e2e"}' });
  });

  await page.goto('/app/secretaria/instructores');
  await page.locator('[data-llm-action="new"]').first().click();
  await page.locator('#c-nombres').fill('Prueba');
  await page.locator('#c-paterno').fill('Multisede');
  await page.locator('#c-rut').fill('11.111.111-1');
  await page.locator('#c-email').fill('e2e.d05@e2e.test');
  await page.locator('#c-telefono').fill('912345678');
  await page.locator('#c-license-num').fill('11111111');
  const fecha = page.locator(
    '[data-llm-description="Fecha de vencimiento de la licencia del instructor"] input',
  );
  await fecha.click();
  await fecha.pressSequentially('31/12/2030', { delay: 30 });
  await fecha.press('Tab');
  await page.locator('#c-type').click();
  await page.getByRole('option').first().click();

  // Antes: el campo Sede se veía pero bloqueado (no se podía crear).
  await page.locator('#branch-scope-sede').click();
  await page.getByRole('option', { name: 'Conductores Chillán' }).click();
  await expect(page.locator('#branch-scope-both')).toHaveCount(0); // "Ambas" solo admin

  await page.locator('[data-llm-action="confirmar-crear-instructor"]').click();
  await expect.poll(() => body, { timeout: 15_000 }).not.toBeNull();
  expect(body!['branchId']).toBe(2);
});
