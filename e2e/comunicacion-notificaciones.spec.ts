/**
 * Testing de Comunicación — campana, panel e historial de notificaciones (ASG-i-035, fix-230-b).
 * Casos del checklist 035: F01–F05, F07, F09, F10, F15, G01, G04, G05, H01/H02.
 *
 * Las notificaciones se siembran por API admin para `secretaria@test.com` con asunto E2E- y se
 * borran al terminar. "Eliminar todas" marca `deleted_at` en TODAS las de la cuenta: el test anota
 * cuáles estaban activas y las restaura.
 */
import type { Page } from '@playwright/test';
import { ACCOUNTS } from './support/accounts';
import { getAdminClient } from './support/supabase-admin';
import { e2eName, expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const CARGA = { timeout: 30_000 };
const VIVO = { timeout: 20_000 };
const SEC_A = 8;
const PANEL = '[aria-label="Panel de notificaciones"]';

const sembradas: number[] = [];

test.afterAll(async () => {
  if (!sembradas.length) return;
  const sb = await getAdminClient();
  await sb.from('notifications').delete().in('id', sembradas);
});

async function sembrar(
  n: number,
  o: { referenceType?: string; referenceId?: number | null; label: string },
): Promise<string[]> {
  const sb = await getAdminClient();
  const filas = Array.from({ length: n }, (_, i) => ({
    recipient_id: SEC_A,
    type: 'system',
    subject: `${e2eName(o.label)}-${i}`,
    message: 'Sembrada por la suite e2e (fix-230-b).',
    reference_type: o.referenceType ?? null,
    reference_id: o.referenceId ?? null,
    read: false,
    sent_ok: true,
  }));
  const { data, error } = await sb.from('notifications').insert(filas).select('id, subject');
  if (error) throw error;
  sembradas.push(...(data ?? []).map((d) => d.id as number));
  return (data ?? []).map((d) => d.subject as string);
}

async function noLeidas(page: Page): Promise<number> {
  const label = await page
    .getByRole('button', { name: /Notificaciones — \d+ sin leer/ })
    .first()
    .getAttribute('aria-label');
  return Number(/(\d+) sin leer/.exec(label ?? '')?.[1] ?? 0);
}

async function abrirPanel(page: Page): Promise<void> {
  if (await page.locator(PANEL).isVisible()) return;
  await page.locator('[data-llm-action="open-notifications-panel"]').first().click();
  await expect(page.locator(PANEL)).toBeVisible(CARGA);
}

async function enDashboard(page: Page): Promise<void> {
  await page.goto('/app/secretaria/dashboard');
  await expect(page.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
  await page.waitForTimeout(4_000); // canal de tiempo real unido
}

test('F01 + F02 + F03 + H02: llega en vivo (badge + toast), aparece primera en el panel y al hacer clic queda leída y navega', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  await enDashboard(page);
  const antes = await noLeidas(page);

  const [asunto] = await sembrar(1, { referenceType: 'task', label: 'NotifVivo' });
  await expect.poll(() => noLeidas(page), VIVO).toBe(antes + 1);
  await expect(page.getByText(asunto).first()).toBeVisible(VIVO); // toast

  await abrirPanel(page);
  const primera = page.locator(`${PANEL} .notif-panel__item`).first();
  await expect(primera).toContainText(asunto);
  await primera.click();
  await expect(page).toHaveURL(/\/app\/secretaria\/observaciones$/, CARGA);
  await expect.poll(() => noLeidas(page), VIVO).toBe(antes);
});

test('F05: 3 no leídas del mismo tipo el mismo día se agrupan; "marcar grupo leído" baja el badge en 3', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  await sembrar(3, { referenceType: 'certificate', label: 'NotifGrupo' });
  await enDashboard(page);
  const antes = await noLeidas(page);
  await abrirPanel(page);
  const grupo = page
    .locator(`${PANEL} [data-llm-action="expand-notification-group"]`)
    .filter({ hasText: /certificados listos/ })
    .first();
  await expect(grupo).toBeVisible(CARGA);
  test.info().annotations.push({ type: 'F05 grupo', description: await grupo.innerText() });
  await grupo.click();
  await expect(page.locator(`${PANEL} .notif-panel__item--nested`)).toHaveCount(3);
  await page.locator(`${PANEL} [data-llm-action="mark-group-read"]`).first().click();
  await expect.poll(() => noLeidas(page), VIVO).toBe(antes - 3);
});

test('F04 + G05 (S17): "Marcar todo como leído" persiste al recargar; anotar si el historial abierto se actualiza', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  const [asunto] = await sembrar(2, { label: 'NotifMarcarTodo' });
  await enDashboard(page);
  await abrirPanel(page);
  await page.locator(`${PANEL} [data-llm-action="open-notifications-history"]`).click();
  const historial = page.locator('.notif-history');
  const fila = historial.locator('.notif-history__row').filter({ hasText: asunto }).first();
  await expect(fila).toBeVisible(CARGA);
  await expect(fila).toHaveAttribute('aria-label', /sin leer/);

  await abrirPanel(page);
  await page.locator(`${PANEL} [data-llm-action="mark-all-notifications-read"]`).click();
  await expect.poll(() => noLeidas(page), VIVO).toBe(0);
  await page.waitForTimeout(1_500);
  const sigueSinLeer = /sin leer/.test((await fila.getAttribute('aria-label')) ?? '');
  test.info().annotations.push({
    type: 'G05 historial abierto tras marcar todo',
    description: sigueSinLeer ? 'sigue mostrando "sin leer" (S17)' : 'se actualizó',
  });

  await page.reload();
  await expect(page.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
  await expect.poll(() => noLeidas(page), VIVO).toBe(0);
  expect(sigueSinLeer, 'G05: el historial abierto refleja "marcar todo como leído"').toBe(false);
});

test('G04 (S17): una notificación nueva aparece en el historial abierto', async ({ pageAs }) => {
  const page = await pageAs('secretariaA');
  await enDashboard(page);
  await abrirPanel(page);
  await page.locator(`${PANEL} [data-llm-action="open-notifications-history"]`).click();
  await expect(page.locator('.notif-history')).toBeVisible(CARGA);
  const [asunto] = await sembrar(1, { label: 'NotifHistorialVivo' });
  await expect(page.getByText(asunto).first()).toBeVisible(VIVO); // al menos el toast
  await expect(
    page.locator('.notif-history__row').filter({ hasText: asunto }),
    'G04: la nueva aparece en el historial sin cerrarlo',
  ).toHaveCount(1, VIVO);
});

test('F07 + F09 + F10 + G01: eliminar una y "Eliminar todas"; el panel queda vacío con acceso al historial, donde siguen', async ({
  pageAs,
}) => {
  const sb = await getAdminClient();
  const { data: activas } = await sb
    .from('notifications')
    .select('id')
    .eq('recipient_id', SEC_A)
    .is('deleted_at', null);
  const activasAntes = (activas ?? []).map((a) => a.id as number);
  const [una, otra] = await sembrar(2, { label: 'NotifEliminar' });
  try {
    const page = await pageAs('secretariaA');
    await enDashboard(page);
    await abrirPanel(page);
    // F07
    const item = page.locator(`${PANEL} .notif-panel__item`).filter({ hasText: una }).first();
    await item.hover();
    await item.locator('[data-llm-action="delete-notification"]').click();
    await expect(page.locator(PANEL).getByText(una)).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
    await abrirPanel(page);
    await expect(page.locator(PANEL).getByText(una)).toHaveCount(0);
    await expect(page.locator(PANEL).getByText(otra)).toHaveCount(1);

    // F09
    await page.locator(`${PANEL} [data-llm-action="delete-all-notifications"]`).click();
    await page
      .locator('[aria-labelledby="confirm-modal-title"]')
      .getByRole('button', { name: 'Sí, eliminar todas' })
      .click();
    await abrirPanel(page);
    await expect(page.locator(`${PANEL} .notif-panel__item`)).toHaveCount(0, CARGA);
    // F10 + G01: el historial sigue accesible y las tiene.
    await page.locator(`${PANEL} [data-llm-action="open-notifications-history"]`).click();
    await expect(page.locator('.notif-history__row').filter({ hasText: una })).toHaveCount(
      1,
      CARGA,
    );
    await expect(page.locator('.notif-history__row').filter({ hasText: otra })).toHaveCount(1);
  } finally {
    if (activasAntes.length)
      await sb.from('notifications').update({ deleted_at: null }).in('id', activasAntes);
  }
});

test('F15: cerrar sesión y entrar con otra cuenta en el mismo navegador no muestra notificaciones de la anterior', async ({
  browser,
}) => {
  const [asunto] = await sembrar(1, { label: 'NotifCambioCuenta' });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const login = async (email: string) => {
    await page.goto('/login');
    await page
      .locator('[data-llm-description="User email address for authentication"]')
      .fill(email);
    await page
      .locator('[data-llm-description="User password for authentication"]')
      .fill(ACCOUNTS.admin.password);
    await page.locator('[data-llm-action="submit-auth-form"]').click();
    await expect(page.locator('[data-llm-nav]').first()).toBeVisible(CARGA);
  };
  try {
    await login(ACCOUNTS.secretariaA.email);
    await abrirPanel(page);
    await expect(page.locator(PANEL).getByText(asunto)).toHaveCount(1, CARGA);
    await page.keyboard.press('Escape');
    await page.locator('[data-llm-action="open-user-profile-menu"]').click();
    await page.locator('[data-llm-action="cerrar-sesion"]').click();
    await page
      .locator('[aria-labelledby="confirm-modal-title"]')
      .getByRole('button', { name: 'Sí, salir' })
      .click();
    await expect(page).toHaveURL(/\/login/, CARGA);
    await login(ACCOUNTS.secretariaB.email);
    await abrirPanel(page);
    await page.waitForTimeout(2_000);
    await expect(page.locator(PANEL).getByText(asunto)).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});
