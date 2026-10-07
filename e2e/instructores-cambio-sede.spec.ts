/**
 * Cambiar de sede a un instructor con clases futuras (ASG-i-034 E13, hotfix-070-b): solo avisa.
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. Nunca se guarda (`update-instructor`
 * interceptado). Instructor1 es de la sede 1 y tiene clases agendadas a futuro.
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const AVISO = '[data-llm-description="aviso de clases futuras al cambiar de sede al instructor"]';

test('E13: al cambiarlo de sede avisa de sus clases futuras; en "Ambas" no', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.route('**/functions/v1/update-instructor', (route) =>
    route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"e2e"}' }),
  );
  const conteo = page.waitForResponse(
    (r) => r.url().includes('/class_b_sessions') && r.request().method() === 'HEAD',
  );
  await page.goto('/app/admin/instructores');
  await page
    .locator('tr', { hasText: 'Instructor1 Apellido1' })
    .locator('[data-llm-action="editar-instructor"]')
    .click();
  await conteo;
  await expect(page.locator(AVISO)).toHaveCount(0);

  await page.locator('#branch-scope-sede').click();
  await page.getByRole('option', { name: 'Conductores Chillán' }).click();
  await expect(page.locator(AVISO)).toContainText(/Tiene \d+ clases? agendadas? a futuro/);

  await page.locator('#branch-scope-both').click();
  await expect(page.locator(AVISO)).toHaveCount(0);
});
