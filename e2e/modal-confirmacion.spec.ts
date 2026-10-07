/**
 * Modal de confirmación global: los datos de usuario se muestran como texto (hotfix-062-b,
 * ASG-i-037 caso F10). ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200.
 */
import { expect, test } from './support/fixtures';
import { getAdminClient } from './support/supabase-admin';

test.describe.configure({ mode: 'default', timeout: 90_000 });

test('F10: un nombre con HTML se ve literal en el modal, sin interpretarse', async ({
  pageAs,
  cleanup,
}) => {
  const nombre = `E2E-<b>negrita</b>-${Date.now()}`;
  const sb = await getAdminClient();
  const { data, error } = await sb
    .from('service_catalog')
    .insert({ name: nombre, base_price: 1000, active: true })
    .select('id')
    .single();
  if (error) throw new Error(`[e2e] No se pudo sembrar el servicio: ${error.message}`);
  cleanup.track('service_catalog', data.id);

  const page = await pageAs('admin');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/admin/servicios-especiales');
  await page.locator(`[data-llm-action="borrar-servicio-${data.id}"]`).click({ timeout: 30_000 });

  const modal = page.getByRole('dialog').filter({ hasText: 'Borrar servicio' });
  await expect(modal).toBeVisible();
  await expect(
    modal.getByText(`¿Borrar "${nombre}" del catálogo?`, { exact: false }),
  ).toBeVisible();
  await expect(modal.locator('b')).toHaveCount(0);

  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).toBeHidden();
});
