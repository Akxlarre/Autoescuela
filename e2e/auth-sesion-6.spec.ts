/**
 * Testing de autenticación y sesión — sexta tanda (ASG-i-022, fix-183-b): salir del wizard de
 * matrícula con un borrador abierto (M01, M02, M03, M06) y cerrar sesión con el borrador (E09, M08).
 * Cada test siembra su alumno E2E- con un borrador vigente y lo borra al terminar (fixture cleanup).
 */
import type { Page } from '@playwright/test';
import { createE2eAlumno } from './support/alumnos-seed';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const SEDE_A = 1;
const CARGA = { timeout: 30_000 };
const EMAIL = '[data-llm-description="User email address for authentication"]';
/** Algún paso del wizard ya renderizado = el borrador terminó de cargar. */
const PASO =
  'app-personal-data-step, app-assignment-step, app-documents-step, app-payment-step, app-contract-step, app-confirmation-step';
const MODAL = '[aria-labelledby="confirm-modal-title"]';

/** Siembra un alumno con un borrador vigente en la sede A y devuelve su apellido. */
async function conBorrador(label: string, cleanup: Parameters<typeof createE2eAlumno>[1]) {
  const alumno = await createE2eAlumno(
    { label, branchId: SEDE_A, enrollments: [{ status: 'draft' }] },
    cleanup,
  );
  const sb = await getAdminClient();
  const { error } = await sb
    .from('enrollments')
    .update({ expires_at: new Date(Date.now() + 86_400_000).toISOString() })
    .eq('id', alumno.enrollmentIds[0]);
  expect(error, 'dejar el borrador vigente').toBeNull();
  return alumno.paternalLastName;
}

/** Abre la matrícula y retoma el borrador del alumno. */
async function retomar(page: Page, apellido: string): Promise<void> {
  await page.goto('/app/secretaria/matricula');
  const tarjeta = page
    .locator('app-draft-list [data-llm-action="resume-enrollment-draft"]')
    .filter({ hasText: apellido })
    .first();
  await expect(tarjeta).toBeVisible(CARGA);
  await tarjeta.click();
  await expect(page.locator('app-draft-list')).toHaveCount(0, CARGA);
  await expect(page.locator(PASO).first()).toBeVisible(CARGA);
}

const menuDashboard = (page: Page) =>
  page.locator('app-sidebar a[href="/app/secretaria/dashboard"]').first();

test('M01 + M02 + M03: con borrador, el menú pide confirmar; "Quedarse" sigue, "Sí, salir" navega y el borrador queda', async ({
  pageAs,
  cleanup,
}) => {
  const apellido = await conBorrador('BorradorSalir', cleanup);
  const page = await pageAs('secretariaA');
  await retomar(page, apellido);
  const modal = page.locator(MODAL);

  // M01
  await menuDashboard(page).click();
  await expect(modal.getByText('¿Deseas salir?')).toBeVisible(CARGA);
  // M02
  await modal.getByRole('button', { name: 'Quedarse' }).click();
  await expect(modal).toHaveCount(0);
  await expect(page).toHaveURL(/\/app\/secretaria\/matricula/);
  // M03
  await menuDashboard(page).click();
  await modal.getByRole('button', { name: 'Sí, salir' }).click();
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard$/, CARGA);
  await page.goto('/app/secretaria/matricula');
  await expect(
    page
      .locator('app-draft-list [data-llm-action="resume-enrollment-draft"]')
      .filter({ hasText: apellido })
      .first(),
  ).toBeVisible(CARGA);
});

test('M06: "Atrás" del navegador con borrador muestra el mismo aviso', async ({
  pageAs,
  cleanup,
}) => {
  const apellido = await conBorrador('BorradorAtras', cleanup);
  const page = await pageAs('secretariaA');
  await page.goto('/app/secretaria/dashboard');
  await expect(menuDashboard(page)).toBeVisible(CARGA);
  // Navegación dentro de la app (sin recargar), para que "Atrás" pase por el router.
  await page.locator('app-sidebar a[href="/app/secretaria/matricula"]').first().click();
  const tarjeta = page
    .locator('app-draft-list [data-llm-action="resume-enrollment-draft"]')
    .filter({ hasText: apellido })
    .first();
  await expect(tarjeta).toBeVisible(CARGA);
  await tarjeta.click();
  await expect(page.locator('app-draft-list')).toHaveCount(0, CARGA);
  await expect(page.locator(PASO).first()).toBeVisible(CARGA);
  await page.goBack();
  const modal = page.locator(MODAL);
  await expect(modal.getByText('¿Deseas salir?')).toBeVisible(CARGA);
  await modal.getByRole('button', { name: 'Quedarse' }).click();
  await expect(page).toHaveURL(/\/app\/secretaria\/matricula/);
});

test('E09 + M08: cerrar sesión con un borrador abierto termina en el login, sin pantallas a medio salir', async ({
  pageAs,
  cleanup,
}) => {
  const apellido = await conBorrador('BorradorLogout', cleanup);
  const page = await pageAs('secretariaA');
  await retomar(page, apellido);

  await page.locator('[data-llm-action="open-user-profile-menu"]').click();
  await page.locator('[data-llm-action="cerrar-sesion"]').click();
  const modal = page.locator(MODAL);
  await expect(modal.getByText('Cerrar sesión').first()).toBeVisible(CARGA);
  await modal.getByRole('button', { name: 'Sí, salir' }).click();

  // Puede aparecer además el aviso del borrador; si aparece, se acepta salir.
  const avisoBorrador = modal.getByText('¿Deseas salir?');
  const enLogin = page.locator(EMAIL);
  await expect(avisoBorrador.or(enLogin).first()).toBeVisible(CARGA);
  const pidioBorrador = await avisoBorrador.isVisible();
  if (pidioBorrador) await modal.getByRole('button', { name: 'Sí, salir' }).click();
  await expect(page).toHaveURL(/\/login/, CARGA);
  await expect(enLogin).toBeVisible();
  test.info().annotations.push({
    type: 'E09 aviso del borrador al cerrar sesión',
    description: pidioBorrador ? 'sí' : 'no',
  });

  // La sesión quedó cerrada de verdad: volver a la app pide login.
  await page.goto('/app/secretaria/dashboard');
  await expect(page).toHaveURL(/\/login/, CARGA);
});
