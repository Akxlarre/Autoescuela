/**
 * Base de Alumnos Clase B — lista (fix-264-m, ASG-i-024).
 * Casos de specs/testing-piloto/024a-base-alumnos-b.md; el ID de cada caso va en el título.
 *
 * Los tests que cambian estado siembran su propio alumno E2E- (e2e/support/alumnos-seed.ts).
 */
import type { Locator, Page } from '@playwright/test';
import { createE2eAlumno } from './support/alumnos-seed';
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
    knownBug('B8 (fix-264-m)');
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
    knownBug('B7 (fix-264-m)');
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
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    await expect(row).toHaveCount(1);
    await expect(row.locator('[data-llm-action="archive-student-row"]')).toHaveCount(0);
    await row.locator('[data-llm-action="restore-student-row"]').click();
    await expect(page.getByText('Alumno restaurado correctamente.')).toBeVisible();
    await expect(row).toHaveCount(0);

    // M03: volver a la lista activa: el alumno está de vuelta.
    await page.locator('[data-llm-nav="back"]').first().click();
    await expect(page.getByText('Listado de alumnos de la escuela')).toBeVisible();
    await page.locator(SEARCH).fill(alumno.paternalLastName);
    await expect(row).toHaveCount(1);
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
  /** Exporta a Excel y devuelve las filas que la función le entregó a la app. */
  async function exportarExcel(page: Page): Promise<(string | number)[][]> {
    await page.locator('[data-llm-action="open-export-menu"]').click();
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/functions/v1/export-students')),
      page.locator('[data-llm-action="export-students-excel"]').click(),
    ]);
    expect(response.status()).toBe(200);
    return ((await response.json()) as { rows: (string | number)[][] }).rows;
  }

  test('K02 · K04 (S3): el Excel trae las mismas filas que la pantalla', async ({ pageAs }) => {
    knownBug('B1 (fix-264-m)');
    const page = await pageAs('secretariaA');
    await openLista(page, 'secretaria');
    const enPantalla = await reportTotal(page);

    const filas = await exportarExcel(page);
    expect(filas.length, 'filas del Excel vs "de N alumnos" de la pantalla').toBe(enPantalla);
  });

  test('K09 (S3): exportar desde la Papelera trae solo archivados', async ({ pageAs, cleanup }) => {
    knownBug('B1 (fix-264-m)');
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
