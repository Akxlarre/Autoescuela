/**
 * Testing transversal del shell (ASG-i-037, fix-190-b): selector de sede (D), buscador global (E),
 * 2 pestañas (K), tema y alto de ventana (V) y accesibilidad básica del shell (Y).
 * Checklist: specs/testing-piloto/037-transversal-multisede-shell.md — los IDs son los del checklist.
 *
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200 (ver e2e/auth-sesion.spec.ts).
 * Ningún test escribe en la BD: el cambio de sede y el tema viven en localStorage del contexto, y el
 * cierre de sesión es local (fix-184-b) con la llamada al servidor interceptada.
 */
import { expect, knownBug, test } from './support/fixtures';
import { ACCOUNTS, storageStatePath } from './support/accounts';
import { getAdminClient } from './support/supabase-admin';
import type { Browser, Page } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

const BRANCH_KEY = 'autoescuela:selectedBranchId';
const TRIGGER = '[data-llm-action="toggle-branch-dropdown"]';
const OPT_ALL = '[data-llm-action="select-branch-all"]';
const OPT_A = '[data-llm-action="select-branch-autoescuela-chillan"]';
const OPT_B = '[data-llm-action="select-branch-conductores-chillan"]';
const SEARCH_BTN = '[data-llm-action="open-search-panel"] button';
const SEARCH_INPUT = 'input[aria-label="Buscar en la aplicación"]';
const RESULT = '[data-llm-action="search-result-item"]';

/** Espera a que el shell esté montado (topbar con el menú de usuario). */
async function shellReady(page: Page): Promise<void> {
  await expect(page.locator('[data-llm-action="open-user-profile-menu"]')).toBeVisible({
    timeout: 30_000,
  });
}

async function pickBranch(page: Page, option: string): Promise<void> {
  await page.locator(TRIGGER).click();
  await page.locator(option).click();
}

interface Alumno {
  name: string;
  rut: string;
}

/** Un alumno activo de Clase B de la sede (lo que lista la Base Alumnos), sin datos E2E-. */
async function alumnoDeSede(branchId: number): Promise<Alumno> {
  const sb = await getAdminClient();
  const { data, error } = await sb
    .from('students')
    .select(
      'id, users!inner(rut, first_names, paternal_last_name, branch_id), enrollments!inner(status, license_group)',
    )
    .eq('users.branch_id', branchId)
    .neq('status', 'archived')
    .eq('enrollments.status', 'active')
    .eq('enrollments.license_group', 'class_b')
    .not('users.paternal_last_name', 'ilike', 'E2E%')
    .order('id', { ascending: false })
    .limit(1)
    .single();
  if (error || !data)
    throw new Error(`[e2e] Sin alumno activo en la sede ${branchId}: ${error?.message}`);
  const u = (
    data as unknown as { users: { rut: string; first_names: string; paternal_last_name: string } }
  ).users;
  return { name: `${u.first_names} ${u.paternal_last_name}`, rut: u.rut };
}

/** Busca en el buscador global (ya abierto) y devuelve el locator del resultado con ese nombre. */
async function search(page: Page, query: string) {
  const input = page.locator(SEARCH_INPUT);
  await input.fill(query);
  return page.locator(RESULT);
}

// ── D. Selector de sede ───────────────────────────────────────────────────────

test.describe('D. Selector de sede', () => {
  test('D01: admin ve "Todas las sedes" + cada sede', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await page.goto('/app/admin/dashboard');
    await shellReady(page);
    await page.locator(TRIGGER).click();
    await expect(page.locator(OPT_ALL)).toBeVisible();
    await expect(page.locator(OPT_A)).toBeVisible();
    await expect(page.locator(OPT_B)).toBeVisible();
  });

  test('D02: secretaria sin grant no ve el selector', async ({ pageAs }) => {
    const page = await pageAs('secretariaA');
    await page.goto('/app/secretaria/dashboard');
    await shellReady(page);
    await expect(page.locator(TRIGGER)).toHaveCount(0);
  });

  test('D03: secretaria con grant ve el selector con ambas sedes', async ({ pageAs }) => {
    const page = await pageAs('secretariaMultisede');
    await page.goto('/app/secretaria/dashboard');
    await shellReady(page);
    await page.locator(TRIGGER).click();
    await expect(page.locator(OPT_A)).toBeVisible();
    await expect(page.locator(OPT_B)).toBeVisible();
  });

  test('D04: la sede elegida sobrevive a F5 y se ve desde el primer render', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await page.goto('/app/admin/pagos');
    await shellReady(page);
    await pickBranch(page, OPT_B);
    await expect(page.locator(TRIGGER)).toHaveAttribute('aria-label', /Conductores Chillán/);

    await page.reload();
    // Primer render del selector: ya debe decir la sede, sin pasar por "Todas" ni "—" (ASG-b-026).
    const firstLabel = await page
      .locator(TRIGGER)
      .first()
      .evaluate((el) => el.getAttribute('aria-label'), undefined, { timeout: 30_000 });
    expect(firstLabel).toContain('Conductores Chillán');
  });

  test('D05: sede persistida inexistente → vuelve a "Todas" y limpia el valor', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await page.goto('/app/admin/dashboard');
    await shellReady(page);
    await page.evaluate(
      ([k]) => localStorage.setItem(k, JSON.stringify({ id: 999999, name: 'Sede fantasma' })),
      [BRANCH_KEY],
    );
    await page.reload();
    await shellReady(page);
    await expect(page.locator(TRIGGER)).toHaveAttribute('aria-label', /Todas/, { timeout: 15_000 });
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), BRANCH_KEY), { timeout: 15_000 })
      .toBeNull();
  });

  test('D09: Nueva Matrícula con "Todas" pide sede y bloquea "Todas" en el topbar', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await page.goto('/app/admin/matricula');
    await shellReady(page);
    await expect(page.getByText('Selecciona una sede')).toBeVisible({ timeout: 20_000 });
    await page.locator(TRIGGER).click();
    await expect(page.locator(OPT_ALL)).toBeDisabled();
    await expect(page.locator(OPT_A)).toBeEnabled();
  });
});

// ── E. Buscador global ────────────────────────────────────────────────────────

test.describe('E. Buscador global', () => {
  test('E01/E02: abre con el botón y con Ctrl+K (foco en el input); Escape cierra y limpia', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await page.goto('/app/admin/dashboard');
    await shellReady(page);

    await page.locator(SEARCH_BTN).click();
    await expect(page.locator(SEARCH_INPUT)).toBeFocused();
    await page.locator(SEARCH_INPUT).fill('caja');
    await page.keyboard.press('Escape');
    await expect(page.locator(SEARCH_INPUT)).toHaveCount(0);

    await page.keyboard.press('Control+k');
    await expect(page.locator(SEARCH_INPUT)).toBeFocused();
    await expect(page.locator(SEARCH_INPUT)).toHaveValue('');
  });

  test('E03/E06: secretaria recién entrada encuentra un alumno de su sede y no uno de la otra', async ({
    pageAs,
  }) => {
    const propio = await alumnoDeSede(1);
    const ajeno = await alumnoDeSede(2);
    const page = await pageAs('secretariaA');
    await page.goto('/app/secretaria/dashboard');
    await shellReady(page);
    await page.locator(SEARCH_BTN).click();

    // E03: sin haber visitado Base Alumnos (H-031).
    const results = await search(page, propio.rut);
    await expect(results.filter({ hasText: propio.name }).first()).toBeVisible({ timeout: 20_000 });

    // E06: los datos ya están cargados; el RUT de la sede 2 no debe aparecer.
    await search(page, ajeno.rut);
    await page.waitForTimeout(1_500);
    await expect(results.filter({ hasText: ajeno.name })).toHaveCount(0);
  });

  test('E07: admin con sede A no encuentra un alumno de B; con "Todas", sí', async ({ pageAs }) => {
    const ajeno = await alumnoDeSede(2);
    const page = await pageAs('admin');
    await page.goto('/app/admin/dashboard');
    await shellReady(page);
    await pickBranch(page, OPT_A);

    await page.locator(SEARCH_BTN).click();
    const results = await search(page, ajeno.rut);
    await page.waitForTimeout(6_000); // carga SWR de la Base (sede A)
    await expect(results.filter({ hasText: ajeno.name })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await pickBranch(page, OPT_ALL);
    await page.locator(SEARCH_BTN).click();
    await search(page, ajeno.rut);
    await expect(results.filter({ hasText: ajeno.name }).first()).toBeVisible({ timeout: 20_000 });
  });

  test('E08: las acciones rápidas de la secretaria llevan a /app/secretaria/**', async ({
    pageAs,
  }) => {
    const page = await pageAs('secretariaA');
    await page.goto('/app/secretaria/dashboard');
    await shellReady(page);
    for (const q of ['pago', 'agendar', 'matrícula']) {
      await page.locator(SEARCH_BTN).click();
      const results = await search(page, q);
      await expect(results.first()).toBeVisible();
      await results.first().click();
      await expect(page).toHaveURL(/\/app\/secretaria\//);
      await expect(page).not.toHaveURL(/\/app\/admin\//);
      await shellReady(page);
    }
  });
});

// ── K. Sesión en 2 pestañas ───────────────────────────────────────────────────

test.describe('K. Dos pestañas', () => {
  test('K01: cerrar sesión en la pestaña 1 → la pestaña 2 termina en /login al interactuar', async ({
    page,
  }) => {
    // Login por UI + 2 cargas del shell: con la suite en paralelo pasa de los 90 s por defecto.
    test.setTimeout(180_000);
    // Sesión propia por UI (no la compartida del setup). Cierre local + servidor interceptado.
    await page.context().route('**/auth/v1/logout**', (r) => r.fulfill({ status: 204, body: '' }));
    await page.goto('/login');
    await page
      .locator('[data-llm-description="User email address for authentication"]')
      .fill(ACCOUNTS.secretariaA.email);
    await page
      .locator('[data-llm-description="User password for authentication"]')
      .fill(ACCOUNTS.secretariaA.password);
    await page.locator('[data-llm-action="submit-auth-form"]').click();
    await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, { timeout: 60_000 });

    const tab2 = await page.context().newPage();
    await tab2.goto('/app/secretaria/pagos');
    await shellReady(tab2);

    await page.locator('[data-llm-action="open-user-profile-menu"]').click();
    await page.locator('[data-llm-action="cerrar-sesion"]').click();
    await page.locator('[data-llm-action="confirm-modal-accept"]').click();
    await expect(page).toHaveURL(/\/login$/);

    // "Al interactuar": navegar por el menú lateral (navegación SPA, sin recargar).
    await tab2.waitForTimeout(2_000);
    if (!/\/login$/.test(tab2.url())) {
      await tab2.locator('[data-llm-nav="/app/secretaria/dashboard"]').first().click();
    }
    await expect(tab2).toHaveURL(/\/login$/, { timeout: 15_000 });
  });
});

// ── T. Hora de Chile ──────────────────────────────────────────────────────────

test.describe('T. Hora de Chile', () => {
  // Paso 1 de ASG-i-054 (fechas de negocio en UTC), sin escribir: solo se lee la fecha por defecto
  // del formulario. 23:30 del 6-oct en Chile (UTC-3) = 02:30 UTC del 7-oct. 15:00 es el control:
  // demuestra que el test mide la fecha y no falla por otra causa.
  for (const hora of ['15:00', '23:30']) {
    test(`T02: a las ${hora} hora Chile, el anticipo nuevo propone la fecha de HOY`, async ({
      browser,
    }) => {
      if (hora === '23:30') knownBug('ASG-i-054 (fechas de negocio en UTC)');
      await anticipoProponeHoy(browser, hora);
    });
  }
});

/** Abre "Registrar anticipo" el 6-oct a `hora` (Chile) y exige que la fecha propuesta sea ese día. */
async function anticipoProponeHoy(browser: Browser, hora: string): Promise<void> {
  const context = await browser.newContext({
    storageState: storageStatePath('admin'),
    timezoneId: 'America/Santiago',
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`2026-10-06T${hora}:00-03:00`) });
  await page.goto('/app/admin/contabilidad/anticipos');
  await shellReady(page);
  await page.locator('[data-llm-action="registrar-anticipo"]').first().click();
  const fecha = page.locator('[data-llm-description="Fecha del anticipo"] input');
  await expect(fecha).toBeVisible({ timeout: 20_000 });
  await expect(fecha).toHaveValue('06/10/2026');
  await context.close();
}

// ── V. Tema y alto de ventana ─────────────────────────────────────────────────

test.describe('V. Visual', () => {
  test('V02: recargar en oscuro arranca en oscuro desde el primer paint (sin flash)', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await page.addInitScript(() => {
      localStorage.setItem('app-color-mode', 'dark');
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as { __modeAtDcl: string | null }).__modeAtDcl =
          document.documentElement.getAttribute('data-mode');
      });
    });
    await page.goto('/app/admin/dashboard');
    await shellReady(page);
    const modeAtDcl = await page.evaluate(
      () => (window as unknown as { __modeAtDcl: string | null }).__modeAtDcl,
    );
    expect(modeAtDcl).toBe('dark');
  });

  const V08_ROUTES = [
    '/app/admin/alumnos',
    '/app/admin/pagos',
    '/app/admin/agenda',
    '/app/admin/flota',
  ];
  for (const path of V08_ROUTES) {
    test(`V08: 1440×700 ${path} sigue app-like (el documento no scrollea)`, async ({ pageAs }) => {
      const page = await pageAs('admin');
      await page.setViewportSize({ width: 1440, height: 700 });
      await page.goto(path);
      await shellReady(page);
      await page.waitForTimeout(3_000); // datos + animación de entrada
      const overflow = await page.evaluate(() => {
        const el = document.querySelector('.shell-content') as HTMLElement | null;
        const doc = document.documentElement;
        return {
          doc: doc.scrollHeight - doc.clientHeight,
          shell: el ? el.scrollHeight - el.clientHeight : 0,
        };
      });
      expect(overflow.doc, 'el documento scrollea').toBeLessThanOrEqual(1);
      expect(overflow.shell, '.shell-content scrollea').toBeLessThanOrEqual(1);
    });
  }
});

// ── Y. Accesibilidad básica del shell ─────────────────────────────────────────

test.describe('Y. Accesibilidad', () => {
  test('Y03/Y07: los botones de solo ícono del shell tienen aria-label y data-llm-*', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await page.goto('/app/admin/dashboard');
    await shellReady(page);

    for (const action of [
      'open-search-panel',
      'toggle-color-mode',
      'open-notifications-panel',
      'open-user-profile-menu',
    ]) {
      const btn = page.locator(`[data-llm-action="${action}"] button`);
      await expect(btn, action).toHaveAttribute('aria-label', /\S/);
    }

    await page.setViewportSize({ width: 375, height: 812 });
    const menu = page.locator('[data-llm-action="toggle-mobile-sidebar"] button');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('aria-label', /\S/);
  });

  test('Y02: al cambiar de ruta el foco va a <main>', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await page.goto('/app/admin/dashboard');
    await shellReady(page);
    await page.locator('[data-llm-nav="/app/admin/pagos"]').first().click();
    await expect(page).toHaveURL(/\/app\/admin\/pagos$/);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.tagName.toLowerCase()))
      .toBe('main');
  });
});
