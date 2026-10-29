/**
 * Testing de autenticación y sesión — novena tanda (ASG-i-022, fix-183-b): la sesión con el paso
 * del tiempo y desde fuera de la pestaña. B04 (app abierta más de 1 h), B05 (equipo suspendido
 * 2+ h), B06 (sesión cerrada desde otro lado) y O05 (autocompletar del login, simulado).
 *
 * El tiempo es el reloj falso de Playwright (`page.clock`); la renovación y la revocación de la
 * sesión son reales contra Supabase. Cada test inicia sesión por la UI en un contexto propio, sin
 * la sesión guardada de la suite: así renovar o revocar esta sesión no invalida la de los demás.
 * No crea ni modifica datos.
 */
import type { Browser, Page, Response } from '@playwright/test';
import { environment } from '../src/environments/environment';
import { ACCOUNTS } from './support/accounts';
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const CARGA = { timeout: 30_000 };
const EMAIL = '[data-llm-description="User email address for authentication"]';
const PASSWORD = '[data-llm-description="User password for authentication"]';
const SUBMIT = '[data-llm-action="submit-auth-form"]';
const CUENTA = ACCOUNTS.secretariaB;

const esRenovacion = (r: Response) =>
  r.url().includes('/auth/v1/token') && r.url().includes('grant_type=refresh_token');

/** Contexto nuevo, reloj falso instalado y sesión iniciada por la UI. */
async function sesionPropia(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.clock.install();
  await page.goto('/login');
  await page.locator(EMAIL).fill(CUENTA.email);
  await page.locator(PASSWORD).fill(CUENTA.password);
  await page.locator(SUBMIT).click();
  await expect(page).toHaveURL(new RegExp(`${CUENTA.home}$`), CARGA);
  return page;
}

/** Va a otra pantalla con un clic del menú (navegación interna, sin recargar). */
async function navegarPorMenu(page: Page): Promise<void> {
  const enlace = page
    .locator('[data-llm-nav^="/app/secretaria/"]:visible')
    .filter({ hasNot: page.locator('[data-llm-nav$="/dashboard"]') })
    .first();
  const destino = (await enlace.getAttribute('data-llm-nav'))!;
  await enlace.click();
  await expect(page).toHaveURL(new RegExp(`${destino}$`), CARGA);
}

/** El token de acceso que la app guardó (para revocar esa sesión desde fuera). */
async function tokenGuardado(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (/^sb-.*-auth-token$/.test(key))
        return JSON.parse(localStorage.getItem(key)!).access_token;
    }
    return null;
  });
  expect(token, 'la app no guardó la sesión en localStorage').toBeTruthy();
  return token as string;
}

test('B04: con la app abierta más de 1 h, el token se renueva solo y la app sigue funcionando', async ({
  browser,
}) => {
  const page = await sesionPropia(browser);
  const renovacion = page.waitForResponse(esRenovacion, CARGA);

  await page.clock.fastForward('01:01:00');
  const respuesta = await renovacion;
  expect(respuesta.status()).toBe(200);

  // Las consultas que siguen salen con el token nuevo y la BD las acepta.
  const fallidas: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/rest/v1/') && r.status() >= 400)
      fallidas.push(`${r.status()} ${r.url()}`);
  });
  await navegarPorMenu(page);
  await expect(page).not.toHaveURL(/\/login$/);
  expect(fallidas).toEqual([]);
  await page.context().close();
});

test('B05: al volver de 2+ h suspendido (sin red, pestaña oculta) retoma la sesión sin pantallas rotas', async ({
  browser,
}) => {
  const page = await sesionPropia(browser);
  const context = page.context();

  // "Suspender": la pestaña se oculta, se corta la red y pasan 2 h 10 min.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await context.setOffline(true);
  await page.clock.fastForward('02:10:00');

  // "Volver": vuelve la red y la pestaña se ve de nuevo.
  await context.setOffline(false);
  const renovacion = page.waitForResponse(esRenovacion, CARGA);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // Puede renovarse al volver a ser visible o en el siguiente tick del reloj.
  await page.clock.fastForward('00:00:31');
  expect((await renovacion).status()).toBe(200);

  await navegarPorMenu(page);
  await expect(page).not.toHaveURL(/\/login$/);
  await context.close();
});

test('B06: si la sesión se cierra desde otro lado, la app vuelve al login sin errores en cadena', async ({
  browser,
}) => {
  const page = await sesionPropia(browser);
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  // "Otro lado": se revoca solo ESTA sesión en Supabase (scope local), como cerrar sesión en
  // otro equipo con esta misma sesión o un admin revocándola.
  const token = await tokenGuardado(page);
  const revocar = await fetch(`${environment.supabase.url}/auth/v1/logout?scope=local`, {
    method: 'POST',
    headers: { apikey: environment.supabase.anonKey, Authorization: `Bearer ${token}` },
  });
  expect(revocar.status).toBe(204);

  // La app se entera cuando intenta renovar (el token de acceso vigente no se puede anular).
  const renovacion = page.waitForResponse(esRenovacion, CARGA);
  await page.clock.fastForward('01:01:00');
  expect((await renovacion).status()).toBeGreaterThanOrEqual(400);

  await expect(page).toHaveURL(/\/login$/, CARGA);
  await expect(page.locator(EMAIL)).toBeVisible();
  expect(pageErrors).toEqual([]);
  await page.context().close();
});

test('O05: el login acepta valores autocompletados (simulado) y habilita el botón', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.locator(EMAIL)).toBeVisible(CARGA);
  const boton = page.locator(SUBMIT);

  // Autocompletar de Chrome: escribe el valor sin teclas y dispara input + change.
  const autocompletar = async (eventos: string[]) => {
    await page.evaluate(
      ([email, password, sel, evs]) => {
        const [emailSel, passSel] = sel as string[];
        for (const [selector, value] of [
          [emailSel, email],
          [passSel, password],
        ] as const) {
          const input = document.querySelector<HTMLInputElement>(selector)!;
          input.value = value;
          for (const ev of evs as string[]) input.dispatchEvent(new Event(ev, { bubbles: true }));
        }
      },
      [CUENTA.email, CUENTA.password, [EMAIL, PASSWORD], eventos] as const,
    );
  };

  await autocompletar(['input', 'change']);
  await expect(boton).toBeEnabled();

  // Solo informativo: un gestor que dispare únicamente "change" no habilita el botón (ngModel
  // escucha "input"). Chrome, 1Password y Bitwarden disparan "input", así que no se exige; la
  // pasada manual con un gestor real lo confirma.
  await page.reload();
  await expect(page.locator(EMAIL)).toBeVisible(CARGA);
  await expect(boton).toBeDisabled();
  await autocompletar(['change']);
  test.info().annotations.push({
    type: 'O05 solo "change"',
    description: (await boton.isEnabled()) ? 'botón habilitado' : 'botón sigue deshabilitado',
  });
});
