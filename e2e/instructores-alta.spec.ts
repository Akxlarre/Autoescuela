/**
 * Alta de instructores (ASG-i-034, fix-197-b). Checklist:
 * specs/testing-piloto/034-instructores-secretarias-usuarios.md — los IDs son los del checklist.
 *
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. La llamada a `create-instructor` se
 * intercepta (400 simulado): ningún test crea instructores ni cuentas de Auth.
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

test('D01/D02 (S3): la secretaria crea en SU sede aunque el navegador guarde la sede de otro usuario', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA'); // sede 1, sin grant
  // Sede 2 guardada en el navegador, como si la hubiera dejado un admin (D02).
  await page.addInitScript(() =>
    localStorage.setItem(
      'autoescuela:selectedBranchId',
      JSON.stringify({ id: 2, name: 'Conductores Chillán' }),
    ),
  );
  let body: Record<string, unknown> | null = null;
  await page.route('**/functions/v1/create-instructor', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: '{"error":"simulado e2e"}',
    });
  });

  await page.goto('/app/secretaria/instructores');
  await page.locator('[data-llm-action="new"]').first().click();
  await page.locator('#c-nombres').fill('Prueba');
  await page.locator('#c-paterno').fill('Sede');
  await page.locator('#c-materno').fill('Tres');
  await page.locator('#c-rut').fill('11.111.111-1');
  await page.locator('#c-email').fill('e2e.s3@e2e.test');
  await page.locator('#c-telefono').fill('912345678');
  const fecha = page.locator(
    '[data-llm-description="Fecha de vencimiento de la licencia del instructor"] input',
  );
  await fecha.click();
  await fecha.pressSequentially('31/12/2030', { delay: 30 });
  await fecha.press('Tab');
  await page.locator('#c-type').click();
  await page.getByRole('option').first().click();

  // La secretaria anclada no elige sede: no ve el campo.
  await expect(page.locator('app-branch-scope-selector')).toHaveCount(0);

  await page.locator('[data-llm-action="confirmar-crear-instructor"]').click();
  await expect.poll(() => body, { timeout: 15_000 }).not.toBeNull();
  expect(body!['branchId']).toBe(1); // antes: 2 (la sede guardada)
});
