/**
 * Clase Profesional visible en el piloto — Base de Alumnos Profesional, Promociones y Libro de
 * Clases (fix-319-m, ASG-i-025).
 * Casos de specs/testing-piloto/025-clase-profesional-piloto.md; el ID de cada caso va en el título.
 *
 * Los tests que necesitan un alumno siembran el suyo con prefijo E2E- (e2e/support/alumnos-seed.ts)
 * en un curso de la promoción en curso más nueva, y lo borran al terminar.
 *
 * Fuera de la suite a propósito:
 * - Crear, editar o eliminar promociones (K09, L04): mientras existe, una promoción de prueba ocupa
 *   un lunes y un número reales de la cadencia automática de la sede.
 * - Matricular por el asistente (B09, N01–N04): es del testing de matrícula (ASG-i-023).
 */
import { statSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { ACCOUNTS } from './support/accounts';
import { createE2eAlumno } from './support/alumnos-seed';
import { getAdminClient, getClientFor } from './support/supabase-admin';
import { expect, knownBug, test, watchErrors } from './support/fixtures';

const SEDE_A = 1; // Autoescuela Chillán — sin Clase Profesional
const SEDE_B = 2; // Conductores Chillán — la única con Clase Profesional

const DESKTOP = { width: 1600, height: 900 };
/**
 * Espera de una carga completa (app + consultas). 30 s: con la suite entera en paralelo, la Base
 * Profesional llegó a tardar más de 20 s en pintar el paginador (corrida del 2026-10-07).
 */
const CARGA = { timeout: 30_000 };

test.describe.configure({ timeout: 90_000 });

const RUTAS = {
  admin: {
    alumnos: '/app/admin/clase-profesional/alumnos',
    promociones: '/app/admin/clase-profesional/promociones',
    libro: '/app/admin/libro-de-clases',
    archivo: '/app/admin/clase-profesional/archivo',
  },
  secretaria: {
    alumnos: '/app/secretaria/profesional/alumnos',
    promociones: '/app/secretaria/profesional/promociones',
    libro: '/app/secretaria/libro-de-clases',
    archivo: '/app/secretaria/profesional/archivo',
  },
} as const;
type Portal = keyof typeof RUTAS;

const SEARCH =
  '[data-llm-description="Search professional students by name, RUT or enrollment number"]';
const FILTRO_CLASE = 'Filter professional students by license class';
const REPORT = /Mostrando \d+ a \d+ de (\d+) matrículas/;

// ── Datos ───────────────────────────────────────────────────────────────────

interface CursoVigente {
  promotionId: number;
  promotionCode: string;
  promotionName: string;
  /** `promotion_courses.id` del curso Profesional A2 de esa promoción. */
  courseA2: number;
}

let cursoVigentePromise: Promise<CursoVigente> | null = null;

/** La promoción en curso más nueva de la sede Profesional: la que el Libro abre por defecto. */
function cursoVigente(): Promise<CursoVigente> {
  cursoVigentePromise ??= (async () => {
    const sb = await getAdminClient();
    const { data: promo, error } = await sb
      .from('professional_promotions')
      .select('id, name, code')
      .eq('branch_id', SEDE_B)
      .eq('status', 'in_progress')
      .order('start_date', { ascending: false })
      .limit(1)
      .single();
    if (error)
      throw new Error(`[e2e] No hay una promoción en curso en la sede 2: ${error.message}`);
    const { data: course, error: courseErr } = await sb
      .from('promotion_courses')
      .select('id, courses!inner(code)')
      .eq('promotion_id', promo.id)
      .eq('courses.code', 'professional_a2')
      .single();
    if (courseErr)
      throw new Error(`[e2e] La promoción ${promo.code} no tiene curso A2: ${courseErr.message}`);
    return {
      promotionId: promo.id,
      promotionCode: promo.code,
      promotionName: promo.name,
      courseA2: course.id,
    };
  })();
  return cursoVigentePromise;
}

type SeedCleanup = Parameters<typeof createE2eAlumno>[1];

/** Alumno E2E- con una matrícula Profesional A2 activa en la promoción en curso. */
async function seedProfesional(
  label: string,
  cleanup: SeedCleanup,
  extra: { paternalLastName?: string; pendingBalance?: number } = {},
) {
  const curso = await cursoVigente();
  const pendingBalance = extra.pendingBalance ?? 0;
  return createE2eAlumno(
    {
      label,
      branchId: SEDE_B,
      paternalLastName: extra.paternalLastName,
      enrollments: [
        {
          courseName: 'Profesional A2',
          promotionCourseId: curso.courseA2,
          pendingBalance,
          paymentStatus: pendingBalance > 0 ? 'partial' : 'paid',
        },
      ],
    },
    cleanup,
  );
}

// ── Pantalla ────────────────────────────────────────────────────────────────

/** Abre la Base Profesional en escritorio y espera el paginador (solo existe con datos cargados). */
async function openBase(page: Page, portal: Portal): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(RUTAS[portal].alumnos);
  await expect(page.getByText(REPORT)).toBeVisible(CARGA);
}

async function reportTotal(page: Page): Promise<number> {
  const text = await page.getByText(REPORT).textContent();
  return Number(text?.match(REPORT)?.[1]);
}

function rows(page: Page): Locator {
  return page.locator('p-table tbody tr');
}

function rowOf(page: Page, text: string): Locator {
  return rows(page).filter({ hasText: text });
}

/** Aviso de búsqueda sin resultados. La tabla y las tarjetas lo traen ambas; solo una se ve. */
function sinResultados(page: Page): Locator {
  return page.getByText('No se encontraron alumnos').locator('visible=true');
}

async function sidebarText(page: Page): Promise<string> {
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(nav).toBeVisible(CARGA);
  return (await nav.innerText()).replace(/\s+/g, ' ');
}

/** El documento no scrollea en horizontal (ni en vertical, si `appLike`). */
async function expectSinScroll(page: Page, appLike = false): Promise<void> {
  const doc = await page.evaluate(() => {
    const el = document.documentElement;
    return { sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight };
  });
  expect(doc.sw, 'scroll horizontal del documento').toBeLessThanOrEqual(doc.cw);
  if (appLike) expect(doc.sh, 'scroll vertical del documento').toBeLessThanOrEqual(doc.ch + 1);
}

/** Elige una opción de un p-select. Reintenta: con carga, el panel a veces se cierra solo. */
async function elegir(page: Page, descripcion: string, opcion: string | RegExp): Promise<void> {
  const select = page.locator(`p-select[data-llm-description="${descripcion}"]`);
  const option = page.getByRole('option', { name: opcion, exact: typeof opcion === 'string' });
  await expect(async () => {
    if (!(await option.first().isVisible())) await select.click();
    await option.first().click({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/** Textos de las opciones de un p-select; lo deja cerrado. */
async function opcionesDe(page: Page, descripcion: string): Promise<string[]> {
  const select = page.locator(`p-select[data-llm-description="${descripcion}"]`);
  const options = page.getByRole('option');
  await expect(async () => {
    if (!(await options.first().isVisible())) await select.click();
    await expect(options.first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  const texts = (await options.allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press('Escape');
  return texts;
}

// ── A. Acceso, menú y guards ────────────────────────────────────────────────

test.describe('A. Acceso y menú', () => {
  for (const [role, portal] of [
    ['admin', 'admin'],
    ['secretariaB', 'secretaria'],
  ] as const) {
    test(`A01 · A02: ${role} ve los 4 ítems de Academia Profesional`, async ({ pageAs }) => {
      const page = await pageAs(role);
      await page.goto(`/app/${portal}/dashboard`);
      // El grupo aparece cuando termina de cargar la sede del usuario: se espera, no se lee al vuelo.
      await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toContainText(
        /Academia Profesional/i,
        CARGA,
      );
      const text = await sidebarText(page);
      // El cuarto es Archivo, habilitado en el piloto por D3a (fix-326-m).
      for (const item of ['Base Alumnos Prof.', 'Promociones', 'Libro de Clases', 'Archivo'])
        expect(text, item).toContain(item);
    });
  }

  test('A04: secretaria de la sede sin Profesional no entra por URL', async ({ pageAs }) => {
    const page = await pageAs('secretariaA');
    for (const path of Object.values(RUTAS.secretaria)) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/app\/secretaria\/dashboard/, CARGA);
    }
  });

  test('A06: una secretaria no entra a las URLs de admin', async ({ pageAs }) => {
    const page = await pageAs('secretariaB');
    for (const path of Object.values(RUTAS.admin)) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/app\/secretaria\/dashboard/, CARGA);
    }
  });

  test('A08 · T01: admin queda en la sede Profesional al entrar', async ({ pageAs }) => {
    const page = await pageAs('admin');
    for (const path of [RUTAS.admin.alumnos, RUTAS.admin.promociones, RUTAS.admin.libro]) {
      await page.goto(path);
      await expect(page.locator('[data-llm-action="toggle-branch-dropdown"]'), path).toContainText(
        'Conductores Chillán',
        CARGA,
      );
    }
  });
});

// ── B–F. Base de Alumnos Profesional ────────────────────────────────────────

test.describe('B–F. Base de Alumnos Profesional', () => {
  test('B01 · C02 · C05 · C10 · E01 · E03 · E04: el alumno aparece con sus datos y se encuentra', async ({
    pageAs,
    cleanup,
  }) => {
    const curso = await cursoVigente();
    const alumno = await seedProfesional('ProfLista', cleanup, { pendingBalance: 50_000 });
    const page = await pageAs('admin');
    await openBase(page, 'admin');
    const row = rowOf(page, alumno.paternalLastName);
    const search = page.locator(SEARCH);

    await search.fill(alumno.paternalLastName);
    await expect(row).toHaveCount(1);
    // C02: nombre y RUT. C05 (fix-330-m): promoción con la categoría. C10: saldo en CLP.
    await expect(row).toContainText(alumno.firstNames);
    await expect(row).toContainText(alumno.rut);
    await expect(row).toContainText(`Promoción ${curso.promotionCode}`);
    await expect(row).toContainText('A2');
    await expect(row).toContainText('Activo');
    await expect(row).toContainText('50.000');

    // E01: "apellido nombre", en mayúsculas.
    await search.fill(`${alumno.paternalLastName} ${alumno.firstNames}`.toUpperCase());
    await expect(row).toHaveCount(1);
    // E03: RUT sin puntos ni guion.
    await search.fill(alumno.rut.replace(/[.-]/g, ''));
    await expect(row).toHaveCount(1);
    // E04: Nº de matrícula.
    await search.fill(alumno.enrollmentNumbers[0]);
    await expect(row).toHaveCount(1);
  });

  test('B03 · B07 · B10: matrícula completada, borrador y alumno solo Clase B no aparecen', async ({
    pageAs,
    cleanup,
  }) => {
    const curso = await cursoVigente();
    const prof = { courseName: 'Profesional A2', promotionCourseId: curso.courseA2 };
    const completado = await createE2eAlumno(
      { label: 'ProfCompl', branchId: SEDE_B, enrollments: [{ ...prof, status: 'completed' }] },
      cleanup,
    );
    const borrador = await createE2eAlumno(
      { label: 'ProfBorr', branchId: SEDE_B, enrollments: [{ ...prof, status: 'draft' }] },
      cleanup,
    );
    const soloB = await createE2eAlumno(
      { label: 'ProfSoloB', branchId: SEDE_B, enrollments: [{}] },
      cleanup,
    );

    const page = await pageAs('admin');
    await openBase(page, 'admin');
    for (const alumno of [completado, borrador, soloB]) {
      await page.locator(SEARCH).fill(alumno.paternalLastName);
      await expect(sinResultados(page), alumno.firstNames).toBeVisible();
    }
  });

  for (const [role, portal] of [
    ['admin', 'admin'],
    ['secretariaB', 'secretaria'],
  ] as const) {
    test(`C07 · C08 · D04 · E06 · I01 · I02: ${role} no ve datos ni accesos de módulos bloqueados`, async ({
      pageAs,
    }) => {
      const page = await pageAs(role);
      await openBase(page, portal);
      // fix-332-m (D12): sin columnas Módulos / Asistencia ni KPI "En riesgo".
      const headers = (await page.locator('p-table thead').innerText()).toUpperCase();
      expect(headers).not.toContain('MÓDULOS');
      expect(headers).not.toContain('ASISTENCIA');
      const hero = page.locator('app-section-hero');
      await expect(hero).not.toContainText(/En riesgo/i);
      // fix-328-m (D1): sin botón "Pre-inscritos". fix-329-m (D2): sin filtro de estado.
      await expect(hero).not.toContainText(/Pre-inscritos/i);
      await expect(page.getByText('Todos los estados')).toHaveCount(0);
    });
  }

  test('D01 · E10 · F01 · F02: el total cuenta matrículas y coincide en chip, contador y paginador', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openBase(page, 'admin');
    const total = await reportTotal(page);
    // fix-331-m (D10): una fila por matrícula; chip y contador dicen lo mismo que el paginador.
    await expect(page.locator('app-section-hero')).toContainText(
      new RegExp(`\\b${total} matrículas?\\b`),
    );
    await expect(page.getByText(`${total} resultados`)).toBeVisible();
    expect(await rows(page).count()).toBeLessThanOrEqual(10);
    // F02: app-like, el documento no scrollea.
    await expectSinScroll(page, true);
  });

  test('E05: el filtro de clase muestra solo esa clase', async ({ pageAs, cleanup }) => {
    const alumno = await seedProfesional('ProfClase', cleanup);
    const page = await pageAs('admin');
    await openBase(page, 'admin');
    const row = rowOf(page, alumno.paternalLastName);
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    await expect(row).toHaveCount(1);

    await elegir(page, FILTRO_CLASE, 'A4');
    await expect(row).toHaveCount(0);
    await elegir(page, FILTRO_CLASE, 'A2');
    await expect(row).toHaveCount(1);
  });

  test('E09 (hotfix-147-m): sin resultados → "Limpiar filtros" vuelve a la lista completa', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openBase(page, 'admin');
    const total = await reportTotal(page);
    await page.locator(SEARCH).fill('zzz-sin-resultados-e2e');
    await expect(sinResultados(page)).toBeVisible();
    await page.getByRole('button', { name: 'Limpiar filtros' }).first().click();
    await expect(page.locator(SEARCH)).toHaveValue('');
    expect(await reportTotal(page)).toBe(total);
  });

  test('F03 · F06 (fix-354-m): en móvil, tarjetas de a 6 con "Cargar más" y sin scroll horizontal', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openBase(page, 'admin');
    const total = await reportTotal(page);
    test.skip(total <= 6, 'Hacen falta más de 6 matrículas para ver "Cargar más".');

    await page.setViewportSize({ width: 375, height: 812 });
    const cards = page.locator('app-alumno-profesional-card');
    await expect(cards).toHaveCount(6, CARGA);
    await expectSinScroll(page);
    // F06: la tarjeta ofrece ver la ficha y archivar.
    await expect(cards.first().getByLabel('Ver ficha')).toBeVisible();
    await expect(cards.first().getByLabel('Archivar alumno')).toBeVisible();

    const masBtn = page.locator('[data-llm-action="load-more-professional-students"]');
    await expect(masBtn).toContainText(`${total - 6} restantes`);
    await masBtn.click();
    await expect(cards).toHaveCount(Math.min(12, total));
  });
});

// ── G–H. Archivar, Papelera y ficha ─────────────────────────────────────────

test.describe('G–H. Archivar, Papelera y ficha', () => {
  test('G02 · G05 · G07 · B06: archivar → Papelera → restaurar', async ({ pageAs, cleanup }) => {
    const alumno = await seedProfesional('ProfArchivar', cleanup);
    const page = await pageAs('secretariaB');
    await openBase(page, 'secretaria');
    const row = rowOf(page, alumno.paternalLastName);
    await page.locator(SEARCH).fill(alumno.paternalLastName);

    // G02: sin pagos, modal simple.
    await row.locator('[data-llm-action="archive-professional-student"]').click();
    const modal = page.getByRole('dialog', { name: /Confirmar archivado de/ });
    await expect(modal).toContainText(alumno.firstNames);
    await modal.locator('[data-llm-action="confirm-archive-student"]').click();
    await expect(page.getByText('Alumno archivado correctamente.')).toBeVisible();
    // B06: ya no está en la lista activa.
    await expect(row).toHaveCount(0);

    // G05: en la Papelera solo se puede restaurar.
    await page.locator('[data-llm-action="papelera"]').click();
    await expect(page.getByText('Papelera — Alumnos profesionales archivados')).toBeVisible(CARGA);
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    await expect(row).toHaveCount(1);
    await expect(row.locator('[data-llm-action="archive-professional-student"]')).toHaveCount(0);
    await row.locator('[data-llm-action="restore-professional-student"]').click();
    await expect(page.getByText('Alumno restaurado correctamente.')).toBeVisible();
    await expect(row).toHaveCount(0);

    // G07: volver a la lista activa; el alumno está de vuelta.
    await page.locator('[data-llm-nav="back"]').first().click();
    await expect(page.getByText('Listado de alumnos de Clase Profesional')).toBeVisible();
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    await expect(row).toHaveCount(1);
  });

  test('H01 · H02 · H07 (fix-335-m): "Ver ficha" abre la matrícula Profesional y vuelve a su Base', async ({
    pageAs,
    cleanup,
  }) => {
    const curso = await cursoVigente();
    const now = Date.now();
    // La Clase B es posterior: sin el parámetro de matrícula, la ficha abriría esa.
    const alumno = await createE2eAlumno(
      {
        label: 'ProfFicha',
        branchId: SEDE_B,
        enrollments: [
          {
            courseName: 'Profesional A2',
            promotionCourseId: curso.courseA2,
            createdAt: new Date(now - 86_400_000).toISOString(),
          },
          { createdAt: new Date(now).toISOString() },
        ],
      },
      cleanup,
    );
    const page = await pageAs('admin');
    await openBase(page, 'admin');
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    const row = rowOf(page, alumno.paternalLastName);
    await expect(row).toHaveCount(1);

    await row.getByLabel('Ver ficha').click();
    await expect(page).toHaveURL(
      new RegExp(`/app/admin/alumnos/${alumno.studentId}\\?enrollment=${alumno.enrollmentIds[0]}`),
    );
    await expect(page.getByText(/PROFESIONAL A2/i).first()).toBeVisible(CARGA);

    // H07: el enlace de vuelta lleva a la Base Profesional, no a la B.
    await page.getByText('Listado de Alumnos Profesionales').first().click();
    await expect(page).toHaveURL(new RegExp(RUTAS.admin.alumnos));
  });

  test('H08: la secretaria de otra sede no ve la ficha por URL', async ({ pageAs, cleanup }) => {
    const alumno = await seedProfesional('ProfOtraSede', cleanup);
    const page = await pageAs('secretariaA');
    await page.goto(`/app/secretaria/alumnos/${alumno.studentId}`);
    await expect(page.getByText('El alumno no existe o no tienes acceso a su ficha.')).toBeVisible(
      CARGA,
    );
    await expect(page.getByText(alumno.rut)).toHaveCount(0);
  });
});

// ── J–L. Promociones ────────────────────────────────────────────────────────

const ENCONTRADAS = /(\d+) promoci(?:ón encontrada|ones encontradas)/;

async function openPromociones(page: Page, portal: Portal): Promise<number> {
  await page.setViewportSize(DESKTOP);
  await page.goto(RUTAS[portal].promociones);
  // El contador dice "0 promociones encontradas" mientras carga: se espera la primera fila.
  await expect(page.locator('[data-llm-action="ver-promocion"]').first()).toBeVisible(CARGA);
  const contador = page.getByText(ENCONTRADAS);
  return Number((await contador.textContent())?.match(ENCONTRADAS)?.[1]);
}

test.describe('J–L. Promociones', () => {
  for (const [role, portal] of [
    ['admin', 'admin'],
    ['secretariaB', 'secretaria'],
  ] as const) {
    test(`J01 · T03: ${role} carga Promociones sin errores`, async ({ pageAs }) => {
      const page = await pageAs(role);
      const errors = watchErrors(page);
      const total = await openPromociones(page, portal);
      expect(total).toBeGreaterThan(0);
      await expectSinScroll(page, true);
      errors.expectClean();
    });
  }

  test('J04 · J05 · J06: KPI total, búsqueda y filtro de estado', async ({ pageAs }) => {
    const curso = await cursoVigente();
    const page = await pageAs('admin');
    const total = await openPromociones(page, 'admin');

    // J04: el KPI "Total" es lo que lista la pantalla.
    const hero = (await page.locator('app-section-hero').innerText()).replace(/\s+/g, ' ');
    expect(hero).toMatch(new RegExp(`Total promociones ${total}\\b`, 'i'));

    // J06 (D3a, D20): las finalizadas se ven en Archivo y "Cancelada" ya no existe.
    const estados = await opcionesDe(page, 'filter promotions by status');
    expect(estados).toContain('En curso');
    expect(estados).not.toContain('Finalizada');
    expect(estados).not.toContain('Cancelada');

    // J05: por número.
    await page
      .locator('[data-llm-description="Search promotions by name or code"]')
      .fill(curso.promotionCode);
    await expect(page.getByText(curso.promotionName).first()).toBeVisible();
    await expect(page.getByText(/^\s*1 promoción encontrada\s*$/)).toBeVisible();
  });

  test('J10: en móvil, tarjetas sin scroll horizontal', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await openPromociones(page, 'admin');
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('[data-llm-action="view-promocion-card"]').first()).toBeVisible(
      CARGA,
    );
    await expectSinScroll(page);
  });

  test('K01 · K07 · K13: el panel de crear ofrece lunes, no deja crear sin fecha y cancelar no crea nada', async ({
    pageAs,
  }) => {
    const sb = await getAdminClient();
    const contar = async () =>
      (await sb.from('professional_promotions').select('id', { count: 'exact', head: true })).count;
    const antes = await contar();

    const page = await pageAs('admin');
    await openPromociones(page, 'admin');
    await page.locator('[data-llm-action="new"]').click();
    const lunes = page.locator('[data-llm-action="seleccionar-fecha-inicio"]');
    await expect(lunes).toHaveCount(8, CARGA);
    for (const texto of await lunes.allInnerTexts()) expect(texto).toMatch(/^\s*lun,/);
    // K07: sin fecha no se puede crear.
    await expect(page.locator('[data-llm-action="submit-crear-promocion"] button')).toBeDisabled();
    // K13
    await page.locator('[data-llm-action="cancelar-crear-promocion"]').click();
    await expect(lunes).toHaveCount(0);
    expect(await contar()).toBe(antes);
  });

  test('K14 (D5): la secretaria no puede programar promociones', async ({ pageAs }) => {
    const page = await pageAs('secretariaB');
    await openPromociones(page, 'secretaria');
    await expect(page.locator('[data-llm-action="new"]')).toHaveCount(0);
    await expect(page.getByText('Programar Promoción')).toHaveCount(0);
  });

  test('L01 · L03 · L05: detalle → editar con datos precargados; un número con letras no se guarda', async ({
    pageAs,
  }) => {
    const curso = await cursoVigente();
    const page = await pageAs('admin');
    await openPromociones(page, 'admin');
    await page
      .locator('[data-llm-description="Search promotions by name or code"]')
      .fill(curso.promotionCode);
    await page.locator('[data-llm-action="ver-promocion"]').first().click();
    await expect(page.getByText('Detalle de Promoción')).toBeVisible(CARGA);
    await expect(page.getByText(/Día de clase \d+ de \d+/)).toBeVisible();

    // L03
    await page.getByRole('button', { name: 'Editar promoción' }).last().click();
    const numero = page.locator('input[placeholder="Ej: 156"]');
    await expect(numero).toHaveValue(curso.promotionCode, CARGA);
    await expect(page.locator('input[placeholder="Ej: Promoción 30 de Marzo 2026"]')).toHaveValue(
      curso.promotionName,
    );

    // L05 (fix-323-m): solo números. No se guarda nada.
    await numero.fill('abc');
    await expect(page.getByText('Debe ser solo números')).toBeVisible();
    await expect(page.locator('[data-llm-action="submit-editar-promocion"] button')).toBeDisabled();
    await page.locator('[data-llm-action="cancelar-editar-promocion"]').click();
  });
});

// ── O–R. Libro de Clases ────────────────────────────────────────────────────

const SENCE = '[data-llm-description="input for SENCE authorized code"]';

async function openLibro(page: Page, portal: Portal): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(RUTAS[portal].libro);
  await expect(page.getByRole('heading', { name: 'Libro de Control de Clases' })).toBeVisible(
    CARGA,
  );
}

/** Cambia de sección del libro (a 1600 px las secciones son pestañas con texto). */
async function seccion(page: Page, nombre: string): Promise<void> {
  await page.locator('main button:visible', { hasText: nombre }).first().click();
}

test.describe('O–R. Libro de Clases', () => {
  for (const [role, portal] of [
    ['admin', 'admin'],
    ['secretariaB', 'secretaria'],
  ] as const) {
    test(`O01 · P01 · P12: ${role} abre el libro de la promoción en curso`, async ({ pageAs }) => {
      const curso = await cursoVigente();
      const page = await pageAs(role);
      const errors = watchErrors(page);
      await openLibro(page, portal);
      // O01: la promoción en curso más nueva y su primer curso (A2).
      const main = page.locator('main');
      await expect(main).toContainText(curso.promotionName);
      await expect(main).toContainText(`ID: ${curso.promotionCode}.2`);
      await expect(main).toContainText('Conductores Chillán');
      await expectSinScroll(page, true);
      errors.expectClean();
    });
  }

  test('O04: el selector de curso ofrece los 4 cursos y las 2 convalidaciones', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openLibro(page, 'admin');
    const cursos = (await opcionesDe(page, 'select course for class book')).join(' | ');
    for (const curso of ['A2', 'A3', 'A4', 'A5', 'Conv. A-3', 'Conv. A-4'])
      expect(cursos, curso).toContain(curso);
  });

  test('P02 · P05 · P07 · P08 · I08: las secciones cargan (vacías por diseño)', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    const errors = watchErrors(page);
    await openLibro(page, 'admin');
    const main = page.locator('main');

    await seccion(page, 'Profesores por Módulo');
    await expect(main).toContainText('7 módulos');
    await expect(main.locator('tbody tr')).toHaveCount(7);

    await seccion(page, 'Firma Diaria');
    await expect(main).toContainText(/Semana 1/);

    await seccion(page, 'Evaluaciones');
    await expect(main).toContainText('Mód. 1');
    await expect(main).toContainText('Mód. 7');

    await seccion(page, 'Resumen Asistencia');
    await expect(main).toContainText(/alumnos?/);
    errors.expectClean();
  });

  test('P03: un alumno del curso sale en la Lista de Clase', async ({ pageAs, cleanup }) => {
    const alumno = await seedProfesional('ProfLibro', cleanup);
    const page = await pageAs('admin');
    await openLibro(page, 'admin');
    await seccion(page, 'Lista de Clase');
    const fila = page.locator('main tbody tr', { hasText: alumno.paternalLastName });
    await expect(fila).toHaveCount(1, CARGA);
    await expect(fila).toContainText(alumno.rut);
    await expect(fila).toContainText('A2');
  });

  test('Q01 · Q02 · Q03: el código SENCE se guarda, queda auditado y persiste', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openLibro(page, 'admin');
    // Curso A5: así no se cruza con los tests que leen el libro A2.
    await elegir(page, 'select course for class book', /A5/);
    const main = page.locator('main');
    await expect(main).toContainText(/ID: \d+\.5\b/, CARGA);
    const input = page.locator(SENCE);
    const guardar = page.locator('[data-llm-action="save-class-book-fields"]');
    const original = await input.inputValue();
    const nuevo = `99${String(Date.now()).slice(-8)}`;

    try {
      await expect(page.getByText('Sin cambios')).toBeVisible();
      await input.fill(nuevo);
      await expect(page.getByText('Sin cambios')).toHaveCount(0); // Q01
      await guardar.click();
      await expect(page.getByText('Datos del libro guardados')).toBeVisible(); // Q02
      await expect(main).toContainText(/Última modificación: .+ · \d{2}-\d{2}-\d{4}/);

      // Q03: al volver a entrar, el mismo código.
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Libro de Control de Clases' })).toBeVisible(
        CARGA,
      );
      await elegir(page, 'select course for class book', /A5/);
      await expect(page.locator(SENCE)).toHaveValue(nuevo, CARGA);
    } finally {
      // Deja el código como estaba (vacío está permitido: D22).
      if ((await page.locator(SENCE).inputValue()) !== original) {
        await page.locator(SENCE).fill(original);
        await page.locator('[data-llm-action="save-class-book-fields"]').click();
        await expect(page.getByText('Datos del libro guardados').last()).toBeVisible();
      }
    }
  });

  test('R01: "Exportar PDF" descarga un PDF con contenido', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await openLibro(page, 'admin');
    const descarga = page.waitForEvent('download', { timeout: 60_000 });
    await page.locator('[data-llm-action="export-pdf"]').click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(/^LibroDeClases_.+\.pdf$/);
    const path = await archivo.path();
    expect(statSync(path).size).toBeGreaterThan(10_000);
    await expect(page.getByText('PDF generado correctamente')).toBeVisible();
  });
});

// ── T. Sedes, roles y seguridad (por API, con la RLS de cada cuenta) ────────

test.describe('T. Seguridad entre sedes', () => {
  const TABLAS = [
    'professional_promotions',
    'promotion_courses',
    'class_book',
    'professional_theory_sessions',
    'professional_practice_sessions',
    'promotion_course_lecturers',
    'lecturers',
  ];
  const contar = async (sb: Awaited<ReturnType<typeof getAdminClient>>, tabla: string) =>
    (await sb.from(tabla).select('*', { count: 'exact', head: true })).count ?? 0;

  test('T05 (fix-321-m, fix-353-m): la secretaria de la sede sin Profesional no lee sus tablas', async () => {
    const otra = await getClientFor(ACCOUNTS.secretariaA.email, ACCOUNTS.secretariaA.password);
    const propia = await getClientFor(ACCOUNTS.secretariaB.email, ACCOUNTS.secretariaB.password);
    for (const tabla of TABLAS) {
      expect(await contar(otra, tabla), `${tabla} desde la sede 1`).toBe(0);
      expect(await contar(propia, tabla), `${tabla} desde la sede 2`).toBeGreaterThan(0);
    }
  });

  test('T05: la secretaria de la sede sin Profesional no modifica una promoción ni sus sesiones', async () => {
    const curso = await cursoVigente();
    const admin = await getAdminClient();
    const otra = await getClientFor(ACCOUNTS.secretariaA.email, ACCOUNTS.secretariaA.password);

    // Reescribe el mismo valor: si la RLS fallara, tampoco cambiaría nada.
    const promo = await otra
      .from('professional_promotions')
      .update({ name: curso.promotionName })
      .eq('id', curso.promotionId)
      .select('id');
    expect(promo.data ?? []).toEqual([]);

    const { data: sesion } = await admin
      .from('professional_theory_sessions')
      .select('id, promotion_course_id')
      .eq('promotion_course_id', curso.courseA2)
      .limit(1)
      .single();
    const sesiones = await otra
      .from('professional_theory_sessions')
      .update({ promotion_course_id: sesion!.promotion_course_id })
      .eq('id', sesion!.id)
      .select('id');
    expect(sesiones.data ?? []).toEqual([]);
  });

  test('T06: una secretaria no lee la matrícula Profesional de otra sede', async ({ cleanup }) => {
    const alumno = await seedProfesional('ProfRls', cleanup);
    const otra = await getClientFor(ACCOUNTS.secretariaA.email, ACCOUNTS.secretariaA.password);
    const propia = await getClientFor(ACCOUNTS.secretariaB.email, ACCOUNTS.secretariaB.password);
    const leer = async (sb: typeof otra) =>
      (await sb.from('enrollments').select('id').eq('id', alumno.enrollmentIds[0])).data ?? [];
    expect(await leer(otra)).toEqual([]);
    expect(await leer(propia)).toHaveLength(1);
  });
});

// ── U. Tiempo real y visual ─────────────────────────────────────────────────

test.describe('U. Tiempo real y visual', () => {
  test('U01: una matrícula Profesional nueva aparece sin recargar', async ({ pageAs, cleanup }) => {
    // La tabla de matrículas no está publicada para tiempo real: el evento nunca llega.
    knownBug('U01 / S13 (fix-319-m) → ASG-i-056');
    const apellido = `Vivo${String(Date.now()).slice(-7)}`;
    const page = await pageAs('secretariaB');
    await openBase(page, 'secretaria');
    await page.locator(SEARCH).fill(apellido);
    await expect(sinResultados(page)).toBeVisible();

    await seedProfesional('ProfVivo', cleanup, { paternalLastName: apellido });
    await expect(rowOf(page, apellido)).toHaveCount(1, { timeout: 10_000 });
  });

  for (const [nombre, path] of Object.entries(RUTAS.admin)) {
    test(`U07: ${nombre} sin scroll horizontal a 375, 768 y 1440 px`, async ({ pageAs }) => {
      const page = await pageAs('admin');
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(path);
      await expect(page.locator('app-section-hero').first()).toBeVisible(CARGA);
      for (const [width, height] of [
        [1440, 900],
        [768, 1024],
        [375, 812],
      ]) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(600); // el layout cambia por ResizeObserver del contenedor
        await expectSinScroll(page);
      }
    });
  }
});
