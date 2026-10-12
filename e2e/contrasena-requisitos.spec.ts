/**
 * Requisitos de la contraseña visibles mientras se escribe (spec 0050-b): AC1, AC2, AC3, AC4, AC6,
 * AC-E1 y AC-E2, en las dos pantallas donde se fija una contraseña.
 *
 * Las llamadas a Auth que cambiarían la clave se interceptan: no se cambia ninguna contraseña real.
 * La pantalla de primer ingreso se abre simulando `first_login = true` en la respuesta del perfil.
 */
import type { Locator, Page } from '@playwright/test';
import { ACCOUNTS } from './support/accounts';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const NUEVA = '[data-llm-description="input for the new account password"]';
const CONFIRMAR = '[data-llm-description="input to confirm the new account password"]';

/** Bloquea el cambio real de clave y cuenta los intentos. */
async function bloquearCambio(page: Page): Promise<() => number> {
  let cambios = 0;
  await page.route('**/auth/v1/user', (route) => {
    if (route.request().method() === 'PUT') {
      cambios++;
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    }
    return route.continue();
  });
  return () => cambios;
}

/** Una palabra (4+ letras) del nombre de la cuenta de prueba, para el caso "contiene tu nombre". */
async function nombreDeLaCuenta(): Promise<string> {
  const sb = await getAdminClient();
  const { data } = await sb
    .from('users')
    .select('first_names, paternal_last_name')
    .eq('email', ACCOUNTS.secretariaA.email)
    .single();
  const palabra = `${data!.first_names} ${data!.paternal_last_name}`
    .split(' ')
    .find((w) => w.length >= 4);
  if (!palabra) throw new Error('[e2e] La cuenta de prueba no tiene un nombre de 4+ letras');
  return palabra;
}

/** Evidencia visual opcional: E2E_SHOTS=<carpeta>. */
async function captura(page: Page, nombre: string): Promise<void> {
  const dir = process.env['E2E_SHOTS'];
  if (dir) await page.screenshot({ path: `${dir}/0050-b-${nombre}.png` });
}

function requisito(lista: Locator, texto: string): Locator {
  return lista.locator('li').filter({ hasText: texto });
}

/** La misma tabla de casos en las dos pantallas (AC3). */
async function comprobarRequisitos(page: Page): Promise<void> {
  const lista = page.locator('app-password-requirements');
  const nueva = page.locator(NUEVA);
  await expect(lista.locator('li')).toHaveCount(4);
  await expect(lista.locator('ul')).toHaveAttribute('aria-live', 'polite'); // AC-E1

  // 9 caracteres: falta el largo; lo demás ya se cumple.
  await nueva.fill('camino202');
  await expect(requisito(lista, 'Al menos 10 caracteres')).toContainText('(pendiente)');
  await expect(requisito(lista, 'Al menos una letra')).toContainText('(cumplido)');
  await expect(requisito(lista, 'Al menos un número')).toContainText('(cumplido)');
  await expect(lista).toContainText('Débil');

  // Válida.
  await nueva.fill('camino2026');
  await expect(lista.getByText('(pendiente)')).toHaveCount(0);
  await expect(lista).toContainText('Aceptable');

  // AC4: contiene una palabra de su nombre.
  const nombre = await nombreDeLaCuenta();
  await nueva.fill(`${nombre.toLowerCase()}2026xx`);
  await expect(requisito(lista, 'Sin tu nombre, correo ni RUT')).toContainText('(pendiente)');

  // Larga y con 3 clases de caracteres. fill() pone el valor de una vez, como pegar o un gestor
  // de contraseñas (AC-E2).
  await nueva.fill('Camino-largo-2026');
  await expect(lista).toContainText('Muy buena');
}

test('Ajustes → Cambiar contraseña: requisitos visibles y botón bloqueado hasta cumplirlos', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  const cambios = await bloquearCambio(page);
  await page.goto('/app/secretaria/dashboard');
  await page.locator('[data-llm-action="open-user-profile-menu"]').click();
  await page.locator('[data-llm-nav="ajustes"]').click();
  await page.getByText('Cambiar Contraseña').first().click();

  await comprobarRequisitos(page);

  // AC2: con la actual y la confirmación puestas, una clave que no cumple no deja guardar.
  const boton = page.locator('[data-llm-action="update-password"]');
  await page.locator('[data-llm-description="input for the current account password"]').fill('x');
  await page.locator(NUEVA).fill('camino202');
  await page.locator(CONFIRMAR).fill('camino202');
  await expect(boton).toBeDisabled();
  await captura(page, 'ajustes');
  await page.locator(NUEVA).fill('camino2026');
  await page.locator(CONFIRMAR).fill('camino2026');
  await expect(boton).toBeEnabled();
  expect(cambios()).toBe(0);
});

test('Primer ingreso: requisitos visibles y confirmación obligatoria', async ({ pageAs }) => {
  const page = await pageAs('secretariaA');
  const cambios = await bloquearCambio(page);
  // El perfil dice que es su primer ingreso (solo en la respuesta: la BD no cambia).
  await page.route('**/rest/v1/users?*first_login*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const fila = Array.isArray(body) ? body[0] : body;
    if (fila && typeof fila === 'object' && 'first_login' in fila) fila.first_login = true;
    await route.fulfill({ response, json: body });
  });

  await page.goto('/force-password-change');
  await expect(page.locator(NUEVA)).toBeVisible({ timeout: 30_000 });

  await comprobarRequisitos(page);

  // AC6: sin confirmación, o distinta, no se puede guardar.
  const boton = page.locator('button[type="submit"]');
  await page.locator(NUEVA).fill('camino2026');
  await expect(boton).toBeDisabled();
  await page.locator(CONFIRMAR).fill('camino2027');
  await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
  await captura(page, 'primer-ingreso');
  await expect(boton).toBeDisabled();
  await page.locator(CONFIRMAR).fill('camino2026');
  await expect(page.getByText('Las contraseñas no coinciden.')).toHaveCount(0);
  await expect(boton).toBeEnabled();

  // AC2: una clave que no cumple no deja guardar aunque coincida la confirmación.
  await page.locator(NUEVA).fill('camino202');
  await page.locator(CONFIRMAR).fill('camino202');
  await expect(boton).toBeDisabled();
  expect(cambios()).toBe(0);
});
