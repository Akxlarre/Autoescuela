/**
 * Desactivar instructor (ASG-i-034 S9, fix-205-b). Decisión del owner: avisar, no bloquear.
 *
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. Nunca se guarda: solo se marca
 * "Inactivo" en el formulario, y `update-instructor` se intercepta por si acaso.
 * Datos: Instructor1 (sede 1) tiene clases agendadas a futuro y vehículo; Instructor2 no tiene
 * clases a futuro.
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const AVISO =
  '[data-llm-description="aviso de lo que queda pendiente al desactivar al instructor"]';

async function abrirEditarYDesactivar(page: import('@playwright/test').Page, nombre: string) {
  await page.route('**/functions/v1/update-instructor', (route) =>
    route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"e2e"}' }),
  );
  await page.goto('/app/admin/instructores');
  await page
    .locator('tr', { hasText: nombre })
    .locator('[data-llm-action="editar-instructor"]')
    .click();
  await page.locator('[data-llm-action="desactivar-instructor"]').click();
  return page.locator(AVISO);
}

test('S9: con clases futuras y vehículo → avisa ambas cosas, sin bloquear el guardado', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const aviso = await abrirEditarYDesactivar(page, 'Instructor1 Apellido1');

  await expect(aviso).toContainText('le impedirá iniciar sesión y recibir clases nuevas');
  await expect(aviso).toContainText(/Tiene \d+ clases? agendadas? a futuro/);
  await expect(aviso).toContainText('Reasígna');
  await expect(aviso).toContainText(/Su vehículo \S+ sigue asignado/);
  await expect(page.locator('[data-llm-action="guardar-editar-instructor"]')).toBeEnabled();
});

test('S9: sin clases futuras → no inventa el aviso de clases', async ({ pageAs }) => {
  const page = await pageAs('admin');
  const conteo = page.waitForResponse(
    (r) => r.url().includes('/class_b_sessions') && r.request().method() === 'HEAD',
  );
  const aviso = await abrirEditarYDesactivar(page, 'Instructor2 Apellido2');
  await conteo;

  await expect(aviso).toContainText('le impedirá iniciar sesión');
  await expect(aviso).not.toContainText('agendada');
});
