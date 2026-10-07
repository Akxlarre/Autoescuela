/**
 * DV del RUT: se completa solo si falta; si se escribió y está mal, error (fix-213-b, C05 de
 * ASG-i-034; requerimiento original ASG-b-047). Antes, `11111111` quedaba `1.111.111-4`.
 *
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. Solo se escribe en el campo; nunca se
 * envía el formulario.
 */
import { expect, test } from './support/fixtures';
import type { Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

async function probarRut(page: Page, campo: string): Promise<void> {
  const rut = page.locator(campo);

  // Solo el número: mientras se escribe, sin guion; al salir, se agrega el DV.
  await rut.pressSequentially('11111111', { delay: 20 });
  await expect(rut).toHaveValue('11.111.111');
  await rut.press('Tab');
  await expect(rut).toHaveValue('11.111.111-1');

  // Con guion y DV equivocado: se respeta lo escrito (no se "corrige") y queda inválido.
  await rut.fill('');
  await rut.pressSequentially('12345678-1', { delay: 20 });
  await rut.press('Tab');
  await expect(rut).toHaveValue('12.345.678-1');
  await expect(
    page.getByText(/RUT inválido|RUT no es válido|dígito verificador/i).first(),
  ).toBeVisible();

  // Con guion y DV correcto: queda igual.
  await rut.fill('');
  await rut.pressSequentially('12345678-5', { delay: 20 });
  await rut.press('Tab');
  await expect(rut).toHaveValue('12.345.678-5');
}

test('C05: Crear instructor — el DV se completa solo si falta', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/instructores');
  await page.locator('[data-llm-action="new"]').first().click();
  await probarRut(page, '#c-rut');
});

test('C05: Crear secretaria — el DV se completa solo si falta', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/secretarias');
  await expect(page.locator('.secretaria-row').first()).toBeVisible();
  await page.locator('[data-llm-action="new"]').first().click();
  await probarRut(page, 'input[id*="rut"]');
});
