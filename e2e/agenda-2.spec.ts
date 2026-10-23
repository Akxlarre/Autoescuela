/**
 * Agenda semanal — segunda tanda (ASG-i-026, fix-186-b). Casos del checklist
 * specs/testing-piloto/026-agenda-triple-match.md que quedaron pendientes. Los IDs son los del
 * checklist. Solo lectura: no siembra ni modifica clases.
 */
import type { Page } from '@playwright/test';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

test.describe.configure({ mode: 'default', timeout: 120_000 });

const CARGA = { timeout: 30_000 };
const FILTRO = '[data-llm-description="Filtrar calendario por instructor"]';
const VISIBILITY_KEY = 'app-agenda-visibility-months';
const SEDE1_INSTRUCTOR = 'Instructor1 Apellido1';

const grid = (page: Page) => page.getByRole('grid');
const weekLabel = (page: Page) => page.locator('.agenda-week-label');

async function abrirAgenda(page: Page, url = '/app/admin/agenda'): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(url);
  await expect(grid(page)).toBeVisible(CARGA);
}

async function elegirInstructor(page: Page, nombre: string): Promise<void> {
  await page.locator(FILTRO).click();
  await page.getByRole('option', { name: nombre, exact: true }).click();
  await expect(page.locator(FILTRO)).toContainText(nombre);
  await expect(grid(page)).toBeVisible(CARGA);
}

/** Hora actual en Chile como minutos del día. */
function minutosChile(): number {
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// ── A. Carga ────────────────────────────────────────────────────────────────────────────────

test('A05 + A09: la primera carga tarda menos de 10 s y al volver la grilla está al instante', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.setViewportSize({ width: 1600, height: 900 });
  const t0 = Date.now();
  await page.goto('/app/admin/agenda');
  await expect(grid(page)).toBeVisible(CARGA);
  const primera = Date.now() - t0;
  test.info().annotations.push({ type: 'A09 primera carga (ms)', description: String(primera) });
  expect(primera).toBeLessThan(10_000);

  await page.locator('a[href="/app/admin/dashboard"]').first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.locator('a[href="/app/admin/agenda"]').first().click();
  // A05: datos en caché, sin esperar el skeleton.
  await expect(grid(page)).toBeVisible({ timeout: 2_000 });
});

// ── B. Grilla ───────────────────────────────────────────────────────────────────────────────

test('B04: el indicador "ahora" está solo en la semana actual y en horario de clases', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirAgenda(page);
  const ahora = page.locator('.agenda-time-label--now');
  // Bloques reales de la grilla (45 min, con pausas de 5 min entre ellos).
  const filas = (await page.locator('.agenda-time-label').allInnerTexts()).map((t) => t.trim());
  const m = minutosChile();
  const dentro = filas.find((f) => {
    const [h, mm] = f.split(':').map(Number);
    return m >= h * 60 + mm && m < h * 60 + mm + 45;
  });
  await expect(ahora).toHaveCount(dentro ? 1 : 0);
  if (dentro) await expect(ahora).toHaveText(dentro);

  await page.locator('[data-llm-action="next-week"]').click();
  await expect(grid(page)).toBeVisible(CARGA);
  await expect(ahora).toHaveCount(0);
});

test('B06: la leyenda tiene los 5 estados', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await abrirAgenda(page);
  const leyenda = page.locator('.agenda-legend');
  for (const estado of ['Disponible', 'Agendada', 'En progreso', 'Completada', 'No asistió']) {
    await expect(leyenda.getByText(estado, { exact: true })).toBeVisible();
  }
});

// ── C. Navegación ───────────────────────────────────────────────────────────────────────────

test('C07: con el límite en 2 meses, la Agenda no deja pasar de esa fecha', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.addInitScript(([key]) => localStorage.setItem(key, '2'), [VISIBILITY_KEY] as const);
  await abrirAgenda(page);
  const next = page.locator('[data-llm-action="next-week"]');
  let semanas = 0;
  while (!(await next.isDisabled()) && semanas < 20) {
    await next.click();
    await expect(grid(page)).toBeVisible(CARGA);
    semanas++;
  }
  test
    .info()
    .annotations.push({ type: 'C07 semanas navegables con 2 meses', description: String(semanas) });
  expect(semanas).toBeGreaterThanOrEqual(7);
  expect(semanas).toBeLessThanOrEqual(10);
});

test('C11: "Ir a fecha" eligiendo hoy desde otra semana vuelve a la semana actual', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirAgenda(page);
  const actual = await weekLabel(page).innerText();
  await page.locator('[data-llm-action="next-week"]').click();
  await page.locator('[data-llm-action="next-week"]').click();
  await expect(weekLabel(page)).not.toHaveText(actual);

  await page
    .locator('.agenda-jump-date button, .agenda-jump-date .p-datepicker-dropdown')
    .first()
    .click();
  const panel = page
    .locator('.p-datepicker-panel, .p-datepicker')
    .filter({ visible: true })
    .first();
  await expect(panel).toBeVisible();
  await panel.locator('.p-datepicker-today, [data-p-today="true"]').first().click();
  await expect(weekLabel(page)).toHaveText(actual, CARGA);
});

test('C13: navegar rápido con red lenta termina en la semana pedida, sin mezclar', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirAgenda(page);
  const inicial = await weekLabel(page).innerText();
  await page.route('**/rest/v1/**', async (route) => {
    await new Promise((r) => setTimeout(r, 1_500));
    return route.continue();
  });
  const next = page.locator('[data-llm-action="next-week"]');
  const prev = page.locator('[data-llm-action="prev-week"]');
  for (const b of [next, next, prev, next]) await b.click();
  await expect(grid(page)).toBeVisible(CARGA);
  await page.waitForTimeout(6_000);
  const final = await weekLabel(page).innerText();
  expect(final).not.toBe(inicial);
  // Dos semanas adelante: volver dos veces debe dejar la semana inicial.
  await page.unroute('**/rest/v1/**');
  await prev.click();
  await prev.click();
  await expect(weekLabel(page)).toHaveText(inicial, CARGA);
});

// ── D. Filtro ───────────────────────────────────────────────────────────────────────────────

test('D07: el instructor elegido al salir y volver (anotar)', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await abrirAgenda(page);
  await elegirInstructor(page, SEDE1_INSTRUCTOR);
  await page.locator('a[href="/app/admin/dashboard"]').first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.locator('a[href="/app/admin/agenda"]').first().click();
  await expect(grid(page)).toBeVisible(CARGA);
  const filtro = await page.locator(FILTRO).innerText();
  test.info().annotations.push({ type: 'D07 filtro al volver', description: filtro.trim() });
});

// ── E. Detalle ──────────────────────────────────────────────────────────────────────────────

test('E08: con teclado, Tab + Enter sobre un horario abre el detalle', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await abrirAgenda(page);
  await elegirInstructor(page, SEDE1_INSTRUCTOR);
  const slot = page.locator('app-agenda-slot[tabindex="0"]').first();
  await expect(slot).toBeVisible(CARGA);
  await slot.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('app-agenda-slot-detail-drawer')).toBeVisible(CARGA);
});

test('E11 (hotfix-095-b): desde el detalle de una clase se abre la ficha del alumno', async ({
  pageAs,
}) => {
  // La próxima clase agendada real (solo lectura).
  const sb = await getAdminClient();
  const { data } = await sb
    .from('class_b_sessions')
    .select('id, instructor_id, scheduled_at')
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(1);
  const clase = data?.[0];
  test.skip(!clase, 'No hay clases agendadas desde hoy');
  const { data: ins } = await sb
    .from('instructors')
    .select('users!inner(first_names, paternal_last_name)')
    .eq('id', clase!.instructor_id)
    .single();
  const u = (ins as any).users;

  const page = await pageAs('admin');
  await abrirAgenda(page);
  await elegirInstructor(page, `${u.first_names} ${u.paternal_last_name}`);
  const conAlumno = page.locator('app-agenda-slot').filter({ has: page.locator('.slot-student') });
  for (let i = 0; i < 8 && (await conAlumno.count()) === 0; i++) {
    await page.locator('[data-llm-action="next-week"]').click();
    await expect(grid(page)).toBeVisible(CARGA);
    await page.waitForTimeout(1_000);
  }
  await conAlumno.first().click();
  const detalle = page.locator('app-agenda-slot-detail-drawer');
  await expect(detalle).toBeVisible(CARGA);
  await detalle.locator('[data-llm-action="ver-ficha-alumno-detalle"]').click();
  await expect(page).toHaveURL(/\/app\/admin\/alumnos\/\d+\?enrollment=\d+$/, CARGA);
  await expect(detalle).toHaveCount(0);
});

// ── P. Visual ───────────────────────────────────────────────────────────────────────────────

test('P03 (hotfix-094-b): en el celular la Agenda abre en el día de hoy', async ({ pageAs }) => {
  const page = await pageAs('admin');
  // Miércoles 21-oct-2026, 12:00 en Chile.
  await page.clock.setFixedTime(new Date('2026-10-21T15:00:00.000Z'));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/app/admin/agenda');
  await expect(grid(page)).toBeVisible(CARGA);
  const activa = page.locator('.agenda-mobile-tab--active');
  await expect(activa).toHaveCount(1);
  await expect(activa).toHaveClass(/agenda-mobile-tab--today/);
  await expect(activa).toContainText('Mié');
});

test('P05: en una pantalla angosta los controles de la barra no se superponen', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto('/app/admin/agenda');
  await expect(grid(page)).toBeVisible(CARGA);
  const cajas = [];
  for (const sel of [
    '[data-llm-action="prev-week"]',
    '.agenda-week-label',
    '[data-llm-action="next-week"]',
    '[data-llm-action="go-to-today"]',
    '.agenda-jump-date',
    '.agenda-instructor-filter',
  ]) {
    const el = page.locator(sel).first();
    if ((await el.count()) === 0 || !(await el.isVisible())) continue;
    const box = await el.boundingBox();
    if (box) cajas.push({ sel, ...box });
  }
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i];
      const b = cajas[j];
      const choca =
        a.x < b.x + b.width - 1 &&
        b.x < a.x + a.width - 1 &&
        a.y < b.y + b.height - 1 &&
        b.y < a.y + a.height - 1;
      expect(choca, `${a.sel} se superpone con ${b.sel}`).toBe(false);
    }
  }
});

test('P06: con Tab se llega a semana anterior/siguiente, Hoy, fecha y filtro', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirAgenda(page);
  // "Hoy" solo aparece fuera de la semana actual.
  await page.locator('[data-llm-action="next-week"]').click();
  await expect(grid(page)).toBeVisible(CARGA);
  await page.locator('[data-llm-action="prev-week"]').focus();
  const vistos = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const id = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return (
        el?.getAttribute('data-llm-action') ??
        el?.closest('.agenda-jump-date, .agenda-instructor-filter')?.className.split(' ')[0] ??
        el?.tagName ??
        ''
      );
    });
    vistos.add(id);
    await page.keyboard.press('Tab');
  }
  test.info().annotations.push({ type: 'P06 recorrido', description: [...vistos].join(', ') });
  for (const esperado of [
    'prev-week',
    'next-week',
    'go-to-today',
    'agenda-jump-date',
    'agenda-instructor-filter',
  ]) {
    expect([...vistos], esperado).toContain(esperado);
  }
});
