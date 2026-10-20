/**
 * Testing de autenticación y sesión — séptima tanda (ASG-i-022, fix-183-b): portales bloqueados con
 * las cuentas de prueba de instructor y alumno (G21–G30, I06, J02), qué devuelve la API a esas
 * sesiones (N04), la misma cuenta en dos equipos (L04), una secretaria sin sede (H06, H07) y un rol
 * desconocido (J05).
 *
 * H06/H07 y J05 cambian `branch_id` / `role_id` de `secretaria2@test.com` y los restauran en
 * `finally`. El resto no escribe nada.
 */
import type { Browser, Page } from '@playwright/test';
import { ACCOUNTS } from './support/accounts';
import { getAdminClient, getClientFor } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

test.describe.configure({ mode: 'serial', timeout: 120_000 });

const EMAIL = '[data-llm-description="User email address for authentication"]';
const PASSWORD = '[data-llm-description="User password for authentication"]';
const SUBMIT = '[data-llm-action="submit-auth-form"]';
const CARGA = { timeout: 30_000 };
const MND = /\/modulo-no-disponible/;
/** Cuentas de prueba que muestra la pantalla de login (misma clave que el resto). */
const INSTRUCTOR = 'instructor@test.com';
const ALUMNO = 'alumno@test.com';
const CLAVE = ACCOUNTS.admin.password;

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator(EMAIL).fill(email);
  await page.locator(PASSWORD).fill(CLAVE);
  await page.locator(SUBMIT).click();
}

const volverAlLogin = (page: Page) =>
  page.getByRole('button', { name: 'Volver al inicio de sesión' });

// ── G. Portales Instructor y Alumno ─────────────────────────────────────────────────────────

for (const [nombre, email, rutas] of [
  [
    'instructor (G21–G26)',
    INSTRUCTOR,
    [
      '/app/instructor/dashboard',
      '/app/instructor/alumnos',
      '/app/instructor/alumnos/1',
      '/app/instructor/alumnos/1/ficha',
      '/app/instructor/clase/iniciar',
      '/app/instructor/clase/1',
      '/app/instructor/ficha/1',
      '/app/instructor/horario',
      '/app/instructor/liquidacion',
      '/app/instructor/notificaciones',
      '/app/instructor/tareas',
    ],
  ],
  [
    'alumno (G27–G30)',
    ALUMNO,
    [
      '/app/alumno/dashboard',
      '/app/alumno/clases',
      '/app/alumno/horario',
      '/app/alumno/pagos',
      '/app/alumno/pagar',
      '/app/alumno/pagar/retorno?token_ws=x',
      '/app/alumno/notificaciones',
      '/app/alumno/pruebas-online',
      '/app/alumno/ayuda',
    ],
  ],
] as const) {
  test(`${nombre}: el login cae en MND sin menú, cada ruta del portal termina en MND y el botón cierra la sesión`, async ({
    page,
  }) => {
    // G28: ninguna ruta de pago llega a llamar a una Edge Function.
    const llamadas: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/functions/v1/')) llamadas.push(r.url());
    });

    // G26 / G30 + I06: login → MND, sin menú.
    await login(page, email);
    await expect(page).toHaveURL(MND, CARGA);
    await expect(volverAlLogin(page)).toBeVisible(CARGA);
    await expect(page.locator('app-sidebar [data-llm-nav]')).toHaveCount(0);

    for (const ruta of rutas) {
      await page.goto(ruta);
      await expect(page, ruta).toHaveURL(MND, CARGA);
      await expect(volverAlLogin(page), ruta).toBeVisible(CARGA);
    }
    expect(llamadas, 'llamadas a Edge Functions').toEqual([]);

    // J02: el botón cierra la sesión y no hay bucle.
    await volverAlLogin(page).click();
    await expect(page).toHaveURL(/\/login/, CARGA);
    await expect(page.locator(EMAIL)).toBeVisible();
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/, CARGA);
  });
}

// ── N. Qué devuelve la API ──────────────────────────────────────────────────────────────────

test('N04: las sesiones de instructor y alumno no leen los pagos de la escuela', async () => {
  const admin = await getAdminClient();
  const { count: total } = await admin
    .from('payments')
    .select('id', { count: 'exact', head: true });
  expect(total ?? 0, 'la escuela tiene pagos').toBeGreaterThan(0);

  for (const email of [INSTRUCTOR, ALUMNO]) {
    const sb = await getClientFor(email, CLAVE);
    const pagos = await sb.from('payments').select('id', { count: 'exact', head: true });
    const alumnos = await sb.from('students').select('id', { count: 'exact', head: true });
    const usuarios = await sb.from('users').select('id', { count: 'exact', head: true });
    test.info().annotations.push({
      type: `N04 ${email}`,
      description: `payments=${pagos.count ?? pagos.error?.code} students=${alumnos.count ?? alumnos.error?.code} users=${usuarios.count ?? usuarios.error?.code} (admin ve payments=${total})`,
    });
    // El alumno puede ver los suyos; nunca los de toda la escuela.
    expect(pagos.count ?? 0, `${email}: pagos visibles`).toBeLessThan(total ?? 0);
    if (email === INSTRUCTOR) expect(pagos.count ?? 0, 'instructor: pagos').toBe(0);
    await sb.auth.signOut({ scope: 'local' });
  }
});

// ── L. Dos equipos ──────────────────────────────────────────────────────────────────────────

async function equipo(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

test('L04: la misma secretaria conectada en dos equipos; ambos siguen funcionando', async ({
  browser,
}) => {
  const a = await equipo(browser);
  const b = await equipo(browser);
  try {
    await login(a, ACCOUNTS.secretariaA.email);
    await expect(a).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);
    await login(b, ACCOUNTS.secretariaA.email);
    await expect(b).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);

    // El primer equipo sigue con sesión después de que entró el segundo.
    await a.goto('/app/secretaria/alumnos');
    await expect(a).toHaveURL(/\/app\/secretaria\/alumnos/, CARGA);
    await expect(a.locator('app-sidebar [data-llm-nav]').first()).toBeVisible(CARGA);
    await b.reload();
    await expect(b).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);
  } finally {
    await a.context().close();
    await b.context().close();
  }
});

// ── H / J. Cuenta sin sede y rol desconocido (cambios temporales) ──────────────────────────

async function secretaria2() {
  const sb = await getAdminClient();
  const { data, error } = await sb
    .from('users')
    .select('id, branch_id, role_id')
    .eq('email', ACCOUNTS.secretariaB.email)
    .single();
  if (error) throw error;
  return data as { id: number; branch_id: number | null; role_id: number | null };
}

async function actualizar(id: number, cambios: Record<string, unknown>): Promise<void> {
  const sb = await getAdminClient();
  const { error } = await sb.from('users').update(cambios).eq('id', id);
  if (error) throw error;
}

test('H06 + H07: secretaria sin sede asignada (anotar qué ve; las rutas profesionales no se abren)', async ({
  page,
}) => {
  const antes = await secretaria2();
  try {
    await actualizar(antes.id, { branch_id: null });
    await login(page, ACCOUNTS.secretariaB.email);
    await page.waitForURL(/\/(app|modulo-no-disponible|acceso-denegado)/, CARGA);
    await page.waitForTimeout(4_000);
    test.info().annotations.push({
      type: 'H07 al entrar',
      description: `${new URL(page.url()).pathname} · ${(
        await page
          .locator('main')
          .first()
          .innerText()
          .catch(() => '')
      )
        .slice(0, 200)
        .replace(/\s+/g, ' ')}`,
    });
    await page.screenshot({ path: test.info().outputPath('h07-sin-sede.png') });

    // H06
    await page.goto('/app/secretaria/profesional/alumnos');
    await page.waitForTimeout(4_000);
    const ruta = new URL(page.url()).pathname;
    test.info().annotations.push({ type: 'H06 ruta profesional', description: ruta });
    expect(ruta).not.toMatch(/\/profesional\//);
  } finally {
    await actualizar(antes.id, { branch_id: antes.branch_id });
  }
});

test('J05: cuenta sin rol reconocido termina en una pantalla con salida, y el botón cierra la sesión', async ({
  page,
}) => {
  const antes = await secretaria2();
  try {
    await actualizar(antes.id, { role_id: null });
    await login(page, ACCOUNTS.secretariaB.email);
    await page.waitForTimeout(6_000);
    const llegada = new URL(page.url()).pathname;
    test.info().annotations.push({
      type: 'J05 al entrar',
      description: `${llegada} · ${(await page.locator('body').innerText()).slice(0, 160).replace(/\s+/g, ' ')}`,
    });
    await page.screenshot({ path: test.info().outputPath('j05-sin-rol.png') });

    await page.goto('/modulo-no-disponible');
    await expect(volverAlLogin(page)).toBeVisible(CARGA);
    await volverAlLogin(page).click();
    await expect(page).toHaveURL(/\/login/, CARGA);
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/, CARGA);
  } finally {
    await actualizar(antes.id, { role_id: antes.role_id });
  }
});
