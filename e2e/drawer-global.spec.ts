/**
 * Drawer global: Escape y cambio de pantalla (hotfix-061-b, ASG-i-037 casos F03/F04/Y05).
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200 (ver e2e/auth-sesion.spec.ts).
 */
import { expect, test } from './support/fixtures';
import type { Page } from '@playwright/test';

test.describe.configure({ mode: 'default', timeout: 90_000 });

const PANEL = '[data-drawer-panel]';

async function abrirAjustes(page: Page): Promise<void> {
  await page.locator('[data-llm-action="open-user-profile-menu"]').click({ timeout: 30_000 });
  await page.locator('app-user-panel button').nth(1).click();
  await expect(page.locator(PANEL)).toBeVisible();
}

test('F03/Y05: Escape cierra el drawer, que se anuncia como diálogo', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/dashboard');
  await abrirAjustes(page);
  await expect(page.getByRole('dialog', { name: 'Ajustes del Sistema' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator(PANEL)).toBeHidden({ timeout: 10_000 });
});

test('F04: ir a otra pantalla por el menú cierra el drawer', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/dashboard');
  await abrirAjustes(page);

  await page.locator('[data-llm-nav="/app/admin/agenda"]').first().click();
  await expect(page).toHaveURL(/\/app\/admin\/agenda$/, { timeout: 30_000 });
  await expect(page.locator(PANEL)).toBeHidden({ timeout: 10_000 });
});

test('Escape con la lista de un select abierta cierra solo la lista; el segundo, el drawer', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaB');
  await page.goto('/app/secretaria/contabilidad/cuadratura');
  await page.locator('[data-llm-action="agregar-ingreso-cuadratura"]').click({ timeout: 30_000 });
  await expect(page.locator(PANEL)).toBeVisible();

  const select = page.locator(`${PANEL} p-select`).first();
  await select.click();
  await expect(page.locator('.p-select-overlay')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.p-select-overlay')).toBeHidden();
  await expect(page.locator(PANEL)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator(PANEL)).toBeHidden({ timeout: 10_000 });
});
