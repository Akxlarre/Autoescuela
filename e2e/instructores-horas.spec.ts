/**
 * Horas trabajadas de instructores (ASG-i-034 S16, fix-208-b).
 *
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. Solo lectura; el error se simula
 * interceptando la consulta a `instructor_monthly_hours`.
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const ERROR = '[data-llm-description="error al cargar las horas trabajadas"]';

test('S16: la consulta de horas va acotada a los instructores de la lista', async ({ pageAs }) => {
  const page = await pageAs('secretariaA'); // sede 1
  await page.goto('/app/secretaria/instructores');
  await expect(page.locator('tbody tr').first()).toBeVisible();

  const horas = page.waitForRequest((r) => r.url().includes('/instructor_monthly_hours'));
  await page.locator('[data-llm-action="hours"]').first().click();
  const url = decodeURIComponent((await horas).url());
  expect(url).toMatch(/instructor_id=in\.\([\d,]+\)/);
  await expect(page.locator(ERROR)).toHaveCount(0);
});

test('S16: un error de carga se muestra como error, no como "Sin clases"', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.route('**/rest/v1/instructor_monthly_hours*', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"e2e"}' }),
  );
  await page.goto('/app/admin/instructores');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await page.locator('[data-llm-action="hours"]').first().click();

  await expect(page.locator(ERROR)).toContainText('No se pudieron cargar las horas');
  await expect(page.getByText('Sin clases registradas para este período.')).toHaveCount(0);
});
