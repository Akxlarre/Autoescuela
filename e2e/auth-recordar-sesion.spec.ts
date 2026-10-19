/**
 * "Mantener sesión iniciada" (fix-229-b, A19 de ASG-i-022). Cerrar el navegador se simula con un
 * contexto nuevo que conserva el localStorage pero pierde las cookies de sesión (las que no tienen
 * vencimiento), que es lo que hace el navegador al cerrarse. No crea ni modifica datos.
 */
import type { Browser, Page } from '@playwright/test';
import { ACCOUNTS } from './support/accounts';
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const EMAIL = '[data-llm-description="User email address for authentication"]';
const PASSWORD = '[data-llm-description="User password for authentication"]';
const SUBMIT = '[data-llm-action="submit-auth-form"]';
const CARGA = { timeout: 30_000 };
const DASH = /\/app\/secretaria\/dashboard$/;

async function entrar(page: Page, recordar: boolean): Promise<void> {
  await page.goto('/login');
  await page.locator(EMAIL).fill(ACCOUNTS.secretariaA.email);
  await page.locator(PASSWORD).fill(ACCOUNTS.secretariaA.password);
  const casilla = page.locator('input[name="rememberMe"]');
  if ((await casilla.isChecked()) !== recordar) await casilla.click();
  await page.locator(SUBMIT).click();
  await expect(page).toHaveURL(DASH, CARGA);
}

/** "Cierra" el navegador: mismo localStorage, sin cookies de sesión. Devuelve la página nueva. */
async function reabrir(browser: Browser, page: Page): Promise<Page> {
  const estado = await page.context().storageState();
  estado.cookies = estado.cookies.filter((c) => c.expires > 0);
  await page.context().close();
  const contexto = await browser.newContext({ storageState: estado });
  return contexto.newPage();
}

test('R2: desmarcada, al cerrar y abrir el navegador pide iniciar sesión', async ({
  browser,
  page,
}) => {
  await entrar(page, false);
  const nueva = await reabrir(browser, page);
  await nueva.goto('/app/secretaria/dashboard');
  await expect(nueva).toHaveURL(/\/login/, CARGA);
  await nueva.context().close();
});

test('R1: marcada, la sesión sigue después de cerrar el navegador', async ({ browser, page }) => {
  await entrar(page, true);
  const nueva = await reabrir(browser, page);
  await nueva.goto('/app/secretaria/dashboard');
  await expect(nueva).toHaveURL(DASH, CARGA);
  await expect(nueva.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
  await nueva.context().close();
});

test('R3: desmarcada, recargar y abrir otra pestaña no cierra la sesión', async ({ page }) => {
  await entrar(page, false);
  await page.reload();
  await expect(page).toHaveURL(DASH, CARGA);
  const otra = await page.context().newPage();
  await otra.goto('/app/secretaria/dashboard');
  await expect(otra).toHaveURL(DASH, CARGA);
  await expect(otra.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
});
