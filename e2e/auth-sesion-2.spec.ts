/**
 * Testing de autenticación y sesión — segunda tanda (ASG-i-022, fix-183-b). Casos del checklist
 * specs/testing-piloto/022-autenticacion-sesion-fase-piloto.md que quedaron pendientes el
 * 2026-10-05. Los IDs son los del checklist. No crea ni modifica datos: los errores del servidor
 * (sin red, demasiados intentos) se simulan cortando la respuesta.
 */
import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../src/environments/environment';
import { ACCOUNTS } from './support/accounts';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 90_000 });

const EMAIL = '[data-llm-description="User email address for authentication"]';
const PASSWORD = '[data-llm-description="User password for authentication"]';
const SUBMIT = '[data-llm-action="submit-auth-form"]';
const CARGA = { timeout: 30_000 };
/** Una clave que no es de nadie (para los casos que no deben entrar). */
const otraClave = () => `x${Math.random().toString(36).slice(2, 10)}9`;

async function abrirLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await expect(page.locator(EMAIL)).toBeVisible(CARGA);
}

async function login(page: Page, email: string): Promise<void> {
  await abrirLogin(page);
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

// ── A. Login ─────────────────────────────────────────────────────────────────────────────────

test('A10: correo en mayúsculas y con espacios entra igual', async ({ page }) => {
  await login(page, `  ${ACCOUNTS.admin.email.toUpperCase()}  `);
  await expect(page).toHaveURL(/\/app\/admin\/dashboard$/, CARGA);
});

test('A11 + A12: Enter envía el formulario; un doble clic hace una sola petición', async ({
  page,
}) => {
  let pedidos = 0;
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    pedidos++;
    await new Promise((r) => setTimeout(r, 500));
    return route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    });
  });
  await abrirLogin(page);
  await page.locator(EMAIL).fill(ACCOUNTS.admin.email);
  await page.locator(PASSWORD).fill(otraClave());
  await page.locator(PASSWORD).press('Enter');
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible(CARGA);
  expect(pedidos).toBe(1);

  await page.locator(SUBMIT).dblclick();
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible(CARGA);
  await page.waitForTimeout(1_500);
  expect(pedidos).toBe(2);
});

test('A13: sin red, mensaje de conexión y el botón vuelve a quedar disponible', async ({
  page,
}) => {
  await page.route('**/auth/v1/token?grant_type=password', (route) => route.abort('failed'));
  await abrirLogin(page);
  await page.locator(EMAIL).fill(ACCOUNTS.admin.email);
  await page.locator(PASSWORD).fill(otraClave());
  await page.locator(SUBMIT).click();
  await expect(
    page.getByText('Sin conexión a internet. Verifica tu red e intenta de nuevo.'),
  ).toBeVisible(CARGA);
  await expect(page.locator(SUBMIT)).toBeEnabled();
});

test('A14: el ojo alterna la contraseña y su aria-label', async ({ page }) => {
  await abrirLogin(page);
  await page.locator(PASSWORD).fill(otraClave());
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
  await expect(page.locator(PASSWORD)).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
  await expect(page.locator(PASSWORD)).toHaveAttribute('type', 'password');
});

for (const [caso, cuerpo] of [
  ['por intentos', { code: 'over_request_rate_limit', message: 'Request rate limit reached' }],
  ['por correos', { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }],
] as const) {
  test(`A15 (S13): "demasiados intentos" ${caso} se dice claro, no un genérico`, async ({
    page,
  }) => {
    await page.route('**/auth/v1/token?grant_type=password', (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify(cuerpo) }),
    );
    await abrirLogin(page);
    await page.locator(EMAIL).fill(ACCOUNTS.admin.email);
    await page.locator(PASSWORD).fill(otraClave());
    await page.locator(SUBMIT).click();
    await expect(page.getByText(/Demasiados intentos/)).toBeVisible(CARGA);
  });
}

// ── B. Sesión ────────────────────────────────────────────────────────────────────────────────

test('B08: borrar el almacenamiento y navegar vuelve a /login', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/dashboard');
  await expect(page.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
  await page.evaluate(() => localStorage.clear());
  await page.goto('/app/admin/pagos');
  await expect(page).toHaveURL(/\/login$/, CARGA);
});

// ── E. Cambio de usuario en el mismo navegador ──────────────────────────────────────────────

test('E05 + E07: la sede elegida por el admin no la hereda la secretaria, y vuelve al admin', async ({
  page,
}) => {
  await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e05-init')) {
      sessionStorage.setItem('e05-init', '1');
      localStorage.setItem(
        'autoescuela:selectedBranchId',
        JSON.stringify({ id: 2, name: 'Conductores Chillán' }),
      );
    }
  });
  await login(page, ACCOUNTS.admin.email);
  await expect(page).toHaveURL(/\/app\/admin\/dashboard$/, CARGA);
  const selector = page.locator('app-topbar app-branch-selector');
  await expect(selector).toContainText('Conductores', CARGA);
  await salir(page);

  // E05: la secretaria de la sede 1 no ve la sede 2 del admin.
  await login(page, ACCOUNTS.secretariaA.email);
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);
  await expect(page.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
  await expect(page.locator('app-topbar').getByText('Conductores Chillán')).toHaveCount(0);
  await salir(page);

  // E07: el admin vuelve a ver su selector.
  await login(page, ACCOUNTS.admin.email);
  await expect(page).toHaveURL(/\/app\/admin\/dashboard$/, CARGA);
  await expect(selector).toBeVisible(CARGA);
});

// ── H. Rutas profesionales ──────────────────────────────────────────────────────────────────

test('H10: F5 en Base Alumnos Prof. como secretaria con Profesional se queda ahí', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaB');
  await page.goto('/app/secretaria/dashboard');
  const link = page.locator('[data-llm-nav*="/app/secretaria/profesional"]').first();
  await expect(link).toBeAttached(CARGA);
  const destino = await link.getAttribute('data-llm-nav');
  await page.goto(destino!);
  await expect(page).toHaveURL(new RegExp(`${destino}$`), CARGA);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${destino}$`), CARGA);
});

// ── I. Menú ──────────────────────────────────────────────────────────────────────────────────

test('I05: solo el ítem de la pantalla actual queda resaltado', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/pagos');
  await expect(page.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
  // routerLinkActive agrega la clase "!bg-brand-muted" (no confundir con hover:bg-brand-muted).
  const activos = await page
    .locator('app-sidebar [data-llm-nav]')
    .evaluateAll((els) =>
      els
        .filter((e) => e.classList.contains('!bg-brand-muted'))
        .map((e) => e.getAttribute('data-llm-nav')),
    );
  expect(activos).toEqual(['/app/admin/pagos']);
});

test('I08: en 375 px el menú se abre y se cierra al navegar', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/app/admin/dashboard');
  const sidebar = page.locator('app-sidebar');
  // Cerrado = corrido a la izquierda, fuera de la pantalla.
  const dentro = async () => ((await sidebar.boundingBox())?.x ?? -1) >= 0;
  await expect(page.locator('[data-llm-nav]').first()).toBeAttached(CARGA);
  await expect.poll(dentro).toBe(false);
  await page.locator('[data-llm-action="toggle-mobile-sidebar"]').first().click();
  await expect.poll(dentro).toBe(true);
  await sidebar.locator('[data-llm-nav="/app/admin/pagos"]').click();
  await expect(page).toHaveURL(/\/app\/admin\/pagos$/, CARGA);
  await expect.poll(dentro).toBe(false);
});

// ── K. Cuenta ────────────────────────────────────────────────────────────────────────────────

test('K09: el nombre del panel de usuario coincide con la BD', async ({ pageAs }) => {
  const sb = await getAdminClient();
  const { data } = await sb
    .from('users')
    .select('first_names, paternal_last_name')
    .eq('email', ACCOUNTS.secretariaA.email)
    .single();
  const page = await pageAs('secretariaA');
  await page.goto('/app/secretaria/dashboard');
  await page.locator('[data-llm-action="open-user-profile-menu"]').click();
  await expect(
    page.getByText(`${data!.first_names} ${data!.paternal_last_name}`).first(),
  ).toBeVisible(CARGA);
});

// ── L. Pestañas ──────────────────────────────────────────────────────────────────────────────

test('L01: cerrar sesión en una pestaña saca a la otra sin recargar', async ({ page }) => {
  await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));
  await login(page, ACCOUNTS.secretariaA.email);
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);
  const otra = await page.context().newPage();
  await otra.goto('/app/secretaria/dashboard');
  await expect(otra.locator('[data-llm-nav]').first()).toBeVisible(CARGA);

  await salir(page);
  await expect(otra).toHaveURL(/\/login$/, CARGA);
});

// ── N. Seguridad por API ─────────────────────────────────────────────────────────────────────

test('N03 (S19): nadie puede crear cuentas con la clave pública', async () => {
  const sb = createClient(environment.supabase.url, environment.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signUp({
    email: `e2e.signup.${Date.now()}@e2e.test`,
    password: `${otraClave()}A1`,
  });
  expect(error, 'el registro público debe estar cerrado').not.toBeNull();
  expect(data.user).toBeNull();
});

// ── O. Accesibilidad ─────────────────────────────────────────────────────────────────────────

test('O03: con Tab se recorre el login en orden y el foco se ve', async ({ page }) => {
  await abrirLogin(page);
  await page.locator(EMAIL).focus();
  const orden: string[] = [];
  for (let i = 0; i < 4; i++) {
    orden.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return (
          el?.getAttribute('data-llm-description') ??
          el?.getAttribute('aria-label') ??
          el?.getAttribute('type') ??
          ''
        );
      }),
    );
    const foco = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element);
      return `${s.outlineStyle}|${s.boxShadow}`;
    });
    expect(foco, `foco visible en ${orden[i]}`).not.toBe('none|none');
    await page.keyboard.press('Tab');
  }
  expect(orden[0]).toBe('User email address for authentication');
  expect(orden[1]).toBe('User password for authentication');
  expect(orden[2]).toMatch(/Mostrar contraseña/);
  expect(orden[3]).toBe('checkbox');
});
