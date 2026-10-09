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

test('fix-357-m: el foco entra al panel al abrirlo y vuelve a su botón al cerrarlo', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/app/admin/clase-profesional/promociones');
  const ver = page.locator('[data-llm-action="ver-promocion"]').first();
  await ver.click({ timeout: 30_000 });
  await expect(page.locator(PANEL)).toBeVisible();

  const focoEnPanel = () => page.evaluate((sel) => !!document.activeElement?.closest(sel), PANEL);
  await expect.poll(focoEnPanel, { message: 'foco dentro del panel al abrir' }).toBe(true);
  // El primer Tab cae en un control del panel, no en la pantalla de atrás.
  await page.keyboard.press('Tab');
  expect(await focoEnPanel(), 'foco dentro del panel tras Tab').toBe(true);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');

  await page.keyboard.press('Escape');
  await expect(page.locator(PANEL)).toBeHidden({ timeout: 10_000 });
  await expect(ver).toBeFocused();
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
