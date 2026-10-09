/**
 * Humo del deploy de `create-instructor` (fix-214-b). ⚠️ Contra el BUILD DE PRODUCCIÓN y la
 * función REAL, pero sin efectos: el correo ya existe, así que la función corta con 409 antes de
 * crear nada. Confirma que la versión desplegada arranca y que el front manda `sendInvite`.
 */
import { expect, test } from './support/fixtures';
import { isBlockedInPilot } from '../src/app/core/config/pilot-phase.config';

test.describe.configure({ timeout: 120_000 });

test('create-instructor desplegada responde 409 con un correo ya registrado', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const resp = page.waitForResponse((r) => r.url().includes('/functions/v1/create-instructor'));

  await page.goto('/app/admin/instructores');
  await page.locator('[data-llm-action="new"]').first().click();
  await page.locator('#c-nombres').fill('Prueba');
  await page.locator('#c-paterno').fill('Deploy');
  await page.locator('#c-rut').fill('11.111.111-1');
  await page.locator('#c-email').fill('instructor.seed1@test-data.local'); // ya existe
  await page.locator('#c-telefono').fill('912345678');
  await page.locator('#c-license-num').fill('11111111');
  const fecha = page.locator(
    '[data-llm-description="Fecha de vencimiento de la licencia del instructor"] input',
  );
  await fecha.click();
  await fecha.pressSequentially('31/12/2030', { delay: 30 });
  await fecha.press('Tab');
  await page.locator('#c-type').click();
  await page.getByRole('option').first().click();
  await page.locator('#branch-scope-sede').click();
  await page.getByRole('option').first().click();
  await page.locator('[data-llm-action="confirmar-crear-instructor"]').click();

  const r = await resp;
  expect(r.request().postDataJSON()['sendInvite']).toBe(!isBlockedInPilot('instructor'));
  expect(r.status()).toBe(409);
});
