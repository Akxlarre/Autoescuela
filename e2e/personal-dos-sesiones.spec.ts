/**
 * Casos de dos sesiones a la vez del checklist 034 (ASG-i-034, fix-197-b): M04, M05, N01, N02.
 *
 * Una sesión es el admin, que edita a la secretaria desde Admin → Secretarias con clics reales; la
 * otra es esa misma secretaria (secretaria2@test.com, sede 2) con su pantalla abierta. Lo que se
 * mira es qué cambia en la pantalla de ella SIN recargar.
 *
 * Cada test deja a la secretaria como estaba (sede 2, activa, sin acceso a todas las sedes) y lo
 * comprueba contra la BD al terminar.
 */
import type { Page } from '@playwright/test';
import { ACCOUNTS } from './support/accounts';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

const SECRETARIA = ACCOUNTS.secretariaB.email;
const SEDE_ORIGINAL = 'Conductores Chillán';
const SEDE_OTRA = 'Autoescuela Chillán';
const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };
/** Tiempo que se le da al cambio para llegar a la otra sesión sin recargar. */
const EN_VIVO = { timeout: 20_000 };

test.describe.configure({ mode: 'serial', timeout: 180_000 });

interface Cambios {
  sede?: string;
  activa?: boolean;
  todasLasSedes?: boolean;
}

/** El admin edita a la secretaria desde su ficha y guarda. */
async function editarSecretaria(admin: Page, cambios: Cambios): Promise<void> {
  await admin.setViewportSize(DESKTOP);
  await admin.goto('/app/admin/secretarias');
  // La lista no es una tabla: la fila es el contenedor más interno con el correo y el botón.
  const editar = admin.locator('[data-llm-action="editar-secretaria"]');
  const fila = admin.locator('div', { has: editar }).filter({ hasText: SECRETARIA }).last();
  await expect(fila).toBeVisible(CARGA);
  await fila.locator(editar).click();

  const drawer = admin.locator('app-admin-secretarias-editar-drawer');
  const guardar = drawer.locator('[data-llm-action="guardar-editar-secretaria"]');
  await expect(guardar).toBeVisible(CARGA);

  if (cambios.sede) {
    await drawer
      .locator('[data-llm-description="Sede de trabajo asignada a la secretaria"]')
      .click();
    await admin.getByRole('option', { name: cambios.sede, exact: true }).click();
  }
  if (cambios.activa !== undefined) {
    const accion = cambios.activa ? 'activar-secretaria' : 'desactivar-secretaria';
    await drawer.locator(`[data-llm-action="${accion}"]`).click();
  }
  if (cambios.todasLasSedes !== undefined) {
    const texto = cambios.todasLasSedes ? 'Todas las sedes' : 'Solo su sede';
    await drawer
      .locator('[data-llm-action="toggle-secretary-all-branches-grant"]')
      .filter({ hasText: texto })
      .click();
  }

  await guardar.click();
  await expect(admin.getByText('Secretaria actualizada')).toBeVisible(CARGA);
}

async function filaEnBd(): Promise<{
  branch_id: number;
  active: boolean;
  can_access_both_branches: boolean;
}> {
  const sb = await getAdminClient();
  const { data, error } = await sb
    .from('users')
    .select('branch_id, active, can_access_both_branches')
    .eq('email', SECRETARIA)
    .single();
  if (error) throw new Error(`[e2e] No se pudo leer a la secretaria: ${error.message}`);
  return data;
}

/** Abre el portal de la secretaria y espera a que cargue su sede. */
async function abrirPortal(sec: Page): Promise<void> {
  await sec.setViewportSize(DESKTOP);
  await sec.goto('/app/secretaria/instructores');
  await expect(sec.locator('app-sidebar')).toContainText(SEDE_ORIGINAL, CARGA);
  await sec.waitForLoadState('networkidle');
}

const selectorDeSede = (sec: Page) => sec.locator('app-topbar app-branch-selector');

test.afterEach(async ({ pageAs }) => {
  const fila = await filaEnBd();
  if (fila.branch_id === 2 && fila.active && !fila.can_access_both_branches) return;
  // Un test falló a medio camino: se repone por la misma vía que usa el admin.
  const admin = await pageAs('admin');
  await editarSecretaria(admin, { sede: SEDE_ORIGINAL, activa: true, todasLasSedes: false });
  expect(await filaEnBd()).toEqual({
    branch_id: 2,
    active: true,
    can_access_both_branches: false,
  });
});

test('N01 + N02: otorgar y revocar el acceso a todas las sedes se refleja sin recargar', async ({
  pageAs,
}) => {
  const sec = await pageAs('secretariaB');
  await abrirPortal(sec);
  await expect(selectorDeSede(sec)).toHaveCount(0);

  const admin = await pageAs('admin');
  await editarSecretaria(admin, { todasLasSedes: true });
  // N01 (AC-E3): aparece el selector de sede en la sesión abierta.
  await expect(selectorDeSede(sec)).toBeVisible(EN_VIVO);

  await editarSecretaria(admin, { todasLasSedes: false });
  // N02 (AC-E3): el selector desaparece y vuelve a ver solo su sede.
  await expect(selectorDeSede(sec)).toHaveCount(0, EN_VIVO);
  await expect(sec.locator('app-sidebar')).toContainText(SEDE_ORIGINAL);
});

test('M04: cambiar la sede de una secretaria se refleja en su sesión abierta', async ({
  pageAs,
}) => {
  const sec = await pageAs('secretariaB');
  await abrirPortal(sec);

  const admin = await pageAs('admin');
  await editarSecretaria(admin, { sede: SEDE_OTRA });
  await expect(sec.locator('app-sidebar')).toContainText(SEDE_OTRA, EN_VIVO);

  await editarSecretaria(admin, { sede: SEDE_ORIGINAL });
  await expect(sec.locator('app-sidebar')).toContainText(SEDE_ORIGINAL, EN_VIVO);
});

test('M05: desactivar a una secretaria con la sesión abierta la saca del sistema', async ({
  pageAs,
}) => {
  const sec = await pageAs('secretariaB');
  await abrirPortal(sec);

  const admin = await pageAs('admin');
  await editarSecretaria(admin, { activa: false });
  // fix-219-b: sin tocar nada, se le avisa y queda en el login. Antes seguía dentro y, al navegar,
  // veía todas las listas vacías ("Aún no hay alumnos") sin ninguna explicación.
  await expect(sec.getByText('Tu cuenta fue desactivada. Contacta al administrador.')).toBeVisible(
    EN_VIVO,
  );
  await expect(sec).toHaveURL(/\/login/, EN_VIVO);

  await editarSecretaria(admin, { activa: true });
});
