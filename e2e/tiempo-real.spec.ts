/**
 * Tiempo real entre dos sesiones (fix-360-m, ASG-i-056).
 * Casos heredados de los checklists 024a (Q02, Q06), 024b (R01, R03) y 025 (U02); Q01 y U01 viven
 * en e2e/alumnos-b-lista.spec.ts y e2e/clase-profesional.spec.ts.
 *
 * "La otra sesión" es el cliente de API con la cuenta admin: para el servidor de tiempo real da lo
 * mismo quién hizo el cambio. Cada test siembra sus alumnos E2E- y los borra al terminar.
 */
import type { Locator, Page } from '@playwright/test';
import { addFutureClass, createE2eAlumno } from './support/alumnos-seed';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

const SEDE_A = 1;
const SEDE_B = 2;
const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };
/** Tiempo que se le da a un evento de tiempo real para llegar y recargar la pantalla. */
const EVENTO = { timeout: 15_000 };

test.describe.configure({ timeout: 90_000 });

const SEARCH_B = '[data-llm-description="Search students by name, RUT or file number"]';
const SEARCH_PROF =
  '[data-llm-description="Search professional students by name, RUT or enrollment number"]';

function rowOf(page: Page, text: string): Locator {
  return page.locator('p-table tbody tr').filter({ hasText: text });
}

async function setStudentStatus(studentId: number, status: 'active' | 'archived'): Promise<void> {
  const sb = await getAdminClient();
  const { error } = await sb.from('students').update({ status }).eq('id', studentId);
  if (error) throw new Error(`[e2e] No se pudo cambiar el estado del alumno: ${error.message}`);
}

/** Abre una lista, espera el paginador y que el canal de tiempo real termine de suscribirse. */
async function openLista(page: Page, path: string, report: RegExp): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(path);
  await expect(page.getByText(report)).toBeVisible(CARGA);
  await page.waitForLoadState('networkidle');
}

test('Q02: archivar y restaurar en otra sesión se refleja en la Base B sin recargar', async ({
  pageAs,
  cleanup,
}) => {
  const alumno = await createE2eAlumno(
    { label: 'VivoB', branchId: SEDE_A, enrollments: [{}] },
    cleanup,
  );
  const page = await pageAs('secretariaA');
  await openLista(page, '/app/secretaria/alumnos', /Mostrando \d+ a \d+ de \d+ alumnos/);
  await page.locator(SEARCH_B).fill(alumno.paternalLastName);
  const row = rowOf(page, alumno.paternalLastName);
  await expect(row).toHaveCount(1);

  await setStudentStatus(alumno.studentId, 'archived');
  await expect(row).toHaveCount(0, EVENTO);
  await setStudentStatus(alumno.studentId, 'active');
  await expect(row).toHaveCount(1, EVENTO);
});

test('Q06: un alumno creado en otra sede no aparece en la lista de esta', async ({
  pageAs,
  cleanup,
}) => {
  const page = await pageAs('secretariaA');
  await openLista(page, '/app/secretaria/alumnos', /Mostrando \d+ a \d+ de \d+ alumnos/);

  const ajeno = await createE2eAlumno(
    { label: 'VivoOtraSede', branchId: SEDE_B, enrollments: [{}] },
    cleanup,
  );
  const propio = await createE2eAlumno(
    { label: 'VivoMiSede', branchId: SEDE_A, enrollments: [{}] },
    cleanup,
  );
  // El propio llega por tiempo real: para cuando aparece, el evento del ajeno ya se procesó.
  await page.locator(SEARCH_B).fill(propio.paternalLastName);
  await expect(rowOf(page, propio.paternalLastName)).toHaveCount(1, EVENTO);
  await page.locator(SEARCH_B).fill(ajeno.paternalLastName);
  await expect(page.getByText('No se encontraron alumnos').locator('visible=true')).toBeVisible();
});

test('U02: archivar y restaurar en otra sesión se refleja en la Base Profesional', async ({
  pageAs,
  cleanup,
}) => {
  const sb = await getAdminClient();
  const { data: promo, error } = await sb
    .from('professional_promotions')
    .select('id')
    .eq('branch_id', SEDE_B)
    .eq('status', 'in_progress')
    .order('start_date', { ascending: false })
    .limit(1)
    .single();
  if (error) throw new Error(`[e2e] No hay promoción en curso en la sede 2: ${error.message}`);
  const { data: course, error: courseErr } = await sb
    .from('promotion_courses')
    .select('id, courses!inner(code)')
    .eq('promotion_id', promo.id)
    .eq('courses.code', 'professional_a2')
    .single();
  if (courseErr) throw new Error(`[e2e] La promoción no tiene curso A2: ${courseErr.message}`);

  const alumno = await createE2eAlumno(
    {
      label: 'VivoProf',
      branchId: SEDE_B,
      enrollments: [{ courseName: 'Profesional A2', promotionCourseId: course.id }],
    },
    cleanup,
  );
  const page = await pageAs('secretariaB');
  await openLista(
    page,
    '/app/secretaria/profesional/alumnos',
    /Mostrando \d+ a \d+ de \d+ matrículas/,
  );
  await page.locator(SEARCH_PROF).fill(alumno.paternalLastName);
  const row = rowOf(page, alumno.paternalLastName);
  await expect(row).toHaveCount(1);

  await setStudentStatus(alumno.studentId, 'archived');
  await expect(row).toHaveCount(0, EVENTO);
  await setStudentStatus(alumno.studentId, 'active');
  await expect(row).toHaveCount(1, EVENTO);
});

test('R01 · R03: la ficha se recarga con un cambio de su alumno y no con el de otro', async ({
  pageAs,
  cleanup,
}) => {
  const abierto = await createE2eAlumno(
    { label: 'VivoFicha', branchId: SEDE_A, enrollments: [{}] },
    cleanup,
  );
  const otro = await createE2eAlumno(
    { label: 'VivoFichaOtro', branchId: SEDE_A, enrollments: [{}] },
    cleanup,
  );
  const page = await pageAs('admin');
  await page.setViewportSize(DESKTOP);
  await page.goto(`/app/admin/alumnos/${abierto.studentId}?enrollment=${abierto.enrollmentIds[0]}`);
  await expect(page.getByText(abierto.rut).first()).toBeVisible(CARGA);
  await page.waitForLoadState('networkidle');

  // Consultas de datos que hace la página a partir de ahora (una recarga de la ficha hace varias).
  let consultas = 0;
  page.on('request', (r) => {
    if (r.method() === 'GET' && r.url().includes('/rest/v1/')) consultas++;
  });

  // R03: una clase agendada a OTRO alumno no recarga esta ficha.
  await addFutureClass(otro.enrollmentIds[0], cleanup);
  await page.waitForTimeout(5_000);
  expect(consultas, 'consultas tras un cambio de otro alumno').toBe(0);

  // R01: una clase agendada a ESTE alumno sí.
  await addFutureClass(abierto.enrollmentIds[0], cleanup);
  await expect
    .poll(() => consultas, { ...EVENTO, message: 'la ficha se recarga' })
    .toBeGreaterThan(0);
});
