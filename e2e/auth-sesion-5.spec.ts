/**
 * Testing de autenticación y sesión — cambios del admin "en caliente" (ASG-i-022, fix-183-b):
 * K05 (dar el grant multisede), K06 (quitarlo) y K07 (cambiar la sede) a una secretaria con la
 * sesión abierta. Escribe sobre las CUENTAS DE PRUEBA y siempre deja el valor original al terminar
 * (finally). No borra nada.
 */
import { ACCOUNTS } from './support/accounts';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

test.describe.configure({ mode: 'serial', timeout: 120_000 });

const CARGA = { timeout: 30_000 };
const VIVO = { timeout: 20_000 };

async function usuario(email: string) {
  const sb = await getAdminClient();
  const { data, error } = await sb
    .from('users')
    .select('id, branch_id, can_access_both_branches')
    .eq('email', email)
    .single();
  if (error) throw error;
  return data as { id: number; branch_id: number; can_access_both_branches: boolean };
}

async function actualizar(id: number, cambios: Record<string, unknown>): Promise<void> {
  const sb = await getAdminClient();
  const { error } = await sb.from('users').update(cambios).eq('id', id);
  if (error) throw error;
}

test('K05 + K06: dar y quitar el grant multisede se refleja sin recargar', async ({ pageAs }) => {
  const antes = await usuario(ACCOUNTS.secretariaB.email);
  test.skip(antes.can_access_both_branches, 'La cuenta ya tiene el grant');
  const page = await pageAs('secretariaB');
  await page.goto('/app/secretaria/dashboard');
  await expect(page.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
  const selector = page.locator('app-topbar app-branch-selector');
  const disparador = page.locator('[data-llm-action="toggle-branch-dropdown"]');
  const sinGrant = await disparador.count();
  // El admin cambia el permiso con la sesión ya asentada (canal Realtime unido).
  await page.waitForTimeout(5_000);

  try {
    // K05: aparece el selector de sede sin recargar.
    await actualizar(antes.id, { can_access_both_branches: true });
    await expect(disparador).toHaveCount(1, VIVO);

    // K06: desaparece y queda en su sede (regresión UAT P7 / fix-422-m).
    await actualizar(antes.id, { can_access_both_branches: false });
    await expect(disparador).toHaveCount(sinGrant, VIVO);
    // Sin grant no hay selector: la sede se lee en la marca del menú.
    await expect(selector).toHaveCount(0, VIVO);
    await expect(page.locator('app-sidebar app-logo')).toContainText('Conductores', VIVO);
  } finally {
    await actualizar(antes.id, { can_access_both_branches: antes.can_access_both_branches });
  }
});

test('K07: cambiar la sede de una secretaria conectada se refleja sin recargar', async ({
  pageAs,
}) => {
  const antes = await usuario(ACCOUNTS.secretariaA.email);
  const page = await pageAs('secretariaA');
  await page.goto('/app/secretaria/dashboard');
  await expect(page.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
  const nombre = page.locator('app-sidebar app-logo');
  await page.waitForTimeout(5_000);

  try {
    await actualizar(antes.id, { branch_id: antes.branch_id === 1 ? 2 : 1 });
    const nueva = antes.branch_id === 1 ? 'Conductores' : 'Autoescuela Chillán';
    // Sin recargar: el canal Realtime refresca el perfil y la marca cambia sola.
    await expect(nombre).toContainText(nueva, VIVO);
    // Tras recargar sigue la sede nueva (mientras carga el perfil se ve la marca genérica).
    await page.reload();
    await expect(nombre).toContainText(nueva, CARGA);
  } finally {
    await actualizar(antes.id, { branch_id: antes.branch_id });
  }
});
