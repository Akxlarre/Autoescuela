/**
 * Reenviar invitación con el correo editado sin guardar (ASG-i-034 S10, hotfix-067-b).
 *
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. `activate-instructor-account` se
 * intercepta (no se envía ningún correo) y nunca se guarda el formulario.
 * Datos: Instructor3 (sede 1) no tiene cuenta de Auth, así que muestra "Reenviar invitación".
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

test('H03 (S10): con el correo editado sin guardar, la invitación va al correo guardado y lo avisa', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  let body: Record<string, unknown> | null = null;
  await page.route('**/functions/v1/activate-instructor-account', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.route('**/functions/v1/update-instructor', (route) =>
    route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"e2e"}' }),
  );

  await page.goto('/app/admin/instructores');
  await page
    .locator('tr', { hasText: 'Instructor3 Apellido3' })
    .locator('[data-llm-action="editar-instructor"]')
    .click();

  const nota = page.locator(
    '[data-llm-description="nota de que la invitación va al correo guardado"]',
  );
  await expect(page.locator('[data-llm-action="enviar-invitacion-instructor"]')).toBeVisible();
  await expect(nota).toHaveCount(0);

  await page.locator('#e-email').fill('otro.correo@e2e.test');
  await expect(nota).toContainText('instructor.seed3@test-data.local');

  await page.locator('[data-llm-action="enviar-invitacion-instructor"]').click();
  await expect.poll(() => body, { timeout: 15_000 }).not.toBeNull();
  expect(body!['email']).toBe('instructor.seed3@test-data.local'); // antes: el del formulario
});
