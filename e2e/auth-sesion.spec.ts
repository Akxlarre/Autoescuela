/**
 * Testing de autenticación, sesión, roles y bloqueo de fase piloto (ASG-i-022, fix-183-b).
 * Checklist: specs/testing-piloto/022-autenticacion-sesion-fase-piloto.md — los IDs de cada test
 * (A01, G08…) son los del checklist.
 *
 * ⚠️ Correr contra un BUILD DE PRODUCCIÓN servido en localhost:4200, no contra `ng serve`: en modo
 * desarrollo `authGuard` deja pasar sin sesión (S14) y los casos B09/B10 saldrían distintos.
 *
 * Mapeo de cuentas (e2e/support/accounts.ts) a los datos del checklist:
 *   admin               → D1
 *   secretariaA (sede 1, sin Clase Profesional)          → D2
 *   secretariaB (sede 2, con Clase Profesional)          → D3
 *   secretariaMultisede (sede 1 + grant ambas sedes)     → D4
 */
import { expect, test, watchErrors } from './support/fixtures';
import type { Page } from '@playwright/test';
import type { E2eRole } from './support/accounts';

// En serie por defecto (resultado estable contra la BD en la nube). `E2E_PARALLEL=1` corre el
// archivo en paralelo: es la prueba de carga de S17 (fix-185-b) — antes de ese fix, con varios
// navegadores la restauración de sesión superaba los 5 s de `whenReady` y los guards mandaban a
// /login a usuarios con sesión válida. 90 s por test: los de matriz navegan varias pantallas.
test.describe.configure({
  mode: process.env['E2E_PARALLEL'] ? 'parallel' : 'default',
  timeout: 90_000,
});

const MND = '/modulo-no-disponible';
const DASH: Record<E2eRole, string> = {
  admin: '/app/admin/dashboard',
  secretariaA: '/app/secretaria/dashboard',
  secretariaB: '/app/secretaria/dashboard',
  secretariaMultisede: '/app/secretaria/dashboard',
};

const EMAIL = '[data-llm-description="User email address for authentication"]';
const PASSWORD = '[data-llm-description="User password for authentication"]';
const SUBMIT = '[data-llm-action="submit-auth-form"]';

/** Navega y espera a que la URL se asiente en `expected` (los guards redirigen en cadena). */
async function expectLandsOn(page: Page, url: string, expected: string): Promise<void> {
  await page.goto(url);
  // 30 s: la cadena de guards + carga de sesión contra la BD en la nube pasa de 20 s cuando la
  // suite corre en paralelo (E2E_PARALLEL) y satura la BD del piloto (consultas de 30 s).
  await expect(page).toHaveURL(new RegExp(`${expected.replace(/[?]/g, '\\?')}$`), {
    timeout: 30_000,
  });
}

/** Texto de la pantalla 404. */
async function expectNotFound(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
}

// ── A. Pantalla de login (sin sesión) ──────────────────────────────────────────

test.describe('A. Login', () => {
  test('A01: abrir / sin sesión redirige a /login', async ({ page }) => {
    await expectLandsOn(page, '/', '/login');
  });

  test('A03: el panel "Credenciales de prueba" no aparece en el build de producción (S3)', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.locator(SUBMIT)).toBeVisible();
    await expect(page.getByText('Credenciales de prueba')).toHaveCount(0);
    await expect(page.getByText('Test123456')).toHaveCount(0);
  });

  test('A04/A05: botón deshabilitado con campos vacíos o correo inválido', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator(SUBMIT)).toBeDisabled();
    await page.locator(PASSWORD).fill('cualquier-clave');
    for (const bad of ['hola@', 'hola']) {
      await page.locator(EMAIL).fill(bad);
      await expect(page.locator(SUBMIT)).toBeDisabled();
    }
  });

  test('A08: contraseña incorrecta → "Correo o contraseña incorrectos." y no navega', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.locator(EMAIL).fill('admin@test.com');
    await page.locator(PASSWORD).fill('clave-incorrecta-e2e');
    await page.locator(SUBMIT).click();
    await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator(EMAIL)).toBeEditable();
  });

  test('A09: correo inexistente → el mismo mensaje (no revela si el correo existe)', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.locator(EMAIL).fill(`no-existe-${Date.now()}@test.com`);
    await page.locator(PASSWORD).fill('clave-incorrecta-e2e');
    await page.locator(SUBMIT).click();
    await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
  });

  test('A17: entrar a /login ya logueado redirige al dashboard del rol', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await expectLandsOn(page, '/login', DASH.admin);
  });

  test('O02: login a 375 px sin scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await expect(page.locator(SUBMIT)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

// ── B. Sesión ──────────────────────────────────────────────────────────────────

test.describe('B. Sesión', () => {
  test('B01: recargar mantiene la sesión y la pantalla', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await page.goto('/app/admin/pagos');
    await expect(page).toHaveURL(/\/app\/admin\/pagos$/);
    await page.reload();
    await expect(page).toHaveURL(/\/app\/admin\/pagos$/);
  });

  test('B09: sin sesión, /app/admin/dashboard redirige a /login', async ({ page }) => {
    await expectLandsOn(page, '/app/admin/dashboard', '/login');
  });

  test('B10: sin sesión, /app redirige a /login', async ({ page }) => {
    await expectLandsOn(page, '/app', '/login');
  });

  test('C11: sin sesión, /force-password-change redirige a /login', async ({ page }) => {
    await expectLandsOn(page, '/force-password-change', '/login');
  });

  test('C10: /force-password-change con un usuario que ya cambió su clave → su dashboard', async ({
    pageAs,
  }) => {
    const page = await pageAs('secretariaA');
    await expectLandsOn(page, '/force-password-change', DASH.secretariaA);
  });
});

// ── D. Recuperar contraseña (lo que no necesita correo real) ───────────────────

test.describe('D. Recuperar contraseña', () => {
  test('D01/D02: "¿Olvidaste tu contraseña?" cambia la card y "Volver" regresa al login', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByText('¿Olvidaste tu contraseña?').click();
    await expect(page.getByText('Recuperar Contraseña').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar Enlace' })).toBeVisible();
    await page.getByText(/Volver a iniciar sesión/i).click();
    await expect(page.locator(PASSWORD)).toBeVisible();
  });

  test('D09/F5: /recuperar-contrasena sin sesión de recuperación → /login (fix-181-b)', async ({
    page,
  }) => {
    await expectLandsOn(page, '/recuperar-contrasena', '/login');
    await expect(page.getByText(/Pendiente calcar|PLANO/)).toHaveCount(0);
  });
});

// ── E. Cerrar sesión ──────────────────────────────────────────────────────────

test.describe('E. Cerrar sesión', () => {
  test('E01–E04: modal, Cancelar, "Sí, salir" → /login, y Atrás no vuelve a la pantalla', async ({
    page,
  }) => {
    // Sesión propia (por UI). Desde fix-184-b el cierre de sesión es local (E11); igual se
    // intercepta la llamada al servidor para que el test no dependa de ella. La app limpia su
    // sesión local de todas formas.
    await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.goto('/login');
    await page.locator(EMAIL).fill('secretaria@test.com');
    await page.locator(PASSWORD).fill('Test123456');
    await page.locator(SUBMIT).click();
    await expect(page).toHaveURL(new RegExp(`${DASH.secretariaA}$`));

    const openLogout = async () => {
      await page.locator('[data-llm-action="open-user-profile-menu"]').click();
      await page.locator('[data-llm-action="cerrar-sesion"]').click();
    };

    await openLogout();
    await expect(page.locator('[data-llm-action="confirm-modal-accept"]')).toBeVisible();
    await page.locator('[data-llm-action="confirm-modal-cancel"]').click();
    await expect(page).toHaveURL(new RegExp(`${DASH.secretariaA}$`));

    await openLogout();
    await page.locator('[data-llm-action="confirm-modal-accept"]').click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
  });
});

// ── F. Rutas de otro rol (URL directa) ────────────────────────────────────────

test.describe('F. Rutas de otro rol', () => {
  const ADMIN_ONLY = [
    '/app/admin/dashboard',
    '/app/admin/secretarias',
    '/app/admin/auditoria',
    '/app/admin/flota',
    '/app/admin/contabilidad/anticipos',
    '/app/admin/tareas',
    '/app/admin/notificaciones',
    '/app/admin/alumnos',
    '/app/admin/pagos',
    '/app/admin/matricula',
  ];

  for (const url of ADMIN_ONLY) {
    test(`F01/F02: secretaria no entra a ${url} (su dashboard + aviso)`, async ({ pageAs }) => {
      const page = await pageAs('secretariaA');
      // fix-184-b: la redirección ya no es silenciosa. El aviso dura 4 s, así que se espera
      // DURANTE la navegación (buscarlo después de que la URL se asienta puede llegar tarde).
      const aviso = page.getByText('No tienes acceso a esa sección').waitFor({ timeout: 30_000 });
      await expectLandsOn(page, url, DASH.secretariaA);
      await aviso;
    });
  }

  for (const url of ['/app/secretaria/dashboard', '/app/secretaria/observaciones']) {
    test(`F03: admin abre ${url} → su dashboard`, async ({ pageAs }) => {
      const page = await pageAs('admin');
      await expectLandsOn(page, url, DASH.admin);
    });
  }

  for (const url of ['/app/instructor/dashboard', '/app/alumno/dashboard']) {
    test(`F04: admin abre ${url} → su dashboard`, async ({ pageAs }) => {
      const page = await pageAs('admin');
      await expectLandsOn(page, url, DASH.admin);
    });
  }

  for (const url of ['/app/instructor/horario', '/app/alumno/pagos']) {
    test(`F05: secretaria abre ${url} → su dashboard`, async ({ pageAs }) => {
      const page = await pageAs('secretariaA');
      await expectLandsOn(page, url, DASH.secretariaA);
    });
  }

  test('F06: ruta inexistente dentro del rol → 404', async ({ pageAs }) => {
    const admin = await pageAs('admin');
    await admin.goto('/app/admin/xyz');
    await expectNotFound(admin);
    const sec = await pageAs('secretariaA');
    for (const url of ['/app/secretaria/usuarios', '/app/secretaria/contabilidad/anticipos']) {
      await sec.goto(url);
      await expectNotFound(sec);
    }
  });

  test('F07: /app/admin y /app/secretaria sin sub-ruta → su dashboard (S18, fix-184-b)', async ({
    pageAs,
  }) => {
    const admin = await pageAs('admin');
    await expectLandsOn(admin, '/app/admin', DASH.admin);
    const sec = await pageAs('secretariaA');
    await expectLandsOn(sec, '/app/secretaria', DASH.secretariaA);
  });

  test('F08: ruta inexistente fuera de /app → 404 y "Volver al inicio" lleva al dashboard', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await page.goto('/hola');
    await expectNotFound(page);
    await page.getByRole('link', { name: 'Volver al inicio' }).click();
    await expect(page).toHaveURL(new RegExp(`${DASH.admin}$`));
  });
});

// ── G. Fase piloto — matriz de rutas bloqueadas ───────────────────────────────

test.describe('G. Fase piloto', () => {
  const ADMIN_BLOCKED = [
    '/app/admin/clase-profesional/pre-inscritos',
    '/app/admin/clase-profesional/relatores',
    '/app/admin/clase-profesional/asistencia',
    '/app/admin/clase-profesional/certificados',
    '/app/admin/clase-profesional/evaluaciones',
    '/app/admin/ex-alumnos-profesional',
  ];
  for (const url of ADMIN_BLOCKED) {
    test(`G01–G07: admin ${url} → MND`, async ({ pageAs }) => {
      const page = await pageAs('admin');
      await expectLandsOn(page, url, MND);
    });
  }

  const SEC_BLOCKED = [
    '/app/secretaria/profesional/pre-inscritos',
    '/app/secretaria/profesional/relatores',
    '/app/secretaria/profesional/asistencia',
    '/app/secretaria/profesional/evaluaciones',
    '/app/secretaria/profesional/certificados',
    '/app/secretaria/ex-alumnos-profesional',
  ];
  const SEC_EXPECTED: Record<'secretariaA' | 'secretariaB' | 'secretariaMultisede', string> = {
    secretariaA: DASH.secretariaA, // D2: sede sin Profesional → su dashboard
    secretariaB: MND, // D3
    secretariaMultisede: MND, // D4
  };
  for (const url of SEC_BLOCKED) {
    for (const role of Object.keys(SEC_EXPECTED) as (keyof typeof SEC_EXPECTED)[]) {
      test(`G08–G14: ${role} ${url} → ${SEC_EXPECTED[role]}`, async ({ pageAs }) => {
        const page = await pageAs(role);
        await expectLandsOn(page, url, SEC_EXPECTED[role]);
      });
    }
  }

  // Archivo de Clase Profesional se habilitó en el piloto con fix-326-m (antes estaba en G06/G13).
  for (const url of [
    '/app/admin/clase-profesional/alumnos',
    '/app/admin/clase-profesional/promociones',
    '/app/admin/clase-profesional/archivo',
    '/app/admin/libro-de-clases',
  ]) {
    test(`G15–G17: admin ${url} renderiza (no MND ni 404)`, async ({ pageAs }) => {
      const page = await pageAs('admin');
      await expectLandsOn(page, url, url);
      await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Módulo no habilitado todavía' })).toHaveCount(
        0,
      );
    });
  }

  for (const url of [
    '/app/secretaria/profesional/alumnos',
    '/app/secretaria/profesional/promociones',
    '/app/secretaria/profesional/archivo',
    '/app/secretaria/libro-de-clases',
  ]) {
    test(`G18/H02/H03: ${url} → D3 renderiza, D2 su dashboard`, async ({ pageAs }) => {
      const d3 = await pageAs('secretariaB');
      await expectLandsOn(d3, url, url);
      const d2 = await pageAs('secretariaA');
      await expectLandsOn(d2, url, DASH.secretariaA);
    });
  }

  test('G31: /inscripcion sin sesión → MND con "Volver al inicio de sesión"', async ({ page }) => {
    await expectLandsOn(page, '/inscripcion', MND);
    await expect(page.getByRole('button', { name: 'Volver al inicio de sesión' })).toBeVisible();
  });

  test('G32: /inscripcion/retorno sin sesión → MND y nunca llama a public-enrollment', async ({
    page,
  }) => {
    const calls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/functions/v1/public-enrollment')) calls.push(r.url());
    });
    await expectLandsOn(page, '/inscripcion/retorno?token_ws=abc', MND);
    await page.waitForLoadState('networkidle');
    expect(calls).toEqual([]);
  });

  test('G33: /inscripcion logueado como admin → MND con "Volver al inicio" sin cerrar sesión', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await expectLandsOn(page, '/inscripcion', MND);
    await page.getByRole('button', { name: 'Volver al inicio', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${DASH.admin}$`));
  });
});

// ── H / I. Menú lateral por rol ───────────────────────────────────────────────

const BLOCKED_MENU_LABELS = [
  'Relatores',
  'Asistencia Prof',
  'Evaluaciones',
  'Certificados Prof',
  'Ex-Alumnos Prof',
  'Pre-inscritos',
];

async function sidebarText(page: Page): Promise<string> {
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(nav).toBeVisible({ timeout: 20_000 });
  return (await nav.innerText()).replace(/\s+/g, ' ');
}

test.describe('H/I. Menú lateral', () => {
  test('H01: D2 (sede sin Profesional) no ve "Academia Profesional"', async ({ pageAs }) => {
    const page = await pageAs('secretariaA');
    await page.goto(DASH.secretariaA);
    expect(await sidebarText(page)).not.toMatch(/Academia Profesional/i);
  });

  for (const role of ['admin', 'secretariaA', 'secretariaB', 'secretariaMultisede'] as const) {
    test(`I03: ${role} no ve módulos bloqueados en el menú`, async ({ pageAs }) => {
      const page = await pageAs(role);
      await page.goto(DASH[role]);
      const text = await sidebarText(page);
      for (const label of BLOCKED_MENU_LABELS) expect(text, label).not.toContain(label);
    });
  }

  test('I02: secretaria no ve Anticipos, Secretarias, Auditoría ni Flota', async ({ pageAs }) => {
    const page = await pageAs('secretariaB');
    await page.goto(DASH.secretariaB);
    const text = await sidebarText(page);
    for (const label of ['Anticipos', 'Secretarias', 'Auditoría', 'Flota']) {
      expect(text, label).not.toContain(label);
    }
  });

  for (const role of ['admin', 'secretariaB'] as const) {
    test(`I04: ${role} — cada ítem del menú abre su pantalla (ni MND ni 404)`, async ({
      pageAs,
    }) => {
      const page = await pageAs(role);
      const errors = watchErrors(page);
      await page.goto(DASH[role]);
      await expect(page.locator('[data-llm-nav]').first()).toBeVisible({ timeout: 20_000 });
      const links = await page
        .locator('[data-llm-nav]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-llm-nav')).filter(Boolean));
      const unique = [...new Set(links as string[])].filter((l) => l.startsWith('/app/'));
      expect(unique.length).toBeGreaterThan(5);
      for (const link of unique) {
        await page.goto(link);
        await expect(page, link).not.toHaveURL(new RegExp(MND));
        await expect(page.getByRole('heading', { name: 'Página no encontrada' }), link).toHaveCount(
          0,
        );
      }
      void errors; // los errores de consola/red de cada pantalla se cubren en ASG-i-037 (barrido)
    });
  }
});

// ── J. Pantallas de aviso y públicas ──────────────────────────────────────────

test.describe('J. Pantallas de aviso y públicas', () => {
  test('J01: /modulo-no-disponible como secretaria → "Volver al inicio" lleva al dashboard', async ({
    pageAs,
  }) => {
    const page = await pageAs('secretariaB');
    await page.goto(MND);
    await expect(page.getByRole('heading', { name: 'Módulo no habilitado todavía' })).toBeVisible();
    await page.getByRole('button', { name: 'Volver al inicio', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${DASH.secretariaB}$`));
  });

  test('J03: /modulo-no-disponible sin sesión → "Volver al inicio de sesión" → /login', async ({
    page,
  }) => {
    await page.goto(MND);
    await page.getByRole('button', { name: 'Volver al inicio de sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('J06: /acceso-denegado ya no existe (stub eliminado, S9 / fix-184-b) → 404', async ({
    page,
  }) => {
    await page.goto('/acceso-denegado');
    await expectNotFound(page);
    await expect(page.getByText(/PLANO|Pendiente calcar/)).toHaveCount(0);
  });

  for (const slug of ['autoescuela-chillan', 'conductores-chillan']) {
    test(`J07: /politica-privacidad/${slug} se ve sin sesión`, async ({ page }) => {
      await page.goto(`/politica-privacidad/${slug}`);
      await expect(page).toHaveURL(new RegExp(`/politica-privacidad/${slug}$`));
      await expect(page.getByText(/RUT/).first()).toBeVisible();
    });
  }

  test('J08: /politica-privacidad/xyz → aviso con enlaces a las 2 sedes', async ({ page }) => {
    await page.goto('/politica-privacidad/xyz');
    await expect(page.getByText(/No encontramos esa política/i)).toBeVisible();
  });
});
