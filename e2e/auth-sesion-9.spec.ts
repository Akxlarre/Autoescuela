/**
 * Testing de autenticación y sesión (ASG-i-022, fix-183-b) — B04, B05 y B06 del checklist
 * specs/testing-piloto/022-autenticacion-sesion-fase-piloto.md, sin esperar horas.
 *
 * El cliente de Supabase relee la sesión guardada en cada ciclo de renovación (cada 30 s) y al
 * volver la pestaña a primer plano. Marcar la sesión guardada como vencida reproduce lo que ve la
 * app tras una hora abierta (B04) o al despertar el equipo (B05), sin adelantar el reloj del
 * navegador (con el reloj adelantado, cada token nuevo del servidor también parecería vencido).
 *
 * Cada test entra con un login propio, no con la sesión guardada de la suite: renovar el token
 * rota el refresh token y dejaría inservible el archivo de sesión para los tests siguientes. B06
 * cierra "todas las sesiones" de la secretaria de la sede 2 y al final guarda una sesión nueva en
 * su archivo (como auth.setup.ts), para no dejar sin sesión al resto de la corrida. No usa al
 * instructor: en el piloto entra a /modulo-no-disponible, fuera del shell que vigila la sesión.
 * No crea datos.
 */
import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../src/environments/environment';
import { ACCOUNTS, storageStatePath } from './support/accounts';
import { expect, test, watchErrors } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const EMAIL = '[data-llm-description="User email address for authentication"]';
const PASSWORD = '[data-llm-description="User password for authentication"]';
const SUBMIT = '[data-llm-action="submit-auth-form"]';
const CARGA = { timeout: 30_000 };
/** El ciclo de renovación corre cada 30 s: 45 s cubren un ciclo completo con margen. */
const RENOVACION = { timeout: 45_000 };

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await expect(page.locator(EMAIL)).toBeVisible(CARGA);
  await page.locator(EMAIL).fill(email);
  await page.locator(PASSWORD).fill(ACCOUNTS.admin.password);
  await page.locator(SUBMIT).click();
  await expect(page).not.toHaveURL(/\/login/, CARGA);
}

/**
 * Deja la sesión guardada como vencida hace un minuto. Con `tokenInvalido`, además cambia el
 * access token por uno que el servidor rechazaría (después de horas, el token real ya venció).
 */
async function vencerSesionGuardada(page: Page, tokenInvalido = false): Promise<void> {
  const ok = await page.evaluate((invalido) => {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
    );
    if (!key) return false;
    const session = JSON.parse(localStorage.getItem(key)!);
    session.expires_at = Math.floor(Date.now() / 1000) - 60;
    if (invalido) session.access_token = 'token-vencido';
    localStorage.setItem(key, JSON.stringify(session));
    return true;
  }, tokenInvalido);
  expect(ok, 'no se encontró la sesión guardada de Supabase').toBe(true);
}

const renovacion = (page: Page) =>
  page.waitForResponse(
    (res) => res.url().includes('/auth/v1/token') && res.url().includes('refresh_token'),
    RENOVACION,
  );

/** Navega por el menú (como una persona) y espera que la pantalla termine de cargar. */
async function irPorMenu(page: Page, destino: RegExp): Promise<void> {
  await page.locator('[data-llm-nav]').filter({ hasText: destino }).first().click();
  await expect(page.locator('main app-skeleton-block')).toHaveCount(0, CARGA);
}

test('B04: con el token vencido tras una hora abierta, la app lo renueva sola y sigue funcionando', async ({
  page,
}) => {
  const errores = watchErrors(page);
  await login(page, ACCOUNTS.secretariaA.email);
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);

  const renovada = renovacion(page);
  await vencerSesionGuardada(page);
  expect((await renovada).status(), 'la renovación del token').toBe(200);

  // Después de renovar, las pantallas cargan con datos y la sesión sigue.
  await irPorMenu(page, /Alumnos/);
  await expect(page).toHaveURL(/\/app\/secretaria\//);
  await expect(page.locator('main table, main app-empty-state').first()).toBeVisible(CARGA);
  await irPorMenu(page, /Agenda/);
  await expect(page).toHaveURL(/\/app\/secretaria\/agenda/);
  errores.expectClean();
});

test('B05: al volver de una suspensión con el token ya inválido, renueva antes de pedir datos', async ({
  page,
}) => {
  const errores = watchErrors(page);
  await login(page, ACCOUNTS.secretariaA.email);
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);

  // El equipo "despierta": la sesión guardada venció y su access token ya no sirve. La pestaña
  // vuelve a primer plano.
  const renovada = renovacion(page);
  await vencerSesionGuardada(page, true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // Ninguna petición sale con el token inválido: antes de pedir datos, renueva.
  const conTokenInvalido: string[] = [];
  page.on('request', (req) => {
    if ((req.headers()['authorization'] ?? '').includes('token-vencido')) {
      conTokenInvalido.push(req.url());
    }
  });
  await irPorMenu(page, /Alumnos/);
  expect((await renovada).status(), 'la renovación del token').toBe(200);
  await expect(page).toHaveURL(/\/app\/secretaria\//);
  await expect(page.locator('main table, main app-empty-state').first()).toBeVisible(CARGA);
  expect(conTokenInvalido, 'peticiones con el token inválido').toEqual([]);
  errores.expectClean();
});

test('B06: si la sesión se cierra desde otro lado, la app vuelve a /login sin errores en cadena', async ({
  page,
  browser,
}) => {
  // Cerrar "todas las sesiones" también invalida la sesión guardada de la suite para esta
  // cuenta: al terminar se guarda una nueva, como lo hace auth.setup.ts.
  const cuenta = ACCOUNTS.secretariaB;
  try {
    await cerrarDesdeOtroLado(page, cuenta.email);
  } finally {
    const context = await browser.newContext();
    const nueva = await context.newPage();
    await login(nueva, cuenta.email);
    await expect(nueva).toHaveURL(new RegExp(`${cuenta.home}$`), CARGA);
    await context.storageState({ path: storageStatePath('secretariaB') });
    await context.close();
  }
});

async function cerrarDesdeOtroLado(page: Page, email: string): Promise<void> {
  const errores = watchErrors(page);
  await login(page, email);
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);
  const dentro = page.url();

  // Otra sesión de la misma cuenta cierra "todas las sesiones" (revoca los refresh tokens).
  const otro = createClient(environment.supabase.url, environment.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: loginError } = await otro.auth.signInWithPassword({
    email,
    password: ACCOUNTS.admin.password,
  });
  expect(loginError, 'login de la otra sesión').toBeNull();
  const { error: logoutError } = await otro.auth.signOut({ scope: 'global' });
  expect(logoutError, 'cerrar todas las sesiones').toBeNull();

  // Mientras el access token siga vigente la app no se entera (es un JWT); al renovarlo, el
  // servidor rechaza el refresh token revocado y la app debe volver al login.
  const renovada = renovacion(page);
  await vencerSesionGuardada(page);
  expect((await renovada).ok(), 'la renovación con un refresh token revocado').toBe(false);
  await expect(page, `seguía en ${dentro}`).toHaveURL(/\/login/, CARGA);
  await expect(page.locator(EMAIL)).toBeVisible();

  // El rechazo de la renovación (su respuesta 400 y la línea que el navegador escribe en consola
  // por ella) es el único error esperado; nada más en cadena.
  const resto = errores
    .unexpected()
    .filter(
      (e) =>
        !/\/auth\/v1\/token/.test(e) &&
        e !== 'console: Failed to load resource: the server responded with a status of 400 ()',
    );
  expect(resto, 'errores además del rechazo de la renovación').toEqual([]);
}
