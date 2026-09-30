/**
 * Proyecto `setup` (spec 0019-m, AC4 / AC-E2): inicia sesión con cada rol por la UI de login
 * y guarda la sesión en e2e/.auth/<rol>.json. Corre al inicio de cada `npm run test:e2e`,
 * así las sesiones nunca quedan vencidas.
 */
import { expect, test as setup } from '@playwright/test';
import { ACCOUNTS, ROLES, storageStatePath } from './support/accounts';

for (const role of ROLES) {
  setup(`sesión: ${role}`, async ({ page }) => {
    const { email, password, home } = ACCOUNTS[role];

    await page.goto('/login');
    await page
      .locator('[data-llm-description="User email address for authentication"]')
      .fill(email);
    await page.locator('[data-llm-description="User password for authentication"]').fill(password);
    await page.locator('[data-llm-action="submit-auth-form"]').click();

    // Espera lo primero que ocurra: llegar al dashboard del rol, caer en el cambio de
    // contraseña obligatorio, o que la tarjeta muestre un error. Nunca un tiempo fijo.
    const loginError = page.getByRole('alert').filter({ hasText: /\S/ });
    const outcome = await Promise.race([
      // Cada espera captura su propio timeout: las que pierden la carrera no dejan
      // rechazos sin manejar.
      page
        .waitForURL(`**${home}`)
        .then(() => 'ok' as const)
        .catch(() => 'timeout' as const),
      page
        .waitForURL('**/force-password-change')
        .then(() => 'first-login' as const)
        .catch(() => 'timeout' as const),
      loginError
        .waitFor()
        .then(() => 'error' as const)
        .catch(() => 'timeout' as const),
    ]);

    if (outcome === 'error') {
      const msg = (await loginError.textContent())?.trim();
      throw new Error(`No se pudo iniciar sesión como ${role} (${email}): ${msg}`);
    }
    if (outcome === 'first-login') {
      throw new Error(
        `No se pudo iniciar sesión como ${role} (${email}): la cuenta tiene el primer login ` +
          `pendiente. Entra una vez a mano y cambia la contraseña a la de e2e/support/accounts.ts.`,
      );
    }
    if (outcome === 'timeout') {
      throw new Error(`No se pudo iniciar sesión como ${role} (${email}): no llegó a ${home}.`);
    }

    await expect(page).toHaveURL(new RegExp(`${home}$`));
    await page.context().storageState({ path: storageStatePath(role) });
  });
}
