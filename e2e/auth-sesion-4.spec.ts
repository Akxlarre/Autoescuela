/**
 * Testing de autenticación y sesión — cuarta tanda (ASG-i-022, fix-183-b): multisede y Clase
 * Profesional (H04, H05, H08, H09), páginas públicas con sesión e impresas (J10, J11), estado de
 * la cuenta (K10), dos pestañas (L03), salir del wizard sin borrador (M04) y modo oscuro (O01).
 * Los IDs son los del checklist 022. No crea ni modifica datos.
 *
 * Sedes del piloto: 1 = Autoescuela Chillán (sin Clase Profesional), 2 = Conductores Chillán (con).
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 90_000 });

const CARGA = { timeout: 30_000 };
const BRANCH_KEY = 'autoescuela:selectedBranchId';
const TRIGGER = '[data-llm-action="toggle-branch-dropdown"]';
const OPT_ALL = '[data-llm-action="select-branch-all"]';
const SEDE_A = { id: 1, name: 'Autoescuela Chillán' };

const selector = (page: Page) => page.locator('app-topbar app-branch-selector');

async function conSede(page: Page, sede: typeof SEDE_A | null): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('sede-init')) {
        sessionStorage.setItem('sede-init', '1');
        localStorage.setItem(key, value);
      }
    },
    [BRANCH_KEY, JSON.stringify(sede)] as const,
  );
}

// ── H. Multisede y Clase Profesional ────────────────────────────────────────────────────────

test('H04 + H05: con grant multisede en una sede sin Profesional, la página profesional cambia la sede y "Todas" vuelve al salir', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaMultisede');
  await conSede(page, null);
  await page.goto('/app/secretaria/profesional/alumnos');
  await expect(page).toHaveURL(/\/app\/secretaria\/profesional\/alumnos$/, CARGA);
  // H04: el selector salta a la sede con Profesional y "Todas" queda deshabilitada.
  await expect(selector(page)).toContainText('Conductores', CARGA);
  await page.locator(TRIGGER).click();
  await expect(page.locator(OPT_ALL)).toBeDisabled();
  await page.keyboard.press('Escape');

  // H05: al salir, el selector vuelve a quedar libre.
  await page.locator('a[href="/app/secretaria/dashboard"]').first().click();
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);
  await page.locator(TRIGGER).click();
  await expect(page.locator(OPT_ALL)).toBeEnabled();
  test.info().annotations.push({
    type: 'H05 sede al salir',
    description: await selector(page).innerText(),
  });
});

for (const [rol, base] of [
  ['secretariaMultisede', '/app/secretaria'],
  ['admin', '/app/admin'],
] as const) {
  test(`H08/H09: ${rol} en una sede sin Profesional, un ítem profesional ofrece conmutar y abre la página`, async ({
    pageAs,
  }) => {
    const page = await pageAs(rol);
    await conSede(page, SEDE_A);
    await page.goto(`${base}/dashboard`);
    const bloqueado = page
      .locator('app-sidebar [data-llm-nav]')
      .filter({ hasText: 'Base Alumnos Prof.' })
      .first();
    await expect(bloqueado).toBeVisible(CARGA);
    await bloqueado.click();
    const modal = page.locator('[aria-labelledby="confirm-modal-title"]');
    await expect(modal.getByText('Módulo de Clase Profesional')).toBeVisible();
    await modal.getByRole('button', { name: 'Conmutar Sede' }).click();
    await expect(page).toHaveURL(new RegExp(`${base}/(profesional|clase-profesional)/`), CARGA);
    await expect(selector(page)).toContainText('Conductores', CARGA);
  });
}

// ── J. Páginas públicas ─────────────────────────────────────────────────────────────────────

test('J10 + J11: la política se ve igual con sesión (sin menú) y al imprimirla', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.goto('/politica-privacidad/autoescuela-chillan');
  await expect(page.locator('h1').first()).toBeVisible(CARGA);
  await expect(page.locator('app-sidebar')).toHaveCount(0);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('h1').first()).toBeVisible();
  const altura = await page.evaluate(() => document.body.scrollHeight);
  expect(altura).toBeGreaterThan(500);
  await page.pdf?.({ path: test.info().outputPath('j11-politica.pdf') }).catch(() => undefined);
});

// ── K. Cuenta ───────────────────────────────────────────────────────────────────────────────

test('K10: Ajustes muestra la cuenta como "Activo"', async ({ pageAs }) => {
  const page = await pageAs('secretariaA');
  await page.goto('/app/secretaria/dashboard');
  await page.locator('[data-llm-action="open-user-profile-menu"]').click();
  await page.locator('[data-llm-nav="ajustes"]').click();
  const ajustes = page.locator('app-ajustes-drawer');
  await expect(ajustes).toBeVisible(CARGA);
  await expect(ajustes.getByText('Activo', { exact: true }).first()).toBeVisible(CARGA);
});

// ── L. Pestañas ─────────────────────────────────────────────────────────────────────────────

test('L03: cambiar la sede en una pestaña no cambia la otra hasta recargar; al recargar toma la última', async ({
  pageAs,
}) => {
  const a = await pageAs('admin');
  await conSede(a, null);
  await a.goto('/app/admin/dashboard');
  await expect(selector(a)).toBeVisible(CARGA);
  const b = await a.context().newPage();
  await b.goto('/app/admin/dashboard');
  await expect(selector(b)).toBeVisible(CARGA);
  const inicialB = await selector(b).innerText();

  await a.locator(TRIGGER).click();
  await a.locator('[data-llm-action="select-branch-conductores-chillan"]').click();
  await expect(selector(a)).toContainText('Conductores', CARGA);

  await b.waitForTimeout(2_000);
  const sinRecargar = await selector(b).innerText();
  test.info().annotations.push({ type: 'L03 pestaña B sin recargar', description: sinRecargar });
  expect(sinRecargar).toBe(inicialB);
  await b.reload();
  await expect(selector(b)).toContainText('Conductores', CARGA);
});

// ── M. Wizard de matrícula ──────────────────────────────────────────────────────────────────

test('M04: salir del wizard recién abierto (sin borrador) no pide confirmación', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/matricula');
  await expect(page.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
  await page.waitForTimeout(2_000);
  await page.locator('a[href="/app/admin/dashboard"]').first().click();
  await expect(page).toHaveURL(/\/app\/admin\/dashboard$/, CARGA);
  await expect(page.getByText('¿Deseas salir?')).toHaveCount(0);
});

// ── O. Modo oscuro ──────────────────────────────────────────────────────────────────────────

test('O01: login, Módulo no disponible y 404 se leen en modo oscuro', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('app-color-mode', 'dark'));
  for (const [url, nombre] of [
    ['/login', 'login'],
    ['/modulo-no-disponible', 'mnd'],
    ['/esta-pagina-no-existe', '404'],
  ]) {
    await page.goto(url);
    const titulo = page.locator('h1, h2').first();
    await expect(titulo).toBeVisible(CARGA);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-mode'))).toBe(
      'dark',
    );
    const [color, fondo] = await titulo.evaluate((el) => {
      let bg = 'rgba(0, 0, 0, 0)';
      for (let n: Element | null = el; n && bg === 'rgba(0, 0, 0, 0)'; n = n.parentElement) {
        bg = getComputedStyle(n).backgroundColor;
      }
      return [getComputedStyle(el).color, bg];
    });
    expect(color, `${nombre}: título del color del fondo`).not.toBe(fondo);
    await page.screenshot({ path: test.info().outputPath(`o01-${nombre}-oscuro.png`) });
  }
});
