/**
 * P02 del checklist 034 (ASG-i-034, fix-197-b): cambiar la contraseña propia DE VERDAD.
 *
 * ⚠️ A diferencia de cambiar-clave-actual.spec.ts, aquí Auth no se intercepta: la clave de la
 * secretaria de prueba de la sede 2 cambia y se repone al terminar (también si el test falla).
 * Si la reposición fallara, el error lo dice y la suite quedaría sin poder entrar con esa cuenta:
 * por eso NO corre con la suite, hay que pedirlo con E2E_CLAVE_REAL=1.
 */
import { ACCOUNTS } from './support/accounts';
import { getClientFor } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

const CUENTA = ACCOUNTS.secretariaB;
const TEMPORAL = `Temporal-${Date.now()}`;

test.describe.configure({ timeout: 180_000 });
test.skip(!process.env['E2E_CLAVE_REAL'], 'Cambia una clave real: correr con E2E_CLAVE_REAL=1');

async function entra(password: string): Promise<boolean> {
  try {
    await getClientFor(CUENTA.email, password);
    return true;
  } catch {
    return false;
  }
}

test('P02: cambia la contraseña; entra con la nueva y no con la vieja', async ({ pageAs }) => {
  const page = await pageAs('secretariaB');
  await page.goto(CUENTA.home);
  await page.locator('[data-llm-action="open-user-profile-menu"]').click();
  await page.locator('[data-llm-nav="ajustes"]').click();
  await page.getByText('Cambiar Contraseña').first().click();

  const actual = page.locator('[data-llm-description="input for the current account password"]');
  const nueva = page.locator('[data-llm-description="input for the new account password"]');
  const confirmar = page.locator(
    '[data-llm-description="input to confirm the new account password"]',
  );
  const boton = page.locator('[data-llm-action="update-password"]');

  let cambiada = false;
  try {
    await actual.fill(CUENTA.password);
    // Paso 2: una nueva de 5 caracteres no deja continuar.
    await nueva.fill('abc12');
    await confirmar.fill('abc12');
    await expect(boton).toBeDisabled();
    // Paso 3: válida pero con confirmación distinta, tampoco.
    await nueva.fill(TEMPORAL);
    await confirmar.fill(`${TEMPORAL}x`);
    await expect(boton).toBeDisabled();
    // Paso 4: iguales → se cambia.
    await confirmar.fill(TEMPORAL);
    await expect(boton).toBeEnabled();
    await boton.click();
    await expect(page.getByText('Contraseña actualizada correctamente.')).toBeVisible({
      timeout: 30_000,
    });
    cambiada = true;

    // Paso 5: con la vieja ya no entra; con la nueva sí.
    expect(await entra(CUENTA.password), 'La clave vieja ya no debe servir').toBe(false);
    expect(await entra(TEMPORAL), 'La clave nueva debe servir').toBe(true);
  } finally {
    if (cambiada || (await entra(TEMPORAL))) {
      const sb = await getClientFor(CUENTA.email, TEMPORAL);
      const { error } = await sb.auth.updateUser({ password: CUENTA.password });
      if (error)
        throw new Error(
          `[e2e] ⚠️ NO se pudo reponer la clave de ${CUENTA.email}: ${error.message}. ` +
            'Reponerla a mano antes de correr la suite.',
        );
    }
    expect(await entra(CUENTA.password), 'La cuenta queda con su clave de siempre').toBe(true);
  }
});
