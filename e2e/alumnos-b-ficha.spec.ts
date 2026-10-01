/**
 * Ficha del alumno Clase B y Ex-Alumnos B (fix-264-m, ASG-i-024).
 * Casos de specs/testing-piloto/024b-ficha-ex-alumnos.md; el ID de cada caso va en el título.
 *
 * Los tests que cambian estado siembran su propio alumno E2E- (e2e/support/alumnos-seed.ts).
 */
import type { Locator, Page } from '@playwright/test';
import { ACCOUNTS } from './support/accounts';
import { createE2eAlumno, markCertificateSent } from './support/alumnos-seed';
import { expect, knownBug, test, watchErrors } from './support/fixtures';
import { getAdminClient, getClientFor } from './support/supabase-admin';

const SEDE_A = 1; // Autoescuela Chillán
const SEDE_B = 2; // Conductores Chillán

const DESKTOP = { width: 1600, height: 900 };
/**
 * Espera de una carga completa (app + consultas). Más larga que el default de 5 s: la suite
 * corre con varios workers contra ng serve y la BD de desarrollo compartida.
 */
const CARGA = { timeout: 20_000 };
const ID_INEXISTENTE = 999_999_999;

// Varios tests encadenan 3 o 4 cargas completas: el default de 30 s por test no alcanza cuando
// la suite corre con todos los workers.
test.describe.configure({ timeout: 90_000 });

const SEARCH_ALUMNOS = '[data-llm-description="Search students by name, RUT or file number"]';
const SEARCH_EGRESADOS = '[data-llm-description="Search graduates by name, RUT or file number"]';
const REPORT_ALUMNOS = /Mostrando \d+ a \d+ de \d+ alumnos/;
const REPORT_EGRESADOS = /Mostrando \d+ a \d+ de \d+ egresados/;

type Portal = 'admin' | 'secretaria';

/** Abre la ficha por URL y espera a que termine el skeleton (datos o error). */
async function openFicha(page: Page, portal: Portal, studentId: number | string): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(`/app/${portal}/alumnos/${studentId}`);
  await expect(matricula(page).or(errorDeCarga(page))).toBeVisible(CARGA);
}

/** Título de la tarjeta de error de la ficha. */
function errorDeCarga(page: Page): Locator {
  return page.getByText('Error al cargar la ficha', { exact: true });
}

function hero(page: Page): Locator {
  return page.locator('app-section-hero');
}

function matricula(page: Page): Locator {
  return page.locator('[data-llm-info="matricula"]');
}

async function openExAlumnos(page: Page, portal: Portal): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(`/app/${portal}/ex-alumnos`);
  await expect(page.getByText(REPORT_EGRESADOS)).toBeVisible(CARGA);
}

function egresadoRow(page: Page, text: string): Locator {
  return page.locator('p-table tbody tr').filter({ hasText: text });
}

test.describe('ficha: carga, acceso y URL manipulada', () => {
  for (const [role, portal] of [
    ['admin', 'admin'],
    ['secretariaA', 'secretaria'],
  ] as const) {
    test(`A01 · A02 · A13 · I01 · I02 (${portal}): desde la lista se abre la ficha sin errores y "Volver" regresa a la lista`, async ({
      pageAs,
    }) => {
      const page = await pageAs(role);
      const errors = watchErrors(page);
      await page.setViewportSize(DESKTOP);
      await page.goto(`/app/${portal}/alumnos`);
      await expect(page.getByText(REPORT_ALUMNOS)).toBeVisible(CARGA);

      // Alumno del seed de 0008-i ("AlumnoNN ApellidoNN"): trae clases y pagos reales.
      await page.locator(SEARCH_ALUMNOS).fill('Apellido');
      const fila = page.locator('p-table tbody tr').first();
      // Espera a que el filtro se aplique: sin esto se puede leer el nombre de la primera fila
      // sin filtrar (un alumno E2E- de otro test) y abrir la ficha de otra.
      await expect(fila).toContainText('Apellido');
      const nombre = (await fila.locator('.item-title').textContent())?.trim() ?? '';
      await fila.getByRole('button', { name: 'Ver ficha' }).click();

      await expect(page).toHaveURL(new RegExp(`/app/${portal}/alumnos/\\d+$`));
      await expect(matricula(page)).toBeVisible(CARGA);
      // La lista muestra "Apellidos Nombres"; la ficha, "Nombres Apellidos".
      for (const parte of nombre.split(/\s+/)) await expect(hero(page)).toContainText(parte);
      await page.waitForLoadState('networkidle');
      errors.expectClean();

      await hero(page).locator('[data-llm-nav="back"]').first().click();
      await expect(page).toHaveURL(new RegExp(`/app/${portal}/alumnos$`));
    });
  }

  test('A03: una secretaria no ve por URL la ficha de un alumno de otra sede', async ({
    pageAs,
    cleanup,
  }) => {
    const ajeno = await createE2eAlumno(
      { label: 'OtraSede', branchId: SEDE_B, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', ajeno.studentId);

    await expect(errorDeCarga(page)).toBeVisible(CARGA);
    await expect(page.getByText(ajeno.paternalLastName)).toHaveCount(0);
    await expect(page.getByText(ajeno.rut)).toHaveCount(0);
  });

  test('A03 · A04: el mensaje de "no encontrado" es entendible (sin códigos técnicos)', async ({
    pageAs,
  }) => {
    knownBug('B11 (fix-264-m)');
    const page = await pageAs('admin');
    await openFicha(page, 'admin', ID_INEXISTENTE);

    await expect(errorDeCarga(page)).toBeVisible(CARGA);
    const detalle = errorDeCarga(page).locator('xpath=following-sibling::p');
    await expect(detalle).not.toContainText(/PGRST|JSON object|rows returned/i);
    // Debe decir qué pasó (no existe o no tienes acceso), no repetir el título.
    await expect(detalle).toContainText(/no (existe|se encontr|tienes acceso)/i);
  });

  test('A05 (S12): después de una ficha con error, la ficha anterior se vuelve a ver bien', async ({
    pageAs,
    cleanup,
  }) => {
    knownBug('B12 (fix-264-m)');
    const alumno = await createE2eAlumno(
      { label: 'ErrorPegado', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('admin');
    await page.setViewportSize(DESKTOP);
    await page.goto('/app/admin/alumnos');
    await expect(page.getByText(REPORT_ALUMNOS)).toBeVisible(CARGA);
    await page.locator(SEARCH_ALUMNOS).fill(alumno.paternalLastName);
    const verFicha = page
      .locator('p-table tbody tr')
      .filter({ hasText: alumno.paternalLastName })
      .getByRole('button', { name: 'Ver ficha' });

    // 1. Ficha del alumno, bien cargada; volver a la lista.
    await verFicha.click();
    await expect(matricula(page)).toBeVisible(CARGA);
    await page.goBack();
    await expect(page.getByText(REPORT_ALUMNOS)).toBeVisible(CARGA);

    // 2. Navegación interna de la SPA (sin recargar la app) a una ficha que no existe.
    await page.evaluate((id) => {
      history.pushState({}, '', `/app/admin/alumnos/${id}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, ID_INEXISTENTE);
    await expect(errorDeCarga(page)).toBeVisible(CARGA);
    await page.goBack();

    // 3. Volver a abrir la ficha del paso 1: se debe ver bien, sin el error anterior.
    await expect(page.getByText(REPORT_ALUMNOS)).toBeVisible(CARGA);
    await page.locator(SEARCH_ALUMNOS).fill(alumno.paternalLastName);
    await verFicha.click();
    await expect(matricula(page)).toBeVisible(CARGA);
    await expect(errorDeCarga(page)).toHaveCount(0);
  });

  test('A06 (S13): un id no numérico muestra un error, no "Cargando…" para siempre', async ({
    pageAs,
  }) => {
    knownBug('B13 (fix-264-m)');
    const page = await pageAs('admin');
    await page.setViewportSize(DESKTOP);
    await page.goto('/app/admin/alumnos/abc');

    await expect(page.getByText(/error|no encontrad/i).first()).toBeVisible();
    await expect(hero(page)).not.toContainText('Cargando...');
  });

  test('A09: una secretaria no entra a la ficha por la ruta del portal admin', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'RutaAdmin', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await page.goto(`/app/admin/alumnos/${alumno.studentId}`);
    await expect(page).not.toHaveURL(/\/app\/admin\/alumnos/);
  });
});

test.describe('ficha: cabecera y selector de matrículas', () => {
  test('B01 · B05 · B11 · C01: una matrícula activa → estado "Activo", sin selector y cabecera con Editar/Eliminar', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'Activo', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);

    await expect(hero(page)).toContainText(alumno.paternalLastName);
    await expect(hero(page)).toContainText(`Clase B · Matrícula #${alumno.enrollmentNumbers[0]}`);
    await expect(page.getByText('ESTADO: Activo')).toBeVisible();
    await expect(page.locator('app-tabs')).toHaveCount(0);

    await expect(hero(page).locator('[data-llm-action="editar-alumno"]')).toBeVisible();
    await expect(hero(page).locator('[data-llm-action="eliminar-alumno"]')).toBeVisible();
    await expect(hero(page).locator('[data-llm-action="marcar-ex-alumno"]')).toHaveCount(0); // O02
    for (const accion of [
      'carnet-menu',
      'generar-certificado',
      'ver-inasistencias',
      'ver-ficha-tecnica',
      'ver-consentimientos',
      'ver-reagendamientos',
    ]) {
      await expect(page.locator(`[data-llm-action="${accion}"]`)).toBeVisible();
    }
  });

  test('B08 (S17): la fecha de ingreso se muestra como dd-mm-aaaa', async ({ pageAs, cleanup }) => {
    knownBug('B14 (fix-264-m)');
    const alumno = await createE2eAlumno(
      { label: 'Fecha', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    await expect(page.locator('[data-llm-info="ingreso"]')).toContainText(/\d{2}-\d{2}-\d{4}/);
  });

  test('C02 (S4): un borrador más reciente no reemplaza a la matrícula activa', async ({
    pageAs,
    cleanup,
  }) => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const alumno = await createE2eAlumno(
      {
        label: 'Borrador',
        branchId: SEDE_A,
        enrollments: [{ createdAt: ayer }, { status: 'draft' }],
      },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);

    await expect(page.locator('app-tabs')).toHaveCount(0); // regresión de fix-263-m
    await expect(matricula(page)).toContainText(alumno.enrollmentNumbers[0]);
    await expect(page.getByText('ESTADO: Activo')).toBeVisible();
  });

  test('C03 · D06: con 2 matrículas, el selector cambia número, estado y cantidad de clases', async ({
    pageAs,
    cleanup,
  }) => {
    const haceUnAno = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const alumno = await createE2eAlumno(
      {
        label: 'DosFichas',
        branchId: SEDE_A,
        enrollments: [
          { status: 'completed', createdAt: haceUnAno },
          { courseName: 'Refuerzo Clase B' },
        ],
      },
      cleanup,
    );
    const [antigua, refuerzo] = alumno.enrollmentNumbers;
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);

    // Abre la más reciente (refuerzo, 6 clases).
    await expect(matricula(page)).toContainText(refuerzo);
    await expect(page.getByText('ESTADO: Activo')).toBeVisible();
    await expect(page.getByText(/de 6\b/).first()).toBeVisible();

    await page.locator('app-tabs').getByText(antigua).click();
    await expect(matricula(page)).toContainText(antigua);
    await expect(page.getByText('ESTADO: Egresado')).toBeVisible();
    await expect(page.getByText(/de 12\b/).first()).toBeVisible();
  });
});

test.describe('ficha: la matrícula elegida se mantiene', () => {
  test('C04 (S14): después de guardar un cambio, sigue elegida la matrícula antigua', async ({
    pageAs,
    cleanup,
  }) => {
    const haceUnAno = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const alumno = await createE2eAlumno(
      {
        label: 'Salta',
        branchId: SEDE_A,
        enrollments: [
          { status: 'completed', createdAt: haceUnAno },
          { courseName: 'Refuerzo Clase B' },
        ],
      },
      cleanup,
    );
    const [antigua] = alumno.enrollmentNumbers;
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    await page.locator('app-tabs').getByText(antigua).click();
    await expect(matricula(page)).toContainText(antigua);

    // Cualquier acción que refresque la ficha; acá, guardar el teléfono en Editar Perfil.
    await hero(page).locator('[data-llm-action="editar-alumno"]').click();
    await page
      .locator('[data-llm-description="Número de teléfono del alumno"]')
      .fill('+56933334444');
    await page.locator('[data-llm-action="guardar-perfil-alumno"]').click();
    await expect(page.locator('[data-llm-info="phone"]')).toContainText('+56933334444');

    await expect(matricula(page), 'sigue en la matrícula antigua').toContainText(antigua);
  });
});

test.describe('ficha: marcar como ex-alumno y archivar', () => {
  test('O01 · O03 · O04 (S5 · S6): marcar ex-alumno → la ficha deja de ofrecerlo y aparece en Ex-Alumnos con el año de hoy', async ({
    pageAs,
    cleanup,
  }) => {
    // Matrícula antigua (último cambio hace 2 años) con certificado ya enviado.
    const haceDosAnos = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    const alumno = await createE2eAlumno(
      { label: 'Egresar', branchId: SEDE_A, enrollments: [{ createdAt: haceDosAnos }] },
      cleanup,
    );
    await markCertificateSent(alumno, alumno.enrollmentIds[0], cleanup);
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    const boton = hero(page).locator('[data-llm-action="marcar-ex-alumno"]');

    const confirmacion = page.locator('[role="dialog"][aria-labelledby="confirm-modal-title"]');

    // O03: cancelar la confirmación no cambia nada.
    await boton.click();
    await confirmacion.getByRole('button', { name: 'Cancelar' }).click();
    await expect(confirmacion).toHaveCount(0);
    await expect(page.getByText('ESTADO: Activo')).toBeVisible();

    // O01: confirmar. La ficha pasa a "Egresado" y el botón desaparece (regresión de fix-263-m).
    await boton.click();
    await confirmacion.getByRole('button', { name: 'Marcar como Ex-Alumno' }).click();
    await expect(page.getByText('Alumno marcado como ex-alumno correctamente.')).toBeVisible();
    await expect(page.getByText('ESTADO: Egresado')).toBeVisible();
    await expect(boton).toHaveCount(0);

    // Ya no está en la Base y sí en Ex-Alumnos (la búsqueda ignora el período).
    await page.goto('/app/secretaria/alumnos');
    await expect(page.getByText(REPORT_ALUMNOS)).toBeVisible(CARGA);
    await page.locator(SEARCH_ALUMNOS).fill(alumno.paternalLastName);
    await expect(egresadoRow(page, alumno.paternalLastName)).toHaveCount(0);

    await openExAlumnos(page, 'secretaria');
    await page.locator(SEARCH_EGRESADOS).fill(alumno.paternalLastName);
    const fila = egresadoRow(page, alumno.paternalLastName);
    await expect(fila).toHaveCount(1);
    // O04 (S6): el año de egreso es el de hoy, no el de la última modificación de la matrícula.
    const celdaAnio = fila.locator('td').nth(4);
    await expect(celdaAnio, 'año de egreso').toContainText(String(new Date().getFullYear()));
  });

  test('P01 · P02: "Eliminar Alumno" archiva desde la ficha y vuelve a la lista', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno({ label: 'ArchivarFicha', branchId: SEDE_A }, cleanup);
    const page = await pageAs('secretariaA');
    const errors = watchErrors(page);
    await openFicha(page, 'secretaria', alumno.studentId);

    await hero(page).locator('[data-llm-action="eliminar-alumno"]').click();
    const modal = page.getByRole('dialog', { name: /Confirmar archivado de/ });
    await expect(modal).toContainText('Archivar alumno');
    await modal.locator('[data-llm-action="confirm-archive-student"]').click();

    await expect(page.getByText('Alumno archivado correctamente.')).toBeVisible();
    await expect(page).toHaveURL(/\/app\/secretaria\/alumnos$/);
    errors.expectClean();
  });
});

test.describe('ficha: editar perfil', () => {
  const NOMBRES = '[data-llm-description="Nombres del alumno"]';
  const EMAIL = '[data-llm-description="Correo electrónico del alumno"]';
  const TELEFONO = '[data-llm-description="Número de teléfono del alumno"]';
  const GUARDAR = '[data-llm-action="guardar-perfil-alumno"]';

  test('M01 · M03 · M06 · M07: el formulario llega precargado, valida y guarda nombre y teléfono', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'Editar', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    await hero(page).locator('[data-llm-action="editar-alumno"]').click();

    // M01: precargado.
    await expect(page.locator(NOMBRES)).toHaveValue(alumno.firstNames);
    await expect(page.locator(EMAIL)).toHaveValue(alumno.email);

    // M06 · M07: nombre vacío y email inválido bloquean el guardado.
    await page.locator(NOMBRES).fill('');
    await expect(page.locator(GUARDAR)).toBeDisabled();
    await page.locator(NOMBRES).fill(`${alumno.firstNames}-Editado`);
    await page.locator(EMAIL).fill('no-es-un-email');
    await page.locator(EMAIL).blur();
    await expect(page.getByText('Ingresa un email válido')).toBeVisible();
    await expect(page.locator(GUARDAR)).toBeDisabled();

    // M03: cambio de nombre y teléfono.
    await page.locator(EMAIL).fill(alumno.email);
    await page.locator(TELEFONO).fill('+56911112222');
    await page.locator(GUARDAR).click();
    await expect(hero(page)).toContainText(`${alumno.firstNames}-Editado`);
    await expect(page.locator('[data-llm-info="phone"]')).toContainText('+56911112222');
  });

  test('M02 (S8): un email ya usado por otro usuario muestra un mensaje claro', async ({
    pageAs,
    cleanup,
  }) => {
    knownBug('B17 (fix-264-m)');
    const [alumno, otro] = await Promise.all([
      createE2eAlumno({ label: 'EmailA', branchId: SEDE_A, enrollments: [{}] }, cleanup),
      createE2eAlumno({ label: 'EmailB', branchId: SEDE_A, enrollments: [{}] }, cleanup),
    ]);
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    await hero(page).locator('[data-llm-action="editar-alumno"]').click();

    await page.locator(EMAIL).fill(otro.email);
    await page.locator(GUARDAR).click();

    await expect(page.getByText(/ya existe|ya está (en uso|registrado)/i).first()).toBeVisible();
    await expect(page.locator('[data-llm-info="email"]')).toContainText(alumno.email);
  });
});

test.describe('fecha de egreso en la BD (fix-266-m, por API)', () => {
  test('completed_at se fija al completar la matrícula, no la mueve un cambio de saldo y se borra al reactivarla', async ({
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'FechaEgreso', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const admin = await getAdminClient();
    const leer = async () => {
      const { data, error } = await admin
        .from('enrollments')
        .select('status, completed_at')
        .eq('id', alumno.enrollmentIds[0])
        .single();
      if (error) throw new Error(error.message);
      return data as { status: string; completed_at: string | null };
    };

    // Activa: sin fecha de egreso.
    expect((await leer()).completed_at).toBeNull();

    // Pasa a completed: el trigger pone la fecha de ahora.
    const antes = Date.now();
    await admin
      .from('enrollments')
      .update({ status: 'completed' })
      .eq('id', alumno.enrollmentIds[0]);
    const egreso = (await leer()).completed_at;
    expect(egreso).not.toBeNull();
    expect(Math.abs(new Date(egreso!).getTime() - antes)).toBeLessThan(5 * 60 * 1000);

    // Un cambio que no toca el estado (lo que hace un pago: saldo y updated_at) no la mueve.
    await admin
      .from('enrollments')
      .update({ pending_balance: 1000, updated_at: new Date().toISOString() })
      .eq('id', alumno.enrollmentIds[0]);
    expect((await leer()).completed_at).toBe(egreso);

    // Vuelve a activa: deja de tener fecha de egreso.
    await admin.from('enrollments').update({ status: 'active' }).eq('id', alumno.enrollmentIds[0]);
    expect((await leer()).completed_at).toBeNull();
  });
});

test.describe('seguridad entre sedes (por API, con la sesión de la secretaria de la sede A)', () => {
  test('S04: no puede cambiar el estado de una matrícula de la sede B', async ({ cleanup }) => {
    const ajeno = await createE2eAlumno(
      { label: 'RlsMatricula', branchId: SEDE_B, enrollments: [{}] },
      cleanup,
    );
    const secretaria = await getClientFor(
      ACCOUNTS.secretariaA.email,
      ACCOUNTS.secretariaA.password,
    );
    const { data } = await secretaria
      .from('enrollments')
      .update({ status: 'completed' })
      .eq('id', ajeno.enrollmentIds[0])
      .select('id');
    expect(data ?? [], 'matrículas de la sede B modificadas').toHaveLength(0);
  });

  test('P02 / 024a L: no puede archivar a un alumno de la sede B', async ({ cleanup }) => {
    const ajeno = await createE2eAlumno(
      { label: 'RlsArchivar', branchId: SEDE_B, enrollments: [{}] },
      cleanup,
    );
    const secretaria = await getClientFor(
      ACCOUNTS.secretariaA.email,
      ACCOUNTS.secretariaA.password,
    );
    const { data } = await secretaria
      .from('students')
      .update({ status: 'archived' })
      .eq('id', ajeno.studentId)
      .select('id');
    expect(data ?? [], 'alumnos de la sede B archivados').toHaveLength(0);
  });

  test('M04 (S1): no puede editar el perfil de un usuario de la sede B', async ({ cleanup }) => {
    knownBug('B19 (fix-264-m) → ASG-i-043');
    const ajeno = await createE2eAlumno(
      { label: 'EditarAjeno', branchId: SEDE_B, enrollments: [{}] },
      cleanup,
    );
    const secretaria = await getClientFor(
      ACCOUNTS.secretariaA.email,
      ACCOUNTS.secretariaA.password,
    );
    // Mismo cuerpo que manda "Editar Perfil", sin cambiar el email (no toca Auth).
    const { error } = await secretaria.functions.invoke('update-student-profile', {
      body: {
        userId: ajeno.userId,
        firstNames: `${ajeno.firstNames}-MODIFICADO`,
        paternalLastName: ajeno.paternalLastName,
        maternalLastName: ajeno.maternalLastName,
        phone: '+56900000000',
        email: ajeno.email,
        currentEmail: ajeno.email,
      },
    });
    expect(error, 'la función debe rechazar la edición').not.toBeNull();
  });
});

test.describe('ex-alumnos', () => {
  for (const [role, portal] of [
    ['admin', 'admin'],
    ['secretariaA', 'secretaria'],
  ] as const) {
    test(`T01 · T10 (${portal}): carga sin errores; "Ver ficha" abre la ficha y "Volver" regresa a Ex-Alumnos`, async ({
      pageAs,
    }) => {
      const page = await pageAs(role);
      const errors = watchErrors(page);
      await openExAlumnos(page, portal);
      await page.waitForLoadState('networkidle');
      errors.expectClean();

      await page.locator('[data-llm-action="view-student-detail"]').first().click();
      await expect(matricula(page)).toBeVisible(CARGA);
      const volver = hero(page).locator('[data-llm-nav="back"]').first();
      await expect(volver).toContainText('Ex-Alumnos B');
      await volver.click();
      await expect(page).toHaveURL(new RegExp(`/app/${portal}/ex-alumnos$`));
    });
  }

  test('U03 · U04: la búsqueda encuentra a un egresado antiguo por nombre, apellido sin tilde y Nº de expediente', async ({
    pageAs,
    cleanup,
  }) => {
    const sufijo = String(Date.now()).slice(-6);
    const egresado = await createE2eAlumno(
      {
        label: 'Egresado',
        branchId: SEDE_A,
        paternalLastName: `Muñoz${sufijo}`,
        enrollments: [{ status: 'completed' }],
      },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openExAlumnos(page, 'secretaria');
    const fila = egresadoRow(page, egresado.paternalLastName);

    for (const consulta of [
      egresado.paternalLastName,
      `munoz${sufijo}`,
      `${egresado.firstNames} ${egresado.paternalLastName}`,
      egresado.enrollmentNumbers[0],
      egresado.rut,
    ]) {
      await page.locator(SEARCH_EGRESADOS).fill(consulta);
      await expect(fila, `búsqueda "${consulta}"`).toHaveCount(1);
    }

    // T06: un egresado sin saldo se muestra "Al día".
    await expect(fila).toContainText('Al día');
  });

  test('V01 · V02 (S15): desde una tarjeta (375 px), "Ver ficha" y "Volver" regresan a Ex-Alumnos', async ({
    pageAs,
  }) => {
    knownBug('B20 (fix-264-m)');
    const page = await pageAs('secretariaA');
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/app/secretaria/ex-alumnos');

    const tarjetas = page.locator('[data-llm-description="Ficha resumen de un egresado"]');
    await expect(tarjetas.first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.locator('[data-llm-action="view-student-detail-card"]').first().click();
    await expect(matricula(page)).toBeVisible(CARGA);
    await hero(page).locator('[data-llm-nav="back"]').first().click();
    await expect(page).toHaveURL(/\/app\/secretaria\/ex-alumnos$/);
  });

  test('W01 · W02: re-matricular pide confirmación y abre la matrícula con el RUT en la URL', async ({
    pageAs,
    cleanup,
  }) => {
    const egresado = await createE2eAlumno(
      { label: 'Rematricular', branchId: SEDE_A, enrollments: [{ status: 'completed' }] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openExAlumnos(page, 'secretaria');
    await page.locator(SEARCH_EGRESADOS).fill(egresado.paternalLastName);
    const reMatricular = egresadoRow(page, egresado.paternalLastName).locator(
      '[data-llm-action="re-enroll-student"]',
    );

    // W02: cancelar no abre nada ni cambia la URL.
    await reMatricular.click();
    await expect(page.getByText('Re-matricular alumno')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page).toHaveURL(/\/ex-alumnos$/);

    // W01: continuar abre "Nueva Matrícula" con ?rut=.
    await reMatricular.click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/[?&]rut=/);
    await expect(page.getByText('Nueva Matrícula').first()).toBeVisible();
  });
});
