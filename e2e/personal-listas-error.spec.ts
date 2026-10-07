/**
 * Listas de instructores y secretarias con la carga fallando (ASG-i-034 S19, fix-209-b).
 *
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. Solo lectura; el error se simula
 * interceptando la consulta de la lista (no la de la sesión).
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const fail = { status: 500, contentType: 'application/json', body: '{"message":"e2e"}' };

test('S19: instructores — un error de carga se muestra como error, no como "sin resultados"', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.route('**/rest/v1/instructors?*', (route) => route.fulfill(fail));
  await page.goto('/app/admin/instructores');

  await expect(
    page.locator('[data-llm-description="error al cargar la lista de instructores"]'),
  ).toBeVisible();
  await expect(page.getByText('No hay instructores que coincidan con los filtros.')).toHaveCount(0);
});

test('S19: secretarias — un error de carga se muestra como error, no como "sin resultados"', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.route(
    (url) =>
      url.pathname.endsWith('/rest/v1/users') && url.search.includes('roles.name=eq.secretary'),
    (route) => route.fulfill(fail),
  );
  await page.goto('/app/admin/secretarias');

  await expect(
    page.locator('[data-llm-description="error al cargar la lista de secretarias"]'),
  ).toBeVisible();
  await expect(page.getByText('No hay registros que coincidan con los filtros.')).toHaveCount(0);
});
