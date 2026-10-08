/**
 * El admin manda el correo de restablecimiento a una secretaria (ASG-i-034 O04, fix-217-b).
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. `/auth/v1/recover` se intercepta:
 * no se envía ningún correo.
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

test('O04: desde la ficha se manda el correo de restablecimiento a esa secretaria', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  let body: Record<string, unknown> | null = null;
  await page.route('**/auth/v1/recover*', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/app/admin/secretarias');
  await page
    .locator('.secretaria-row', { hasText: 'secretaria2@test.com' })
    .locator('[data-llm-action="ver-detalle-secretaria"]')
    .click();
  await page.locator('[data-llm-action="enviar-restablecimiento-clave-secretaria"]').click();

  await expect.poll(() => body, { timeout: 15_000 }).not.toBeNull();
  expect(body!['email']).toBe('secretaria2@test.com');
  await expect(page.getByText('Correo enviado').first()).toBeVisible();
});
