/**
 * Cambiar la contraseña desde Ajustes exige la actual (ASG-i-034 P04, fix-216-b).
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. Las llamadas a Auth se interceptan:
 * no se cambia ninguna contraseña real.
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

test('P04: sin la actual no se puede; con una actual incorrecta no se cambia la clave', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/dashboard');

  let cambios = 0;
  await page.route('**/auth/v1/user', (route) => {
    if (route.request().method() === 'PUT') {
      cambios++;
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    }
    return route.continue();
  });
  await page.route('**/auth/v1/token?grant_type=password', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: '{"error":"invalid_grant","error_description":"Invalid login credentials"}',
    }),
  );

  await page.locator('[data-llm-action="open-user-profile-menu"]').click();
  await page.locator('[data-llm-nav="ajustes"]').click();
  await page.getByText('Cambiar Contraseña').first().click();

  const boton = page.locator('[data-llm-action="update-password"]');
  await page
    .locator('[data-llm-description="input for the new account password"]')
    .fill('NuevaClave123');
  await page
    .locator('[data-llm-description="input to confirm the new account password"]')
    .fill('NuevaClave123');
  await expect(boton).toBeDisabled(); // falta la actual

  await page
    .locator('[data-llm-description="input for the current account password"]')
    .fill('mala');
  await expect(boton).toBeEnabled();
  await boton.click();

  await expect(page.getByText('La contraseña actual no es correcta.')).toBeVisible();
  expect(cambios).toBe(0);
});
