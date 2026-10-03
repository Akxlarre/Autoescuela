/**
 * Base de Alumnos Clase B — lista (fix-264-m, ASG-i-024).
 * Casos de specs/testing-piloto/024a-base-alumnos-b.md; el ID de cada caso va en el título.
 *
 * Los tests que cambian estado siembran su propio alumno E2E- (e2e/support/alumnos-seed.ts).
 */
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import type { Locator, Page } from '@playwright/test';
import {
  addCompletedPractices,
  addFutureClass,
  addStudentDocuments,
  createE2eAlumno,
  markCertificateSent,
} from './support/alumnos-seed';
import { getAdminClient } from './support/supabase-admin';
import { expect, knownBug, test, watchErrors } from './support/fixtures';

const SEDE_A = 1; // Autoescuela Chillán
const SEDE_B = 2; // Conductores Chillán

const DESKTOP = { width: 1600, height: 900 };
/**
 * Espera de una carga completa (app + consultas). Más larga que el default de 5 s: la suite
 * corre con varios workers contra ng serve y la BD de desarrollo compartida.
 */
const CARGA = { timeout: 20_000 };

// Varios tests encadenan 2 o 3 cargas completas: el default de 30 s por test no alcanza cuando
// la suite corre con todos los workers.
test.describe.configure({ timeout: 90_000 });

const SEARCH = '[data-llm-description="Search students by name, RUT or file number"]';
const REPORT = /Mostrando \d+ a \d+ de (\d+) alumnos/;

/** Abre la lista y espera a que termine el skeleton (el paginador solo existe con datos cargados). */
async function openLista(page: Page, portal: 'admin' | 'secretaria'): Promise<void> {
  // La tabla solo se muestra si su contenedor mide más de 900 px; con menos, la lista pasa a
  // tarjetas (ver el test de pantalla angosta).
  await page.setViewportSize(DESKTOP);
  await page.goto(`/app/${portal}/alumnos`);
  await expect(page.getByText(REPORT)).toBeVisible(CARGA);
}

/** Total del reporte del paginador ("… de N alumnos"): filas que cumplen los filtros actuales. */
async function reportTotal(page: Page): Promise<number> {
  const text = await page.getByText(REPORT).textContent();
  return Number(text?.match(REPORT)?.[1]);
}

/** Valor numérico de un KPI del hero, buscado por su etiqueta. */
async function kpiValue(page: Page, label: string): Promise<number> {
  const value = page
    .locator('app-section-hero p', { hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .first()
    .locator('xpath=..')
    .locator('span')
    .first();
  return Number((await value.textContent())?.trim());
}

function rows(page: Page): Locator {
  return page.locator('p-table tbody tr');
}

function rowOf(page: Page, text: string): Locator {
  return rows(page).filter({ hasText: text });
}

/** Elige una sede en el selector del topbar. No espera la recarga: ver `selectSedeYRecargar`. */
async function selectSede(page: Page, option: string): Promise<void> {
  await page.locator('[data-llm-action="toggle-branch-dropdown"]').click();
  await page
    .getByRole('listbox', { name: 'Seleccionar sede' })
    .getByRole('option', { name: option })
    .click();
}

/** Elige una sede y espera a que la lista vuelva a cargar con ella. */
async function selectSedeYRecargar(page: Page, option: string): Promise<void> {
  const recarga = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/students') && r.request().method() === 'GET',
  );
  await selectSede(page, option);
  await recarga;
  await expect(page.getByText(REPORT)).toBeVisible(CARGA);
}

test.describe('carga y totales', () => {
  test('A01 · D01 · D02 · G01: admin carga sin errores y chip, KPI y paginador muestran el mismo total', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    const errors = watchErrors(page);
    await openLista(page, 'admin');

    const total = await reportTotal(page);
    await expect(page.locator('app-section-hero').getByText(`${total} alumnos`)).toBeVisible();
    expect(await kpiValue(page, 'Total Alumnos')).toBe(total);
    // fix-271-m: "Por Vencer" valía 0 por construcción y se quitó.
    await expect(page.locator('app-section-hero').getByText('Por Vencer')).toHaveCount(0);
    if (total > 10) await expect(rows(page)).toHaveCount(10);

    errors.expectClean();
  });

  test('A02 · P05: secretaria carga sin errores, sin columna Sede ni selector de sede', async ({
    pageAs,
  }) => {
    const page = await pageAs('secretariaA');
    const errors = watchErrors(page);
    await openLista(page, 'secretaria');

    await expect(page.getByRole('columnheader', { name: 'Sede' })).toHaveCount(0);
    await expect(page.locator('[data-llm-action="toggle-branch-dropdown"]')).toHaveCount(0);
    errors.expectClean();
  });

  test('A03: una secretaria no entra a la lista del portal admin', async ({ pageAs }) => {
    const page = await pageAs('secretariaA');
    await page.goto('/app/admin/alumnos');
    await expect(page).not.toHaveURL(/\/app\/admin\/alumnos/);
  });

  test('A08 (S8): si la carga falla se muestra un error, no "No se encontraron alumnos"', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await page.setViewportSize(DESKTOP);
    await page.route('**/rest/v1/students*', (route) => route.abort());
    await page.goto('/app/admin/alumnos');

    // Espera a que termine el skeleton: aparece el error o el estado vacío.
    const resultado = page.getByText(/error al cargar|No se encontraron alumnos/i).first();
    await expect(resultado).toBeVisible();
    await expect(resultado).toHaveText(/error al cargar/i);
  });
});

test.describe('qué alumnos aparecen y con qué estado', () => {
  test('B01 · B02 · B05 · B07 · C09: la lista incluye o excluye a cada alumno según su matrícula', async ({
    pageAs,
    cleanup,
  }) => {
    const [docs, retirado, pago, pre, finalizado, borrador, archivado] = await Promise.all([
      createE2eAlumno(
        { label: 'DocsPend', branchId: SEDE_A, enrollments: [{ docsComplete: false }] },
        cleanup,
      ),
      createE2eAlumno(
        { label: 'Retirado', branchId: SEDE_A, enrollments: [{ status: 'withdrawn' }] },
        cleanup,
      ),
      createE2eAlumno(
        {
          label: 'PendPago',
          branchId: SEDE_A,
          enrollments: [{ paymentStatus: 'pending', pendingBalance: 180000 }],
        },
        cleanup,
      ),
      createE2eAlumno({ label: 'SinMatricula', branchId: SEDE_A }, cleanup),
      createE2eAlumno(
        { label: 'Finalizado', branchId: SEDE_A, enrollments: [{ status: 'completed' }] },
        cleanup,
      ),
      createE2eAlumno(
        { label: 'SoloBorrador', branchId: SEDE_A, enrollments: [{ status: 'draft' }] },
        cleanup,
      ),
      createE2eAlumno(
        { label: 'Archivado', branchId: SEDE_A, studentStatus: 'archived', enrollments: [{}] },
        cleanup,
      ),
    ]);

    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    const estadoDe = async (apellido: string) => {
      await page.locator(SEARCH).fill(apellido);
      return rowOf(page, apellido);
    };

    await expect(await estadoDe(docs.paternalLastName)).toContainText('Docs Pendientes');
    await expect(await estadoDe(retirado.paternalLastName)).toContainText('Retirado');
    await expect(await estadoDe(pago.paternalLastName)).toContainText('Pendiente Pago');
    await expect(await estadoDe(pre.paternalLastName)).toContainText('Pre-inscrito');
    await expect(await estadoDe(finalizado.paternalLastName)).toHaveCount(0);
    await expect(await estadoDe(borrador.paternalLastName)).toHaveCount(0);
    await expect(await estadoDe(archivado.paternalLastName)).toHaveCount(0);
  });

  test('C05 · D04 (S11): con 2 matrículas B se ven ambos números y la deuda de la más antigua cuenta', async ({
    pageAs,
    cleanup,
  }) => {
    const haceUnAno = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    // El alumno se crea archivado para medir el KPI dentro de la Papelera: ahí "Con deuda"
    // solo cuenta archivados, y ningún otro test ni dev crea archivados con deuda, así que el
    // antes/después no se contamina con los tests que corren en paralelo.
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator('[data-llm-action="papelera"]').click();
    await expect(page.getByText('Papelera — Alumnos archivados')).toBeVisible(CARGA);
    const deudaAntes = await kpiValue(page, 'Con deuda');

    const alumno = await createE2eAlumno(
      {
        label: 'DosMatriculas',
        branchId: SEDE_A,
        studentStatus: 'archived',
        enrollments: [
          { paymentStatus: 'partial', pendingBalance: 90000, createdAt: haceUnAno },
          { courseName: 'Refuerzo Clase B' },
        ],
      },
      cleanup,
    );

    await page.locator(SEARCH).fill(alumno.paternalLastName);
    const row = rowOf(page, alumno.paternalLastName);
    // La fila llega sola por Realtime o, si no, al recargar la Papelera.
    await page.locator('[data-llm-nav="back"]').first().click();
    await page.locator('[data-llm-action="papelera"]').click();
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    for (const number of alumno.enrollmentNumbers) await expect(row).toContainText(number);

    expect(await kpiValue(page, 'Con deuda'), 'la deuda de la matrícula antigua debe contar').toBe(
      deudaAntes + 1,
    );
  });
});

test.describe('búsqueda y filtros', () => {
  test('E01–E05 · E07 · E09 · E10 · F09: búsqueda por nombre, apellido, sin tildes, mayúsculas y Nº de expediente', async ({
    pageAs,
    cleanup,
  }) => {
    const sufijo = String(Date.now()).slice(-6);
    const alumno = await createE2eAlumno(
      {
        label: 'José',
        branchId: SEDE_A,
        paternalLastName: `Núñez${sufijo}`,
        maternalLastName: `Peña${sufijo}`,
        enrollments: [{}],
      },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    const total = await reportTotal(page);
    const row = rowOf(page, alumno.paternalLastName);

    const consultas = [
      alumno.firstNames, // E01 nombre
      alumno.paternalLastName, // E02 apellido paterno
      alumno.maternalLastName, // E02 apellido materno
      `${alumno.firstNames} ${alumno.paternalLastName}`, // E03 nombre apellido
      `${alumno.paternalLastName} ${alumno.firstNames}`, // E03 apellido nombre
      `nunez${sufijo}`, // E04 sin tilde ni ñ
      `NÚÑEZ${sufijo}`, // E05 mayúsculas
      alumno.enrollmentNumbers[0], // E07 Nº de expediente
      `   ${alumno.paternalLastName}   `, // E09 espacios al inicio y al final
    ];
    for (const consulta of consultas) {
      await page.locator(SEARCH).fill(consulta);
      await expect(row, `búsqueda "${consulta}"`).toHaveCount(1);
    }

    // E10 · F09: sin resultados → estado vacío → "Limpiar filtros" devuelve la lista completa.
    await page.locator(SEARCH).fill(`sin-resultados-${sufijo}`);
    await expect(page.getByText('No se encontraron alumnos').first()).toBeVisible();
    await page.locator('[data-llm-action="ejecutar-accion-empty-state"]').first().click();
    await expect(page.locator(SEARCH)).toHaveValue('');
    expect(await reportTotal(page)).toBe(total);
  });

  test('E06: el RUT se encuentra con puntos, sin puntos, sin guion y parcial', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'Rut', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const sinPuntos = alumno.rut.replace(/\./g, ''); // 99123456-7
    const soloDigitos = sinPuntos.replace('-', ''); // 991234567
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    const row = rowOf(page, alumno.paternalLastName);

    for (const consulta of [alumno.rut, sinPuntos, soloDigitos, soloDigitos.slice(0, -1)]) {
      await page.locator(SEARCH).fill(consulta);
      await expect.soft(row, `búsqueda por RUT "${consulta}"`).toHaveCount(1);
    }
  });

  test('F03 (S12): un alumno de "Refuerzo Clase B" se puede filtrar por su curso', async ({
    pageAs,
    cleanup,
  }) => {
    // Las opciones salen de los cursos presentes en la lista: se siembra uno de refuerzo.
    const refuerzo = await createE2eAlumno(
      { label: 'Refuerzo', branchId: SEDE_A, enrollments: [{ courseName: 'Refuerzo Clase B' }] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator('[data-llm-description="Filter students by course type"]').click();
    await expect(page.getByRole('option', { name: 'Clase B', exact: true })).toBeVisible();
    await page.getByRole('option', { name: 'Refuerzo Clase B' }).click();

    await page.locator(SEARCH).fill(refuerzo.paternalLastName);
    await expect(rowOf(page, refuerzo.paternalLastName)).toHaveCount(1);
    // Con el filtro puesto no queda ningún alumno de otro curso.
    await page.locator(SEARCH).fill('');
    for (const fila of await rows(page).all()) await expect(fila).toContainText('Refuerzo Clase B');
  });
});

test.describe('los filtros se conservan', () => {
  test('F10 (fix-275-m): la búsqueda sigue puesta al abrir una ficha y volver', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'Filtros', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    const volver = page.locator('app-section-hero [data-llm-nav="back"]').first();

    await page.locator(SEARCH).fill(alumno.paternalLastName);
    await expect(rows(page)).toHaveCount(1);
    await rows(page).first().locator('[data-llm-action="view-student-detail"]').click();
    await expect(page).toHaveURL(/\/alumnos\/\d+/);
    await volver.click();

    await expect(page.getByText(REPORT)).toBeVisible(CARGA);
    await expect(page.locator(SEARCH)).toHaveValue(alumno.paternalLastName);
    await expect(rows(page)).toHaveCount(1);

    // Con el botón "atrás" del navegador también se conserva.
    await rows(page).first().locator('[data-llm-action="view-student-detail"]').click();
    await expect(page).toHaveURL(/\/alumnos\/\d+/);
    await page.goBack();
    await expect(page.getByText(REPORT)).toBeVisible(CARGA);
    await expect(page.locator(SEARCH)).toHaveValue(alumno.paternalLastName);

    // hotfix-126-m: solo al devolverse desde una ficha. Entrando por el menú después de pasar
    // por otra pantalla, la lista aparece sin filtros.
    await page.locator('a[href="/app/secretaria/agenda"]').first().click();
    await expect(page).toHaveURL(/\/agenda$/);
    await page.locator('a[href="/app/secretaria/alumnos"]').first().click();
    await expect(page.getByText(REPORT)).toBeVisible(CARGA);
    await expect(page.locator(SEARCH)).toHaveValue('');
    expect(await reportTotal(page)).toBeGreaterThan(1);

    // "Limpiar filtros" también se conserva: al volver, la lista sigue sin filtrar.
    await page.locator(SEARCH).fill('zzzz-no-existe');
    // spec 0022-m: hay dos "Limpiar filtros" (barra de filtros y estado vacío); se usa el de la barra.
    await page.locator('[data-llm-action="clear-students-filters"]').click();
    await expect(page.locator(SEARCH)).toHaveValue('');
    await rows(page).first().locator('[data-llm-action="view-student-detail"]').click();
    await expect(page).toHaveURL(/\/alumnos\/\d+/);
    await volver.click();

    await expect(page.getByText(REPORT)).toBeVisible(CARGA);
    await expect(page.locator(SEARCH)).toHaveValue('');
  });
});

test.describe('ordenar por columna (spec 0020-m)', () => {
  // Control compartido app-sort-control (spec 0023-m): "Sort the <llmSubject> list by a column".
  const SORT_CARDS = '[data-llm-description="Sort the students list by a column"]';
  const sortButton = (page: Page, field: string): Locator =>
    page.locator(`[data-llm-action="sort-students-by-${field}"]`);
  const sortHeader = (page: Page, field: string): Locator =>
    page.locator('th', { has: sortButton(page, field) });

  /**
   * Tres alumnos con un apellido materno común (para aislarlos con el buscador) y fechas de
   * ingreso cuyo orden real difiere del orden del texto dd-mm-aaaa.
   * Se crean en el orden M, Z, A: por defecto (más reciente primero) salen A, Z, M.
   */
  async function seedTrio(cleanup: Parameters<typeof createE2eAlumno>[1]) {
    const sufijo = String(Date.now()).slice(-6);
    const comun = `Orden${sufijo}`;
    const crear = (paterno: string, createdAt: string) =>
      createE2eAlumno(
        {
          label: 'Orden',
          branchId: SEDE_A,
          paternalLastName: `${paterno}${sufijo}`,
          maternalLastName: comun,
          enrollments: [{ createdAt }],
        },
        cleanup,
      );
    const m = await crear('Mmm', '2026-01-05T15:00:00Z'); // 05-01-2026
    const z = await crear('Zzz', '2025-12-20T15:00:00Z'); // 20-12-2025
    const a = await crear('Aaa', '2026-03-10T15:00:00Z'); // 10-03-2026
    const fila = (alumno: typeof m) => new RegExp(alumno.paternalLastName);
    return { comun, a: fila(a), m: fila(m), z: fila(z) };
  }

  test('G03: un clic ordena ascendente, el segundo descendente y el tercero vuelve al orden por defecto', async ({
    pageAs,
    cleanup,
  }) => {
    const { comun, a, m, z } = await seedTrio(cleanup);
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator(SEARCH).fill(comun);

    // Sin orden elegido: el más reciente primero, y ningún título marcado.
    await expect(rows(page)).toHaveText([a, z, m]);
    await expect(sortHeader(page, 'alumno')).toHaveAttribute('aria-sort', 'none');

    await sortButton(page, 'alumno').click();
    await expect(rows(page)).toHaveText([a, m, z]);
    await expect(sortHeader(page, 'alumno')).toHaveAttribute('aria-sort', 'ascending');
    await expect(sortHeader(page, 'rut')).toHaveAttribute('aria-sort', 'none');

    await sortButton(page, 'alumno').click();
    await expect(rows(page)).toHaveText([z, m, a]);
    await expect(sortHeader(page, 'alumno')).toHaveAttribute('aria-sort', 'descending');

    await sortButton(page, 'alumno').click();
    await expect(rows(page)).toHaveText([a, z, m]);
    await expect(sortHeader(page, 'alumno')).toHaveAttribute('aria-sort', 'none');

    // La secretaria de una sola sede no ve la columna Sede: tampoco se ofrece para ordenar.
    await expect(sortButton(page, 'sede')).toHaveCount(0);
  });

  test('G03: "Fecha Ingreso" ordena por la fecha real y el orden se conserva al volver de la ficha', async ({
    pageAs,
    cleanup,
  }) => {
    const { comun, a, m, z } = await seedTrio(cleanup);
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator(SEARCH).fill(comun);

    // 20-12-2025 → 05-01-2026 → 10-03-2026 (por texto, el 05-01-2026 quedaría primero).
    await sortButton(page, 'fechaIngreso').click();
    await expect(rows(page)).toHaveText([z, m, a]);

    await rows(page).first().locator('[data-llm-action="view-student-detail"]').click();
    await expect(page).toHaveURL(/\/alumnos\/\d+/);
    await page.locator('app-section-hero [data-llm-nav="back"]').first().click();

    await expect(page.getByText(REPORT)).toBeVisible(CARGA);
    await expect(sortHeader(page, 'fechaIngreso')).toHaveAttribute('aria-sort', 'ascending');
    await expect(rows(page)).toHaveText([z, m, a]);

    // Entrando por el menú desde otra pantalla, la lista vuelve al orden por defecto.
    await page.locator('a[href="/app/secretaria/agenda"]').first().click();
    await expect(page).toHaveURL(/\/agenda$/);
    await page.locator('a[href="/app/secretaria/alumnos"]').first().click();
    await expect(page.getByText(REPORT)).toBeVisible(CARGA);
    await expect(sortHeader(page, 'fechaIngreso')).toHaveAttribute('aria-sort', 'none');
  });

  test('G03: el orden abarca todas las páginas y vuelve a la primera al cambiarlo', async ({
    pageAs,
  }) => {
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    test.skip((await reportTotal(page)) <= 10, 'La sede tiene una sola página de alumnos');

    await page.locator('.p-paginator-next').click();
    await expect(page.getByText(/Mostrando 11 a/)).toBeVisible();
    await sortButton(page, 'alumno').click();
    await expect(page.getByText(/Mostrando 1 a 10/)).toBeVisible();

    const apellidos = async (): Promise<string[]> =>
      (await rows(page).locator('.item-title').allTextContents()).map((t) => t.trim());
    const pagina1 = await apellidos();
    await page.locator('.p-paginator-next').click();
    await expect(page.getByText(/Mostrando 11 a/)).toBeVisible();
    const pagina2 = await apellidos();

    const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
    const todos = [...pagina1, ...pagina2];
    expect(todos).toEqual([...todos].sort(collator.compare));
  });

  test('G03 · H: en la vista de tarjetas se ordena con el control "Ordenar por"', async ({
    pageAs,
    cleanup,
  }) => {
    const { comun, a, m, z } = await seedTrio(cleanup);
    const page = await pageAs('secretariaA');

    // Con la tabla visible el control no aparece: se ordena desde los títulos.
    await openLista(page, 'secretaria');
    await expect(page.locator(SORT_CARDS)).toBeHidden();

    await page.setViewportSize({ width: 375, height: 800 });
    const cards = page.locator('[data-llm-description="Ficha resumen de un alumno"]');
    await page.locator(SEARCH).fill(comun);
    await expect(cards).toHaveText([a, z, m]);

    await page.locator(SORT_CARDS).click();
    await page.getByRole('option', { name: 'Alumno', exact: true }).click();
    await expect(cards).toHaveText([a, m, z]);

    await page.locator('[data-llm-action="toggle-students-sort-direction"]').click();
    await expect(cards).toHaveText([z, m, a]);
  });
});

test.describe('sedes', () => {
  test('P01 · P02 · P04: admin ve la columna Sede solo en "Todas" y el total es la suma de las sedes', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openLista(page, 'admin');

    // El admin entra con "Todas las sedes"; cada cambio de sede recarga la lista sola (P02).
    await selectSedeYRecargar(page, 'Autoescuela Chillán');
    await expect(page.getByRole('columnheader', { name: 'Sede' })).toHaveCount(0);
    const sedeA = await reportTotal(page);

    await selectSedeYRecargar(page, 'Conductores Chillán');
    await expect(page.getByRole('columnheader', { name: 'Sede' })).toHaveCount(0);
    const sedeB = await reportTotal(page);

    await selectSedeYRecargar(page, 'Todas las sedes');
    await expect(page.getByRole('columnheader', { name: 'Sede' })).toBeVisible();
    const todas = await reportTotal(page);

    // Tolerancia: otros tests crean y borran alumnos E2E- en paralelo entre una lectura y otra.
    expect(Math.abs(sedeA + sedeB - todas)).toBeLessThanOrEqual(5);
    expect(todas).toBeGreaterThan(Math.max(sedeA, sedeB));
  });

  test('P06 (S6): la secretaria multi-sede cambia de sede y la lista se recarga con la columna Sede en "Todas"', async ({
    pageAs,
    cleanup,
  }) => {
    const [alumnoA, alumnoB] = await Promise.all([
      createE2eAlumno({ label: 'SedeA', branchId: SEDE_A, enrollments: [{}] }, cleanup),
      createE2eAlumno({ label: 'SedeB', branchId: SEDE_B, enrollments: [{}] }, cleanup),
    ]);
    const page = await pageAs('secretariaMultisede');
    await openLista(page, 'secretaria');

    // Sin esperar una recarga a propósito: si la pantalla no reacciona al cambio de sede, las
    // aserciones de abajo lo muestran.
    await selectSede(page, 'Conductores Chillán');
    await page.locator(SEARCH).fill(alumnoB.paternalLastName);
    await expect
      .soft(rowOf(page, alumnoB.paternalLastName), 'el alumno de la sede elegida aparece')
      .toHaveCount(1);
    await page.locator(SEARCH).fill(alumnoA.paternalLastName);
    await expect
      .soft(rowOf(page, alumnoA.paternalLastName), 'el alumno de la otra sede ya no aparece')
      .toHaveCount(0);

    await selectSede(page, 'Todas las sedes');
    await expect.soft(page.getByRole('columnheader', { name: 'Sede' })).toBeVisible();
  });
});

test.describe('archivar, papelera y restaurar', () => {
  test('L01 · M01 · M02: archivar sin historial → Papelera → restaurar', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno({ label: 'Archivar', branchId: SEDE_A }, cleanup);
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    const row = rowOf(page, alumno.paternalLastName);
    await page.locator(SEARCH).fill(alumno.paternalLastName);

    // L01: modal simple, sin campo de confirmación.
    await row.locator('[data-llm-action="archive-student-row"]').click();
    const modal = page.getByRole('dialog', { name: /Confirmar archivado de/ });
    await expect(modal).toContainText('Archivar alumno');
    await expect(modal).toContainText(alumno.firstNames);
    await modal.locator('[data-llm-action="confirm-archive-student"]').click();
    await expect(page.getByText('Alumno archivado correctamente.')).toBeVisible();
    await expect(row).toHaveCount(0);

    // M01 · M02: en la Papelera solo se puede restaurar.
    await page.locator('[data-llm-action="papelera"]').click();
    await expect(page.getByText('Papelera — Alumnos archivados')).toBeVisible(CARGA);
    // O05 (hotfix-119-m): dentro de la Papelera no se ofrece "Nueva Matrícula".
    await expect(page.locator('[data-llm-action="nueva-matricula"]')).toHaveCount(0);
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    await expect(row).toHaveCount(1);
    await expect(row.locator('[data-llm-action="archive-student-row"]')).toHaveCount(0);
    await row.locator('[data-llm-action="restore-student-row"]').click();
    await expect(page.getByText('Alumno restaurado correctamente.')).toBeVisible();
    await expect(row).toHaveCount(0);

    // M03: volver a la lista activa: el alumno está de vuelta.
    await page.locator('[data-llm-nav="back"]').first().click();
    await expect(page.getByText('Listado de alumnos de la escuela')).toBeVisible();
    await expect(page.locator('[data-llm-action="nueva-matricula"]')).toBeVisible();
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    await expect(row).toHaveCount(1);
  });

  test('L09 (fix-277-m): un alumno con una clase agendada a futuro no se puede archivar', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'ClaseFutura', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    await addFutureClass(alumno.enrollmentIds[0], cleanup);
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    const row = rowOf(page, alumno.paternalLastName);

    await row.locator('[data-llm-action="archive-student-row"]').click();

    await expect(page.getByText('No se puede archivar')).toBeVisible();
    await expect(
      page.getByText('Tiene 1 clase agendada. Cancélala o reagéndala antes de archivar al alumno.'),
    ).toBeVisible();
    await expect(page.getByRole('dialog', { name: /Confirmar archivado de/ })).toHaveCount(0);
    await expect(row).toHaveCount(1);

    // Desde la ficha, igual.
    await row.locator('[data-llm-action="view-student-detail"]').click();
    await page.locator('app-section-hero [data-llm-action="eliminar-alumno"]').click(CARGA);
    await expect(page.getByText('No se puede archivar').last()).toBeVisible();
    await expect(page.getByRole('dialog', { name: /Confirmar archivado de/ })).toHaveCount(0);
  });

  test('L02 · L03 · L05: con historial exige escribir "borrarlo"; cancelar no archiva', async ({
    pageAs,
  }) => {
    // Solo lectura: se abre el modal sobre un alumno del seed de 0008-i (nombres "AlumnoNN
    // ApellidoNN", con pagos y clases) y se cancela.
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator(SEARCH).fill('Apellido');
    await page.locator('[data-llm-description="Filter students by enrollment status"]').click();
    await page.getByRole('option', { name: 'Activo', exact: true }).click();
    const total = await reportTotal(page);

    await rows(page).first().locator('[data-llm-action="archive-student-row"]').click();
    const modal = page.getByRole('dialog', { name: /Confirmar archivado de/ });
    await expect(modal).toContainText('Archivar con historial');
    const confirmar = modal.locator('[data-llm-action="confirm-archive-student"]');
    const campo = modal.locator('[data-llm-description^="confirmation text field"]');
    await expect(confirmar).toBeDisabled();
    await expect(campo).toBeFocused(); // L08

    await campo.fill('borrar');
    await expect(confirmar).toBeDisabled();
    // L04 (hotfix-124-m): hay que escribirlo tal como lo pide el modal, en minúsculas.
    await campo.fill('BORRARLO');
    await expect(confirmar).toBeDisabled();
    await campo.fill('borrarlo');
    await expect(confirmar).toBeEnabled();

    await modal.locator('[data-llm-action="cancel-archive-student"]').click();
    await expect(modal).toHaveCount(0);
    expect(await reportTotal(page)).toBe(total);
  });

  test('L06 (S10): Escape no cierra el modal mientras está archivando', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno({ label: 'Escape', branchId: SEDE_A }, cleanup);
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    await rowOf(page, alumno.paternalLastName)
      .locator('[data-llm-action="archive-student-row"]')
      .click();
    const modal = page.getByRole('dialog', { name: /Confirmar archivado de/ });

    // Demora el PATCH 4 s para que "Archivando…" dure más que la espera de abajo (1 s): si el
    // modal no está, es porque Escape lo cerró y no porque el archivado terminó.
    await page.route('**/rest/v1/students?id=eq.*', async (route) => {
      if (route.request().method() === 'PATCH') await new Promise((r) => setTimeout(r, 4000));
      await route.continue();
    });
    await modal.locator('[data-llm-action="confirm-archive-student"]').click();
    await page.keyboard.press('Escape');
    await expect(modal, 'el modal debe seguir abierto mientras archiva').toBeVisible({
      timeout: 1000,
    });
  });

  test('M04 (S7): la Papelera no queda "pegada" al salir y volver a la pantalla', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openLista(page, 'admin');
    await page.locator('[data-llm-action="papelera"]').click();
    await expect(page.getByText('Papelera — Alumnos archivados')).toBeVisible(CARGA);

    // Navegación dentro de la SPA (sin recargar): otra pantalla y de vuelta.
    await page.locator('[data-llm-nav]', { hasText: 'Agenda' }).first().click();
    await expect(page).not.toHaveURL(/\/alumnos$/);
    await page.goBack();

    await expect(page.getByText('Listado de alumnos de la escuela')).toBeVisible();
  });

  test('M07: la Papelera de una secretaria no muestra archivados de otra sede', async ({
    pageAs,
    cleanup,
  }) => {
    const [propio, ajeno] = await Promise.all([
      createE2eAlumno({ label: 'PapeleraA', branchId: SEDE_A, studentStatus: 'archived' }, cleanup),
      createE2eAlumno({ label: 'PapeleraB', branchId: SEDE_B, studentStatus: 'archived' }, cleanup),
    ]);
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator('[data-llm-action="papelera"]').click();
    await expect(page.getByText('Papelera — Alumnos archivados')).toBeVisible(CARGA);

    await page.locator(SEARCH).fill(propio.paternalLastName);
    await expect(rowOf(page, propio.paternalLastName)).toHaveCount(1);
    await page.locator(SEARCH).fill(ajeno.paternalLastName);
    await expect(rowOf(page, ajeno.paternalLastName)).toHaveCount(0);
  });
});

test.describe('exportar', () => {
  /**
   * Exporta a Excel y devuelve las filas del archivo descargado, sin la cabecera. Desde
   * fix-281-m el Excel se arma en el navegador con las filas de la pantalla.
   */
  async function exportarExcel(page: Page): Promise<(string | number)[][]> {
    await page.locator('[data-llm-action="open-export-menu"]').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-llm-action="export-students-excel"]').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^alumnos_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const book = XLSX.read(readFileSync(await download.path()));
    const [, ...rows] = XLSX.utils.sheet_to_json<(string | number)[]>(
      book.Sheets[book.SheetNames[0]],
      { header: 1 },
    );
    return rows;
  }

  test('K02 · K04 (S3): el Excel trae las mismas filas que la pantalla', async ({ pageAs }) => {
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    const enPantalla = await reportTotal(page);

    const filas = await exportarExcel(page);
    expect(filas.length, 'filas del Excel vs "de N alumnos" de la pantalla').toBe(enPantalla);
  });

  test('K09 (S3): exportar desde la Papelera trae solo archivados', async ({ pageAs, cleanup }) => {
    const archivado = await createE2eAlumno(
      { label: 'ExportPapelera', branchId: SEDE_A, studentStatus: 'archived' },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator('[data-llm-action="papelera"]').click();
    await expect(page.getByText('Papelera — Alumnos archivados')).toBeVisible(CARGA);
    const enPapelera = await reportTotal(page);

    const filas = await exportarExcel(page);
    expect(filas.length, 'filas del Excel vs archivados en pantalla').toBe(enPapelera);
    expect(filas.some((fila) => fila.includes(archivado.rut))).toBe(true);
  });
});

/** Elige una opción de uno de los 3 selectores de filtro, buscado por su data-llm-description. */
async function filtrar(page: Page, descripcion: string, opcion: string): Promise<void> {
  await page.locator(`p-select[data-llm-description="${descripcion}"]`).click();
  await page.getByRole('option', { name: opcion, exact: true }).click();
}
const FILTRO_ESTADO = 'Filter students by enrollment status';
const FILTRO_EXPEDIENTE = 'Filter students by file completion status';

test.describe('segunda pasada (fix-264-m, 2026-10-02)', () => {
  test('I03 (fix-282-m): al volver desde la ficha se conserva la página; por el menú vuelve a la 1', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openLista(page, 'admin');
    await page.getByRole('button', { name: 'Página 3' }).click();
    await expect(page.getByText(/Mostrando 21 a/)).toBeVisible();

    await rows(page).first().locator('[data-llm-action="view-student-detail"]').click();
    await expect(page).toHaveURL(/\/alumnos\/\d+/);
    await page.locator('app-section-hero [data-llm-nav="back"]').first().click();
    await expect(page.getByText(/Mostrando 21 a/)).toBeVisible(CARGA);

    // hotfix-126-m: entrando por el menú desde otra pantalla, la lista aparece desde el principio.
    await page.locator('[data-llm-nav]', { hasText: 'Agenda' }).first().click();
    await expect(page).toHaveURL(/\/agenda$/);
    await page.locator('[data-llm-nav]', { hasText: 'Base Alumnos B' }).first().click();
    await expect(page.getByText(/Mostrando 1 a/)).toBeVisible(CARGA);
  });

  test('F04 · F05: cada estado del filtro muestra solo a los alumnos de ese estado', async ({
    pageAs,
    cleanup,
  }) => {
    const [docs, retirado, pre, inactivo] = await Promise.all([
      createE2eAlumno(
        { label: 'FiltroDocs', branchId: SEDE_A, enrollments: [{ docsComplete: false }] },
        cleanup,
      ),
      createE2eAlumno(
        { label: 'FiltroRetirado', branchId: SEDE_A, enrollments: [{ status: 'withdrawn' }] },
        cleanup,
      ),
      createE2eAlumno({ label: 'FiltroPre', branchId: SEDE_A }, cleanup),
      createE2eAlumno(
        { label: 'FiltroInactivo', branchId: SEDE_A, studentStatus: 'inactive' },
        cleanup,
      ),
    ]);
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');

    for (const [estado, alumno] of [
      ['Docs Pendientes', docs],
      ['Retirado', retirado],
      ['Pre-inscrito', pre],
      ['Inactivo', inactivo],
    ] as const) {
      await filtrar(page, FILTRO_ESTADO, estado);
      await page.locator(SEARCH).fill('');
      // Sin búsqueda: todas las filas de la página tienen ese estado.
      for (const fila of await rows(page).all()) await expect(fila).toContainText(estado);
      await page.locator(SEARCH).fill(alumno.paternalLastName);
      await expect(rowOf(page, alumno.paternalLastName)).toHaveCount(1);
    }
  });

  test('C11 · C12 · F06: el expediente cuenta la CI y la foto, también la foto legacy', async ({
    pageAs,
    cleanup,
  }) => {
    const [completo, legacy, parcial, pendiente] = await Promise.all(
      ['ExpCompleto', 'ExpLegacy', 'ExpParcial', 'ExpPendiente'].map((label) =>
        createE2eAlumno({ label, branchId: SEDE_A, enrollments: [{}] }, cleanup),
      ),
    );
    await addStudentDocuments(completo.enrollmentIds[0], ['cedula_identidad', 'id_photo'], cleanup);
    // fix-035-i: matrículas antiguas guardaron la foto como 'foto_carnet'.
    await addStudentDocuments(
      legacy.enrollmentIds[0],
      ['cedula_identidad', 'foto_carnet'],
      cleanup,
    );
    await addStudentDocuments(parcial.enrollmentIds[0], ['cedula_identidad'], cleanup);

    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    const expedienteDe = async (apellido: string) => {
      await page.locator(SEARCH).fill(apellido);
      return rowOf(page, apellido);
    };

    await expect(await expedienteDe(completo.paternalLastName)).toContainText('Completo · 2/2');
    await expect(await expedienteDe(legacy.paternalLastName)).toContainText('Completo · 2/2');
    await expect(await expedienteDe(parcial.paternalLastName)).toContainText('Parcial · 1/2');
    await expect(await expedienteDe(pendiente.paternalLastName)).toContainText('Pendiente · 0/2');

    // C12: el tooltip detalla qué documentos tiene.
    await (await expedienteDe(parcial.paternalLastName)).getByText('Parcial · 1/2').hover();
    await expect(page.getByText('CI: Sí | Foto: No | Médico: No | SEMEP: No')).toBeVisible();

    // F06: el filtro Completo deja a los dos completos y saca al parcial.
    await filtrar(page, FILTRO_EXPEDIENTE, 'Completo');
    await expect(await expedienteDe(legacy.paternalLastName)).toHaveCount(1);
    await expect(await expedienteDe(parcial.paternalLastName)).toHaveCount(0);
  });

  test('C10: con 12/12 prácticas y el certificado enviado aparece "Curso completo"', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'CursoCompleto', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    await addCompletedPractices(alumno.enrollmentIds[0], 12, cleanup);
    await markCertificateSent(alumno, alumno.enrollmentIds[0], cleanup);

    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    const row = rowOf(page, alumno.paternalLastName);
    await expect(row).toContainText('Activo');
    await row.getByText('Curso completo').hover();
    await expect(page.getByText('falta marcar como Ex-Alumno en su ficha')).toBeVisible();
  });

  test('C13: un nombre muy largo no se sale de su columna', async ({ pageAs, cleanup }) => {
    const alumno = await createE2eAlumno(
      {
        label: 'NombreLarguísimoDePruebaParaVerSiRompeLaFila',
        branchId: SEDE_A,
        paternalLastName: `Fernández-Valdivieso${Date.now()}`,
        maternalLastName: 'De La Santísima Trinidad Echeverría',
      },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    const celdas = rowOf(page, alumno.paternalLastName).locator('td');
    const [nombre, rut] = [await celdas.nth(0).boundingBox(), await celdas.nth(1).boundingBox()];
    const titulo = celdas.nth(0).locator('.item-title');
    expect(
      await titulo.evaluate((el) => el.getBoundingClientRect().right),
      'el nombre no debe invadir la columna RUT',
    ).toBeLessThanOrEqual(rut!.x);
    expect(nombre!.height, 'la fila crece en alto, no en ancho').toBeGreaterThan(0);
  });

  test('M05 · M09: en la Papelera se busca y filtra; si restaurar falla se avisa', async ({
    pageAs,
    cleanup,
  }) => {
    const [retirado, activo] = await Promise.all([
      createE2eAlumno(
        {
          label: 'PapeleraRetirado',
          branchId: SEDE_A,
          studentStatus: 'archived',
          enrollments: [{ status: 'withdrawn' }],
        },
        cleanup,
      ),
      createE2eAlumno(
        { label: 'PapeleraActivo', branchId: SEDE_A, studentStatus: 'archived', enrollments: [{}] },
        cleanup,
      ),
    ]);
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator('[data-llm-action="papelera"]').click();
    await expect(page.getByText('Papelera — Alumnos archivados')).toBeVisible(CARGA);

    // M05: buscar y filtrar dentro de la Papelera.
    await page.locator(SEARCH).fill(retirado.paternalLastName);
    await expect(rowOf(page, retirado.paternalLastName)).toHaveCount(1);
    await page.locator(SEARCH).fill('');
    await filtrar(page, FILTRO_ESTADO, 'Retirado');
    await page.locator(SEARCH).fill(activo.paternalLastName);
    await expect(rowOf(page, activo.paternalLastName)).toHaveCount(0);
    await filtrar(page, FILTRO_ESTADO, 'Todos los estados');

    // M09: el restaurar falla → aviso y el alumno sigue en la Papelera.
    await page.route('**/rest/v1/students?id=eq.*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
        : route.continue(),
    );
    const row = rowOf(page, activo.paternalLastName);
    await row.locator('[data-llm-action="restore-student-row"]').click();
    await expect(page.locator('.p-toast-message').filter({ hasText: /No se pudo/ })).toBeVisible();
    await expect(row).toHaveCount(1);
  });

  test('L10: archivar deja registro en la auditoría con quién lo hizo', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno({ label: 'Auditoria', branchId: SEDE_A }, cleanup);
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    await rowOf(page, alumno.paternalLastName)
      .locator('[data-llm-action="archive-student-row"]')
      .click();
    await page
      .getByRole('dialog', { name: /Confirmar archivado de/ })
      .locator('[data-llm-action="confirm-archive-student"]')
      .click();
    await expect(page.getByText('Alumno archivado correctamente.')).toBeVisible();

    const sb = await getAdminClient();
    const { data, error } = await sb
      .from('audit_log')
      .select('action, entity, entity_id, user_id, detail')
      .eq('entity', 'students')
      .eq('entity_id', alumno.studentId);
    expect(error).toBeNull();
    const update = (data ?? []).find((r) => /update/i.test(r.action));
    expect(update, 'debe quedar un UPDATE de students en audit_log').toBeTruthy();
    expect(update!.user_id, 'con el usuario que archivó').not.toBeNull();
  });

  test('E11 · F07 (fix-283-m): buscar o filtrar desde la página 3 vuelve a la página 1', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openLista(page, 'admin');
    await page.locator('.p-paginator-next').click();
    await page.locator('.p-paginator-next').click();
    await expect(page.getByText(/Mostrando 21 a/)).toBeVisible();

    await page.locator(SEARCH).fill('Apellido19');
    await expect(page.getByText(/Mostrando 1 a/)).toBeVisible();
    await expect(rows(page).first()).toContainText('Apellido19');
  });

  test('K01 (B26): el menú Exportar se cierra con Escape y con un clic en el encabezado', async ({
    pageAs,
  }) => {
    knownBug('B26 (fix-264-m)');
    const page = await pageAs('admin');
    await openLista(page, 'admin');
    const excel = page.locator('[data-llm-action="export-students-excel"]');

    await page.locator('[data-llm-action="open-export-menu"]').click();
    await expect(excel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(excel, 'Escape cierra el menú').toHaveCount(0);

    await page.locator('[data-llm-action="open-export-menu"]').click();
    await page.getByText('Listado de alumnos de la escuela').click();
    await expect(excel, 'un clic fuera del panel cierra el menú').toHaveCount(0);
  });

  test('B24: "Exportar" se deshabilita cuando la lista está vacía', async ({ pageAs }) => {
    knownBug('B24 (fix-264-m)');
    const page = await pageAs('admin');
    await openLista(page, 'admin');
    await page.locator(SEARCH).fill('zzz-no-existe-nadie-asi');
    // El estado vacío existe dos veces en el DOM (vista de tabla y de tarjetas).
    await expect(page.getByText('No se encontraron alumnos').first()).toBeVisible();
    await expect(page.locator('[data-llm-action="open-export-menu"]')).toBeDisabled();
  });

  test('B23: a 1366 px la columna Acciones se ve completa, sin scroll horizontal', async ({
    pageAs,
  }) => {
    knownBug('B23 (fix-264-m)');
    const page = await pageAs('admin');
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('/app/admin/alumnos');
    await expect(page.getByText(REPORT)).toBeVisible(CARGA);

    const tabla = page.locator('p-table .p-datatable-table-container').first();
    const { scroll, client } = await tabla.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
    }));
    expect(scroll, 'la tabla no debe necesitar scroll horizontal').toBeLessThanOrEqual(client + 1);
  });
});

test.describe('tiempo real', () => {
  test('Q01 (S5): un alumno matriculado en otra sesión aparece sin recargar', async ({
    pageAs,
    cleanup,
  }) => {
    knownBug('B10 (fix-264-m) → ASG-i-056');
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    // Da tiempo a que el canal Realtime termine de suscribirse antes de crear el alumno.
    await page.waitForLoadState('networkidle');

    const alumno = await createE2eAlumno(
      { label: 'Realtime', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    await expect(rowOf(page, alumno.paternalLastName)).toHaveCount(1, { timeout: 10_000 });
  });
});

test.describe('pantalla angosta', () => {
  test('H01 · H04: a 375 px se ven tarjetas, de a 6, sin scroll horizontal', async ({ pageAs }) => {
    const page = await pageAs('secretariaA');
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/app/secretaria/alumnos');

    // El botón "Cargar más" solo existe con los datos ya cargados: el skeleton también dibuja 6
    // tarjetas, así que contarlas no alcanza para saber que la carga terminó.
    const cargarMas = page.locator('[data-llm-action="load-more-students"]');
    await expect(cargarMas).toBeVisible({ timeout: 15_000 });
    const cards = page.locator('[data-llm-description="Ficha resumen de un alumno"]');
    await expect(cards).toHaveCount(6);
    // Con reintentos: la animación de entrada puede desbordar el ancho por un instante.
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(0);

    await cargarMas.click();
    await expect(cards).toHaveCount(12);

    // Al filtrar, la vista vuelve a 6 tarjetas.
    await page.locator(SEARCH).fill('a');
    await expect(cards).toHaveCount(6);
  });
});
