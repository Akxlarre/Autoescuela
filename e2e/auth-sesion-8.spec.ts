/**
 * Testing de autenticación y sesión — octava tanda (ASG-i-022, fix-183-b): salir de la pantalla de
 * crear contraseña (C03, hotfix-169-b), rutas en primer ingreso (C02, C10), doble clic (C12) y sin
 * red (C13) al guardar, y enlaces viejos a la inscripción online con parámetros (G34). Los IDs
 * son los del checklist 022.
 *
 * No cambia ninguna contraseña ni cierra sesiones reales: el primer ingreso se simula en la
 * respuesta del perfil y las llamadas a Auth que escribirían se interceptan.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const CARGA = { timeout: 30_000 };
const MND = '/modulo-no-disponible';
const NUEVA = '[data-llm-description="input for the new account password"]';
const CONFIRMAR = '[data-llm-description="input to confirm the new account password"]';
const GUARDAR = '[data-llm-action="actualizar-contrasena-forzada"]';
const CERRAR = '[data-llm-action="cerrar-sesion-cambio-clave"]';
const CLAVE = 'camino2026';

/** El perfil dice que es su primer ingreso (solo en la respuesta: la BD no cambia). */
async function simularPrimerIngreso(page: Page): Promise<void> {
  await page.route('**/rest/v1/users?*first_login*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const fila = Array.isArray(body) ? body[0] : body;
    if (fila && typeof fila === 'object' && 'first_login' in fila) fila.first_login = true;
    await route.fulfill({ response, json: body });
  });
}

async function abrirPrimerIngreso(page: Page): Promise<void> {
  await simularPrimerIngreso(page);
  await page.goto('/force-password-change');
  await expect(page.locator(NUEVA)).toBeVisible(CARGA);
}

async function escribirClave(page: Page): Promise<void> {
  await page.locator(NUEVA).fill(CLAVE);
  await page.locator(CONFIRMAR).fill(CLAVE);
  await expect(page.locator(GUARDAR)).toBeEnabled();
}

test('C03: "Cerrar sesión" saca de la pantalla de primer ingreso y no vuelve a ella', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  // El cierre se responde acá: un logout real revocaría la sesión que comparte la suite.
  let cierres = 0;
  await page.route('**/auth/v1/logout**', (route) => {
    cierres++;
    return route.fulfill({ status: 204, body: '' });
  });
  await abrirPrimerIngreso(page);

  await page.locator(CERRAR).click();
  await expect(page).toHaveURL(/\/login$/, CARGA);
  expect(cierres).toBe(1);

  // Ya sin sesión, la pantalla de primer ingreso manda al login (C11).
  await page.goto('/force-password-change');
  await expect(page).toHaveURL(/\/login$/, CARGA);
});

test('C02: en primer ingreso, cualquier ruta de la app vuelve a la pantalla de crear contraseña', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  await simularPrimerIngreso(page);
  for (const url of ['/app/secretaria/dashboard', '/app', '/app/admin/dashboard']) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/force-password-change$/, CARGA);
  }
});

test('C10: quien ya creó su contraseña no puede volver a esa pantalla', async ({ pageAs }) => {
  const page = await pageAs('secretariaA');
  await page.goto('/force-password-change');
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);
});

test('C12: doble clic en "Guardar y entrar" hace un solo cambio de clave', async ({ pageAs }) => {
  const page = await pageAs('secretariaA');
  let cambios = 0;
  await page.route('**/auth/v1/user', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    cambios++;
    // Respuesta lenta para que el segundo clic llegue mientras se guarda; termina en error para
    // que la clave real no cambie.
    await new Promise((r) => setTimeout(r, 1_500));
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await abrirPrimerIngreso(page);
  await escribirClave(page);

  await page.locator(GUARDAR).dblclick();
  await expect(page.locator(GUARDAR)).toBeDisabled();
  // Mientras guarda, "Cerrar sesión" tampoco se puede usar.
  await expect(page.locator(CERRAR)).toBeDisabled();
  await expect(page.getByRole('alert').filter({ hasText: /\S/ }).first()).toBeVisible(CARGA);
  expect(cambios).toBe(1);
});

test('C13: sin red al guardar muestra un error claro y se puede reintentar', async ({ pageAs }) => {
  const page = await pageAs('secretariaA');
  let intentos = 0;
  await page.route('**/auth/v1/user', (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    intentos++;
    return route.abort('internetdisconnected');
  });
  await abrirPrimerIngreso(page);
  await escribirClave(page);

  await page.locator(GUARDAR).click();
  const error = page.getByRole('alert').filter({ hasText: /\S/ }).first();
  await expect(error).toBeVisible(CARGA);
  test.info().annotations.push({ type: 'C13 mensaje', description: await error.innerText() });
  await expect(page).toHaveURL(/\/force-password-change$/);

  // Reintentar: el botón vuelve a estar disponible y hace un segundo intento.
  await expect(page.locator(GUARDAR)).toBeEnabled();
  await page.locator(GUARDAR).click();
  await expect.poll(() => intentos, CARGA).toBe(2);
});

test('G34: enlaces viejos a /inscripcion con parámetros terminan en "Módulo no disponible"', async ({
  page,
}) => {
  for (const url of ['/inscripcion?sede=1', '/inscripcion?curso=clase-b&utm_source=qr']) {
    await page.goto(url);
    await expect(page).toHaveURL(new RegExp(`${MND}$`), CARGA);
    await expect(page.getByRole('button', { name: 'Volver al inicio de sesión' })).toBeVisible();
  }
});
