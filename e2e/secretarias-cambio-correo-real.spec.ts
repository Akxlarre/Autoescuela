/**
 * M02 del checklist 034 (ASG-i-034, fix-197-b): el admin cambia el correo de una secretaria DE VERDAD.
 *
 * ⚠️ `update-secretary` no se intercepta: el correo cambia en `users` y en Auth. No corre con la
 * suite ni trae correos escritos: E2E_M02_FROM=<correo actual> E2E_M02_TO=<correo nuevo, libre>.
 * No envía ningún correo (el cambio por la API de admin es directo, hotfix-068-b).
 */
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

const FROM = (process.env['E2E_M02_FROM'] ?? '').trim().toLowerCase();
const TO = (process.env['E2E_M02_TO'] ?? '').trim().toLowerCase();
const CARGA = { timeout: 30_000 };

test.describe.configure({ timeout: 180_000 });
test.skip(!FROM || !TO, 'Cambia un correo real: correr con E2E_M02_FROM y E2E_M02_TO');

test('M02: el admin cambia el correo de una secretaria', async ({ pageAs }) => {
  const sb = await getAdminClient();
  const { data: antes } = await sb
    .from('users')
    .select('id, supabase_uid')
    .eq('email', FROM)
    .single();
  const { data: ocupado } = await sb.from('users').select('id').eq('email', TO).maybeSingle();
  expect(ocupado, `${TO} ya está registrado`).toBeNull();

  const page = await pageAs('admin');
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/app/admin/secretarias');
  const editar = page.locator('[data-llm-action="editar-secretaria"]');
  const fila = page.locator('div', { has: editar }).filter({ hasText: FROM }).last();
  await expect(fila).toBeVisible(CARGA);
  await fila.locator(editar).click();

  const drawer = page.locator('app-admin-secretarias-editar-drawer');
  const correo = drawer.locator(
    '[data-llm-description="Correo electrónico de acceso de la secretaria"]',
  );
  await expect(correo).toHaveValue(FROM, CARGA);
  await correo.fill(TO);
  // El aviso dice la verdad: cambio inmediato, sin correo de confirmación (S13, hotfix-068-b).
  await expect(drawer.getByText(/El cambio es inmediato/)).toBeVisible();

  await drawer.locator('[data-llm-action="guardar-editar-secretaria"]').click();
  await expect(page.getByText('Secretaria actualizada')).toBeVisible(CARGA);

  // La lista muestra el correo nuevo y ya no el viejo.
  await expect(page.locator('div', { has: editar }).filter({ hasText: TO }).last()).toBeVisible(
    CARGA,
  );
  await expect(page.getByText(FROM)).toHaveCount(0);

  const { data: despues } = await sb
    .from('users')
    .select('id, email, supabase_uid')
    .eq('id', antes!.id)
    .single();
  const { data: auditoria } = await sb
    .from('audit_log')
    .select('id, action, user_id')
    .eq('entity', 'users')
    .eq('entity_id', antes!.id)
    .eq('action', 'UPDATE')
    .order('id', { ascending: false })
    .limit(1);
  console.log('[M02]', JSON.stringify({ antes, despues, auditoria }));
  expect(despues!.email).toBe(TO);
  expect(despues!.supabase_uid, 'Sigue siendo la misma cuenta de Auth').toBe(antes!.supabase_uid);
  expect(auditoria).toHaveLength(1);
});
