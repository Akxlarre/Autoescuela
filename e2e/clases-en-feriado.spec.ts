/**
 * Spec 0056-b (AC5): la secretaria ve la alerta "clases en día feriado" en su dashboard, para
 * reagendarlas antes del día. El cron que las cancela sin falta (AC1–AC4) se prueba en BD:
 * supabase/tests/agenda/fix-186-b-cron-fin-de-jornada.sql (M09, M10).
 *
 * Siembra un alumno E2E- con una clase en el próximo feriado (a las 03:07, fuera de la grilla
 * para no chocar con clases reales) y lo borra al terminar.
 */
import { createE2eAlumno } from './support/alumnos-seed';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const CARGA = { timeout: 30_000 };

test('AC5: la secretaria ve las clases agendadas en un feriado', async ({ pageAs, cleanup }) => {
  const sb = await getAdminClient();
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  const { data: feriado, error: feriadoErr } = await sb
    .from('holidays')
    .select('date, name')
    .gt('date', hoy)
    .order('date')
    .limit(1)
    .single();
  expect(feriadoErr?.message, 'hace falta un feriado futuro en public.holidays').toBeUndefined();

  const alumno = await createE2eAlumno(
    { label: 'ClaseFeriado', branchId: 1, enrollments: [{}] },
    cleanup,
  );
  const { data: clase, error } = await sb
    .from('class_b_sessions')
    .insert({
      enrollment_id: alumno.enrollmentIds[0],
      instructor_id: 222,
      vehicle_id: 1,
      class_number: 1,
      scheduled_at: `${feriado!.date}T03:07:00-03:00`,
      status: 'scheduled',
    })
    .select('id')
    .single();
  expect(error?.message).toBeUndefined();
  cleanup.track('class_b_sessions', clase!.id);

  const page = await pageAs('secretariaA');
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/app/secretaria/dashboard');

  const alertas = page.getByRole('list', { name: 'Alertas importantes' });
  await expect(alertas.getByText(/\d+ clases? en día feriado/)).toBeVisible(CARGA);
  await expect(alertas.getByText(/hay que reagendarlas/)).toBeVisible();
});
