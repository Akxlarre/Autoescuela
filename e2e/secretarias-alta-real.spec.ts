/**
 * L01 (pasos 1-2) y T01 (secretaria) del checklist 034 (ASG-i-034, fix-197-b): alta REAL de una
 * secretaria.
 *
 * ⚠️ `create-secretary` no se intercepta: crea la cuenta de Auth y ENVÍA el correo de invitación a
 * la dirección indicada. Por eso no corre con la suite ni trae un correo escrito: hay que pedirlo
 * con E2E_L01_EMAIL=<bandeja real que controla quien prueba>. El resto de L01 (abrir el enlace,
 * fijar la clave, entrar) lo hace una persona. La cuenta queda en la BD; se limpia por SQL.
 */
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

const EMAIL = (process.env['E2E_L01_EMAIL'] ?? '').trim().toLowerCase();
const SEDE_A = 'Autoescuela Chillán';
const CARGA = { timeout: 30_000 };

test.describe.configure({ timeout: 180_000 });
test.skip(!EMAIL, 'Envía un correo real: correr con E2E_L01_EMAIL=<bandeja de pruebas>');

function rutValido(cuerpo: number): string {
  let suma = 0;
  let factor = 2;
  for (const d of String(cuerpo).split('').reverse()) {
    suma += Number(d) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  return `${cuerpo}-${resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)}`;
}

test('L01 + T01: alta de secretaria en la sede A con invitación por correo', async ({ pageAs }) => {
  const sb = await getAdminClient();
  const { data: previa } = await sb.from('users').select('id').eq('email', EMAIL).maybeSingle();
  expect(previa, `${EMAIL} ya está registrado: usar otra bandeja`).toBeNull();

  const rut = rutValido(41_000_000 + (Math.floor(Date.now() / 1000) % 8_000_000));
  const page = await pageAs('admin');
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/app/admin/secretarias');
  await page.getByRole('button', { name: 'Nueva Secretaria' }).click();
  await expect(page.locator('#d-nombres')).toBeVisible(CARGA);

  await page.locator('#d-nombres').fill('Zzprueba');
  await page.locator('#d-paterno').fill('Secretaria');
  await page.locator('#d-materno').fill('Borrar');
  await page.locator('#d-rut').fill(rut);
  await page.locator('#d-rut').blur();
  await page.locator('#d-email').fill(EMAIL);
  await page.locator('#d-telefono').fill('912345678');
  await page.locator('#d-sede').click();
  await page.getByRole('option', { name: SEDE_A, exact: true }).click();
  await page
    .locator('[data-llm-action="toggle-secretary-all-branches-grant"]')
    .filter({ hasText: 'Solo su sede' })
    .click();

  await page.locator('[data-llm-action="confirmar-crear-secretaria"]').click();
  const toast = page.locator('.p-toast-message').last();
  await expect(toast).toBeVisible(CARGA);
  console.log('[L01] toast:', (await toast.innerText()).replace(/\n/g, ' | '));

  // Paso 2: aparece en la lista como "Activa".
  const editar = page.locator('[data-llm-action="editar-secretaria"]');
  const fila = page.locator('div', { has: editar }).filter({ hasText: EMAIL }).last();
  await expect(fila).toBeVisible(CARGA);
  await expect(fila).toContainText(/activa/i);
  await expect(fila).toContainText(SEDE_A);

  const { data: user } = await sb
    .from('users')
    .select('id, branch_id, active, first_login, can_access_both_branches, supabase_uid')
    .eq('email', EMAIL)
    .single();
  const { data: auditoria } = await sb
    .from('audit_log')
    .select('id, action, user_id')
    .eq('entity', 'users')
    .eq('entity_id', user!.id);
  const { data: admin } = await sb
    .from('users')
    .select('id')
    .eq('email', 'admin@test.com')
    .single();
  console.log('[L01] creada', JSON.stringify({ rut, user, auditoria }));

  expect(user).toMatchObject({
    branch_id: 1,
    active: true,
    first_login: true,
    can_access_both_branches: false,
  });
  expect(user!.supabase_uid, 'Cuenta de Auth creada y vinculada').toBeTruthy();
  // T01: el alta queda en la auditoría a nombre del admin.
  expect(auditoria?.filter((a) => a.action === 'INSERT' && a.user_id === admin!.id)).toHaveLength(
    1,
  );
});
