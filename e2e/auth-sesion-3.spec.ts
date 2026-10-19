/**
 * Testing de autenticación y sesión — tercera tanda (ASG-i-022, fix-183-b). Casos del checklist
 * specs/testing-piloto/022-autenticacion-sesion-fase-piloto.md que necesitaban red lenta, varias
 * pestañas o acceso por URL/API. Los IDs son los del checklist. No crea ni modifica datos.
 */
import type { Page } from '@playwright/test';
import { ACCOUNTS } from './support/accounts';
import { getAdminClient, getClientFor } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 90_000 });

const EMAIL = '[data-llm-description="User email address for authentication"]';
const PASSWORD = '[data-llm-description="User password for authentication"]';
const SUBMIT = '[data-llm-action="submit-auth-form"]';
const CARGA = { timeout: 30_000 };
const BRANCH_KEY = 'autoescuela:selectedBranchId';

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator(EMAIL).fill(email);
  await page.locator(PASSWORD).fill(ACCOUNTS.admin.password);
  await page.locator(SUBMIT).click();
}

async function salir(page: Page): Promise<void> {
  await page.locator('[data-llm-action="open-user-profile-menu"]').click();
  await page.locator('[data-llm-action="cerrar-sesion"]').click();
  await page.locator('[data-llm-action="confirm-modal-accept"]').click();
  await expect(page).toHaveURL(/\/login$/, CARGA);
}

/** Id de un alumno con matrícula en la sede indicada. */
async function alumnoDeSede(branchId: number): Promise<number> {
  const sb = await getAdminClient();
  const { data } = await sb
    .from('enrollments')
    .select('student_id')
    .eq('branch_id', branchId)
    .not('student_id', 'is', null)
    .limit(1)
    .single();
  return data!.student_id as number;
}

// ── B. Sesión ────────────────────────────────────────────────────────────────────────────────

test('B03 (S17): recargar con red lenta termina en la pantalla correcta, sin rebotar a /login', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  // 3 s de demora en todas las consultas a la BD y a Auth.
  await page.route('**/{rest,auth}/v1/**', async (route) => {
    await new Promise((r) => setTimeout(r, 3_000));
    return route.continue();
  });
  await page.goto('/app/secretaria/alumnos');
  await expect(page).toHaveURL(/\/app\/secretaria\/alumnos$/, { timeout: 60_000 });
  await page.waitForTimeout(5_000);
  await expect(page).toHaveURL(/\/app\/secretaria\/alumnos$/);
});

test('B07: si la sesión expira al guardar, el mensaje es claro y no queda un spinner colgado', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.route('**/rest/v1/vehicles*', (route) =>
    route.request().method() === 'GET'
      ? route.continue()
      : route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'PGRST303', message: 'JWT expired' }),
        }),
  );
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    BRANCH_KEY,
    JSON.stringify({ id: 1, name: 'Autoescuela Chillán' }),
  ] as const);
  await page.goto('/app/admin/flota');
  await page
    .getByRole('button', { name: /Nuevo Vehículo/i })
    .first()
    .click();
  await page.locator('#vf-plate').fill('ZZZZ96');
  await page.locator('#vf-brand').fill('Prueba');
  await page.locator('#vf-model').fill('Sesion');
  await page.locator('[data-llm-action="save-vehicle"]').click();

  const mensaje = page.locator('app-vehicle-form-drawer p-message');
  await expect(mensaje).toBeVisible(CARGA);
  test.info().annotations.push({ type: 'B07 mensaje', description: await mensaje.innerText() });
  await expect(page.locator('[data-llm-action="save-vehicle"]')).toBeEnabled();
  await expect(mensaje).toContainText(/sesión|inicia sesión|autoriz/i);
});

// ── E. Cambio de usuario ────────────────────────────────────────────────────────────────────

test('E06 + E08: tras cambiar de usuario no queda la búsqueda ni las notificaciones del anterior', async ({
  page,
}) => {
  await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));
  await login(page, ACCOUNTS.admin.email);
  await expect(page).toHaveURL(/\/app\/admin\/dashboard$/, CARGA);
  await page.locator('[data-llm-action="open-search-panel"] button').click();
  const buscador = page.locator(
    '[data-llm-description="Global command palette — alumnos, acciones, vistas"]',
  );
  await buscador.fill('busqueda-del-admin');
  await page.keyboard.press('Escape');
  await salir(page);

  await login(page, ACCOUNTS.secretariaA.email);
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);
  await page.locator('[data-llm-action="open-search-panel"] button').click();
  await expect(buscador).toHaveValue('');
  await page.keyboard.press('Escape');

  // E08: las notificaciones que se ven son solo las de la secretaria.
  const sec = await getClientFor(ACCOUNTS.secretariaA.email, ACCOUNTS.secretariaA.password);
  const { data: propias } = await sec.from('notifications').select('id').is('deleted_at', null);
  const sb = await getAdminClient();
  const { data: yo } = await sb
    .from('users')
    .select('id')
    .eq('email', ACCOUNTS.secretariaA.email)
    .single();
  const { data: ajenas } = await sec
    .from('notifications')
    .select('id')
    .neq('recipient_id', yo!.id)
    .is('deleted_at', null);
  expect(ajenas ?? []).toHaveLength(0);
  test.info().annotations.push({
    type: 'E08 notificaciones de la secretaria',
    description: String(propias?.length ?? 0),
  });
});

test('E10: salir sin red termina en /login y no deja una sesión fantasma', async ({ page }) => {
  await login(page, ACCOUNTS.secretariaA.email);
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);
  await page.route('**/auth/v1/logout**', (route) => route.abort('failed'));
  await salir(page);
  await page.unroute('**/auth/v1/logout**');
  await page.goto('/app/secretaria/dashboard');
  await expect(page).toHaveURL(/\/login$/, CARGA);
});

// ── F. Acceso por URL ────────────────────────────────────────────────────────────────────────

test('F09: la secretaria de la sede 1 no ve la ficha de un alumno de la sede 2', async ({
  pageAs,
}) => {
  const id = await alumnoDeSede(2);
  const page = await pageAs('secretariaA');
  await page.goto(`/app/secretaria/alumnos/${id}`);
  await page.waitForTimeout(8_000);
  const texto = await page.locator('main').innerText();
  test.info().annotations.push({ type: 'F09 pantalla', description: texto.slice(0, 300) });
  // Mensaje claro, no una ficha vacía rota.
  await expect(
    page.getByText(/no encontrad|no existe|no tienes acceso|sin acceso/i).first(),
  ).toBeVisible();
});

test('F10: la secretaria entra a Configuración web y Contabilidad › Cursos (rutas suyas)', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaB');
  for (const url of ['/app/secretaria/configuracion-web', '/app/secretaria/contabilidad/cursos']) {
    await page.goto(url);
    await expect(page).toHaveURL(new RegExp(`${url}$`), CARGA);
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toHaveCount(0);
  }
});

// ── I. Menú ──────────────────────────────────────────────────────────────────────────────────

test('I01 + I07: grupos del menú del admin y rutas sin ítem', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/dashboard');
  await expect(page.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
  const menu = await page.locator('app-sidebar').innerText();
  test.info().annotations.push({ type: 'I01 menú admin', description: menu.replace(/\s+/g, ' ') });
  for (const grupo of ['Operaciones Diarias', 'Academia Clase B', 'Finanzas y Caja']) {
    expect(menu.toLowerCase()).toContain(grupo.toLowerCase());
  }
  // I07: las rutas existen aunque no tengan ítem.
  for (const url of ['/app/admin/notificaciones']) {
    await page.goto(url);
    await expect(page).toHaveURL(new RegExp(`${url}$`), CARGA);
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toHaveCount(0);
  }
});

// ── J. Páginas especiales ───────────────────────────────────────────────────────────────────

test('J04 (S16): recargar /modulo-no-disponible como admin nunca muestra "inicio de sesión"', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.goto('/modulo-no-disponible');
  const textos: string[] = [];
  page.on('framenavigated', () => undefined);
  await page.reload();
  for (let i = 0; i < 20; i++) {
    textos.push(
      await page
        .locator('body')
        .innerText()
        .catch(() => ''),
    );
    await page.waitForTimeout(100);
  }
  expect(textos.join(' ')).not.toMatch(/inicio de sesión/i);
  await page
    .getByRole('button', { name: /Volver/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/admin\/dashboard$/, CARGA);
});

test('J09 + J12: política en 375 px sin scroll horizontal; 404 legible en oscuro', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/politica-privacidad/autoescuela-chillan');
  await expect(page.locator('h1').first()).toBeVisible(CARGA);
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(desborde).toBeLessThanOrEqual(0);

  await page.addInitScript(() => localStorage.setItem('app-color-mode', 'dark'));
  await page.goto('/no-existe-esta-pagina');
  const titulo = page.getByRole('heading', { name: 'Página no encontrada' });
  await expect(titulo).toBeVisible(CARGA);
  const [color, fondo] = await page.evaluate(() => [
    getComputedStyle(document.querySelector('h1, h2')!).color,
    getComputedStyle(document.body).backgroundColor,
  ]);
  expect(color).not.toBe(fondo);
  await page.screenshot({ path: test.info().outputPath('j12-404-oscuro.png') });
});

// ── L. Pestañas ──────────────────────────────────────────────────────────────────────────────

test('L02 (S8): una pestaña del admin no queda con el menú de la secretaria que entró en otra', async ({
  page,
}) => {
  await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));
  await login(page, ACCOUNTS.admin.email);
  await expect(page).toHaveURL(/\/app\/admin\/dashboard$/, CARGA);
  const a = await page.context().newPage();
  await a.goto('/app/admin/pagos');
  await expect(a.locator('[data-llm-nav]').first()).toBeVisible(CARGA);

  await salir(page);
  await login(page, ACCOUNTS.secretariaA.email);
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);

  // La pestaña A no puede quedar en una pantalla de admin con la sesión de la secretaria.
  await expect.poll(async () => a.url(), { timeout: 30_000 }).not.toMatch(/\/app\/admin\//);
});

// ── N. Seguridad por API ─────────────────────────────────────────────────────────────────────

test('N01: con sesión de la secretaria de la sede 1, la API no devuelve matrículas de la sede 2', async () => {
  const sec = await getClientFor(ACCOUNTS.secretariaA.email, ACCOUNTS.secretariaA.password);
  const { data, error } = await sec.from('enrollments').select('id').eq('branch_id', 2);
  expect(error).toBeNull();
  expect(data ?? []).toHaveLength(0);
});

// ── O. Accesibilidad ─────────────────────────────────────────────────────────────────────────

test('O04 + O06: el error de login se anuncia y un mensaje largo no rompe la card', async ({
  page,
}) => {
  const largo = 'x'.repeat(400);
  await page.route('**/auth/v1/token?grant_type=password', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'unexpected',
        message: `Something totally unexpected ${largo}`,
      }),
    }),
  );
  await page.goto('/login');
  const card = page.locator('form[data-llm-form="auth-form"]');
  const ancho = (await card.boundingBox())!.width;
  await page.locator(EMAIL).fill(ACCOUNTS.admin.email);
  await page.locator(PASSWORD).fill('cualquiera1');
  await page.locator(SUBMIT).click();
  const alerta = page.locator('[role="alert"]');
  await expect(alerta).toBeVisible(CARGA);
  await expect(alerta).toHaveAttribute('aria-live', 'assertive');
  expect(Math.abs((await card.boundingBox())!.width - ancho)).toBeLessThan(2);
});
