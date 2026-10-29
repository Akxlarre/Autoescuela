/**
 * Pestañas del drawer Ajustes (hotfix-168-b, casos V07/V08 del checklist 034): patrón tablist de
 * WAI-ARIA — roles, aria-selected, tabindex itinerante y flechas/Inicio/Fin. No escribe datos.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 90_000 });

const CARGA = { timeout: 30_000 };

async function abrirAjustes(page: Page, home: string) {
  await page.goto(home);
  await page.locator('[data-llm-action="open-user-profile-menu"]').click();
  await page.locator('[data-llm-nav="ajustes"]').click();
  const ajustes = page.locator('app-ajustes-drawer');
  await expect(ajustes).toBeVisible(CARGA);
  return ajustes;
}

test('V07/V08 admin: tres pestañas con semántica de tablist y teclado', async ({ pageAs }) => {
  const page = await pageAs('admin');
  const ajustes = await abrirAjustes(page, '/app/admin/dashboard');

  const tablist = ajustes.getByRole('tablist', { name: 'Secciones de ajustes' });
  await expect(tablist).toBeVisible();
  const tabs = tablist.getByRole('tab');
  await expect(tabs).toHaveText(['Mi Perfil', 'Ajustes', 'Seguridad']);

  const perfil = tablist.getByRole('tab', { name: 'Mi Perfil' });
  const config = tablist.getByRole('tab', { name: 'Ajustes' });
  const seguridad = tablist.getByRole('tab', { name: 'Seguridad' });

  // Estado inicial: Mi Perfil activa, única pestaña en el orden de Tab.
  await expect(perfil).toHaveAttribute('aria-selected', 'true');
  await expect(perfil).toHaveAttribute('tabindex', '0');
  await expect(config).toHaveAttribute('aria-selected', 'false');
  await expect(config).toHaveAttribute('tabindex', '-1');
  const panel = ajustes.getByRole('tabpanel');
  await expect(panel).toHaveAttribute('aria-labelledby', 'ajustes-tab-perfil');
  await expect(perfil).toHaveAttribute('aria-controls', 'ajustes-panel-perfil');

  // Flecha derecha → Ajustes, con foco y panel nuevos.
  await perfil.focus();
  await page.keyboard.press('ArrowRight');
  await expect(config).toHaveAttribute('aria-selected', 'true');
  await expect(config).toBeFocused();
  await expect(panel).toHaveAttribute('aria-labelledby', 'ajustes-tab-config');

  // Fin → Seguridad; flecha derecha da la vuelta a Mi Perfil; Inicio se queda en Mi Perfil.
  await page.keyboard.press('End');
  await expect(seguridad).toHaveAttribute('aria-selected', 'true');
  await expect(seguridad).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(perfil).toHaveAttribute('aria-selected', 'true');
  await expect(perfil).toBeFocused();

  // Flecha izquierda desde la primera da la vuelta a la última.
  await page.keyboard.press('ArrowLeft');
  await expect(seguridad).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(perfil).toHaveAttribute('aria-selected', 'true');

  // El clic sigue funcionando.
  await config.click();
  await expect(config).toHaveAttribute('aria-selected', 'true');
  await expect(panel).toHaveAttribute('id', 'ajustes-panel-config');
});

test('V07/V08 secretaria: sin Seguridad, las flechas recorren solo dos pestañas', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  const ajustes = await abrirAjustes(page, '/app/secretaria/dashboard');

  const tablist = ajustes.getByRole('tablist', { name: 'Secciones de ajustes' });
  await expect(tablist.getByRole('tab')).toHaveText(['Mi Perfil', 'Ajustes']);

  const perfil = tablist.getByRole('tab', { name: 'Mi Perfil' });
  await perfil.focus();
  await page.keyboard.press('End');
  await expect(tablist.getByRole('tab', { name: 'Ajustes' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('ArrowRight');
  await expect(perfil).toHaveAttribute('aria-selected', 'true');
  await expect(perfil).toBeFocused();
});
