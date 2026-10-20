/**
 * Testing de Comunicación — comunicados a alumnos (ASG-i-035, fix-230-b).
 * Casos del checklist 035: J01, J02, J04, J12, K04, K06, K10, L10, M02, M03, N07, O06, O07.
 *
 * No envía nada: `send-announcement` (envío) queda interceptado y la vista previa solo arma el
 * HTML. Ningún caso confirma un envío. Las inserciones de O07 usan `status = 'cancelado'`, que el
 * dispatcher nunca toma, por si la RLS las dejara pasar.
 */
import type { Page } from '@playwright/test';
import { ACCOUNTS } from './support/accounts';
import { getAdminClient, getClientFor } from './support/supabase-admin';
import { environment } from '../src/environments/environment';
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const CARGA = { timeout: 30_000 };
const FORM = '[data-llm-form="create-announcement"]';

/** Corta cualquier envío real: solo deja pasar la vista previa. */
async function sinEnvios(page: Page, intentos: string[]): Promise<void> {
  await page.route('**/functions/v1/send-announcement', async (route) => {
    const body = route.request().postDataJSON() ?? {};
    if (body.previewOnly === true) return route.continue();
    intentos.push(JSON.stringify(body));
    return route.fulfill({ status: 500, body: '{"error":"bloqueado por el test"}' });
  });
}

async function abrirCompositor(page: Page, rol: 'admin' | 'secretaria'): Promise<void> {
  await page.goto(rol === 'admin' ? '/app/admin/tareas' : '/app/secretaria/observaciones');
  await page.locator('[data-llm-action="seleccionar-tab-comunicados"]:visible').first().click();
  await page.getByRole('button', { name: 'Nuevo comunicado' }).click();
  await expect(page.locator(FORM)).toBeVisible(CARGA);
}

async function tipo(page: Page, label: RegExp): Promise<void> {
  await page.locator('#a-kind').click();
  await page.getByRole('option', { name: label }).click();
}

/** Abre una sección plegable del compositor ("Mensaje" o "Envío"). */
async function seccion(page: Page, titulo: 'Mensaje' | 'Envío'): Promise<void> {
  const boton = page.locator(`${FORM} button[aria-expanded]`).filter({ hasText: titulo }).first();
  if ((await boton.getAttribute('aria-expanded')) !== 'true') await boton.click();
}

async function alcance(page: Page): Promise<number> {
  const texto = await page
    .locator(FORM)
    .getByText(/\d+ destinatario\(s\)/)
    .first()
    .innerText();
  return Number(/(\d+) destinatario/.exec(texto)?.[1] ?? -1);
}

test('J01 + J02 + J12: la secretaria abre el compositor; sin tipo no se puede enviar y no ve selector de sede', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  const intentos: string[] = [];
  await sinEnvios(page, intentos);
  await abrirCompositor(page, 'secretaria');
  await expect(
    page
      .locator(FORM)
      .getByText(/Elige el tipo/)
      .first(),
  ).toBeVisible();
  await expect(page.locator('[data-llm-action="enviar-comunicado"]')).toBeDisabled();
  await expect(page.locator('#a-branch')).toHaveCount(0);
  expect(intentos).toEqual([]);
});

test('J04: promocional deja fuera a quienes no consintieron (alcance ≤ operativo, con aviso si excluye)', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  const intentos: string[] = [];
  await sinEnvios(page, intentos);
  await abrirCompositor(page, 'secretaria');
  await tipo(page, /^Operativo/);
  await expect(
    page
      .locator(FORM)
      .getByText(/\d+ destinatario\(s\)/)
      .first(),
  ).toBeVisible(CARGA);
  const operativo = await alcance(page);
  await tipo(page, /^Promocional/);
  await page.waitForTimeout(2_500);
  const promocional = await alcance(page);
  test.info().annotations.push({
    type: 'J04 alcance sede A',
    description: `operativo=${operativo} promocional=${promocional}`,
  });
  expect(promocional).toBeLessThanOrEqual(operativo);
  if (promocional < operativo)
    await expect(
      page
        .locator(FORM)
        .getByText(/no tener consentimiento/i)
        .first(),
    ).toBeVisible();
  expect(intentos).toEqual([]);
});

test('K04 + K06: la vista previa resuelve {{nombre}} y muestra el HTML del cuerpo como texto', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const intentos: string[] = [];
  await sinEnvios(page, intentos);
  await abrirCompositor(page, 'admin');
  await tipo(page, /^Operativo/);
  await seccion(page, 'Mensaje');
  await page.locator('#a-subject').fill('Hola {{nombre}}');
  await page.locator('#a-body').fill('Texto <b>negrita</b> <script>alert(1)</script> fin');
  await page.locator('[data-llm-action="previsualizar-comunicado"]').click();
  const frame = page.frameLocator('iframe').first();
  await expect(frame.locator('body')).toContainText('Ana Pérez', CARGA);
  await expect(frame.locator('body')).toContainText('<b>negrita</b>');
  await expect(frame.locator('b')).toHaveCount(0);
  await expect(frame.locator('script')).toHaveCount(0);
  expect(intentos).toEqual([]);
});

test('L10: en la confirmación, "Revisar" no envía ni crea el comunicado', async ({ pageAs }) => {
  const sb = await getAdminClient();
  const { count: antes } = await sb
    .from('announcements')
    .select('id', { count: 'exact', head: true });
  const page = await pageAs('secretariaA');
  const intentos: string[] = [];
  await sinEnvios(page, intentos);
  await abrirCompositor(page, 'secretaria');
  await tipo(page, /^Operativo/);
  await seccion(page, 'Mensaje');
  await page.locator('#a-subject').fill('E2E-L10 no enviar');
  await page.locator('#a-body').fill('Prueba e2e: este comunicado no se envía.');
  await page.locator('[data-llm-action="enviar-comunicado"]').click();
  const modal = page.locator('[aria-labelledby="confirm-modal-title"]');
  await expect(modal.getByText('Enviar comunicado').first()).toBeVisible(CARGA);
  await modal.getByRole('button', { name: 'Revisar' }).click();
  await expect(page.locator(FORM)).toBeVisible();
  const { count: despues } = await sb
    .from('announcements')
    .select('id', { count: 'exact', head: true });
  expect(despues).toBe(antes);
  expect(intentos).toEqual([]);
});

test('M02 + M03: programar con fecha pasada avisa y bloquea; destildar vuelve al envío inmediato', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  const intentos: string[] = [];
  await sinEnvios(page, intentos);
  await abrirCompositor(page, 'secretaria');
  await tipo(page, /^Operativo/);
  await seccion(page, 'Mensaje');
  await page.locator('#a-subject').fill('E2E-M02');
  await page.locator('#a-body').fill('Prueba');
  await seccion(page, 'Envío');
  const programar = page.getByText('Programar para más adelante');
  await programar.click();
  await page.locator('input[type="datetime-local"]').fill('2020-01-01T10:00');
  await expect(page.getByText('La fecha de envío tiene que ser futura.')).toBeVisible();
  await expect(page.locator('[data-llm-action="enviar-comunicado"]')).toBeDisabled();
  await programar.click();
  await expect(page.getByText('La fecha de envío tiene que ser futura.')).toHaveCount(0);
  await expect(page.locator('[data-llm-action="enviar-comunicado"]')).toBeEnabled();
  expect(intentos).toEqual([]);
});

test('K10: "Plantillas de Comunicado" está en Ajustes del admin y no en el de la secretaria', async ({
  pageAs,
}) => {
  for (const [rol, ve] of [
    ['admin', 1],
    ['secretariaA', 0],
  ] as const) {
    const page = await pageAs(rol);
    await page.goto(rol === 'admin' ? '/app/admin/dashboard' : '/app/secretaria/dashboard');
    await page.locator('[data-llm-action="open-user-profile-menu"]').click();
    await page.locator('[data-llm-nav="ajustes"]').click();
    const ajustes = page.locator('app-ajustes-drawer');
    await expect(ajustes).toBeVisible(CARGA);
    await ajustes.getByRole('button', { name: 'Ajustes', exact: true }).click();
    await page.waitForTimeout(1_000);
    await expect(ajustes.getByText('Plantillas de Comunicado')).toHaveCount(ve);
  }
});

test('N07: historial vacío muestra el mensaje de estado vacío', async ({ pageAs }) => {
  const sb = await getAdminClient();
  const { count } = await sb.from('announcements').select('id', { count: 'exact', head: true });
  test.skip((count ?? 0) > 0, 'Ya hay comunicados');
  const page = await pageAs('secretariaA');
  await page.goto('/app/secretaria/observaciones');
  await page.locator('[data-llm-action="seleccionar-tab-comunicados"]:visible').first().click();
  await expect(page.getByText(/Todavía no (enviaste|hay) comunicados/i).first()).toBeVisible(CARGA);
});

test('O06 + O07: dispatch rechaza el token de un usuario; la secretaria no puede crear comunicados de otra sede ni sin sede', async () => {
  const sec = await getClientFor(ACCOUNTS.secretariaA.email, ACCOUNTS.secretariaA.password);
  const { data: s } = await sec.auth.getSession();
  const res = await fetch(
    `${environment.supabase.url}/functions/v1/dispatch-scheduled-announcements`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${s.session?.access_token}`,
        apikey: environment.supabase.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dryRun: true }),
    },
  );
  test.info().annotations.push({ type: 'O06 status', description: String(res.status) });
  expect([401, 403]).toContain(res.status);

  const admin = await getAdminClient();
  for (const branch_id of [2, null]) {
    const { data, error } = await sec
      .from('announcements')
      .insert({
        subject: `E2E-O07-${branch_id}`,
        body: 'no enviar',
        kind: 'operativo',
        branch_id,
        status: 'cancelado',
        segment_filters: {},
      })
      .select('id');
    if (data?.length)
      test.info().annotations.push({
        type: 'O07 FUGA',
        description: `insertó id ${data[0].id} con branch ${branch_id}`,
      });
    expect(error, `branch_id=${branch_id}`).not.toBeNull();
    expect(data ?? []).toEqual([]);
  }
  void admin;
  await sec.auth.signOut({ scope: 'local' });
});
