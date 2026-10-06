/**
 * Testing de la Agenda Clase B y el Triple Match (ASG-i-026, fix-186-b).
 * Checklist: specs/testing-piloto/026-agenda-triple-match.md — los IDs de cada test (A01, C05…)
 * son los del checklist. Las reglas de BD (O02, O03, L01–L03, S2/S3/S6/S19/S20) se prueban en
 * supabase/tests/agenda/fix-186-b-triple-match-bd.sql, no acá.
 *
 * ⚠️ Correr contra un BUILD DE PRODUCCIÓN servido en localhost:4200 (ver e2e/auth-sesion.spec.ts).
 *
 * La Agenda es de solo lectura: estos tests no agendan nada desde la UI. Los que necesitan clases
 * (E02, E03, E04) siembran un alumno E2E- con 2 clases la semana siguiente y las borran al final.
 */
import { expect, knownBug, test, watchErrors, type Cleanup } from './support/fixtures';
import { createE2eAlumno } from './support/alumnos-seed';
import { getAdminClient } from './support/supabase-admin';
import type { Page } from '@playwright/test';
import type { E2eRole } from './support/accounts';

test.describe.configure({ mode: 'default', timeout: 90_000 });

const AGENDA: Record<E2eRole, string> = {
  admin: '/app/admin/agenda',
  secretariaA: '/app/secretaria/agenda',
  secretariaB: '/app/secretaria/agenda',
  secretariaMultisede: '/app/secretaria/agenda',
};

/** Instructor de la sede 1 usado para sembrar clases (id 223 del seed, vehículo 2). */
const SEED_INSTRUCTOR = { id: 223, vehicleId: 2, name: 'Instructor2 Apellido2' };
const SEDE1_INSTRUCTOR = 'Instructor1 Apellido1';
const SEDE2_INSTRUCTOR = 'Instructor9 Apellido9';

/** Abre la Agenda y espera la grilla (la vista de disponibilidad es lenta contra la BD del piloto). */
async function openAgenda(page: Page, role: E2eRole): Promise<void> {
  await page.goto(AGENDA[role]);
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 30_000 });
}

function grid(page: Page) {
  return page.getByRole('grid');
}

function weekLabel(page: Page) {
  return page.locator('.agenda-week-label');
}

/** Espera a que termine la recarga de la semana (el skeleton reemplaza la grilla). */
async function waitWeekLoaded(page: Page): Promise<void> {
  await expect(grid(page)).toBeVisible({ timeout: 30_000 });
}

async function selectInstructor(page: Page, name: string): Promise<void> {
  await page.locator('[data-llm-description="Filtrar calendario por instructor"]').click();
  await page.getByRole('option', { name, exact: true }).click();
  await expect(
    page.locator('[data-llm-description="Filtrar calendario por instructor"]'),
  ).toContainText(name);
}

async function instructorOptions(page: Page): Promise<string[]> {
  await page.locator('[data-llm-description="Filtrar calendario por instructor"]').click();
  const options = await page.getByRole('option').allInnerTexts();
  await page.keyboard.press('Escape');
  return options.map((o) => o.trim());
}

/** Lunes (YYYY-MM-DD, hora Chile) de la semana que viene. */
function nextMondayIso(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const day = now.getDay() || 7;
  now.setDate(now.getDate() - day + 1 + 7);
  return now.toISOString().slice(0, 10);
}

interface SeededClasses {
  studentName: string;
  scheduledAt: string;
  completedAt: string;
}

/**
 * Alumno E2E- de la sede 1 con 2 clases la semana siguiente con SEED_INSTRUCTOR: una agendada y una
 * completada (KM 1000 → 1025). Los horarios salen de la vista de disponibilidad, así que no chocan.
 */
async function seedClasses(cleanup: Cleanup): Promise<SeededClasses> {
  const alumno = await createE2eAlumno(
    { label: 'Agenda', branchId: 1, enrollments: [{}] },
    cleanup,
  );
  const sb = await getAdminClient();
  const monday = nextMondayIso();
  const { data: slots, error } = await sb
    .from('v_class_b_schedule_availability')
    .select('slot_start')
    .eq('instructor_id', SEED_INSTRUCTOR.id)
    .eq('slot_status', 'available')
    .gte('slot_start', `${monday}T00:00:00-03:00`)
    .lt('slot_start', `${monday}T23:59:00-03:00`)
    .order('slot_start')
    .limit(4);
  if (error || !slots || slots.length < 3)
    throw new Error(`[e2e] Sin horarios libres el ${monday} para el instructor: ${error?.message}`);

  // slots[0] y slots[2]: no contiguos, para que la regla de "2 por día" no importe a la vista.
  const rows = [
    { scheduled_at: slots[0].slot_start, status: 'scheduled', class_number: 1 },
    {
      scheduled_at: slots[2].slot_start,
      status: 'completed',
      class_number: 2,
      km_start: 1000,
      km_end: 1025,
      completed_at: new Date().toISOString(),
    },
  ];
  for (const row of rows) {
    const { data, error: insErr } = await sb
      .from('class_b_sessions')
      .insert({
        ...row,
        enrollment_id: alumno.enrollmentIds[0],
        instructor_id: SEED_INSTRUCTOR.id,
        vehicle_id: SEED_INSTRUCTOR.vehicleId,
      })
      .select('id')
      .single();
    if (insErr) throw new Error(`[e2e] No se pudo sembrar la clase: ${insErr.message}`);
    cleanup.track('class_b_sessions', data.id);
  }
  return {
    studentName: `${alumno.firstNames} ${alumno.paternalLastName}`,
    scheduledAt: slots[0].slot_start,
    completedAt: slots[2].slot_start,
  };
}

// ── A. Carga y acceso ─────────────────────────────────────────────────────────

test.describe('A. Carga y acceso', () => {
  test('A01: admin abre la Agenda — grilla sin errores de consola ni de red', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    const errors = watchErrors(page);
    await openAgenda(page, 'admin');
    errors.expectClean(); // incluye P09: sin advertencias de claves duplicadas en @for (S19)
  });

  test('A02: secretaria (sede 1) abre la Agenda — solo instructores de su sede', async ({
    pageAs,
  }) => {
    const page = await pageAs('secretariaA');
    const errors = watchErrors(page);
    await openAgenda(page, 'secretariaA');
    const options = await instructorOptions(page);
    expect(options).toContain(SEDE1_INSTRUCTOR);
    expect(options).not.toContain(SEDE2_INSTRUCTOR);
    errors.expectClean();
  });

  test('A03: secretaria escribe /app/admin/agenda → su dashboard', async ({ pageAs }) => {
    const page = await pageAs('secretariaA');
    await page.goto('/app/admin/agenda');
    await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, { timeout: 30_000 });
  });

  for (const role of ['admin', 'secretariaA'] as const) {
    test(`A04: ${role} — menú lateral → Agenda`, async ({ pageAs }) => {
      const page = await pageAs(role);
      await page.goto(role === 'admin' ? '/app/admin/dashboard' : '/app/secretaria/dashboard');
      await page.locator(`[data-llm-nav="${AGENDA[role]}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${AGENDA[role]}$`));
      await waitWeekLoaded(page);
    });
  }

  test('A06: F5 vuelve a la semana actual', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await openAgenda(page, 'admin');
    const current = await weekLabel(page).innerText();
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await expect(weekLabel(page)).not.toHaveText(current);
    await page.reload();
    await waitWeekLoaded(page);
    await expect(weekLabel(page)).toHaveText(current);
  });

  test('A10: desktop — app-like: el documento no scrollea, la grilla sí por dentro', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAgenda(page, 'admin');
    const doc = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      client: document.documentElement.clientHeight,
    }));
    expect(doc.scroll).toBeLessThanOrEqual(doc.client + 1);
  });

  test('A08: si la carga falla, la Agenda lo dice (S11)', async ({ pageAs }) => {
    knownBug('S11 (fix-186-b)');
    const page = await pageAs('admin');
    await page.route('**/rest/v1/v_class_b_schedule_availability**', (r) => r.abort());
    await page.route('**/rest/v1/class_b_sessions**', (r) => r.abort());
    await page.goto(AGENDA.admin);
    await expect(page.getByText(/error al cargar la agenda/i)).toBeVisible({ timeout: 30_000 });
  });
});

// ── B. Grilla ─────────────────────────────────────────────────────────────────

test.describe('B. Grilla', () => {
  test('B01/B02: lunes a viernes, hoy destacado, 13 bloques de 08:30 a 20:00', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openAgenda(page, 'admin');
    await expect(grid(page).locator('.agenda-day-header')).toHaveCount(5);
    const isWeekday = [1, 2, 3, 4, 5].includes(
      new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getDay(),
    );
    await expect(grid(page).locator('.agenda-day-header--today')).toHaveCount(isWeekday ? 1 : 0);
    const rows = grid(page).getByRole('rowheader');
    await expect(rows).toHaveCount(13);
    await expect(rows.first()).toHaveText('08:30');
    await expect(rows.last()).toHaveText('20:00');
  });
});

// ── C. Navegación de semanas y límite ─────────────────────────────────────────

test.describe('C. Navegación de semanas', () => {
  test('C01–C03: siguiente, anterior y "Hoy"', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await openAgenda(page, 'admin');
    const current = await weekLabel(page).innerText();
    const hoy = page.locator('[data-llm-action="go-to-today"]');
    await expect(hoy).toHaveCount(0);

    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await waitWeekLoaded(page);
    await expect(weekLabel(page)).not.toHaveText(current);
    await expect(hoy).toBeVisible();

    await page.getByRole('button', { name: 'Semana anterior' }).click();
    await page.getByRole('button', { name: 'Semana anterior' }).click();
    await waitWeekLoaded(page);
    await expect(weekLabel(page)).not.toHaveText(current);

    await hoy.click();
    await waitWeekLoaded(page);
    await expect(weekLabel(page)).toHaveText(current);
    await expect(hoy).toHaveCount(0);
  });

  test('C04/C05: 20 clics rápidos en "siguiente" nunca pasan del límite y la grilla no navega sola', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openAgenda(page, 'admin');
    const next = page.getByRole('button', { name: 'Semana siguiente' });
    for (let i = 0; i < 20; i++) {
      if (await next.isDisabled()) break;
      await next.click({ timeout: 2_000 }).catch(() => undefined);
    }
    await waitWeekLoaded(page);
    await expect(next).toBeDisabled({ timeout: 30_000 });
    const settled = await weekLabel(page).innerText();
    await page.waitForTimeout(3_000);
    await expect(weekLabel(page)).toHaveText(settled);

    // Ningún día visible es posterior al límite sin estar marcado como fuera de rango.
    await expect(grid(page).locator('.agenda-day-header').first()).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  test('C06: dentro del límite, la semana 6 todavía ofrece horarios "Disponible" (S3)', async ({
    pageAs,
  }) => {
    knownBug('S3 (fix-186-b) — la vista solo genera 28 días');
    const page = await pageAs('admin');
    await openAgenda(page, 'admin');
    await selectInstructor(page, SEDE1_INSTRUCTOR);
    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: 'Semana siguiente' }).click();
      await waitWeekLoaded(page);
    }
    await expect(grid(page).locator('[data-llm-action="view-available-slot"]').first()).toBeVisible(
      {
        timeout: 15_000,
      },
    );
  });
});

// ── D. Filtro de instructor ───────────────────────────────────────────────────

test.describe('D. Filtro de instructor', () => {
  test('D01/D03/D06: con un instructor elegido, la grilla solo muestra los suyos y el filtro se mantiene al cambiar de semana', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openAgenda(page, 'admin');
    const filter = page.locator('[data-llm-description="Filtrar calendario por instructor"]');
    await expect(filter).not.toContainText('Todos los instructores'); // D01: hay uno preseleccionado

    await selectInstructor(page, SEDE1_INSTRUCTOR);
    const slots = grid(page).locator('app-agenda-slot');
    await expect(slots.first()).toBeVisible({ timeout: 15_000 });
    for (const label of await slots.evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label') ?? ''),
    )) {
      expect(label).toContain(SEDE1_INSTRUCTOR);
    }

    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await waitWeekLoaded(page);
    await expect(filter).toContainText(SEDE1_INSTRUCTOR);
  });

  test('D02/D09: limpiar el filtro muestra la vista maestra ("N libres") (S15 resuelta en parte)', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openAgenda(page, 'admin');
    await page.locator('[data-llm-action="clear-agenda-filters"]').first().click();
    await expect(page.locator('.cell-pill--available').first()).toBeVisible({ timeout: 15_000 });
  });
});

// ── E. Detalle de slot ────────────────────────────────────────────────────────

test.describe('E. Detalle de slot', () => {
  test('E01/E09: un horario libre abre "Horario disponible", sin botón para agendar, y se cierra', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openAgenda(page, 'admin');
    await selectInstructor(page, SEDE1_INSTRUCTOR);
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await waitWeekLoaded(page);
    await grid(page)
      .locator('app-agenda-slot')
      .filter({ has: page.locator('[data-llm-action="view-available-slot"]') })
      .first()
      .click();
    await expect(
      page.locator('app-agenda-slot-detail-drawer').getByText('Horario disponible'),
    ).toBeVisible();
    const drawer = page.locator('app-agenda-slot-detail-drawer');
    await expect(drawer.getByRole('button')).toHaveText(['Cerrar detalle']); // único botón: solo lectura
    await page.getByRole('button', { name: 'Cerrar detalle' }).click();
    await expect(page.getByRole('button', { name: 'Cerrar detalle' })).toHaveCount(0);
  });

  test('E01b: el horario libre no promete "Clic para agendar" si el detalle es de solo lectura (S18, hotfix-060-b)', async ({
    pageAs,
  }) => {
    const page = await pageAs('admin');
    await openAgenda(page, 'admin');
    await selectInstructor(page, SEDE1_INSTRUCTOR);
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await waitWeekLoaded(page);
    const libre = grid(page)
      .locator('app-agenda-slot')
      .filter({ has: page.locator('[data-llm-action="view-available-slot"]') })
      .first();
    await expect(libre).toBeVisible();
    expect(await libre.getAttribute('aria-label')).not.toMatch(/agendar/i);
  });

  test('E02/E04: clase agendada y clase completada muestran su detalle (alumno, KM)', async ({
    pageAs,
    cleanup,
  }) => {
    const seeded = await seedClasses(cleanup);
    const page = await pageAs('admin');
    await openAgenda(page, 'admin');
    await selectInstructor(page, SEED_INSTRUCTOR.name);
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await waitWeekLoaded(page);

    // La variante compacta de una clase completada no muestra el nombre como texto: se filtra por aria-label.
    const clases = grid(page).locator(`app-agenda-slot[aria-label^="${seeded.studentName},"]`);
    await expect(clases).toHaveCount(2, { timeout: 15_000 });
    const drawer = page.locator('app-agenda-slot-detail-drawer');

    await clases.first().click();
    await expect(drawer.getByText(seeded.studentName)).toBeVisible();
    await expect(drawer.locator('.status-pill')).toHaveText('Agendada');
    await page.getByRole('button', { name: 'Cerrar detalle' }).click();

    await clases.last().click();
    await expect(drawer.locator('.status-pill')).toHaveText('Completada');
    await expect(drawer.getByText('1000 km')).toBeVisible();
    await expect(drawer.getByText('1025 km')).toBeVisible();
    await expect(drawer.getByText('Distancia recorrida: 25 km')).toBeVisible();
  });

  test('E03: la pastilla "Agendada" del detalle tiene color (S18, hotfix-060-b)', async ({
    pageAs,
    cleanup,
  }) => {
    const seeded = await seedClasses(cleanup);
    const page = await pageAs('admin');
    await openAgenda(page, 'admin');
    await selectInstructor(page, SEED_INSTRUCTOR.name);
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await waitWeekLoaded(page);
    await grid(page)
      .locator(`app-agenda-slot[aria-label^="${seeded.studentName},"]`)
      .first()
      .click();
    const pill = page.locator('app-agenda-slot-detail-drawer .status-pill');
    await expect(pill).toHaveText('Agendada');
    // Con un token inexistente, `background: color-mix(… var(--state-brand) …)` queda inválido → transparente.
    expect(await pill.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      'rgba(0, 0, 0, 0)',
    );
  });
});

// ── F. Sedes ──────────────────────────────────────────────────────────────────

test.describe('F. Sedes', () => {
  test('F01: admin con "Todas las sedes" ve instructores de las 2 sedes', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await openAgenda(page, 'admin');
    const options = await instructorOptions(page);
    expect(options).toContain(SEDE1_INSTRUCTOR);
    expect(options).toContain(SEDE2_INSTRUCTOR);
  });

  test('F04: secretaria sede 2 no ve instructores ni clases de la sede 1', async ({ pageAs }) => {
    const page = await pageAs('secretariaB');
    await openAgenda(page, 'secretariaB');
    const options = await instructorOptions(page);
    expect(options).toContain(SEDE2_INSTRUCTOR);
    expect(options).not.toContain(SEDE1_INSTRUCTOR);
  });
});

// ── P. Responsive ─────────────────────────────────────────────────────────────

test.describe('P. Responsive', () => {
  for (const width of [375, 768, 1440]) {
    test(`P02/P04: ${width}px sin scroll horizontal del documento`, async ({ pageAs }) => {
      const page = await pageAs('admin');
      await page.setViewportSize({ width, height: 900 });
      await openAgenda(page, 'admin');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      if (width === 375)
        await expect(page.getByRole('tablist', { name: 'Seleccionar día' })).toBeVisible();
    });
  }
});

// ── K. Ciclo de vida de la clase (Asistencia B, como secretaria) ──────────────

interface TodayClasses {
  studentName: string;
  studentUserId: number;
  sessionIds: number[];
  /** Hora local (HH:MM) de cada clase, en el mismo orden que sessionIds. */
  times: string[];
}

/**
 * Alumno E2E- de la sede 1 con `count` clases HOY con SEED_INSTRUCTOR, en los últimos horarios
 * libres del día, no contiguos. Si ya es tarde y no quedan, el test se salta.
 */
async function seedTodayClasses(cleanup: Cleanup, count: number): Promise<TodayClasses> {
  const alumno = await createE2eAlumno({ label: 'Ciclo', branchId: 1, enrollments: [{}] }, cleanup);
  const sb = await getAdminClient();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const { data: slots, error } = await sb
    .from('v_class_b_schedule_availability')
    .select('slot_start')
    .eq('instructor_id', SEED_INSTRUCTOR.id)
    .eq('slot_status', 'available')
    .gte('slot_start', new Date().toISOString())
    .lt('slot_start', `${today}T23:59:00-03:00`)
    .order('slot_start', { ascending: false })
    .limit(count * 2);
  const picked = (slots ?? [])
    .filter((_, i) => i % 2 === 0)
    .slice(0, count)
    .reverse();
  if (error || picked.length < count)
    test.skip(
      true,
      `Quedan menos de ${count} horarios libres hoy (${error?.message ?? 'es tarde'})`,
    );

  const sessionIds: number[] = [];
  for (const [i, slot] of picked.entries()) {
    const { data, error: insErr } = await sb
      .from('class_b_sessions')
      .insert({
        enrollment_id: alumno.enrollmentIds[0],
        instructor_id: SEED_INSTRUCTOR.id,
        vehicle_id: SEED_INSTRUCTOR.vehicleId,
        class_number: i + 1,
        scheduled_at: slot.slot_start,
        status: 'scheduled',
      })
      .select('id')
      .single();
    if (insErr) throw new Error(`[e2e] No se pudo sembrar la clase de hoy: ${insErr.message}`);
    cleanup.track('class_b_sessions', data.id);
    sessionIds.push(data.id);
  }
  return {
    studentName: `${alumno.firstNames} ${alumno.paternalLastName}`,
    studentUserId: alumno.userId,
    sessionIds,
    times: picked.map((s) =>
      new Date(s.slot_start).toLocaleTimeString('es-CL', {
        timeZone: 'America/Santiago',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    ),
  };
}

/**
 * Lo que el ciclo de la clase escribe fuera de las filas sembradas: asistencia (FK sin cascada),
 * notificaciones del trigger de clase completada y el KM del vehículo. Se registra para el teardown
 * (que borra en orden inverso, antes que las clases) y el KM vuelve a su valor original.
 */
async function trackCycleSideEffects(
  cleanup: Cleanup,
  seeded: TodayClasses,
  since: string,
  kmOriginal: number,
): Promise<void> {
  const sb = await getAdminClient();
  const { data: att } = await sb
    .from('class_b_practice_attendance')
    .select('id')
    .in('class_b_session_id', seeded.sessionIds);
  for (const a of att ?? []) cleanup.track('class_b_practice_attendance', a.id);
  const { data: notifs } = await sb
    .from('notifications')
    .select('id')
    .gte('created_at', since)
    .or(`recipient_id.eq.${seeded.studentUserId},message.ilike.%${seeded.studentName}%`);
  for (const n of notifs ?? []) cleanup.track('notifications', n.id);
  await sb.from('vehicles').update({ current_km: kmOriginal }).eq('id', SEED_INSTRUCTOR.vehicleId);
}

async function vehicleKm(): Promise<number> {
  const sb = await getAdminClient();
  const { data } = await sb
    .from('vehicles')
    .select('current_km')
    .eq('id', SEED_INSTRUCTOR.vehicleId)
    .single();
  return data?.current_km ?? 0;
}

function attendanceRow(page: Page, seeded: TodayClasses, i: number) {
  return page
    .locator('tr')
    .filter({ hasText: seeded.studentName })
    .filter({ hasText: seeded.times[i] });
}

const KM_START =
  '[data-llm-description="Odómetro inicial del vehículo para iniciar clase práctica"]';
const KM_END =
  '[data-llm-description="Odómetro final del vehículo al retorno de la clase práctica"]';

test.describe('K. Ciclo de vida de la clase', () => {
  test('K01/K04/K09: secretaria inicia y finaliza una clase — estado, KM y asistencia quedan guardados', async ({
    pageAs,
    cleanup,
  }) => {
    const since = new Date().toISOString();
    const seeded = await seedTodayClasses(cleanup, 1);
    const kmOriginal = await vehicleKm();
    try {
      const page = await pageAs('secretariaA');
      await page.goto('/app/secretaria/asistencia');
      const row = attendanceRow(page, seeded, 0);
      await expect(row).toBeVisible({ timeout: 30_000 });

      // Iniciar: el KM viene precargado con el del vehículo (K04).
      await row.locator('[data-llm-action="iniciar-clase-practica"]').click();
      await expect(page.locator(KM_START)).toHaveValue(String(kmOriginal));
      await page.locator(KM_START).fill(String(kmOriginal + 10));
      await page.locator('[data-llm-action="admin-start-class"]').click();
      await expect(row.locator('[data-llm-action="finalizar-clase-practica"]')).toBeVisible({
        timeout: 20_000,
      });

      // Finalizar: un KM igual al inicial no se acepta (K09).
      await row.locator('[data-llm-action="finalizar-clase-practica"]').click();
      await page.locator(KM_END).fill(String(kmOriginal + 10));
      await expect(page.locator('[data-llm-action="admin-finish-class"]')).toBeDisabled();
      await page.locator(KM_END).fill(String(kmOriginal + 35));
      await page.locator('[data-llm-action="admin-finish-class"]').click();
      await expect(row.getByText('Presente')).toBeVisible({ timeout: 20_000 });

      // En la BD: clase completada con sus KM, asistencia presente, vehículo con el KM final.
      const sb = await getAdminClient();
      const { data: s } = await sb
        .from('class_b_sessions')
        .select('status, km_start, km_end')
        .eq('id', seeded.sessionIds[0])
        .single();
      expect(s).toEqual({
        status: 'completed',
        km_start: kmOriginal + 10,
        km_end: kmOriginal + 35,
      });
      const { data: att } = await sb
        .from('class_b_practice_attendance')
        .select('status')
        .eq('class_b_session_id', seeded.sessionIds[0]);
      expect(att?.map((a) => a.status)).toEqual(['present']);
      expect(await vehicleKm()).toBe(kmOriginal + 35);
    } finally {
      await trackCycleSideEffects(cleanup, seeded, since, kmOriginal);
    }
  });

  test('K10: con una clase en curso, el instructor no puede iniciar otra', async ({
    pageAs,
    cleanup,
  }) => {
    const since = new Date().toISOString();
    const seeded = await seedTodayClasses(cleanup, 2);
    const kmOriginal = await vehicleKm();
    try {
      const page = await pageAs('secretariaA');
      await page.goto('/app/secretaria/asistencia');
      await expect(attendanceRow(page, seeded, 0)).toBeVisible({ timeout: 30_000 });

      for (const i of [0, 1]) {
        await attendanceRow(page, seeded, i)
          .locator('[data-llm-action="iniciar-clase-practica"]')
          .click();
        await page.locator(KM_START).fill(String(kmOriginal + 1));
        await page.locator('[data-llm-action="admin-start-class"]').click();
        if (i === 0)
          await expect(
            attendanceRow(page, seeded, 0).locator('[data-llm-action="finalizar-clase-practica"]'),
          ).toBeVisible({ timeout: 20_000 });
      }
      await expect(
        page
          .getByText(
            'El instructor ya tiene una clase en curso. Debe cerrarla antes de iniciar otra.',
          )
          .first(),
      ).toBeVisible({ timeout: 20_000 });

      const sb = await getAdminClient();
      const { data } = await sb
        .from('class_b_sessions')
        .select('id, status')
        .in('id', seeded.sessionIds)
        .order('id');
      expect(data?.map((r) => r.status)).toEqual(['in_progress', 'scheduled']);
    } finally {
      await trackCycleSideEffects(cleanup, seeded, since, kmOriginal);
    }
  });
});
