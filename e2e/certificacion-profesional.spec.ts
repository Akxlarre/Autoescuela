/**
 * Certificados Clase Profesional en el piloto (ASG-m-011, fix-480-m).
 *
 * Los alumnos son E2E- en la promoción 277 (finalizada, sede 2) y se borran al terminar. El
 * certificado que genera la UI deja fila en `certificates`, historial y un PDF en Storage: se borran
 * a mano en `limpiarCertificado` (la limpieza de `cleanup` solo borra las filas que registra).
 * Nunca se emite con deuda: la habilitación (`enrollment_payment_overrides`) no se puede borrar.
 */
import type { Page } from '@playwright/test';
import { expect, test, type Cleanup } from './support/fixtures';
import { ACCOUNTS } from './support/accounts';
import { createE2eAlumno } from './support/alumnos-seed';
import { getAdminClient, getClientFor } from './support/supabase-admin';

const DESKTOP = { width: 1440, height: 900 };
const CARGA = { timeout: 30_000 };
/** Promoción 277 (id 14), finalizada; cursos A2 = 46, A4 = 47. */
const PROMO = 'Promoción 277';
const CURSO_A2 = { id: 46, nombre: 'Profesional A2' };
const CURSO_A4 = { id: 47, nombre: 'Profesional A4' };

test.describe.configure({ timeout: 150_000 });

async function alumnoProfesional(
  label: string,
  curso: { id: number; nombre: string },
  pendingBalance: number,
  cleanup: Cleanup,
) {
  return createE2eAlumno(
    {
      label,
      branchId: 2,
      enrollments: [
        {
          courseName: curso.nombre,
          promotionCourseId: curso.id,
          status: 'completed',
          pendingBalance,
          paymentStatus: pendingBalance > 0 ? 'partial' : 'paid',
        },
      ],
    },
    cleanup,
  );
}

/** Elige una opción de un p-select por su `data-llm-description` y espera que se cierre. */
async function elegir(page: Page, descripcion: string, opcion: string): Promise<void> {
  await page.locator(`[data-llm-description="${descripcion}"]`).click(CARGA);
  await page.getByRole('option', { name: opcion }).first().click();
  await expect(page.getByRole('option')).toHaveCount(0);
}

async function abrirCurso(page: Page, ruta: string, curso: string): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(ruta);
  await elegir(page, 'Selector de promoción de clase profesional finalizada', PROMO);
  await elegir(page, 'Selector de curso dentro de la promoción seleccionada', curso);
}

/** Borra historial, certificado y PDF que la UI generó para la matrícula. */
async function limpiarCertificado(enrollmentId: number): Promise<void> {
  const sb = await getAdminClient();
  const { data: cert } = await sb
    .from('certificates')
    .select('id')
    .eq('enrollment_id', enrollmentId)
    .maybeSingle();
  if (cert) {
    await sb.from('certificate_issuance_log').delete().eq('certificate_id', cert.id);
    await sb.from('certificates').delete().eq('id', cert.id);
  }
  const { data: e } = await sb
    .from('enrollments')
    .select('certificate_professional_pdf_url')
    .eq('id', enrollmentId)
    .maybeSingle();
  if (e?.certificate_professional_pdf_url) {
    await sb.storage.from('documents').remove([e.certificate_professional_pdf_url]);
  }
}

async function folioDe(enrollmentId: number): Promise<number | null> {
  const sb = await getAdminClient();
  const { data } = await sb
    .from('certificates')
    .select('folio')
    .eq('enrollment_id', enrollmentId)
    .maybeSingle();
  return data?.folio ?? null;
}

test('P01 · P02 (fix-481-m, fix-482-m): generar y regenerar conservan el folio; la fila muestra el Nº', async ({
  pageAs,
  cleanup,
}) => {
  const alumno = await alumnoProfesional('CertProfOk', CURSO_A2, 0, cleanup);
  const enrollmentId = alumno.enrollmentIds[0];
  try {
    const page = await pageAs('admin');
    await abrirCurso(page, '/app/admin/clase-profesional/certificados', 'Profesional A2');

    // El buscador encuentra por Nº de matrícula y la fila lo muestra primero.
    await page.getByPlaceholder('Buscar por Nº, nombre o RUT...').fill(alumno.enrollmentNumbers[0]);
    const fila = page.locator('.desktop-view tbody tr');
    await expect(fila).toHaveCount(1, CARGA);
    await expect(fila.locator('td').first()).toHaveText(alumno.enrollmentNumbers[0]);
    await expect(page.locator('.desktop-view th', { hasText: 'Promoción' })).toHaveCount(0);

    // Generar: sin avisos ni deuda se emite directo y abre el visor.
    await fila.locator('[data-llm-action="generate-professional-certificate"]').click();
    await expect(page.getByText('Certificado profesional generado correctamente')).toBeVisible(
      CARGA,
    );
    await expect.poll(() => folioDe(enrollmentId), CARGA).not.toBeNull();
    const folio = await folioDe(enrollmentId);
    await page.getByRole('button', { name: 'Cerrar panel' }).click();

    // Regenerar: confirma y conserva el folio.
    await fila.locator('[data-llm-action="regenerate-professional-certificate"]').click(CARGA);
    const modal = page.getByRole('dialog').filter({ hasText: 'Regenerar certificado' });
    await expect(modal).toContainText('El folio no cambia');
    await modal.getByRole('button', { name: 'Regenerar' }).click();
    await expect(page.getByText('Certificado regenerado')).toBeVisible(CARGA);
    expect(await folioDe(enrollmentId)).toBe(folio);
  } finally {
    await limpiarCertificado(enrollmentId);
  }
});

test('P03: con deuda, Generar pide el motivo; al cancelar no se emite', async ({
  pageAs,
  cleanup,
}) => {
  const alumno = await alumnoProfesional('CertProfDeuda', CURSO_A4, 40_000, cleanup);
  const page = await pageAs('secretariaB');
  await abrirCurso(page, '/app/secretaria/profesional/certificados', 'Profesional A4');

  // "Generar Pendientes" no lo cuenta (solo los que tienen el pago al día).
  await page.getByPlaceholder('Buscar por Nº, nombre o RUT...').fill(alumno.paternalLastName);
  const fila = page.locator('.desktop-view tbody tr').filter({ hasText: alumno.paternalLastName });
  await expect(fila).toContainText('Pendiente', CARGA);

  await fila.locator('[data-llm-action="generate-professional-certificate"]').click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Certificado con deuda' });
  await expect(modal).toContainText('$40.000', CARGA);
  await modal.getByRole('button', { name: 'Cancelar' }).click();

  expect(await folioDe(alumno.enrollmentIds[0])).toBeNull();
});

test('P04: la secretaria de otra sede no entra ni genera por API', async ({ pageAs, cleanup }) => {
  const alumno = await alumnoProfesional('CertProfSede', CURSO_A2, 0, cleanup);

  const page = await pageAs('secretariaA');
  await page.goto('/app/secretaria/profesional/certificados');
  await expect(page).toHaveURL(/\/app\/secretaria\/dashboard/, CARGA);

  const sb = await getClientFor(ACCOUNTS.secretariaA.email, ACCOUNTS.secretariaA.password);
  const { error } = await sb.functions.invoke('generate-certificate-professional-pdf', {
    body: { enrollment_id: alumno.enrollmentIds[0] },
  });
  expect((error as { context?: Response } | null)?.context?.status).toBe(403);
});

test('P05 (hotfix-167-m): selectores sin datos repetidos e historial del curso elegido', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/clase-profesional/certificados');

  await page
    .locator('[data-llm-description="Selector de promoción de clase profesional finalizada"]')
    .click(CARGA);
  await expect(
    page.getByRole('option', { name: 'Promoción 277 (24 de Agosto 2026)' }),
  ).toBeVisible();
  await expect(page.getByRole('option', { name: /^277 — / })).toHaveCount(0);
  await page.getByRole('option', { name: /Promoción 277/ }).click();

  await page
    .locator('[data-llm-description="Selector de curso dentro de la promoción seleccionada"]')
    .click(CARGA);
  await expect(page.getByRole('option')).toHaveText([
    'Profesional A2',
    'Profesional A3',
    'Profesional A4',
    'Profesional A5',
  ]);
  await page.getByRole('option', { name: 'Profesional A2' }).click();
  await expect(page.getByRole('option')).toHaveCount(0);

  await page.getByRole('button', { name: 'Historial de emisiones' }).click();
  await expect(page.getByText(/registros? de emisión del curso seleccionado/)).toBeVisible(CARGA);
});
