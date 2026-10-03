/**
 * Ficha del alumno Clase B y Ex-Alumnos B (fix-264-m, ASG-i-024).
 * Casos de specs/testing-piloto/024b-ficha-ex-alumnos.md; el ID de cada caso va en el título.
 *
 * Los tests que cambian estado siembran su propio alumno E2E- (e2e/support/alumnos-seed.ts).
 */
import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { ACCOUNTS } from './support/accounts';
import { addMissedClass, createE2eAlumno, markCertificateSent } from './support/alumnos-seed';
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

      // fix-272-m: el enlace lleva la matrícula de la fila (?enrollment=<id>).
      await expect(page).toHaveURL(new RegExp(`/app/${portal}/alumnos/\\d+\\?enrollment=\\d+$`));
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
  test('I06 · I08 (fix-278-m): desde la ficha se registra un pago y se ve el historial del alumno', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      {
        label: 'PagoFicha',
        branchId: SEDE_A,
        // Sin pagos: al registrar uno, la BD recalcula el saldo desde la suma de los pagos, así
        // que la matrícula tiene que partir debiendo el precio completo.
        enrollments: [{ paymentStatus: 'pending', totalPaid: 0 }],
      },
      cleanup,
    );
    const sb = await getAdminClient();
    const { data: matricula } = await sb
      .from('enrollments')
      .select('base_price')
      .eq('id', alumno.enrollmentIds[0])
      .single();
    const precio = matricula!.base_price as number;
    await sb
      .from('enrollments')
      .update({ pending_balance: precio })
      .eq('id', alumno.enrollmentIds[0]);
    const clp = (n: number) => `$${n.toLocaleString('es-CL')}`;
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    const financiero = page.locator('app-admin-historial-pagos');
    await expect(financiero).toContainText('No hay pagos registrados');

    try {
      // I08: registrar un pago sin salir de la ficha, con la matrícula ya elegida.
      await financiero.locator('[data-llm-action="registrar-pago-ficha"]').click();
      const panel = page.locator('app-registrar-pago-drawer');
      await expect(panel).toBeVisible();
      await expect(panel.locator('#pago-enrollment')).toHaveCount(0);
      await panel.locator('p-select').click();
      await page.getByRole('option', { name: 'Abono', exact: true }).click();
      await panel.locator('#pago-total').fill('30000');
      await panel.locator('#pago-cash').fill('30000');
      await page.getByRole('button', { name: 'Guardar Pago' }).click();
      await expect(page.getByText('Pago registrado correctamente.')).toBeVisible();

      // La ficha se refresca sola: aparece el pago y el saldo es el precio menos lo pagado.
      await expect(financiero).toContainText(clp(precio - 30000), CARGA);
      await expect(financiero).toContainText('$30.000');
      await expect(financiero).not.toContainText('No hay pagos registrados');
      await expect(page).toHaveURL(/\/alumnos\/\d+/);

      // I06: "Ver todo el historial" abre el estado de cuenta de este alumno, sin navegar.
      await financiero.locator('[data-llm-action="ver-historial-pagos"]').click();
      const estadoCuenta = page.locator('app-admin-pago-detalle-drawer');
      await expect(estadoCuenta).toContainText('Historial de Pagos');
      await expect(estadoCuenta).toContainText(alumno.paternalLastName);
      await expect(estadoCuenta).toContainText('$30.000');
      // hotfix-127-m: el estado de pago va traducido, nunca el valor crudo de la base.
      await expect(estadoCuenta.locator('app-badge').first()).toHaveText('Parcial');
      await expect(estadoCuenta).not.toContainText(/paid_full|partial|pending/);
      await expect(page).toHaveURL(/\/alumnos\/\d+/);
    } finally {
      // El pago y el aviso al alumno los crea la app: se registran para borrarlos.
      const { data: pagos } = await sb
        .from('payments')
        .select('id')
        .eq('enrollment_id', alumno.enrollmentIds[0]);
      for (const p of pagos ?? []) cleanup.track('payments', p.id);
      const { data: avisos } = await sb
        .from('notifications')
        .select('id')
        .eq('recipient_id', alumno.userId);
      for (const n of avisos ?? []) cleanup.track('notifications', n.id);
    }
  });

  test('F04 · F11 · F13 (fix-279-m): reprogramar una clase con inasistencia la archiva y queda en el historial', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'Reprogramar', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const sessionId = await addMissedClass(alumno, alumno.enrollmentIds[0], cleanup);
    const sb = await getAdminClient();
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);

    try {
      await page.locator('[data-llm-action="ver-ficha-tecnica"]').click();
      const reprogramar = page.locator('[data-llm-action="reprogramar-clase"]').first();
      await reprogramar.click();
      const panel = page.locator('app-admin-reprogramar-clase-drawer');
      const confirmar = panel.locator('[data-llm-action="confirmar-reprogramar-clase"]');

      // F11: "Cancelar" vuelve a la Ficha Técnica, no cierra todo.
      await panel.locator('[data-llm-action="cancelar-reprogramar-clase"]').click();
      await expect(panel).toHaveCount(0);
      await expect(reprogramar).toBeVisible();
      await reprogramar.click();

      // La razón es obligatoria: con instructor y horario elegidos, sin razón no se confirma.
      await panel.locator('[data-llm-action="seleccionar-instructor-reprogramar"]').first().click();
      await panel.locator('[data-llm-action="seleccionar-slot-reprogramar"]').first().click(CARGA);
      await expect(confirmar).toBeDisabled();
      await panel.locator('p-select').click();
      await page.getByRole('option', { name: 'Médica', exact: true }).click();
      await confirmar.click();
      await expect(page.getByText('Clase reprogramada correctamente.')).toBeVisible();

      // F04: la inasistencia anterior queda archivada y la clase vuelve a estar agendada.
      const { data: asistencia } = await sb
        .from('class_b_practice_attendance')
        .select('archived_at')
        .eq('class_b_session_id', sessionId);
      expect(asistencia, 'asistencia de la sesión').toHaveLength(1);
      expect(asistencia![0].archived_at, 'archived_at').not.toBeNull();
      const { data: sesion } = await sb
        .from('class_b_sessions')
        .select('status, scheduled_at')
        .eq('id', sessionId)
        .single();
      expect(sesion!.status).toBe('scheduled');
      expect(new Date(sesion!.scheduled_at).getTime()).toBeGreaterThan(Date.now());

      // F13: queda en el historial de reagendamientos, con su razón.
      const { data: historial } = await sb
        .from('class_b_reschedule_history')
        .select('reason, new_scheduled_at')
        .eq('class_session_id', sessionId);
      expect(historial, 'historial de reagendamientos').toHaveLength(1);
      expect(historial![0].reason).toBe('medica');
      await page.locator('[data-llm-action="ver-reagendamientos"]').click();
      await expect(page.getByText('Médica').first()).toBeVisible();

      // H06 (hotfix-128-m): la inasistencia reagendada se ve como tal y ya no ofrece "Justificar".
      await page.getByRole('button', { name: 'Cerrar panel' }).click();
      await page.locator('[data-llm-action="ver-inasistencias"]').click();
      const inasistencias = page.locator('app-admin-inasistencias-drawer');
      await expect(inasistencias.getByText('Reagendada')).toBeVisible();
      await expect(
        inasistencias.locator('[data-llm-action="justificar-inasistencia-clase-b"]'),
      ).toHaveCount(0);
    } finally {
      // Historial y avisos los crea la app: se registran para borrarlos antes que la sesión.
      const { data: historial } = await sb
        .from('class_b_reschedule_history')
        .select('id')
        .eq('class_session_id', sessionId);
      for (const h of historial ?? []) cleanup.track('class_b_reschedule_history', h.id);
      const { data: avisos } = await sb
        .from('notifications')
        .select('id')
        .eq('reference_type', 'class_b')
        .eq('reference_id', sessionId);
      for (const n of avisos ?? []) cleanup.track('notifications', n.id);
      const { data: avisosAlumno } = await sb
        .from('notifications')
        .select('id')
        .eq('recipient_id', alumno.userId);
      for (const n of avisosAlumno ?? []) {
        if (!(avisos ?? []).some((a) => a.id === n.id)) cleanup.track('notifications', n.id);
      }
    }
  });

  test('O05 (hotfix-125-m): con saldo pendiente, la confirmación de egreso avisa el monto', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      {
        label: 'EgresarDeuda',
        branchId: SEDE_A,
        enrollments: [{ paymentStatus: 'partial', pendingBalance: 90000 }],
      },
      cleanup,
    );
    await markCertificateSent(alumno, alumno.enrollmentIds[0], cleanup);
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    const confirmacion = page.locator('[role="dialog"][aria-labelledby="confirm-modal-title"]');

    await hero(page).locator('[data-llm-action="marcar-ex-alumno"]').click();

    await expect(confirmacion).toContainText('Tiene un saldo pendiente de $90.000.');
    // Avisa, pero permite: el botón de confirmar sigue disponible.
    await expect(confirmacion.getByRole('button', { name: 'Marcar como Ex-Alumno' })).toBeEnabled();
    await confirmacion.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('ESTADO: Activo')).toBeVisible();
  });

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
    // B19 (fix-264-m) → ASG-i-043: el 2026-10-01 la función ya rechaza la edición; se quitó la
    // marca knownBug. El cambio no salió de este track (ver fix-264-m).
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
      cleanup,
    }) => {
      // Egresado propio: la primera fila de la lista puede ser el alumno E2E- de otro test, que
      // se borra en cualquier momento.
      const egresado = await createE2eAlumno(
        { label: 'VerFicha', branchId: SEDE_A, enrollments: [{ status: 'completed' }] },
        cleanup,
      );
      const page = await pageAs(role);
      const errors = watchErrors(page);
      await openExAlumnos(page, portal);
      await page.waitForLoadState('networkidle');
      errors.expectClean();

      await page.locator(SEARCH_EGRESADOS).fill(egresado.paternalLastName);
      await egresadoRow(page, egresado.paternalLastName)
        .locator('[data-llm-action="view-student-detail"]')
        .click();
      await expect(matricula(page)).toBeVisible(CARGA);
      const volver = hero(page).locator('[data-llm-nav="back"]').first();
      await expect(volver).toContainText('Ex-Alumnos B');
      await volver.click();
      await expect(page).toHaveURL(new RegExp(`/app/${portal}/ex-alumnos$`));
    });
  }

  test.describe('T14 (spec 0021-m): exportar la lista', () => {
    const MENU = '[data-llm-action="open-export-menu"]';

    /** Dos egresados con un apellido materno común, para aislarlos con el buscador. */
    async function seedPar(cleanup: Parameters<typeof createE2eAlumno>[1]) {
      const comun = `Export${String(Date.now()).slice(-6)}`;
      const crear = (paterno: string, pendingBalance: number) =>
        createE2eAlumno(
          {
            label: 'Exportar',
            branchId: SEDE_A,
            paternalLastName: `${paterno}${comun}`,
            maternalLastName: comun,
            enrollments: [{ status: 'completed', pendingBalance }],
          },
          cleanup,
        );
      return { comun, alDia: await crear('Aaa', 0), conDeuda: await crear('Zzz', 30000) };
    }

    test('el Excel trae las mismas filas que la pantalla, con sus columnas', async ({
      pageAs,
      cleanup,
    }) => {
      const { comun, alDia, conDeuda } = await seedPar(cleanup);
      const page = await pageAs('secretariaA');
      await openExAlumnos(page, 'secretaria');
      await page.locator(SEARCH_EGRESADOS).fill(comun);
      await expect(page.locator('p-table tbody tr')).toHaveCount(2);

      await page.locator(MENU).click();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('[data-llm-action="export-graduates-excel"]').click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^ex-alumnos-b_\d{4}-\d{2}-\d{2}\.xlsx$/);

      const book = XLSX.read(readFileSync(await download.path()));
      const [headers, ...rows] = XLSX.utils.sheet_to_json<(string | number)[]>(
        book.Sheets[book.SheetNames[0]],
        { header: 1 },
      );
      expect(headers).toEqual([
        'Alumno',
        'RUT',
        'Correo',
        'Nº Expediente',
        'Licencia',
        'Fecha de egreso',
        'Sede',
        'Estado de cuenta',
        'Saldo pendiente',
      ]);
      expect(rows).toHaveLength(2);
      const ruts = rows.map((r) => r[1]);
      expect(ruts).toContain(alDia.rut);
      expect(ruts).toContain(conDeuda.rut);
      const filaDeuda = rows.find((r) => r[1] === conDeuda.rut)!;
      expect(filaDeuda[7]).toBe('Debe');
      expect(filaDeuda[8]).toBeGreaterThan(0);
      expect(rows.find((r) => r[1] === alDia.rut)![7]).toBe('Al día');
      expect(String(filaDeuda[5])).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    });

    test('el PDF se pide con las filas de la pantalla y se descarga', async ({
      pageAs,
      cleanup,
    }) => {
      const { comun } = await seedPar(cleanup);
      const page = await pageAs('secretariaA');
      // La función se simula: este test cubre lo que la app envía y qué hace con la respuesta.
      let body: { title: string; headers: string[]; rows: string[][]; footer: string } | null =
        null;
      await page.route('**/functions/v1/export-table-pdf', async (route) => {
        if (route.request().method() === 'OPTIONS') return route.continue();
        body = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('%PDF-1.4 simulado'),
        });
      });
      await openExAlumnos(page, 'secretaria');
      await page.locator(SEARCH_EGRESADOS).fill(comun);
      await expect(page.locator('p-table tbody tr')).toHaveCount(2);

      await page.locator(MENU).click();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('[data-llm-action="export-graduates-pdf"]').click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/^ex-alumnos-b_\d{4}-\d{2}-\d{2}\.pdf$/);
      expect(body!.title).toBe('Ex-Alumnos Clase B');
      expect(body!.headers).toHaveLength(7);
      expect(body!.rows).toHaveLength(2);
      expect(body!.footer).toBe('Total: 2 egresados');
      // El botón vuelve a quedar disponible.
      await expect(page.locator(MENU)).toBeEnabled();
    });

    test('sin egresados en pantalla, "Exportar" está deshabilitado', async ({ pageAs }) => {
      const page = await pageAs('secretariaA');
      await openExAlumnos(page, 'secretaria');

      await page.locator(SEARCH_EGRESADOS).fill('zzzz-no-existe-nadie');
      await expect(page.getByText('No se encontraron egresados').first()).toBeVisible();

      await expect(page.locator(MENU)).toBeDisabled();
    });
  });

  test('C05 · T11: la ficha abre la matrícula de la fila que se cliqueó (fix-272-m)', async ({
    pageAs,
    cleanup,
  }) => {
    // Egresado que se volvió a matricular: aparece en Ex-Alumnos por la matrícula terminada y en
    // la Base por la vigente.
    const haceUnAno = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const alumno = await createE2eAlumno(
      {
        label: 'Cliqueada',
        branchId: SEDE_A,
        enrollments: [
          { status: 'completed', createdAt: haceUnAno },
          { courseName: 'Refuerzo Clase B' },
        ],
      },
      cleanup,
    );
    const [terminada, vigente] = alumno.enrollmentNumbers;
    const page = await pageAs('secretariaA');

    // Desde Ex-Alumnos: la terminada, aunque la vigente sea más reciente.
    await openExAlumnos(page, 'secretaria');
    await page.locator(SEARCH_EGRESADOS).fill(alumno.paternalLastName);
    await egresadoRow(page, alumno.paternalLastName)
      .locator('[data-llm-action="view-student-detail"]')
      .click();
    await expect(matricula(page)).toContainText(terminada, CARGA);
    await expect(page.getByText('ESTADO: Egresado')).toBeVisible();

    // Desde la Base de Alumnos: la vigente. La visita anterior no se arrastra.
    await page.goto('/app/secretaria/alumnos');
    await expect(page.getByText(REPORT_ALUMNOS)).toBeVisible(CARGA);
    await page.locator(SEARCH_ALUMNOS).fill(alumno.paternalLastName);
    await page
      .locator('p-table tbody tr')
      .filter({ hasText: alumno.paternalLastName })
      .locator('[data-llm-action="view-student-detail"]')
      .click();
    await expect(matricula(page)).toContainText(vigente, CARGA);
    await expect(page.getByText('ESTADO: Activo')).toBeVisible();
  });

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
      egresado.rut.replace(/[.-]/g, ''), // RUT sin puntos ni guion (fix-267-m)
    ]) {
      await page.locator(SEARCH_EGRESADOS).fill(consulta);
      await expect(fila, `búsqueda "${consulta}"`).toHaveCount(1);
    }

    // T06: un egresado sin saldo se muestra "Al día".
    await expect(fila).toContainText('Al día');
  });

  test('V01 · V02 (S15): desde una tarjeta (375 px), "Ver ficha" y "Volver" regresan a Ex-Alumnos', async ({
    pageAs,
    cleanup,
  }) => {
    // Egresado propio: la primera tarjeta puede ser el alumno E2E- de otro test.
    const egresado = await createE2eAlumno(
      { label: 'Tarjeta', branchId: SEDE_A, enrollments: [{ status: 'completed' }] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/app/secretaria/ex-alumnos');

    const tarjetas = page.locator('[data-llm-description="Ficha resumen de un egresado"]');
    await expect(tarjetas.first()).toBeVisible(CARGA);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(0);

    await page.locator(SEARCH_EGRESADOS).fill(egresado.paternalLastName);
    await tarjetas
      .filter({ hasText: egresado.paternalLastName })
      .locator('[data-llm-action="view-student-detail-card"]')
      .click();
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

  test('T04 · P04 · M08 (fix-276-m): un egresado archivado sale de Ex-Alumnos, se ve en la Papelera y al restaurarlo vuelve', async ({
    pageAs,
    cleanup,
  }) => {
    const egresado = await createE2eAlumno(
      { label: 'ExArchivado', branchId: SEDE_A, enrollments: [{ status: 'completed' }] },
      cleanup,
    );
    const apellido = egresado.paternalLastName;
    const page = await pageAs('secretariaA');
    const buscarEgresado = async () => {
      await openExAlumnos(page, 'secretaria');
      await page.locator(SEARCH_EGRESADOS).fill(apellido);
      return egresadoRow(page, apellido);
    };
    const filaAlumno = page.locator('p-table tbody tr').filter({ hasText: apellido });

    // Archivar desde su ficha.
    await (await buscarEgresado()).locator('[data-llm-action="view-student-detail"]').click();
    await expect(matricula(page)).toBeVisible(CARGA);
    await hero(page).locator('[data-llm-action="eliminar-alumno"]').click();
    await page
      .getByRole('dialog', { name: /Confirmar archivado de/ })
      .locator('[data-llm-action="confirm-archive-student"]')
      .click();
    await expect(page.getByText('Alumno archivado correctamente.')).toBeVisible();

    // T04 · P04: ya no está en Ex-Alumnos.
    await expect(await buscarEgresado()).toHaveCount(0);

    // Está en la Papelera de la Base, como Finalizado, y no en la lista activa.
    await page.goto('/app/secretaria/alumnos');
    await expect(page.getByText(REPORT_ALUMNOS)).toBeVisible(CARGA);
    await page.locator(SEARCH_ALUMNOS).fill(apellido);
    await expect(filaAlumno).toHaveCount(0);
    await page.locator('[data-llm-action="papelera"]').click();
    await expect(page.getByText('Papelera — Alumnos archivados')).toBeVisible(CARGA);
    await expect(filaAlumno).toHaveCount(1);
    await expect(filaAlumno).toContainText('Finalizado');

    // M08: al restaurarlo vuelve a Ex-Alumnos, no a la Base.
    await filaAlumno.locator('[data-llm-action="restore-student-row"]').click();
    await expect(page.getByText('Alumno restaurado correctamente.')).toBeVisible();
    await expect(filaAlumno).toHaveCount(0);
    await page.locator('[data-llm-nav="back"]').first().click();
    await expect(page.getByText('Listado de alumnos de la escuela')).toBeVisible();
    await expect(filaAlumno).toHaveCount(0);
    await expect(await buscarEgresado()).toHaveCount(1);
  });

  test('W05 (fix-274-m): tras re-matricular, el admin vuelve a "Todas las sedes"', async ({
    pageAs,
    cleanup,
  }) => {
    const egresado = await createE2eAlumno(
      { label: 'RematSede', branchId: SEDE_B, enrollments: [{ status: 'completed' }] },
      cleanup,
    );
    const page = await pageAs('admin');
    await openExAlumnos(page, 'admin');
    const sede = page.locator('[data-llm-action="toggle-branch-dropdown"]');
    await expect(sede).toContainText('Todas las sedes');

    await page.locator(SEARCH_EGRESADOS).fill(egresado.paternalLastName);
    await egresadoRow(page, egresado.paternalLastName)
      .locator('[data-llm-action="re-enroll-student"]')
      .click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Con el wizard abierto, la sede activa es la del egresado.
    await expect(page.getByText('Nueva Matrícula').first()).toBeVisible();
    await expect(sede).toContainText('Conductores Chillán');

    // Al cerrarlo sin matricular, vuelve la sede que el admin tenía elegida.
    await page.getByRole('button', { name: 'Cerrar panel' }).click();
    await expect(sede).toContainText('Todas las sedes', CARGA);
  });
});

test.describe('segunda pasada (fix-264-m, 2026-10-02)', () => {
  /** `id` de la fila de asistencia que `addMissedClass()` dejó para esa sesión. */
  async function attendanceIdOf(sessionId: number): Promise<number> {
    const sb = await getAdminClient();
    const { data, error } = await sb
      .from('class_b_practice_attendance')
      .select('id')
      .eq('class_b_session_id', sessionId)
      .single();
    if (error) throw new Error(`[e2e] No se encontró la asistencia: ${error.message}`);
    return data.id;
  }

  async function abrirJustificar(page: Page): Promise<Locator> {
    await page.locator('[data-llm-action="ver-inasistencias"]').click();
    await page.locator('[data-llm-action="justificar-inasistencia-clase-b"]').first().click();
    return page.getByRole('dialog', { name: 'Justificar inasistencia' });
  }

  test('H02 · H03 · H04 · H09: justificar exige motivo, persiste al recargar y guarda una sola vez', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'Justificar', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    await addMissedClass(alumno, alumno.enrollmentIds[0], cleanup);
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);

    // H04: cerrar con la X y con Cancelar no guarda.
    let modal = await abrirJustificar(page);
    await modal.getByRole('button', { name: 'Cerrar' }).click();
    await expect(modal).toHaveCount(0);
    await page.locator('[data-llm-action="justificar-inasistencia-clase-b"]').first().click();
    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(modal).toHaveCount(0);

    // H03: vacío o solo espacios → Guardar deshabilitado.
    await page.locator('[data-llm-action="justificar-inasistencia-clase-b"]').first().click();
    modal = page.getByRole('dialog', { name: 'Justificar inasistencia' });
    const guardar = modal.locator('[data-llm-action="submit-justificacion-clase-b"]');
    const motivo = modal.locator(
      '[data-llm-description="textarea for absence justification reason"]',
    );
    await expect(guardar).toBeDisabled();
    await motivo.fill('   ');
    await expect(guardar).toBeDisabled();

    // H09: doble clic en Guardar → una sola actualización.
    const updates: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/rest/v1/class_b_practice_attendance') && r.method() === 'PATCH')
        updates.push(r.url());
    });
    await motivo.fill('Certificado médico E2E');
    await guardar.dblclick();
    const drawer = page.locator('app-admin-inasistencias-drawer');
    await expect(drawer.getByText('Justificado')).toBeVisible();
    expect(updates.length, 'PATCH a class_b_practice_attendance').toBe(1);

    // H02: "Ver motivo" muestra el texto, y todo sigue igual tras recargar.
    await drawer.locator('[data-llm-action="ver-motivo-justificacion"]').click();
    await expect(page.getByText('Certificado médico E2E')).toBeVisible();
    await page.reload();
    await expect(matricula(page)).toBeVisible(CARGA);
    await expect(page.getByText('Inasistencia — Justificada')).toBeVisible();
  });

  test('H07: si justificar falla, se avisa y la inasistencia sigue sin justificar', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'JustificarFalla', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    await addMissedClass(alumno, alumno.enrollmentIds[0], cleanup);
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    const modal = await abrirJustificar(page);

    await page.route('**/rest/v1/class_b_practice_attendance*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
        : route.continue(),
    );
    await modal
      .locator('[data-llm-description="textarea for absence justification reason"]')
      .fill('x');
    await modal.locator('[data-llm-action="submit-justificacion-clase-b"]').click();

    await expect(
      page.locator('.p-toast-message').filter({ hasText: /No se pudo|Error/i }),
    ).toBeVisible();
    await expect(
      page.locator(
        'app-admin-inasistencias-drawer [data-llm-action="justificar-inasistencia-clase-b"]',
      ),
    ).toBeVisible();
  });

  test('S03: la secretaria de la sede A no puede justificar una inasistencia de la sede B (por API)', async ({
    cleanup,
  }) => {
    const ajeno = await createE2eAlumno(
      { label: 'JustificarAjeno', branchId: SEDE_B, enrollments: [{}] },
      cleanup,
    );
    const sessionId = await addMissedClass(ajeno, ajeno.enrollmentIds[0], cleanup);
    const attendanceId = await attendanceIdOf(sessionId);
    const secretaria = await getClientFor(
      ACCOUNTS.secretariaA.email,
      ACCOUNTS.secretariaA.password,
    );

    const { data } = await secretaria
      .from('class_b_practice_attendance')
      .update({ justification: 'intento E2E desde otra sede' })
      .eq('id', attendanceId)
      .select('id');
    expect(data ?? [], 'filas actualizadas por la secretaria de otra sede').toHaveLength(0);

    const sb = await getAdminClient();
    const { data: fila } = await sb
      .from('class_b_practice_attendance')
      .select('justification')
      .eq('id', attendanceId)
      .single();
    expect(fila!.justification).toBeNull();
  });

  test('M09 · M15: el email se guarda en minúsculas y cancelar descarta lo escrito', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'EmailMayus', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    const NOMBRES = '[data-llm-description="Nombres del alumno"]';
    const EMAIL = '[data-llm-description="Correo electrónico del alumno"]';

    // M15: escribir, cancelar y reabrir → datos originales.
    await hero(page).locator('[data-llm-action="editar-alumno"]').click();
    await page.locator(NOMBRES).fill('Cualquier Cosa');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await hero(page).locator('[data-llm-action="editar-alumno"]').click();
    await expect(page.locator(NOMBRES)).toHaveValue(alumno.firstNames);

    // M09: el email en mayúsculas queda en minúsculas.
    const nuevo = alumno.email.replace('@', '-nuevo@').toUpperCase();
    await page.locator(EMAIL).fill(nuevo);
    await page.locator('[data-llm-action="guardar-perfil-alumno"]').click();
    await expect(page.locator('[data-llm-info="email"]')).toContainText(nuevo.toLowerCase(), CARGA);
  });

  test('O06 · O07: doble clic al confirmar el egreso cambia una sola vez; si falla, sigue activo', async ({
    pageAs,
    cleanup,
  }) => {
    const [doble, falla] = await Promise.all(
      ['EgresoDoble', 'EgresoFalla'].map((label) =>
        createE2eAlumno({ label, branchId: SEDE_A, enrollments: [{}] }, cleanup),
      ),
    );
    await markCertificateSent(doble, doble.enrollmentIds[0], cleanup);
    await markCertificateSent(falla, falla.enrollmentIds[0], cleanup);
    const page = await pageAs('secretariaA');
    const confirmacion = page.locator('[role="dialog"][aria-labelledby="confirm-modal-title"]');

    // O07: el PATCH de la matrícula falla.
    await openFicha(page, 'secretaria', falla.studentId);
    await page.route('**/rest/v1/enrollments?id=eq.*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
        : route.continue(),
    );
    await hero(page).locator('[data-llm-action="marcar-ex-alumno"]').click();
    await confirmacion.getByRole('button', { name: 'Marcar como Ex-Alumno' }).click();
    await expect(
      page.locator('.p-toast-message').filter({ hasText: /No se pudo|Error/i }),
    ).toBeVisible();
    await expect(page.getByText('ESTADO: Activo')).toBeVisible();
    await page.unroute('**/rest/v1/enrollments?id=eq.*');

    // O06: doble clic → un solo PATCH y un solo toast.
    await openFicha(page, 'secretaria', doble.studentId);
    const patches: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/rest/v1/enrollments') && r.method() === 'PATCH') patches.push(r.url());
    });
    await hero(page).locator('[data-llm-action="marcar-ex-alumno"]').click();
    await confirmacion.getByRole('button', { name: 'Marcar como Ex-Alumno' }).dblclick();
    // El toast dura unos segundos: se cuenta apenas aparece.
    const exito = page.getByText('Alumno marcado como ex-alumno correctamente.');
    await expect(exito.first()).toBeVisible();
    await expect(exito).toHaveCount(1);
    await expect(page.getByText('ESTADO: Egresado')).toBeVisible();
    expect(patches.length, 'PATCH a enrollments').toBe(1);
  });

  test('P03: si archivar desde la ficha falla, se avisa y sigue en la ficha', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno({ label: 'ArchivarFalla', branchId: SEDE_A }, cleanup);
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    await page.route('**/rest/v1/students?id=eq.*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
        : route.continue(),
    );

    await hero(page).locator('[data-llm-action="eliminar-alumno"]').click();
    await page
      .getByRole('dialog', { name: /Confirmar archivado de/ })
      .locator('[data-llm-action="confirm-archive-student"]')
      .click();

    await expect(
      page.getByText('No se pudo archivar al alumno. Inténtalo de nuevo.'),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/alumnos/${alumno.studentId}`));
    await expect(matricula(page)).toBeVisible();
  });

  test('T13 (B32): si la carga de Ex-Alumnos falla se muestra un error, no "No se encontraron egresados"', async ({
    pageAs,
  }) => {
    knownBug('B32 (fix-264-m)');
    const page = await pageAs('admin');
    await page.setViewportSize(DESKTOP);
    await page.route('**/rest/v1/enrollments*', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
        : route.continue(),
    );
    await page.goto('/app/admin/ex-alumnos');
    await expect(page.getByText(/No se pudo|Error al cargar/).first()).toBeVisible(CARGA);
    await expect(page.getByText('No se encontraron egresados')).toHaveCount(0);
  });

  test('Z06 (B35): un nombre con "<" o "&" se muestra tal cual en la confirmación de re-matricular', async ({
    pageAs,
    cleanup,
  }) => {
    knownBug('B35 (fix-264-m)');
    const sufijo = String(Date.now()).slice(-6);
    const egresado = await createE2eAlumno(
      {
        label: 'Html',
        branchId: SEDE_A,
        paternalLastName: `Ruiz${sufijo} <i>cursiva</i> & Cía`,
        enrollments: [{ status: 'completed' }],
      },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openExAlumnos(page, 'secretaria');
    await page.locator(SEARCH_EGRESADOS).fill(`Ruiz${sufijo}`);
    await egresadoRow(page, `Ruiz${sufijo}`)
      .locator('[data-llm-action="re-enroll-student"]')
      .click();

    const confirmacion = page.locator('[role="dialog"][aria-labelledby="confirm-modal-title"]');
    await expect(confirmacion).toBeVisible();
    // El texto literal debe verse: si el nombre se interpretara como HTML, "<i>" desaparecería.
    await expect(confirmacion).toContainText(`Ruiz${sufijo} <i>cursiva</i> & Cía`);
    await expect(confirmacion.locator('i', { hasText: 'cursiva' })).toHaveCount(0);
    await confirmacion.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('Y04 (B33): la secretaria multi-sede cambia de sede en Ex-Alumnos y la lista se recarga', async ({
    pageAs,
    cleanup,
  }) => {
    knownBug('B33 (fix-264-m)');
    const [egresadoA, egresadoB] = await Promise.all([
      createE2eAlumno(
        { label: 'EgresadoSedeA', branchId: SEDE_A, enrollments: [{ status: 'completed' }] },
        cleanup,
      ),
      createE2eAlumno(
        { label: 'EgresadoSedeB', branchId: SEDE_B, enrollments: [{ status: 'completed' }] },
        cleanup,
      ),
    ]);
    const page = await pageAs('secretariaMultisede');
    await openExAlumnos(page, 'secretaria');

    await page.locator('[data-llm-action="toggle-branch-dropdown"]').click();
    await page
      .getByRole('listbox', { name: 'Seleccionar sede' })
      .getByRole('option', { name: 'Conductores Chillán' })
      .click();
    await page.locator(SEARCH_EGRESADOS).fill(egresadoB.paternalLastName);
    await expect(egresadoRow(page, egresadoB.paternalLastName)).toHaveCount(1, CARGA);
    await page.locator(SEARCH_EGRESADOS).fill(egresadoA.paternalLastName);
    await expect(egresadoRow(page, egresadoA.paternalLastName)).toHaveCount(0);
  });
});
