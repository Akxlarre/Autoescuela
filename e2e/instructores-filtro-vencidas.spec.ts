/**
 * Filtro "Licencia vencida" en Instructores (ASG-i-034 B06, hotfix-069-b).
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. Solo lectura.
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

test('B06: la pill "Licencia vencida (N)" cuenta y filtra solo las vencidas', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/instructores');
  const filas = page.locator('tbody tr.instructor-row');
  await expect(filas.first()).toBeVisible();

  const vencidasEnTodos = await filas.filter({ hasText: 'Vencida' }).count();
  const pill = page.locator('[data-llm-action="filtro-licencia-vencida"]');
  await expect(pill).toContainText(`Licencia vencida (${vencidasEnTodos})`);

  await pill.click();
  if (vencidasEnTodos === 0) {
    await expect(
      page.getByText('No hay instructores que coincidan con los filtros.'),
    ).toBeVisible();
  } else {
    await expect(filas).toHaveCount(vencidasEnTodos);
    for (const fila of await filas.all()) await expect(fila).toContainText('Vencida');
  }
});
