/**
 * Acciones masivas sobre el horario de un alumno (fix-364-m, ASG-i-052).
 *
 * Todo ocurre sobre un alumno E2E- propio: 2 inasistencias seguidas (clases 1 y 2), 2 clases
 * futuras agendadas (3 y 4) y 1 clase cancelada de una fecha pasada (5).
 *
 * "Borrar horarios" del Dashboard actúa sobre TODOS los alumnos de la alerta, incluidos los
 * reales de la BD compartida: ese test abre el diálogo y vuelve atrás, nunca confirma.
 */
import type { Page } from '@playwright/test';
import { expect, test, type Cleanup } from './support/fixtures';
import { createE2eAlumno, type E2eAlumno } from './support/alumnos-seed';
import { getAdminClient } from './support/supabase-admin';

test.describe.configure({ mode: 'default', timeout: 120_000 });

const DAY_MS = 24 * 60 * 60 * 1000;

interface Seed {
  alumno: E2eAlumno;
  enrollmentId: number;
  /** Ids de las clases, por número de clase. */
  sessionIds: Record<number, number>;
}

/** Fecha a `days` días de hoy a las 06:15 UTC (03:15 en Chile: sin clases reales). */
function at(days: number): string {
  const when = new Date(Date.now() + days * DAY_MS);
  when.setUTCHours(6, 15, Math.floor(Math.random() * 60), 0);
  return when.toISOString();
}

async function seed(label: string, cleanup: Cleanup): Promise<Seed> {
  const alumno = await createE2eAlumno({ label, branchId: 1, enrollments: [{}] }, cleanup);
  const enrollmentId = alumno.enrollmentIds[0];
  const sb = await getAdminClient();

  const { data: sample, error: sampleErr } = await sb
    .from('class_b_sessions')
    .select('instructor_id, vehicle_id')
    .limit(1)
    .single();
  if (sampleErr) throw new Error(`[e2e] No hay clase de la que copiar: ${sampleErr.message}`);

  // Días distintos y al azar: dos tests en paralelo no le dejan al instructor clases solapadas.
  const past = 3 + Math.floor(Math.random() * 150);
  const future = 400 + Math.floor(Math.random() * 300);
  const rows = [
    { class_number: 1, scheduled_at: at(-past - 2), status: 'no_show' },
    { class_number: 2, scheduled_at: at(-past - 1), status: 'no_show' },
    { class_number: 3, scheduled_at: at(future), status: 'scheduled' },
    { class_number: 4, scheduled_at: at(future + 1), status: 'scheduled' },
    { class_number: 5, scheduled_at: at(-past), status: 'cancelled' },
  ];

  const sessionIds: Record<number, number> = {};
  for (const row of rows) {
    const { data, error } = await sb
      .from('class_b_sessions')
      .insert({
        ...row,
        enrollment_id: enrollmentId,
        instructor_id: sample.instructor_id,
        vehicle_id: sample.vehicle_id,
      })
      .select('id')
      .single();
    if (error)
      throw new Error(`[e2e] No se pudo crear la clase ${row.class_number}: ${error.message}`);
    cleanup.track('class_b_sessions', data.id);
    sessionIds[row.class_number] = data.id;
  }

  for (const classNumber of [1, 2]) {
    const { data, error } = await sb
      .from('class_b_practice_attendance')
      .insert({
        class_b_session_id: sessionIds[classNumber],
        student_id: alumno.studentId,
        status: 'absent',
      })
      .select('id')
      .single();
    if (error) throw new Error(`[e2e] No se pudo registrar la inasistencia: ${error.message}`);
    cleanup.track('class_b_practice_attendance', data.id);
  }

  return { alumno, enrollmentId, sessionIds };
}

async function statuses(enrollmentId: number): Promise<Record<number, string>> {
  const sb = await getAdminClient();
  const { data, error } = await sb
    .from('class_b_sessions')
    .select('class_number, status')
    .eq('enrollment_id', enrollmentId);
  if (error) throw new Error(`[e2e] No se pudieron leer las clases: ${error.message}`);
  return Object.fromEntries((data ?? []).map((s) => [s.class_number, s.status]));
}

const confirmModal = (page: Page, title: string) =>
  page.locator('[role="dialog"][aria-labelledby="confirm-modal-title"]').filter({ hasText: title });

test('Q07/K02: "Borrar horarios" pide confirmación con el detalle y no cancela nada al volver', async ({
  pageAs,
  cleanup,
}) => {
  const { enrollmentId } = await seed('BorrarHorarios', cleanup);

  const page = await pageAs('admin');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/admin/dashboard');
  await page.getByRole('tab', { name: 'Operación de hoy' }).click({ timeout: 30_000 });
  await page.locator('[data-llm-action="ver-todas-alertas-dashboard"]').click({ timeout: 30_000 });

  await expect(page.getByText(/con 2 inasistencias seguidas/).last()).toBeVisible();
  await page.locator('[data-llm-action="execute-alert-action-clear-schedule"]').click();

  const modal = confirmModal(page, 'Borrar horarios');
  await expect(modal).toBeVisible();
  await expect(
    modal.getByText(/Se cancelar(á|án) \d+ clases? futuras? de \d+ alumnos?/),
  ).toBeVisible();
  await page.screenshot({ path: '.playwright-mcp/fix-364-m-borrar-horarios.png' });

  // Sin confirmar: nada cambió.
  expect(await statuses(enrollmentId)).toMatchObject({ 3: 'scheduled', 4: 'scheduled' });

  await modal.locator('[data-llm-action="confirm-modal-cancel"]').click();
  await expect(modal).toBeHidden();
  expect(await statuses(enrollmentId)).toMatchObject({
    1: 'no_show',
    2: 'no_show',
    3: 'scheduled',
    4: 'scheduled',
    5: 'cancelled',
  });
});

test('H06/H09: "Eliminar" y "Reactivar" solo tocan las clases futuras, con confirmación', async ({
  pageAs,
  cleanup,
}) => {
  const { alumno, enrollmentId } = await seed('Reactivar', cleanup);
  const nombre = `${alumno.firstNames} ${alumno.paternalLastName}`;

  const page = await pageAs('admin');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/admin/asistencia');

  // Fila del rail: el contenedor más interno que tiene el nombre y un botón de acción.
  const fila = page
    .locator('div')
    .filter({ hasText: nombre })
    .filter({ has: page.locator('button') })
    .last();

  await fila.locator('[data-llm-action="remove-schedule"]').click({ timeout: 30_000 });
  const eliminar = confirmModal(page, 'Eliminar horario');
  await expect(eliminar.getByText(/clases prácticas futuras/)).toBeVisible();
  await eliminar.locator('[data-llm-action="confirm-modal-accept"]').click();

  await expect(fila.locator('[data-llm-action="reactivate-schedule"]')).toBeVisible();
  expect(await statuses(enrollmentId)).toMatchObject({
    1: 'no_show',
    2: 'no_show',
    3: 'cancelled',
    4: 'cancelled',
    5: 'cancelled',
  });

  // H08 (fix-365-m): tras recargar sigue ofreciendo "Reactivar".
  await page.reload();
  await expect(fila.locator('[data-llm-action="reactivate-schedule"]')).toBeVisible({
    timeout: 30_000,
  });

  await fila.locator('[data-llm-action="reactivate-schedule"]').click();
  const reactivar = confirmModal(page, 'Reactivar horario');
  await expect(reactivar.getByText(/Se volverán a agendar 2 clases futuras/)).toBeVisible();
  await page.screenshot({ path: '.playwright-mcp/fix-364-m-reactivar.png' });
  await reactivar.locator('[data-llm-action="confirm-modal-accept"]').click();

  await expect(fila.locator('[data-llm-action="remove-schedule"]')).toBeVisible();
  // La clase 5, cancelada y de una fecha pasada, NO revive.
  expect(await statuses(enrollmentId)).toMatchObject({
    3: 'scheduled',
    4: 'scheduled',
    5: 'cancelled',
  });
});
