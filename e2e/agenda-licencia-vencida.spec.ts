/**
 * Agenda con instructor de licencia vencida (ASG-i-034 S7, fix-202-b). Decisión del owner, opción
 * B: la Agenda lo sigue ofreciendo, con aviso.
 *
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. Se intercepta la respuesta de
 * instructores y se le pone una fecha vencida al primero: la BD no se toca.
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const AVISO = '[data-llm-description="aviso de instructores con licencia de conducir vencida"]';

test('S7: instructor con licencia vencida → "· licencia vencida" en el selector y aviso con la fecha', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaB');
  let vencido = '';
  await page.route('**/rest/v1/instructors?select=id%2Clicense_expiry*', async (route) => {
    const res = await route.fetch();
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length) {
      rows[0].license_expiry = '2026-09-30';
      vencido = `${rows[0].users.first_names} ${rows[0].users.paternal_last_name}`;
    }
    await route.fulfill({ response: res, json: rows });
  });

  await page.goto('/app/secretaria/agenda');
  await expect(page.locator(AVISO).first()).toBeVisible({ timeout: 30_000 });
  // Al cargar queda elegido el primer instructor (el vencido).
  await expect(page.locator(AVISO).first()).toHaveText(
    `La licencia de ${vencido} venció el 30-09-2026. Sus horas se siguen ofreciendo.`,
  );

  await page.locator('[data-llm-description="Filtrar calendario por instructor"]').first().click();
  await expect(page.getByRole('option', { name: `${vencido} · licencia vencida` })).toBeVisible();
});
