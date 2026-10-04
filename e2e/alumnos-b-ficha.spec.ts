/**
 * Ficha del alumno Clase B y Ex-Alumnos B (fix-264-m, ASG-i-024).
 * Casos de specs/testing-piloto/024b-ficha-ex-alumnos.md; el ID de cada caso va en el título.
 *
 * Los tests que cambian estado siembran su propio alumno E2E- (e2e/support/alumnos-seed.ts).
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { ACCOUNTS } from './support/accounts';
import {
  addCompletedPractices,
  addMissedClass,
  createE2eAlumno,
  markCertificateSent,
} from './support/alumnos-seed';
import { expect, knownBug, test, watchErrors } from './support/fixtures';
import { getAdminClient, getAnonClient, getClientFor } from './support/supabase-admin';

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

/** Igual que matricula(): para los tests que ya tienen una variable con ese nombre. */
function fichaCargada(page: Page): Locator {
  return matricula(page);
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

  test('F04 · F11 · F13 · E09 (fix-279-m): reprogramar una clase con inasistencia la archiva y queda en el historial', async ({
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
      // El lápiz existe en la tabla y en las tarjetas; en el drawer se ven las tarjetas (fix-290-m).
      const reprogramar = page
        .locator('[data-llm-action="reprogramar-clase"]')
        .locator('visible=true')
        .first();
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

      // E09: en la Ficha Técnica la clase ya no figura como inasistencia; vuelve a poder moverse.
      await page.getByRole('button', { name: 'Cerrar panel' }).click();
      await page.locator('[data-llm-action="ver-ficha-tecnica"]').click();
      const clase = page
        .locator('app-admin-ficha-tecnica .ficha-tarjetas > div')
        .filter({ has: page.getByText('SESIÓN #1', { exact: true }) });
      await expect(clase).toBeVisible();
      await expect(clase).not.toContainText('Inasistencia');
      await expect(clase.locator('[data-llm-action="reprogramar-clase"]')).toBeVisible();
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

  test('M09 · M15 · B36: el email se guarda en minúsculas; cancelar descarta lo escrito y se puede reabrir de inmediato', async ({
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
    // B36 (fix-295-m): se reabre de inmediato, con el panel todavía cerrándose. Antes aparecía
    // con el formulario vacío y, al terminar la animación de salida, se cerraba solo.
    await hero(page).locator('[data-llm-action="editar-alumno"]').click();
    await expect(page.locator(NOMBRES)).toHaveValue(alumno.firstNames);
    // Pasado el tiempo de la animación de salida (250 ms) el panel sigue abierto y con datos.
    await page.waitForTimeout(700);
    await expect(page.locator(NOMBRES)).toHaveValue(alumno.firstNames);

    // M09: el email en mayúsculas queda en minúsculas.
    const nuevo = alumno.email.replace('@', '-nuevo@').toUpperCase();
    await page.locator(EMAIL).fill(nuevo);
    await page.locator('[data-llm-action="guardar-perfil-alumno"]').click();
    // hotfix-135-m: una vez guardado, el aviso "Guarda los cambios antes de enviar la invitación"
    // no se ve en ningún cuadro hasta que el panel se cierra (antes aparecía mientras la ficha
    // se refrescaba, y otra vez durante la animación de cierre).
    await expect(page.getByText('Datos actualizados correctamente.')).toBeVisible(CARGA);
    await page.evaluate(() => {
      const w = window as unknown as { avisoVisto: boolean };
      w.avisoVisto = false;
      const revisar = (): void => {
        if (document.body.innerText.includes('Guarda los cambios antes de enviar')) {
          w.avisoVisto = true;
        }
        requestAnimationFrame(revisar);
      };
      revisar();
    });
    await expect(page.locator('[data-llm-info="email"]')).toContainText(nuevo.toLowerCase(), CARGA);
    await expect(page.locator(EMAIL)).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as unknown as { avisoVisto: boolean }).avisoVisto),
      'el aviso no debe verse después de guardar',
    ).toBe(false);
  });

  test('S18 (hotfix-134-m): guardar el perfil y abrir otro panel enseguida no cierra ese panel', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'CierreDiferido', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);

    await hero(page).locator('[data-llm-action="editar-alumno"]').click();
    await page.locator('#edit-phone').fill('987654321');
    await page.locator('[data-llm-action="guardar-perfil-alumno"]').click();
    // El aviso de éxito marca el inicio del plazo de 1,2 s del cierre automático.
    await expect(page.getByText('Datos actualizados correctamente.')).toBeVisible(CARGA);

    // Dentro de ese plazo: cerrar "Editar Perfil" y abrir la Ficha Técnica.
    await page.getByRole('button', { name: 'Cerrar panel' }).click();
    await page.locator('[data-llm-action="ver-ficha-tecnica"]').click();
    const ficha = page.locator('app-admin-ficha-tecnica');
    await expect(ficha).toBeVisible();

    // Pasado el plazo del cierre diferido, la Ficha Técnica sigue abierta.
    await page.waitForTimeout(1_800);
    await expect(ficha).toBeVisible();
  });

  test('S18 · invitación (fix-296-m): con el correo sin guardar no se puede enviar la invitación', async ({
    pageAs,
    cleanup,
  }) => {
    // Los alumnos E2E- no han activado su cuenta: el bloque de la invitación está visible.
    const alumno = await createE2eAlumno(
      { label: 'Invitacion', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    await hero(page).locator('[data-llm-action="editar-alumno"]').click();

    const EMAIL = '[data-llm-description="Correo electrónico del alumno"]';
    const invitar = page.locator('[data-llm-action="enviar-invitacion-alumno"]');
    const aviso = page.getByText('Guarda los cambios antes de enviar la invitación.');

    await expect(invitar).toBeEnabled();
    await expect(aviso).toHaveCount(0);

    await page.locator(EMAIL).fill(alumno.email.replace('@', '-otro@'));
    await expect(invitar).toBeDisabled();
    await expect(aviso).toBeVisible();

    // El mismo correo en mayúsculas no es un cambio: se guarda en minúsculas.
    await page.locator(EMAIL).fill(alumno.email.toUpperCase());
    await expect(invitar).toBeEnabled();
    await expect(aviso).toHaveCount(0);

    // hotfix-135-m: al cancelar, el aviso no aparece mientras el panel se cierra. Se mira en
    // cada cuadro de la animación de salida, no solo al final.
    await page.evaluate(() => {
      const w = window as unknown as { avisoVisto: boolean };
      w.avisoVisto = false;
      const revisar = (): void => {
        if (document.body.innerText.includes('Guarda los cambios antes de enviar')) {
          w.avisoVisto = true;
        }
        requestAnimationFrame(revisar);
      };
      requestAnimationFrame(revisar);
    });
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator(EMAIL)).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as unknown as { avisoVisto: boolean }).avisoVisto),
      'el aviso no debe verse durante el cierre',
    ).toBe(false);
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

  for (const width of [1600, 1366]) {
    test(`E08 (fix-290-m): a ${width} px la Ficha Técnica muestra el lápiz de reprogramar sin scroll horizontal`, async ({
      pageAs,
      cleanup,
    }) => {
      const alumno = await createE2eAlumno(
        { label: `FichaTecnica${width}`, branchId: SEDE_A, enrollments: [{}] },
        cleanup,
      );
      await addMissedClass(alumno, alumno.enrollmentIds[0], cleanup);
      const page = await pageAs('secretariaA');
      await openFicha(page, 'secretaria', alumno.studentId);
      await page.setViewportSize({ width, height: 900 });

      await page.locator('[data-llm-action="ver-ficha-tecnica"]').click();
      const ficha = page.locator('app-admin-ficha-tecnica');
      // Hay un lápiz por cada clase sin completar; basta el de la primera.
      const lapiz = ficha
        .locator('[data-llm-action="reprogramar-clase"]')
        .locator('visible=true')
        .first();

      await expect(lapiz, 'el lápiz se ve entero, sin desplazar nada').toBeInViewport({ ratio: 1 });
      // Ningún bloque visible de la ficha necesita scroll horizontal. Se reintenta: el drawer
      // entra animando su ancho y a mitad de camino el contenido todavía no cabe.
      await expect
        .poll(
          () =>
            ficha.evaluate(
              (el) =>
                [...el.querySelectorAll<HTMLElement>('*')].filter(
                  (n) =>
                    n.offsetParent !== null &&
                    n.scrollWidth > n.clientWidth + 1 &&
                    n.clientWidth > 200,
                ).length,
            ),
          { message: 'bloques con scroll horizontal' },
        )
        .toBe(0);
    });
  }

  test('Z04 (fix-291-m): a 768 px el nombre del alumno se lee en la cabecera de la ficha', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'Cabecera', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    await page.setViewportSize({ width: 768, height: 900 });

    const nombre = page.locator('app-section-hero h1');
    await expect(nombre).toContainText(alumno.paternalLastName);
    // Antes quedaba en 34 px ("Alum Ap…"): las acciones no bajaban de línea.
    await expect
      .poll(async () => (await nombre.boundingBox())?.width ?? 0, {
        message: 'ancho del nombre en la cabecera',
      })
      .toBeGreaterThan(200);
    await expect(page.getByRole('button', { name: 'Editar Perfil' })).toBeInViewport({ ratio: 1 });
  });

  test('T13 (fix-287-m): si la carga de Ex-Alumnos falla se muestra un error, no "No se encontraron egresados"', async ({
    pageAs,
  }) => {
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

  test('Z06 (fix-284-m): un nombre con "<" o "&" se muestra tal cual en la confirmación de re-matricular', async ({
    pageAs,
    cleanup,
  }) => {
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

  test('Y04 (fix-288-m): la secretaria multi-sede cambia de sede en Ex-Alumnos y la lista se recarga', async ({
    pageAs,
    cleanup,
  }) => {
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

test.describe('tercera pasada (fix-264-m, 2026-10-04)', () => {
  test('B06 · B07 · G02 · I03 · K02: ficha de un alumno sin teléfono, sin clases, sin pagos y sin contrato', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'FichaVacia', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const sb = await getAdminClient();
    const { error } = await sb.from('users').update({ phone: null }).eq('id', alumno.userId);
    expect(error, 'dejar al alumno sin teléfono').toBeNull();

    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);

    // B07: teléfono vacío → "—".
    await expect(page.locator('[data-llm-info="phone"]')).toContainText('—');

    // B06: un correo largo no ensancha su tarjeta (los de prueba miden unos 45 caracteres).
    const email = page.locator('[data-llm-info="email"]');
    await expect(email).toContainText(alumno.email);
    const { correo, tarjeta } = await email.evaluate((el) => {
      const card = el.closest('.bento-card, .card') as HTMLElement;
      return {
        correo: el.getBoundingClientRect().right,
        tarjeta: card.getBoundingClientRect().right,
      };
    });
    expect(correo, 'el correo no se sale de su tarjeta').toBeLessThanOrEqual(tarjeta + 1);

    // G02: sin clases pendientes de reagendar no hay botón "Reagendar Clases".
    await expect(page.getByRole('button', { name: /Reagendar Clases/ })).toHaveCount(0);
    // I03: sin pagos.
    await expect(page.getByText('No hay pagos registrados')).toBeVisible();
    // K02: matrícula presencial sin contrato → no hay botón de contrato.
    await expect(page.getByRole('button', { name: /Contrato/ })).toHaveCount(0);
  });

  test('D03 · E02 · E03: una clase completada muestra avance, kilometraje, observaciones y firmas', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'UnaClase', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    await addCompletedPractices(alumno.enrollmentIds[0], 1, cleanup);
    const sb = await getAdminClient();
    const { error } = await sb
      .from('class_b_sessions')
      .update({
        km_start: 125430,
        km_end: 125462,
        performance_notes: 'Buen dominio del embrague',
        student_signature: true,
        instructor_signature: false,
      })
      .eq('enrollment_id', alumno.enrollmentIds[0]);
    expect(error, 'registrar kilometraje, observación y firma').toBeNull();

    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);

    // D03: con 1 de 12 (8 %) la barra no lleva texto dentro y no se desborda.
    const barra = page.locator('.progress-track').first();
    await expect(barra).toHaveAttribute('aria-valuenow', '8');
    await expect(barra.locator('.progress-label-inline')).toHaveCount(0);
    expect(
      await barra.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      'la barra no se desborda',
    ).toBe(true);

    await page.locator('[data-llm-action="ver-ficha-tecnica"]').click();
    const clase = page
      .locator('app-admin-ficha-tecnica .ficha-tarjetas > div')
      .filter({ has: page.getByText('SESIÓN #1', { exact: true }) });
    // E02: lo que registró el instructor.
    await expect(clase).toContainText('125.430 km');
    await expect(clase).toContainText('125.462 km');
    await expect(clase).toContainText('Buen dominio del embrague');
    // E03: punto de color solo donde hay firma, con su texto al pasar el mouse.
    await expect(clase.locator('.firma-alumno')).toHaveAttribute('title', 'Alumno firmó');
    await expect(clase.locator('.firma-instructor')).toHaveCount(0);
    await expect(clase.locator('.firma-pendiente')).toHaveAttribute(
      'title',
      'Firma instructor pendiente',
    );
  });

  test('M14 · M16: doble clic en "Guardar Cambios" guarda una vez y queda en la auditoría', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'Auditoria', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    let guardados = 0;
    page.on('request', (r) => {
      if (r.url().includes('update-student-profile') && r.method() === 'POST') guardados++;
    });

    await hero(page).locator('[data-llm-action="editar-alumno"]').click();
    await page.locator('#edit-phone').fill('912345678');
    // M14: dos clics seguidos.
    await page.locator('[data-llm-action="guardar-perfil-alumno"]').dblclick();
    await expect(page.locator('[data-llm-info="phone"]')).toContainText('912345678', CARGA);
    expect(guardados, 'pedidos de guardado').toBe(1);

    // M16: el cambio queda en audit_log con el usuario que lo hizo.
    const sb = await getAdminClient();
    await expect
      .poll(
        async () => {
          const { data } = await sb
            .from('audit_log')
            .select('action, user_id')
            .eq('entity', 'users')
            .eq('entity_id', alumno.userId);
          return (data ?? []).filter((r) => /update/i.test(r.action) && r.user_id !== null).length;
        },
        { message: 'UPDATE de users en audit_log, con usuario' },
      )
      .toBeGreaterThan(0);
  });

  test('S01 · S02: admin y secretaria con las dos sedes abren fichas de ambas sedes', async ({
    pageAs,
    cleanup,
  }) => {
    const [deA, deB] = await Promise.all([
      createE2eAlumno({ label: 'FichaSedeA', branchId: SEDE_A, enrollments: [{}] }, cleanup),
      createE2eAlumno({ label: 'FichaSedeB', branchId: SEDE_B, enrollments: [{}] }, cleanup),
    ]);
    for (const [cuenta, portal] of [
      ['admin', 'admin'],
      ['secretariaMultisede', 'secretaria'],
    ] as const) {
      const page = await pageAs(cuenta);
      for (const alumno of [deA, deB]) {
        await openFicha(page, portal, alumno.studentId);
        await expect(matricula(page), `${cuenta} ve la ficha`).toBeVisible();
        await expect(hero(page).locator('h1')).toContainText(alumno.paternalLastName);
      }
    }
  });

  test('J09: el menú de Carnet se cierra con un clic fuera', async ({ pageAs, cleanup }) => {
    const alumno = await createE2eAlumno(
      { label: 'MenuCarnet', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    const menu = page.locator('.card-action-menu[role="menu"]');

    await page.locator('[data-llm-action="carnet-menu"]').click();
    await expect(menu).toBeVisible();
    await page.locator('[data-llm-info="email"]').click();
    await expect(menu, 'un clic fuera lo cierra').toHaveCount(0);

    await page.locator('[data-llm-action="carnet-menu"]').click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu, 'Escape lo cierra').toHaveCount(0);
  });

  test('U07: un egresado del 31 de diciembre de noche queda en el año correcto', async ({
    pageAs,
    cleanup,
  }) => {
    const egresado = await createE2eAlumno(
      { label: 'FinDeAno', branchId: SEDE_A, enrollments: [{ status: 'completed' }] },
      cleanup,
    );
    const sb = await getAdminClient();
    // 31-12-2025 a las 23:30 en Chile (UTC-3 en verano) = 01-01-2026 02:30 UTC.
    const { error } = await sb
      .from('enrollments')
      .update({ completed_at: '2026-01-01T02:30:00Z' })
      .eq('id', egresado.enrollmentIds[0]);
    expect(error, 'fijar la fecha de egreso').toBeNull();

    const page = await pageAs('secretariaA');
    await openExAlumnos(page, 'secretaria');
    await page.locator(SEARCH_EGRESADOS).fill(egresado.paternalLastName);
    const fila = egresadoRow(page, egresado.paternalLastName);
    await expect(fila).toHaveCount(1, CARGA);
    await expect(fila.locator('td').nth(4)).toContainText('2025');

    // Sin búsqueda, el período "2025" lo incluye y "2026" no.
    await page.locator(SEARCH_EGRESADOS).fill('');
    await page.getByRole('combobox', { name: 'Período de egreso' }).click();
    await page.getByRole('option', { name: '2025', exact: true }).click();
    await page.locator(SEARCH_EGRESADOS).fill('');
    await expect(
      page.locator('p-table tbody').getByText(egresado.paternalLastName),
      'aparece al elegir el año 2025',
    ).toHaveCount(1);
  });

  /**
   * Deja un reagendamiento ya registrado en una matrícula de prueba: una clase a futuro y su fila
   * en el historial, con razón "Médica".
   */
  async function addReschedule(
    enrollmentId: number,
    cleanup: { track(table: string, id: string | number): void },
  ): Promise<void> {
    const sb = await getAdminClient();
    const { data: sample } = await sb
      .from('class_b_sessions')
      .select('instructor_id, vehicle_id')
      .limit(1)
      .single();
    const antes = new Date(Date.now() + (400 + Math.floor(Math.random() * 300)) * 86_400_000);
    antes.setUTCHours(6, 15, Math.floor(Math.random() * 60), 0);
    const despues = new Date(antes.getTime() + 86_400_000);
    const { data: sesion, error: sesionErr } = await sb
      .from('class_b_sessions')
      .insert({
        enrollment_id: enrollmentId,
        instructor_id: sample!.instructor_id,
        vehicle_id: sample!.vehicle_id,
        class_number: 1,
        scheduled_at: despues.toISOString(),
        status: 'scheduled',
      })
      .select('id')
      .single();
    if (sesionErr) throw new Error(`[e2e] No se pudo agendar la clase: ${sesionErr.message}`);
    cleanup.track('class_b_sessions', sesion.id);
    const { data: fila, error: filaErr } = await sb
      .from('class_b_reschedule_history')
      .insert({
        class_session_id: sesion.id,
        enrollment_id: enrollmentId,
        old_scheduled_at: antes.toISOString(),
        new_scheduled_at: despues.toISOString(),
        old_instructor_id: sample!.instructor_id,
        new_instructor_id: sample!.instructor_id,
        reason: 'medica',
      })
      .select('id')
      .single();
    if (filaErr)
      throw new Error(`[e2e] No se pudo registrar el reagendamiento: ${filaErr.message}`);
    cleanup.track('class_b_reschedule_history', fila.id);
  }

  const cerrarPanel = (page: Page) => page.getByRole('button', { name: 'Cerrar panel' }).click();

  test('N06 · N07 · C07 (S14): el historial de reagendamientos es el de la matrícula elegida', async ({
    pageAs,
    cleanup,
  }) => {
    const haceUnAno = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const alumno = await createE2eAlumno(
      {
        label: 'HistorialDos',
        branchId: SEDE_A,
        enrollments: [
          { status: 'completed', createdAt: haceUnAno },
          { courseName: 'Refuerzo Clase B' },
        ],
      },
      cleanup,
    );
    const [antigua, refuerzo] = alumno.enrollmentNumbers;
    // El reagendamiento es de la matrícula antigua; la de refuerzo no tiene ninguno.
    await addReschedule(alumno.enrollmentIds[0], cleanup);

    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    const panel = page.locator('app-admin-historial-reagendamientos');

    await expect(matricula(page)).toContainText(refuerzo);
    await page.locator('[data-llm-action="ver-reagendamientos"]').click();
    await expect(panel, 'la de refuerzo no tiene').toContainText('Sin reagendamientos registrados');

    // C07: con el panel abierto, el selector de matrículas sigue a la vista y no queda debajo.
    const tabs = page.locator('app-tabs');
    await expect(tabs).toBeVisible();
    const [cajaTabs, cajaPanel] = await Promise.all([
      tabs.boundingBox(),
      page.locator('app-layout-drawer').boundingBox(),
    ]);
    expect(cajaTabs!.x + cajaTabs!.width, 'el selector no queda bajo el panel').toBeLessThanOrEqual(
      cajaPanel!.x + 1,
    );

    // N07: al elegir la matrícula antigua, el panel muestra su reagendamiento.
    await tabs.getByText(antigua).click();
    await expect(matricula(page)).toContainText(antigua);
    await expect(panel, 'historial de la matrícula antigua').toContainText('Médica');

    // …y al volver a la de refuerzo, queda vacío otra vez.
    await tabs.getByText(refuerzo).click();
    await expect(matricula(page)).toContainText(refuerzo);
    await expect(panel).toContainText('Sin reagendamientos registrados');
  });

  test('N08 (S14): la ficha de un alumno sin reagendamientos no muestra los del alumno anterior', async ({
    pageAs,
    cleanup,
  }) => {
    const [conHistorial, sinHistorial] = await Promise.all([
      createE2eAlumno({ label: 'ConReagenda', branchId: SEDE_A, enrollments: [{}] }, cleanup),
      createE2eAlumno({ label: 'SinReagenda', branchId: SEDE_A, enrollments: [{}] }, cleanup),
    ]);
    await addReschedule(conHistorial.enrollmentIds[0], cleanup);

    const page = await pageAs('secretariaA');
    await page.setViewportSize(DESKTOP);
    await page.goto('/app/secretaria/alumnos');
    await expect(page.getByText(REPORT_ALUMNOS)).toBeVisible(CARGA);
    const panel = page.locator('app-admin-historial-reagendamientos');
    const abrirFicha = async (apellido: string) => {
      await page.locator(SEARCH_ALUMNOS).fill(apellido);
      await page
        .locator('p-table tbody tr')
        .filter({ hasText: apellido })
        .getByRole('button', { name: 'Ver ficha' })
        .click();
      await expect(matricula(page)).toBeVisible(CARGA);
      await page.locator('[data-llm-action="ver-reagendamientos"]').click();
    };

    await abrirFicha(conHistorial.paternalLastName);
    await expect(panel).toContainText('Médica');
    await cerrarPanel(page);

    // Navegación interna (sin recargar la app): la ficha siguiente no hereda el historial.
    await page.goBack();
    await expect(page.getByText(REPORT_ALUMNOS)).toBeVisible(CARGA);
    await abrirFicha(sinHistorial.paternalLastName);
    await expect(panel).toContainText('Sin reagendamientos registrados');
    await expect(panel).not.toContainText('Médica');
  });

  test('I04 · I05 · I07 · D09: estados de pago, lista larga con scroll propio, y pago y clase nuevos al volver a la ficha', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      // Parte debiendo: la base no acepta pagos por más que el saldo de la matrícula.
      {
        label: 'MuchosPagos',
        branchId: SEDE_A,
        enrollments: [{ paymentStatus: 'pending', totalPaid: 0, pendingBalance: 100_000 }],
      },
      cleanup,
    );
    const sb = await getAdminClient();
    const pago = (monto: number, status: string, dia: number) => ({
      enrollment_id: alumno.enrollmentIds[0],
      type: 'enrollment',
      total_amount: monto,
      cash_amount: monto,
      transfer_amount: 0,
      card_amount: 0,
      voucher_amount: 0,
      status,
      payment_date: `2026-09-${String(dia).padStart(2, '0')}`,
      requires_receipt: false,
    });
    const insertarPagos = async (filas: ReturnType<typeof pago>[]) => {
      const { data, error } = await sb.from('payments').insert(filas).select('id');
      expect(error, 'sembrar pagos').toBeNull();
      for (const p of data ?? []) cleanup.track('payments', p.id);
    };
    await insertarPagos([
      ...Array.from({ length: 12 }, (_, i) => pago(1000 + i, 'paid', i + 1)),
      pago(2222, 'pending', 20),
      pago(3333, 'cancelled', 21),
    ]);

    const page = await pageAs('secretariaA');
    await page.setViewportSize(DESKTOP);
    await page.goto('/app/secretaria/alumnos');
    await expect(page.getByText(REPORT_ALUMNOS)).toBeVisible(CARGA);
    await page.locator(SEARCH_ALUMNOS).fill(alumno.paternalLastName);
    await page
      .locator('p-table tbody tr')
      .filter({ hasText: alumno.paternalLastName })
      .getByRole('button', { name: 'Ver ficha' })
      .click();
    await expect(matricula(page)).toBeVisible(CARGA);
    const financiero = page.locator('app-admin-historial-pagos');
    const filaDe = (monto: string) =>
      financiero.locator('.ficha-pagos-scroll > div').filter({ hasText: monto });

    // I04: cada pago con su estado; uno pendiente o anulado no se muestra como "Pagado".
    await expect(filaDe('$1.000')).toContainText('Pagado');
    await expect(filaDe('$2.222')).toContainText('Pendiente');
    await expect(filaDe('$3.333')).toContainText('Cancelado');
    await expect(filaDe('$3.333')).not.toContainText('Pagado');

    // I05: con 14 pagos la lista tiene scroll propio y la página no crece.
    const lista = financiero.locator('.ficha-pagos-scroll');
    expect(
      await lista.evaluate((el) => el.scrollHeight > el.clientHeight + 1),
      'la lista de pagos scrollea por dentro',
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
      'el documento no scrollea',
    ).toBe(true);
    await lista.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(filaDe('$3.333')).toBeInViewport();

    // I07 · D09: un pago y una clase cerrada registrados mientras se está en otra pantalla
    // aparecen al volver a la ficha, sin recargar la app.
    const barra = page.locator('.progress-track').first();
    await expect(barra).toHaveAttribute('aria-valuenow', '0');
    await page.goBack();
    await expect(page.getByText(REPORT_ALUMNOS)).toBeVisible(CARGA);
    await insertarPagos([pago(4444, 'paid', 22)]);
    await addCompletedPractices(alumno.enrollmentIds[0], 1, cleanup);
    await page.goForward();
    await expect(filaDe('$4.444')).toHaveCount(1, CARGA);
    await expect(barra).toHaveAttribute('aria-valuenow', '8');
  });

  test('H05: un motivo de justificación largo se lee con scroll dentro del modal', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'MotivoLargo', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const sessionId = await addMissedClass(alumno, alumno.enrollmentIds[0], cleanup);
    const motivo = Array.from(
      { length: 40 },
      (_, i) => `Línea ${i + 1} del certificado médico presentado por el alumno.`,
    ).join('\n');
    const sb = await getAdminClient();
    const { error } = await sb
      .from('class_b_practice_attendance')
      .update({ status: 'excused', justification: motivo })
      .eq('class_b_session_id', sessionId);
    expect(error, 'dejar la inasistencia justificada').toBeNull();

    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    await page.locator('[data-llm-action="ver-inasistencias"]').click();
    await page.locator('[data-llm-action="ver-motivo-justificacion"]').click();

    const modal = page.getByRole('dialog', { name: 'Motivo de justificación' });
    const texto = modal.getByText('Línea 1 del certificado');
    await expect(texto).toBeVisible();
    expect(
      await texto.evaluate((el) => el.scrollHeight > el.clientHeight + 1),
      'el texto scrollea dentro del modal',
    ).toBe(true);
    // El modal cabe en la pantalla: el botón "Cerrar" se alcanza sin mover la página.
    const cerrar = modal.getByRole('button', { name: 'Cerrar', exact: true }).last();
    await expect(cerrar).toBeInViewport();
    await texto.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(modal.getByText('Línea 40 del certificado')).toBeInViewport();
    await cerrar.click();
    await expect(modal).toHaveCount(0);
  });

  test('N01 · N05: los consentimientos de un alumno se ven completos; solo el admin puede revocar', async ({
    pageAs,
  }) => {
    // Solo lectura sobre datos existentes: `consents` no se puede borrar (es prueba legal), así
    // que un test no puede sembrar los suyos.
    const sb = await getAdminClient();
    const { data: otorgados } = await sb
      .from('consents')
      .select('user_id')
      .eq('granted', true)
      .is('revoked_at', null)
      .not('user_id', 'is', null)
      .limit(200);
    const userIds = [...new Set((otorgados ?? []).map((c) => c.user_id as number))];
    const { data: candidatos } = await sb
      .from('students')
      .select('id, enrollments!inner(license_group, status)')
      .in('user_id', userIds.length ? userIds : [-1])
      .eq('status', 'active')
      .eq('enrollments.license_group', 'class_b')
      .eq('enrollments.status', 'active')
      .limit(1);
    test.skip(!candidatos?.length, 'Ningún alumno Clase B activo tiene consentimientos vigentes');
    const studentId = candidatos![0].id as number;

    for (const [cuenta, portal] of [
      ['admin', 'admin'],
      ['secretariaMultisede', 'secretaria'],
    ] as const) {
      const page = await pageAs(cuenta);
      await openFicha(page, portal, studentId);
      await page.locator('[data-llm-action="ver-consentimientos"]').click();
      const panel = page.locator('app-admin-consentimientos-drawer');
      const otorgado = panel.locator('article').filter({ hasText: 'Otorgado' }).first();

      // N01: tipo, estado, fecha, origen, versión e IP.
      await expect(otorgado).toBeVisible(CARGA);
      await expect(otorgado.locator('.item-title')).not.toBeEmpty();
      for (const campo of ['Fecha', 'Origen', 'Versión de política', 'Dirección IP']) {
        await expect(otorgado.locator('dt', { hasText: campo })).toBeVisible();
      }
      await expect(otorgado.locator('dd').first()).toHaveText(/\d{2}-\d{2}-\d{4}/);

      // N05: "Registrar revocación" solo para el admin.
      await expect(
        panel.locator('[data-llm-action="revocar-consentimiento"]'),
        `${cuenta}: botón de revocar`,
      ).toHaveCount(
        cuenta === 'admin'
          ? await panel.locator('article').filter({ hasText: 'Otorgado' }).count()
          : 0,
      );
    }
  });

  test('F07 (S20): al reprogramar, un horario que choca con otra clase del alumno no se puede elegir', async ({
    pageAs,
    cleanup,
  }) => {
    interface Slot {
      instructor_id: number;
      vehicle_id: number;
      slot_start: string;
      slot_status: string;
    }
    const alumno = await createE2eAlumno(
      { label: 'ChoqueHora', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    await addMissedClass(alumno, alumno.enrollmentIds[0], cleanup);
    const sb = await getAdminClient();
    const page = await pageAs('secretariaA');
    const panel = page.locator('app-admin-reprogramar-clase-drawer');
    const horarios = panel.locator('[data-llm-action="seleccionar-slot-reprogramar"]');
    const hora = (iso: string) =>
      new Date(iso).toLocaleTimeString('es-CL', {
        timeZone: 'America/Santiago',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    const dia = (iso: string) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date(iso));

    /** Abre "reprogramar" para la clase #1 y elige al primer instructor; devuelve su grilla. */
    const abrirGrilla = async (): Promise<Slot[]> => {
      await openFicha(page, 'secretaria', alumno.studentId);
      await page.locator('[data-llm-action="ver-ficha-tecnica"]').click();
      await page
        .locator('[data-llm-action="reprogramar-clase"]')
        .locator('visible=true')
        .first()
        .click();
      const respuesta = page.waitForResponse((r) =>
        r.url().includes('/rest/v1/v_class_b_schedule_availability'),
      );
      await panel.locator('[data-llm-action="seleccionar-instructor-reprogramar"]').first().click();
      const filas = (await (await respuesta).json()) as Slot[];
      await expect(horarios.first()).toBeVisible(CARGA);
      return filas;
    };

    // 1. Un horario libre del primer día de la grilla, que otro instructor también tenga libre.
    const grilla = await abrirGrilla();
    const primerDia = dia(grilla[0].slot_start);
    let elegido: Slot | null = null;
    let otro: Slot | null = null;
    for (const slot of grilla) {
      if (dia(slot.slot_start) !== primerDia || slot.slot_status !== 'available') continue;
      const { data } = await sb
        .from('v_class_b_schedule_availability')
        .select('instructor_id, vehicle_id, slot_start, slot_status')
        .eq('slot_start', slot.slot_start)
        .eq('slot_status', 'available')
        .neq('instructor_id', slot.instructor_id)
        .limit(1);
      if (data?.length) {
        elegido = slot;
        otro = data[0] as Slot;
        break;
      }
    }
    test.skip(!elegido || !otro, 'Ningún horario del primer día está libre para dos instructores');
    const texto = hora(elegido!.slot_start);
    await expect(horarios.filter({ hasText: `${texto} –` }), 'antes: se puede elegir').toHaveCount(
      1,
    );

    // 2. El alumno ya tiene la clase #2 a esa misma hora, con el otro instructor.
    const { data: clase2, error } = await sb
      .from('class_b_sessions')
      .insert({
        enrollment_id: alumno.enrollmentIds[0],
        instructor_id: otro!.instructor_id,
        vehicle_id: otro!.vehicle_id,
        class_number: 2,
        scheduled_at: elegido!.slot_start,
        status: 'scheduled',
      })
      .select('id')
      .single();
    expect(error, 'agendar la clase #2').toBeNull();
    cleanup.track('class_b_sessions', clase2!.id);

    // 3. Ese horario ya no se ofrece para la clase #1.
    await abrirGrilla();
    await expect(
      horarios.filter({ hasText: `${texto} –` }),
      'el horario que choca no se puede elegir',
    ).toHaveCount(0);
  });

  test('F07 (fix-301-m): la base rechaza una segunda clase del alumno a la misma hora', async ({
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'ChoqueBase', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const sb = await getAdminClient();
    // Dos instructores distintos: el choque del instructor ya lo impide otro trigger.
    const { data: muestras } = await sb
      .from('class_b_sessions')
      .select('instructor_id, vehicle_id')
      .limit(500);
    const primero = muestras![0];
    const segundo = muestras!.find((m) => m.instructor_id !== primero.instructor_id);
    test.skip(!segundo, 'No hay clases de dos instructores distintos de las que copiar');

    const cuando = new Date(Date.now() + (400 + Math.floor(Math.random() * 300)) * 86_400_000);
    cuando.setUTCHours(6, 15, Math.floor(Math.random() * 60), 0);
    const clase = (numero: number, de: { instructor_id: number; vehicle_id: number }) => ({
      enrollment_id: alumno.enrollmentIds[0],
      instructor_id: de.instructor_id,
      vehicle_id: de.vehicle_id,
      class_number: numero,
      scheduled_at: cuando.toISOString(),
      status: 'scheduled',
    });

    const una = await sb.from('class_b_sessions').insert(clase(1, primero)).select('id').single();
    expect(una.error, 'primera clase').toBeNull();
    cleanup.track('class_b_sessions', una.data!.id);

    const otra = await sb.from('class_b_sessions').insert(clase(2, segundo!)).select('id').single();
    if (otra.data) cleanup.track('class_b_sessions', otra.data.id);
    expect(otra.error?.message, 'segunda clase a la misma hora').toMatch(
      /alumno ya tiene otra clase/i,
    );

    // Una clase cancelada a esa hora sí se acepta: no ocupa al alumno.
    const cancelada = await sb
      .from('class_b_sessions')
      .insert({ ...clase(3, segundo!), status: 'cancelled' })
      .select('id')
      .single();
    if (cancelada.data) cleanup.track('class_b_sessions', cancelada.data.id);
    expect(cancelada.error, 'clase cancelada a la misma hora').toBeNull();
  });

  test('fix-302-m: a 1366 px Ex-Alumnos B muestra cada fila en una línea', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('/app/admin/ex-alumnos');
    await expect(page.getByText(REPORT_EGRESADOS)).toBeVisible(CARGA);

    const tabla = page.locator('p-table .p-datatable-table-container').first();
    const { scroll, client, altoRut, altoNombre } = await tabla.evaluate((el) => {
      // Alto del texto de una celda: una sola línea mide menos de 24 px.
      const alto = (nodo: Element): number => {
        const range = document.createRange();
        range.selectNodeContents(nodo);
        return Math.round(range.getBoundingClientRect().height);
      };
      return {
        scroll: el.scrollWidth,
        client: el.clientWidth,
        altoRut: [...el.querySelectorAll('tbody tr td:nth-child(2)')].map(alto),
        altoNombre: [...el.querySelectorAll('tbody tr td:first-child .item-title')].map(alto),
      };
    });
    expect(scroll, 'sin scroll horizontal').toBeLessThanOrEqual(client + 1);
    expect(altoRut.length, 'hay filas').toBeGreaterThan(0);
    expect(Math.max(...altoRut), 'el RUT va en una sola línea').toBeLessThan(24);
    expect(Math.max(...altoNombre), 'el nombre va en una sola línea').toBeLessThan(24);
    await expect(
      page.locator('p-table tbody tr').first().locator('[data-llm-action="re-enroll-student"]'),
      'el botón de re-matricular se ve entero',
    ).toBeInViewport({ ratio: 1 });
  });

  test('Z05: la ficha se recorre solo con teclado, con el foco a la vista, y Escape cierra menús y modales', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'Teclado', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    await addMissedClass(alumno, alumno.enrollmentIds[0], cleanup);
    const page = await pageAs('admin');
    await openFicha(page, 'admin', alumno.studentId);

    // Todo lo que se puede accionar en la ficha (no el menú lateral ni la barra superior).
    const total = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      const candidatos = [
        ...main.querySelectorAll<HTMLElement>('button, a[href], [role="tab"], [tabindex="0"]'),
      ].filter(
        (el) =>
          !(el as HTMLButtonElement).disabled &&
          el.getAttribute('aria-hidden') !== 'true' &&
          el.offsetParent !== null,
      );
      candidatos.forEach((el, i) => el.setAttribute('data-z05', String(i)));
      return candidatos.length;
    });
    expect(total, 'acciones en la ficha').toBeGreaterThan(5);

    // Tab hasta dar la vuelta completa: qué acciones recibieron el foco y si el foco se ve.
    const alcanzados = new Map<string, boolean>();
    for (let i = 0; i < 200; i++) {
      await page.keyboard.press('Tab');
      const foco = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const id = el?.getAttribute('data-z05');
        if (!el || id == null) return null;
        const cs = getComputedStyle(el);
        const contorno = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        return { id, visible: contorno || cs.boxShadow !== 'none' };
      });
      if (foco) alcanzados.set(foco.id, foco.visible);
      if (alcanzados.size === total) break;
    }

    const descripcion = (id: string) =>
      page
        .locator(`[data-z05="${id}"]`)
        .evaluate(
          (el) =>
            el.getAttribute('data-llm-action') ??
            el.getAttribute('aria-label') ??
            el.textContent?.trim().slice(0, 40) ??
            el.tagName,
        );
    const sinAlcanzar: string[] = [];
    for (let i = 0; i < total; i++) {
      if (!alcanzados.has(String(i))) sinAlcanzar.push(await descripcion(String(i)));
    }
    expect(sinAlcanzar, 'acciones a las que no se llega con Tab').toEqual([]);
    const sinFocoVisible: string[] = [];
    for (const [id, visible] of alcanzados) {
      if (!visible) sinFocoVisible.push(await descripcion(id));
    }
    expect(sinFocoVisible, 'acciones sin foco visible').toEqual([]);

    // Menú de Carnet: se abre con Enter y se cierra con Escape.
    const menu = page.locator('.card-action-menu[role="menu"]');
    await page.locator('[data-llm-action="carnet-menu"]').focus();
    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    // Modal de archivar: se abre con Enter desde la cabecera y se cierra con Escape.
    await hero(page)
      .getByRole('button', { name: /Eliminar Alumno/ })
      .focus();
    await page.keyboard.press('Enter');
    const modal = page.getByRole('dialog').filter({ hasText: /Archivar/ });
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);

    // Panel lateral (Inasistencias): se abre con Enter y se cierra desde su botón, con el
    // teclado. Los paneles no son modales y no se cierran con Escape (ninguno de la app).
    await page.locator('[data-llm-action="ver-inasistencias"]').focus();
    await page.keyboard.press('Enter');
    const panel = page.locator('app-admin-inasistencias-drawer');
    await expect(panel).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar panel' }).focus();
    await page.keyboard.press('Enter');
    await expect(panel).toHaveCount(0);
  });

  /**
   * Desde Ex-Alumnos, re-matricula al egresado y llega al paso 1 del wizard. Si la sede tiene
   * borradores pendientes, pasa por la lista de borradores y elige "Nueva matrícula".
   * Devuelve si esa lista apareció.
   */
  async function reMatricular(page: Page, apellido: string): Promise<boolean> {
    await page.locator(SEARCH_EGRESADOS).fill(apellido);
    await egresadoRow(page, apellido).locator('[data-llm-action="re-enroll-student"]').click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    const borradores = page.locator('app-draft-list');
    const nombres = page.locator('#firstNames');
    await expect(borradores.or(nombres).first()).toBeVisible(CARGA);
    const huboLista = await borradores.isVisible();
    if (huboLista) await borradores.locator('[data-llm-action="start-new-enrollment"]').click();
    await expect(nombres).toBeVisible(CARGA);
    return huboLista;
  }

  test('W03 · W04: con borradores pendientes y el RUT guardado sin puntos, el paso 1 llega precargado', async ({
    pageAs,
    cleanup,
  }) => {
    const [egresado, conBorrador] = await Promise.all([
      createE2eAlumno(
        { label: 'RematSinPuntos', branchId: SEDE_A, enrollments: [{ status: 'completed' }] },
        cleanup,
      ),
      createE2eAlumno(
        { label: 'BorradorSede', branchId: SEDE_A, enrollments: [{ status: 'draft' }] },
        cleanup,
      ),
    ]);
    const sb = await getAdminClient();
    // W04: el RUT como lo deja el seed, sin puntos.
    const rutSinPuntos = egresado.rut.replace(/\./g, '');
    const { error: rutErr } = await sb
      .from('users')
      .update({ rut: rutSinPuntos })
      .eq('id', egresado.userId);
    expect(rutErr, 'guardar el RUT sin puntos').toBeNull();
    // W03: un borrador vigente en la sede hace aparecer la lista de borradores.
    const { error: draftErr } = await sb
      .from('enrollments')
      .update({ expires_at: new Date(Date.now() + 86_400_000).toISOString() })
      .eq('id', conBorrador.enrollmentIds[0]);
    expect(draftErr, 'dejar el borrador vigente').toBeNull();

    const page = await pageAs('secretariaA');
    await openExAlumnos(page, 'secretaria');
    const huboLista = await reMatricular(page, egresado.paternalLastName);

    expect(huboLista, 'apareció la lista de borradores').toBe(true);
    await expect(page.locator('#firstNames')).toHaveValue(egresado.firstNames);
    await expect(page.locator('#paternalLastName')).toHaveValue(egresado.paternalLastName);
    await expect(page.locator('#maternalLastName')).toHaveValue(egresado.maternalLastName);
    await expect(page.locator('#phone')).toHaveValue(/900000000/);
  });

  test('W06 · W07: "Reiniciar" vuelve a precargar al egresado; re-matricular a otro precarga al otro', async ({
    pageAs,
    cleanup,
  }) => {
    const [primero, segundo] = await Promise.all([
      createE2eAlumno(
        { label: 'RematPrimero', branchId: SEDE_A, enrollments: [{ status: 'completed' }] },
        cleanup,
      ),
      createE2eAlumno(
        { label: 'RematSegundo', branchId: SEDE_A, enrollments: [{ status: 'completed' }] },
        cleanup,
      ),
    ]);
    const page = await pageAs('secretariaA');
    await openExAlumnos(page, 'secretaria');
    const nombres = page.locator('#firstNames');
    const apellido = page.locator('#paternalLastName');

    await reMatricular(page, primero.paternalLastName);
    await expect(apellido).toHaveValue(primero.paternalLastName);

    // W07: "Reiniciar" borra lo escrito y vuelve a precargar al mismo egresado.
    await nombres.fill('Otro nombre');
    await page.getByRole('button', { name: 'Reiniciar' }).click();
    await expect(nombres).toHaveValue(primero.firstNames, CARGA);
    await expect(apellido).toHaveValue(primero.paternalLastName);

    // W06: cerrar sin matricular y re-matricular a otro egresado precarga al otro.
    await cerrarPanel(page);
    await expect(nombres).toHaveCount(0);
    await reMatricular(page, segundo.paternalLastName);
    await expect(nombres).toHaveValue(segundo.firstNames);
    await expect(apellido).toHaveValue(segundo.paternalLastName);
    await expect(page.locator('#rut')).toHaveValue(new RegExp(segundo.rut.slice(-5)));
  });
});

test.describe('cuarta pasada: PDF reales (fix-264-m, 2026-10-04)', () => {
  // Las funciones generan el PDF de verdad y lo guardan en Storage: más lentas que el resto.
  test.describe.configure({ timeout: 150_000 });
  const GENERAR = { timeout: 60_000 };

  /** PDF válido mínimo, para sembrar un contrato sin pasar por el wizard. */
  const PDF_MINIMO = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF',
  );

  function visor(page: Page): Locator {
    return page.locator('app-dms-viewer-modal iframe[title="Visor PDF"]');
  }

  /** Borra de Storage todo lo que haya en las carpetas dadas (los archivos los crea la app). */
  async function limpiarStorage(carpetas: string[]): Promise<void> {
    const sb = await getAdminClient();
    for (const carpeta of carpetas) {
      const { data } = await sb.storage.from('documents').list(carpeta);
      const rutas = (data ?? []).map((o) => `${carpeta}/${o.name}`);
      if (!rutas.length) continue;
      const { error } = await sb.storage.from('documents').remove(rutas);
      expect(error, `borrar de Storage ${carpeta}`).toBeNull();
    }
  }

  /** Deja un contrato (archivo en Storage + fila) para una matrícula de prueba. */
  async function addContrato(
    enrollmentId: number,
    cleanup: { track(table: string, id: string | number): void },
  ): Promise<string> {
    const sb = await getAdminClient();
    const ruta = `contracts/${enrollmentId}/contract.pdf`;
    const subida = await sb.storage
      .from('documents')
      .upload(ruta, PDF_MINIMO, { contentType: 'application/pdf', upsert: true });
    expect(subida.error, 'subir el contrato de prueba').toBeNull();
    const { data, error } = await sb
      .from('digital_contracts')
      .insert({
        enrollment_id: enrollmentId,
        file_name: 'E2E-contrato.pdf',
        file_url: ruta,
        accepted_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    expect(error, 'registrar el contrato de prueba').toBeNull();
    cleanup.track('digital_contracts', data!.id);
    return ruta;
  }

  test('J02 · J03 · J06 · J07: el carnet de 6 clases se genera sin foto, se ve y se vuelve a generar', async ({
    pageAs,
    cleanup,
  }, testInfo) => {
    const alumno = await createE2eAlumno(
      { label: 'Carnet', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const enrollmentId = alumno.enrollmentIds[0];
    await addCompletedPractices(enrollmentId, 2, cleanup);
    const sb = await getAdminClient();
    const page = await pageAs('secretariaA');
    const errores = watchErrors(page);
    await openFicha(page, 'secretaria', alumno.studentId);
    const menu = page.locator('[data-llm-action="carnet-menu"]');

    try {
      // J02 · J06: generar (el alumno de prueba no tiene foto) abre el visor con el PDF.
      await menu.click();
      await expect(page.locator('[data-llm-action="ver-carnet-6"]')).toBeDisabled();
      await page.locator('[data-llm-action="generar-carnet-6"]').click();
      await expect(visor(page)).toBeVisible(GENERAR);
      const { data: matricula } = await sb
        .from('enrollments')
        .select('license_initial_url, license_full_url')
        .eq('id', enrollmentId)
        .single();
      expect(matricula!.license_initial_url, 'ruta del carnet de 6').toContain(
        `student-licenses/${enrollmentId}/`,
      );
      expect(matricula!.license_full_url, 'el de 12 no se generó').toBeNull();

      // J03: el archivo queda adjunto al reporte para revisarlo a ojo.
      const descarga = await sb.storage
        .from('documents')
        .download(matricula!.license_initial_url as string);
      expect(descarga.error, 'descargar el carnet').toBeNull();
      const destino = testInfo.outputPath('carnet-6.pdf');
      writeFileSync(destino, Buffer.from(await descarga.data!.arrayBuffer()));
      await testInfo.attach('carnet-6.pdf', { path: destino });

      // Tras recargar, "Ver" está habilitado y "Generar" pasó a "Volver a generar".
      await page.reload();
      await expect(fichaCargada(page)).toBeVisible(CARGA);
      await menu.click();
      const ver = page.locator('[data-llm-action="ver-carnet-6"]');
      await expect(ver).toBeEnabled();
      await expect(page.locator('[data-llm-action="generar-carnet-6"]')).toContainText(
        'Volver a generar',
      );
      await ver.click();
      await expect(visor(page)).toBeVisible(GENERAR);

      // J07: volver a generar reemplaza el archivo (misma ruta, un solo archivo).
      await page.reload();
      await expect(fichaCargada(page)).toBeVisible(CARGA);
      await menu.click();
      await page.locator('[data-llm-action="generar-carnet-6"]').click();
      await expect(visor(page)).toBeVisible(GENERAR);
      const { data: archivos } = await sb.storage
        .from('documents')
        .list(`student-licenses/${enrollmentId}`);
      expect(archivos ?? [], 'un solo carnet en Storage').toHaveLength(1);
      errores.expectClean();
    } finally {
      await limpiarStorage([`student-licenses/${enrollmentId}`]);
    }
  });

  test('J04: en un curso de refuerzo el menú solo ofrece el carnet de 6 clases', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      {
        label: 'CarnetRefuerzo',
        branchId: SEDE_A,
        enrollments: [{ courseName: 'Refuerzo Clase B' }],
      },
      cleanup,
    );
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    await page.locator('[data-llm-action="carnet-menu"]').click();
    await expect(page.locator('[data-llm-action="generar-carnet-6"]')).toBeVisible();
    await expect(page.locator('[data-llm-action="generar-carnet-12"]')).toHaveCount(0);
    await expect(page.locator('[data-llm-action="ver-carnet-12"]')).toHaveCount(0);
  });

  test('J08 (S2 · spec 0009-i): sin una sesión real no se puede generar el carnet de una matrícula (por API)', async ({
    cleanup,
  }) => {
    // La función exige un usuario real con rol de admin o secretaria (spec 0009-i). Con la anon
    // key sola, como un visitante del sitio, responde 401 y no genera nada.
    //
    // La sede NO se valida en el servidor, por decisión tomada en esa misma spec (Ignacio,
    // 2026-10-01): una secretaria puede generar por API el carnet de una matrícula de otra sede.
    // No es un bug de este módulo; este test no lo afirma ni lo niega.
    const alumno = await createE2eAlumno(
      { label: 'CarnetSinSesion', branchId: SEDE_B, enrollments: [{}] },
      cleanup,
    );
    const enrollmentId = alumno.enrollmentIds[0];
    try {
      const { data, error } = await getAnonClient().functions.invoke(
        'generate-student-license-pdf',
        { body: { enrollment_id: enrollmentId, variant: 'initial' } },
      );
      expect(data?.pdfUrl, 'no devuelve el carnet').toBeUndefined();
      expect((error as { context?: Response } | null)?.context?.status, 'HTTP 401').toBe(401);
      const sb = await getAdminClient();
      const { data: archivos } = await sb.storage
        .from('documents')
        .list(`student-licenses/${enrollmentId}`);
      expect(archivos ?? [], 'no se generó ningún archivo').toHaveLength(0);
    } finally {
      await limpiarStorage([`student-licenses/${enrollmentId}`]);
    }
  });

  test('K01: una matrícula presencial con contrato ofrece "Ver Contrato" y abre el PDF', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'ContratoPresencial', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const enrollmentId = alumno.enrollmentIds[0];
    try {
      await addContrato(enrollmentId, cleanup);
      const page = await pageAs('secretariaA');
      await openFicha(page, 'secretaria', alumno.studentId);
      await page.locator('[data-llm-action="ver-contrato"]').click();
      await expect(visor(page)).toBeVisible(GENERAR);
    } finally {
      await limpiarStorage([`contracts/${enrollmentId}`]);
    }
  });

  test('K03 · K04 · K05: contrato online sin firmar → descargar, rechazar un archivo que no es PDF y subir el firmado', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'ContratoOnline', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const enrollmentId = alumno.enrollmentIds[0];
    const sb = await getAdminClient();
    const { error } = await sb
      .from('enrollments')
      .update({ registration_channel: 'online' })
      .eq('id', enrollmentId);
    expect(error, 'dejar la matrícula como online').toBeNull();

    try {
      await addContrato(enrollmentId, cleanup);
      const page = await pageAs('secretariaA');
      await openFicha(page, 'secretaria', alumno.studentId);
      const menu = page.locator('[data-llm-action="contrato-menu"]');
      const archivo = page.locator('input[type="file"][accept="application/pdf"]');
      const firmado = async () =>
        (
          await sb
            .from('digital_contracts')
            .select('signed_contract_url')
            .eq('enrollment_id', enrollmentId)
            .single()
        ).data?.signed_contract_url ?? null;

      // K03: sin firmar, el botón es un menú con "Descargar" y "Subir Firmado".
      await expect(page.locator('[data-llm-action="ver-contrato"]')).toHaveCount(0);
      await menu.click();
      await expect(page.locator('[data-llm-action="subir-contrato-firmado"]')).toBeVisible();
      const [descarga] = await Promise.all([
        page.waitForEvent('download', GENERAR),
        page.locator('[data-llm-action="descargar-contrato"]').click(),
      ]);
      expect(descarga.suggestedFilename()).toBe('Contrato.pdf');

      // K04: un archivo que no es PDF se rechaza con un aviso y no queda como contrato firmado.
      await archivo.setInputFiles({
        name: 'no-es-un-contrato.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('esto no es un PDF'),
      });
      await expect(
        page.getByText('El contrato firmado debe ser un archivo PDF.'),
        'aviso de formato',
      ).toBeVisible();
      await expect(page.getByText('Contrato firmado subido correctamente.')).toHaveCount(0);
      expect(await firmado(), 'no se registró el archivo').toBeNull();

      // K05: el PDF firmado se sube y el botón pasa a "Ver Contrato".
      await archivo.setInputFiles({
        name: 'contrato-firmado.pdf',
        mimeType: 'application/pdf',
        buffer: PDF_MINIMO,
      });
      await expect(page.getByText('Contrato firmado subido correctamente.')).toBeVisible(GENERAR);
      expect(await firmado()).toBe(`contracts/${enrollmentId}/signed_contract.pdf`);
      const ver = page.locator('[data-llm-action="ver-contrato"]');
      await expect(ver).toBeVisible();
      await expect(menu).toHaveCount(0);
      await ver.click();
      await expect(visor(page)).toBeVisible(GENERAR);
    } finally {
      await limpiarStorage([`contracts/${enrollmentId}`]);
    }
  });

  test('L02 · L04 · L05 · L07: con 12 clases cerradas (sin nota) el certificado se genera, se vuelve a ver y avisa al alumno', async ({
    pageAs,
    cleanup,
  }, testInfo) => {
    const alumno = await createE2eAlumno(
      { label: 'Certificado', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const enrollmentId = alumno.enrollmentIds[0];
    // L04: las 12 clases están cerradas sin nota de evaluación.
    await addCompletedPractices(enrollmentId, 12, cleanup);
    const sb = await getAdminClient();
    const page = await pageAs('secretariaA');
    await openFicha(page, 'secretaria', alumno.studentId);
    const boton = page.locator('[data-llm-action="generar-certificado"]');

    try {
      // L05: generar abre el visor y el botón pasa a "Ver Certificado".
      await expect(boton).toContainText('Generar Certificado');
      await expect(boton).toBeEnabled();
      await boton.click();
      await expect(visor(page)).toBeVisible(GENERAR);
      const { data: matricula } = await sb
        .from('enrollments')
        .select('certificate_b_pdf_url')
        .eq('id', enrollmentId)
        .single();
      expect(matricula!.certificate_b_pdf_url, 'ruta del certificado').toContain(
        `certificates/${enrollmentId}/`,
      );
      const descarga = await sb.storage
        .from('documents')
        .download(matricula!.certificate_b_pdf_url as string);
      const destino = testInfo.outputPath('certificado.pdf');
      writeFileSync(destino, Buffer.from(await descarga.data!.arrayBuffer()));
      await testInfo.attach('certificado.pdf', { path: destino });

      // L07: el alumno recibe el aviso de que su certificado está listo.
      await expect
        .poll(
          async () => {
            const { data } = await sb
              .from('notifications')
              .select('id')
              .eq('recipient_id', alumno.userId)
              .eq('reference_type', 'certificate');
            return (data ?? []).length;
          },
          { message: 'aviso al alumno', timeout: 15_000 },
        )
        .toBe(1);

      // L02: ya generado, el botón dice "Ver Certificado" y abre el mismo PDF.
      await page.reload();
      await expect(fichaCargada(page)).toBeVisible(CARGA);
      await expect(boton).toContainText('Ver Certificado');
      await boton.click();
      await expect(visor(page)).toBeVisible(GENERAR);
    } finally {
      // Certificado, registro de emisión, avisos y archivo los crea la función: se borran.
      const { data: certs } = await sb
        .from('certificates')
        .select('id')
        .eq('enrollment_id', enrollmentId);
      for (const c of certs ?? []) {
        cleanup.track('certificates', c.id);
        const { data: logs } = await sb
          .from('certificate_issuance_log')
          .select('id')
          .eq('certificate_id', c.id);
        for (const l of logs ?? []) cleanup.track('certificate_issuance_log', l.id);
      }
      const { data: avisos } = await sb
        .from('notifications')
        .select('id')
        .eq('recipient_id', alumno.userId);
      for (const n of avisos ?? []) cleanup.track('notifications', n.id);
      await limpiarStorage([`certificates/${enrollmentId}`]);
    }
  });

  test('L06: si la función rechaza el certificado, se muestra el motivo real', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'CertRechazo', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    await addCompletedPractices(alumno.enrollmentIds[0], 12, cleanup);
    const motivo = 'El alumno no cumple el mínimo de clases prácticas completadas (11/12).';
    const page = await pageAs('secretariaA');
    // El rechazo se simula con la misma forma que usa la función real (HTTP 400 + error).
    await page.route('**/functions/v1/generate-certificate-b-pdf', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.continue();
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: motivo }),
      });
    });
    await openFicha(page, 'secretaria', alumno.studentId);
    await page.locator('[data-llm-action="generar-certificado"]').click();
    await expect(page.getByText(motivo)).toBeVisible();
    await expect(visor(page)).toHaveCount(0);
  });
});

test.describe('cierre de la asignación (fix-264-m, 2026-10-04)', () => {
  test('M13: un alumno con la cuenta ya activada no ve el aviso de invitación', async ({
    pageAs,
    cleanup,
  }) => {
    const alumno = await createE2eAlumno(
      { label: 'CuentaActiva', branchId: SEDE_A, enrollments: [{}] },
      cleanup,
    );
    const sb = await getAdminClient();
    const page = await pageAs('admin');
    const invitar = page.locator('[data-llm-action="enviar-invitacion-alumno"]');
    const abrirEditar = async (): Promise<void> => {
      await openFicha(page, 'admin', alumno.studentId);
      await hero(page).locator('[data-llm-action="editar-alumno"]').click();
      await expect(page.locator('#edit-phone')).toBeVisible();
    };
    /** Deja al alumno como si tuviera cuenta: con identificador de Auth y, o no, primer ingreso. */
    const dejarCuenta = async (firstLogin: boolean): Promise<void> => {
      const { data, error } = await sb
        .from('users')
        .update({ supabase_uid: randomUUID(), first_login: firstLogin })
        .eq('id', alumno.userId)
        .select('id');
      expect(error, 'marcar la cuenta').toBeNull();
      expect(data, 'fila actualizada').toHaveLength(1);
    };

    // Sin cuenta (como nace un alumno): el aviso de invitación está.
    await abrirEditar();
    await expect(invitar).toBeVisible();

    // Con cuenta creada pero sin haber entrado nunca: sigue estando.
    await dejarCuenta(true);
    await abrirEditar();
    await expect(invitar).toBeVisible();

    // M13: con la cuenta ya activada (entró y cambió su clave), el aviso no aparece.
    await dejarCuenta(false);
    await abrirEditar();
    await expect(invitar).toHaveCount(0);
    await expect(page.getByText(/invitaci[oó]n/i)).toHaveCount(0);
  });
});
