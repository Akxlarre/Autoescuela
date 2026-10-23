/**
 * Testing de Comunicación — tareas, observaciones y consultas (ASG-i-035, fix-230-b).
 * Casos del checklist 035: B01, B12, C03, C06, D01–D07, D13, E01, E02, E04, F01, G07, I01–I03.
 *
 * Las tareas se crean entre las cuentas de prueba (admin, secretaria@test.com,
 * secretaria2@test.com) con asunto E2E-. Al final se borran las tareas, sus respuestas y las
 * notificaciones que generaron (por API admin). Una tarea eliminada desde la app queda con
 * `deleted_at` y la RLS ya no deja verla ni borrarla: se anota su id para limpiarla a mano.
 */
import type { Page } from '@playwright/test';
import {
  chileToday,
  addDaysIso,
  chileWallTimeToInstant,
} from '../src/app/core/utils/chile-time.utils';
import { getAdminClient } from './support/supabase-admin';
import { e2eName, expect, test } from './support/fixtures';

test.describe.configure({ timeout: 150_000 });

const CARGA = { timeout: 30_000 };
const VIVO = { timeout: 20_000 };
const ADMIN = { id: 2, nombre: 'PEPITO ADMI' };
const SEC_A = { id: 8, nombre: 'Lola SECRETARIA' };
const SEC_B = { id: 33, nombre: 'Maria Torres' };
const BRANCH_KEY = 'autoescuela:selectedBranchId';

/** Asuntos creados en este archivo, para limpiar al final. */
const creados: string[] = [];
const eliminadosEnApp: number[] = [];

test.afterAll(async () => {
  if (!creados.length) return;
  const sb = await getAdminClient();
  const { data: tareas } = await sb.from('tasks').select('id, subject').in('subject', creados);
  const ids = (tareas ?? []).map((t) => t.id as number);
  if (ids.length) {
    await sb.from('task_replies').delete().in('task_id', ids);
    await sb.from('tasks').delete().in('id', ids);
  }
  for (const asunto of creados) {
    await sb.from('notifications').delete().ilike('message', `%${asunto}%`);
    await sb.from('notifications').delete().ilike('subject', `%${asunto}%`);
  }
  if (eliminadosEnApp.length)
    console.log(`[fix-230-b] tareas soft-deleted a limpiar a mano: ${eliminadosEnApp.join(', ')}`);
});

function asunto(label: string): string {
  const s = e2eName(label);
  creados.push(s);
  return s;
}

async function abrirComunicacion(page: Page, rol: 'admin' | 'secretaria'): Promise<void> {
  await page.goto(rol === 'admin' ? '/app/admin/tareas' : '/app/secretaria/observaciones');
  await expect(page.getByRole('button', { name: 'Nueva comunicación' })).toBeVisible(CARGA);
}

async function tab(page: Page, id: string): Promise<void> {
  await page.locator(`[data-llm-action="seleccionar-tab-${id}"]:visible`).first().click();
}

async function elegir(page: Page, selectId: string, opcion: string | RegExp): Promise<void> {
  await page.locator(`#${selectId}`).click();
  await page.getByRole('option', { name: opcion }).first().click();
}

async function crearTarea(
  page: Page,
  o: {
    tipo: 'Tarea' | 'Observación' | 'Consulta';
    para: string;
    asunto: string;
    vence?: string;
  },
): Promise<void> {
  await page.getByRole('button', { name: 'Nueva comunicación' }).click();
  const form = page.locator('[data-llm-form="create-task"]');
  await expect(form).toBeVisible(CARGA);
  await elegir(page, 't-type', o.tipo);
  await elegir(page, 't-recipient', new RegExp(o.para));
  await page.locator('#t-subject').fill(o.asunto);
  await page.locator('#t-body').fill('Creada por la suite e2e (fix-230-b).');
  if (o.vence) {
    const [y, m, d] = o.vence.split('-');
    const input = form.locator('app-date-input input');
    await input.click();
    await input.fill('');
    await input.pressSequentially(`${d}${m}${y}`);
    await page.keyboard.press('Escape');
  }
  await page.locator('[data-llm-action="submit-create-task"]').click();
  await expect(page.getByText('Tarea enviada correctamente')).toBeVisible(CARGA);
}

const tarjeta = (page: Page, texto: string) =>
  page.locator('[data-llm-action="open-task-detail"]').filter({ hasText: texto }).first();

async function noLeidas(page: Page): Promise<number> {
  const label = await page
    .getByRole('button', { name: /Notificaciones — \d+ sin leer/ })
    .first()
    .getAttribute('aria-label');
  return Number(/(\d+) sin leer/.exec(label ?? '')?.[1] ?? 0);
}

async function tarea(subject: string) {
  const sb = await getAdminClient();
  const { data } = await sb
    .from('tasks')
    .select('id, status, due_date, branch_id, deleted_at')
    .eq('subject', subject)
    .maybeSingle();
  return data as {
    id: number;
    status: string;
    due_date: string | null;
    branch_id: number | null;
  } | null;
}

async function notifs(recipientId: number, texto: string) {
  const sb = await getAdminClient();
  const { data } = await sb
    .from('notifications')
    .select('id, subject, message, recipient_id')
    .eq('recipient_id', recipientId)
    .or(`message.ilike.%${texto}%,subject.ilike.%${texto}%`);
  return (data ?? []) as { subject: string; message: string }[];
}

// ── B / E / F / I: crear, llega en vivo, se completa ────────────────────────────────────────

test('B01 + E01 + F01 + I01 + D01–D03 + E02 + I03: admin → tarea a secretaria; le llega en vivo; la completa y el admin lo ve sin recargar', async ({
  pageAs,
}) => {
  const s = asunto('TareaVivo');
  const manana = addDaysIso(chileToday(), 1);
  const admin = await pageAs('admin');
  const sec = await pageAs('secretariaA');
  await abrirComunicacion(sec, 'secretaria');
  await tab(sec, 'recibidas');
  await sec.waitForTimeout(4_000); // canales de tiempo real unidos
  const antes = await noLeidas(sec);

  await abrirComunicacion(admin, 'admin');
  await crearTarea(admin, { tipo: 'Tarea', para: SEC_A.nombre, asunto: s, vence: manana });
  await tab(admin, 'sent');
  await expect(tarjeta(admin, s)).toBeVisible(CARGA);

  // E01 + F01: sin recargar.
  await expect(tarjeta(sec, s)).toBeVisible(VIVO);
  await expect.poll(() => noLeidas(sec), VIVO).toBe(antes + 1);
  // I01
  expect((await notifs(SEC_A.id, s)).map((n) => n.subject)).toContain(`Nueva tarea: ${s}`);

  // D03: el emisor no ve Iniciar/Completar; sí Eliminar.
  await tarjeta(admin, s).click();
  await expect(admin.locator('[data-llm-action="delete-task"]')).toBeVisible(CARGA);
  await expect(admin.locator('[data-llm-action="mark-task-in-progress"]')).toHaveCount(0);

  // D01 + D02
  await tarjeta(sec, s).click();
  await sec.locator('[data-llm-action="mark-task-in-progress"]').click();
  await expect.poll(async () => (await tarea(s))?.status, VIVO).toBe('in_progress');
  await sec.locator('[data-llm-action="mark-task-completed"]').first().click();
  await expect.poll(async () => (await tarea(s))?.status, VIVO).toBe('completed');

  // E02: el admin ve el cambio sin recargar; I03: le llega "Tarea completada", a ella no.
  await admin.keyboard.press('Escape');
  await expect(tarjeta(admin, s)).toContainText(/Completada/i, VIVO);
  await expect.poll(async () => (await notifs(ADMIN.id, s)).length, VIVO).toBeGreaterThan(0);
  expect(
    (await notifs(SEC_A.id, s)).filter((n) => /complet/i.test(n.subject)),
    'quien la completó no recibe "Tarea completada"',
  ).toEqual([]);
});

// ── B12 / S9 / S10: fecha límite en hora de Chile ───────────────────────────────────────────

test('B12 (S9): la fecha límite se guarda y se muestra como el día elegido, y la de hoy no sale "Vencida"', async ({
  pageAs,
}) => {
  const hoy = chileToday();
  const manana = addDaysIso(hoy, 1);
  const sHoy = asunto('VenceHoy');
  const sManana = asunto('VenceManana');
  const admin = await pageAs('admin');
  await abrirComunicacion(admin, 'admin');
  await crearTarea(admin, { tipo: 'Tarea', para: SEC_A.nombre, asunto: sHoy, vence: hoy });
  await crearTarea(admin, { tipo: 'Tarea', para: SEC_A.nombre, asunto: sManana, vence: manana });
  await tab(admin, 'sent');

  const tHoy = await tarea(sHoy);
  const tManana = await tarea(sManana);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('es-CL', {
      day: 'numeric',
      month: 'short',
      timeZone: 'America/Santiago',
    }).format(new Date(`${iso}T12:00:00Z`));
  test.info().annotations.push(
    { type: 'B12 due_date guardado (hoy)', description: String(tHoy?.due_date) },
    {
      type: 'B12 tarjeta hoy',
      description: (await tarjeta(admin, sHoy).innerText()).replace(/\s+/g, ' '),
    },
    {
      type: 'B12 tarjeta mañana',
      description: (await tarjeta(admin, sManana).innerText()).replace(/\s+/g, ' '),
    },
  );
  await expect(tarjeta(admin, sManana)).toContainText(`Vence ${fmt(manana)}`);
  await expect(tarjeta(admin, sHoy)).toContainText(`Vence ${fmt(hoy)}`);
  await expect(tarjeta(admin, sHoy)).not.toContainText('Vencida');
});

// ── D04 / S11: observación ──────────────────────────────────────────────────────────────────

test('D04 (S11, fix-231-b): el admin abre una observación → queda "Vista" y la secretaria recibe "Observación vista"', async ({
  pageAs,
}) => {
  const s = asunto('Observacion');
  const sec = await pageAs('secretariaA');
  await abrirComunicacion(sec, 'secretaria');
  await crearTarea(sec, { tipo: 'Observación', para: ADMIN.nombre, asunto: s });
  // B02: la observación no lleva fecha límite.
  expect((await tarea(s))?.due_date ?? null).toBeNull();

  const admin = await pageAs('admin');
  await abrirComunicacion(admin, 'admin');
  await tab(admin, 'observations');
  await tarjeta(admin, s).click();
  await expect.poll(async () => (await tarea(s))?.status, VIVO).toBe('seen');
  await admin.keyboard.press('Escape');
  await expect(tarjeta(admin, s)).toContainText('Vista', VIVO);
  await expect
    .poll(async () => (await notifs(SEC_A.id, s)).map((n) => n.subject), VIVO)
    .toEqual(['Observación vista']);
});

// ── D05 / D06 / I02: consulta con respuesta ─────────────────────────────────────────────────

test('D05 + D06 + I02: consulta — la respuesta la pasa a "En curso" y avisa al emisor; cerrada queda en solo lectura', async ({
  pageAs,
}) => {
  const s = asunto('Consulta');
  const sec = await pageAs('secretariaA');
  await abrirComunicacion(sec, 'secretaria');
  await crearTarea(sec, { tipo: 'Consulta', para: ADMIN.nombre, asunto: s });

  const admin = await pageAs('admin');
  await abrirComunicacion(admin, 'admin');
  await tab(admin, 'received');
  await tarjeta(admin, s).click();
  const caja = admin.locator('[data-llm-description="reply text input for task thread"]');
  await caja.fill('Respuesta e2e');
  await admin.locator('[data-llm-action="add-reply-to-task"]').click();
  await expect(admin.getByText('Respuesta e2e')).toBeVisible(CARGA);
  await expect.poll(async () => (await tarea(s))?.status, VIVO).toBe('in_progress');
  await expect.poll(async () => (await notifs(SEC_A.id, s)).length, VIVO).toBeGreaterThan(0);
  const aSec = await notifs(SEC_A.id, s);
  test.info().annotations.push({
    type: 'I02 notificación a la secretaria',
    description: aSec.map((n) => `${n.subject} · ${n.message}`).join(' | '),
  });

  // D06: el emisor la ve en "Enviadas" (hotfix-102-b) con la respuesta y la cierra → solo lectura.
  await tab(sec, 'enviadas');
  await expect(tarjeta(sec, s)).toBeVisible(VIVO);
  await tarjeta(sec, s).click();
  await sec.locator('[data-llm-action="mark-task-completed"]').first().click();
  await expect.poll(async () => (await tarea(s))?.status, VIVO).toBe('completed');
  await expect(
    sec.locator('[data-llm-description="reply text input for task thread"]'),
  ).toHaveCount(0, CARGA);
});

// ── D13 / E04 / S14: eliminar ───────────────────────────────────────────────────────────────

test('D13 + E04 (S14): el emisor elimina una tarea pendiente; desaparece del lado del destinatario sin recargar', async ({
  pageAs,
}) => {
  const s = asunto('Eliminar');
  const sec = await pageAs('secretariaA');
  await abrirComunicacion(sec, 'secretaria');
  await tab(sec, 'recibidas');
  await sec.waitForTimeout(4_000);

  const admin = await pageAs('admin');
  await abrirComunicacion(admin, 'admin');
  await crearTarea(admin, { tipo: 'Tarea', para: SEC_A.nombre, asunto: s });
  await expect(tarjeta(sec, s)).toBeVisible(VIVO);
  const id = (await tarea(s))!.id;

  await tab(admin, 'sent');
  await tarjeta(admin, s).click();
  await admin.locator('[data-llm-action="delete-task"]').click();
  await admin
    .locator('[aria-labelledby="confirm-modal-title"]')
    .getByRole('button', { name: /Eliminar/ })
    .click();
  eliminadosEnApp.push(id);
  await expect(tarjeta(admin, s)).toHaveCount(0, CARGA);
  // E04: del lado de la secretaria, sin recargar.
  await expect(tarjeta(sec, s)).toHaveCount(0, VIVO);
});

// ── C06 / S8: tarea desde otra sede ─────────────────────────────────────────────────────────

test('C06 (S8): admin con la sede A elegida ve en "Dirigidas a mí" la tarea que le manda la secretaria de B', async ({
  pageAs,
}) => {
  const s = asunto('DesdeSedeB');
  const secB = await pageAs('secretariaB');
  await abrirComunicacion(secB, 'secretaria');
  await crearTarea(secB, { tipo: 'Tarea', para: ADMIN.nombre, asunto: s });
  test.info().annotations.push({
    type: 'C06 branch_id de la tarea',
    description: String((await tarea(s))?.branch_id),
  });

  const admin = await pageAs('admin');
  await admin.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    BRANCH_KEY,
    JSON.stringify({ id: 1, name: 'Autoescuela Chillán' }),
  ] as const);
  await abrirComunicacion(admin, 'admin');
  await tab(admin, 'received');
  await expect(tarjeta(admin, s)).toBeVisible(CARGA);
});

// ── C03 / S10: KPI Vencidas ─────────────────────────────────────────────────────────────────

test('C03 (S10): una tarea completada con fecha pasada no cuenta en "Vencidas"', async ({
  pageAs,
}) => {
  const s = asunto('CompletadaAtrasada');
  const sb = await getAdminClient();
  const sec = await pageAs('secretariaA');
  await abrirComunicacion(sec, 'secretaria');
  await crearTarea(sec, { tipo: 'Tarea', para: ADMIN.nombre, asunto: s });
  const t = (await tarea(s))!;
  // Fecha límite de hace 3 días y completada (sembrado directo: el formulario no deja una fecha pasada fácil de leer).
  const { error } = await sb
    .from('tasks')
    .update({ due_date: `${addDaysIso(chileToday(), -3)}T15:00:00Z`, status: 'completed' })
    .eq('id', t.id);
  expect(error).toBeNull();

  const admin = await pageAs('admin');
  await abrirComunicacion(admin, 'admin');
  await tab(admin, 'received');
  await expect(tarjeta(admin, s)).toBeVisible(CARGA);
  await expect(tarjeta(admin, s)).not.toContainText('Vencida');
});

// ── G07 / S16 ───────────────────────────────────────────────────────────────────────────────

test('G07 (S16, hotfix-103-b): /notificaciones de admin y secretaria llevan al inicio, no a una maqueta', async ({
  pageAs,
}) => {
  for (const [rol, url, inicio] of [
    ['admin', '/app/admin/notificaciones', '/app/admin/dashboard'],
    ['secretariaA', '/app/secretaria/notificaciones', '/app/secretaria/dashboard'],
  ] as const) {
    const page = await pageAs(rol);
    await page.goto(url);
    await expect(page, url).toHaveURL(new RegExp(`${inicio}$`), CARGA);
    await expect(page.getByText('PLANO')).toHaveCount(0);
  }
});

// ── Spec 0053-b: editar una tarea enviada ───────────────────────────────────────────────────

test('0053-b AC1–AC5: el admin edita una tarea pendiente; la secretaria ve el cambio en vivo, recibe el aviso y no puede editarla', async ({
  pageAs,
}) => {
  const original = asunto('Editar');
  const nuevo = asunto('Editada');
  const manana = addDaysIso(chileToday(), 1);
  const sec = await pageAs('secretariaA');
  await abrirComunicacion(sec, 'secretaria');
  await tab(sec, 'recibidas');
  await sec.waitForTimeout(4_000);

  const admin = await pageAs('admin');
  await abrirComunicacion(admin, 'admin');
  await crearTarea(admin, { tipo: 'Tarea', para: SEC_A.nombre, asunto: original });
  await expect(tarjeta(sec, original)).toBeVisible(VIVO);

  // AC1 + AC2: el formulario abre precargado; el destinatario no se cambia.
  await tab(admin, 'sent');
  await tarjeta(admin, original).click();
  await admin.locator('[data-llm-action="edit-task"]').click();
  const form = admin.locator('[data-llm-form="create-task"]');
  await expect(admin.locator('#t-subject')).toHaveValue(original, CARGA);
  await expect(form.getByText(SEC_A.nombre)).toBeVisible();
  await expect(admin.locator('#t-recipient')).toHaveCount(0);

  // "Cancelar" vuelve al detalle; se reabre el formulario.
  await admin.getByRole('button', { name: 'Cancelar', exact: true }).last().click();
  await expect(admin.locator('[data-llm-action="edit-task"]')).toBeVisible(CARGA);
  await admin.locator('[data-llm-action="edit-task"]').click();
  await expect(admin.locator('#t-subject')).toHaveValue(original, CARGA);

  // AC-E2: asunto de solo espacios no deja guardar.
  await admin.locator('#t-subject').fill('   ');
  await expect(admin.locator('[data-llm-action="save-task-edit"]')).toBeDisabled();

  // AC3: guardar con asunto y fecha nuevos.
  await admin.locator('#t-subject').fill(nuevo);
  const [y, m, d] = manana.split('-');
  const fecha = form.locator('app-date-input input');
  await fecha.click();
  await fecha.fill('');
  await fecha.pressSequentially(`${d}${m}${y}`);
  await admin.keyboard.press('Escape');
  await admin.locator('[data-llm-action="save-task-edit"]').click();
  await expect(admin.getByText('Tarea actualizada')).toBeVisible(CARGA);
  await expect(admin.locator('[data-llm-action="delete-task"]')).toBeVisible(CARGA); // volvió al detalle
  await expect(admin.getByText(nuevo).first()).toBeVisible();
  // 23:59 de Chile del día elegido (hotfix-100-b).
  expect(Date.parse(String((await tarea(nuevo))?.due_date))).toBe(
    Date.parse(chileWallTimeToInstant(manana, '23:59')),
  );

  // AC4: la secretaria ve el asunto nuevo sin recargar y recibe el aviso.
  await expect(tarjeta(sec, nuevo)).toBeVisible(VIVO);
  await expect
    .poll(async () => (await notifs(SEC_A.id, nuevo)).map((n) => n.subject), VIVO)
    .toContain(`Tarea modificada: ${nuevo}`);

  // AC5: la destinataria no ve "Editar".
  await tarjeta(sec, nuevo).click();
  await expect(sec.locator('[data-llm-action="mark-task-in-progress"]')).toBeVisible(CARGA);
  await expect(sec.locator('[data-llm-action="edit-task"]')).toHaveCount(0);
});
