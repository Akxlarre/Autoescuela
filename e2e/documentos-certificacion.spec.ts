/**
 * Documentos (DMS), plantillas y certificación Clase B (ASG-i-033, fix-447-m).
 * IDs del checklist specs/testing-piloto/033-documentos-certificacion.md.
 *
 * Los alumnos son E2E- y se borran al terminar. Los archivos que sube la UI van a Storage y se
 * borran a mano al final de cada test (la limpieza de `cleanup` solo borra filas).
 */
import type { Page } from '@playwright/test';
import { expect, test, watchErrors, type Cleanup } from './support/fixtures';
import { ACCOUNTS } from './support/accounts';
import {
  addCompletedPractices,
  addStudentDocuments,
  createE2eAlumno,
} from './support/alumnos-seed';
import { getAdminClient, getClientFor } from './support/supabase-admin';

const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };

test.describe.configure({ timeout: 120_000 });

/** PDF mínimo válido, para subir sin depender de archivos del disco. */
function pdfFile(name: string) {
  const body =
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(body) };
}

/** Alumno E2E de la sede 1 con una matrícula Clase B y una cédula ya cargada (aparece en el DMS). */
async function alumnoConDocumento(label: string, cleanup: Cleanup) {
  const alumno = await createE2eAlumno({ label, branchId: 1, enrollments: [{}] }, cleanup);
  await addStudentDocuments(alumno.enrollmentIds[0], ['cedula_identidad'], cleanup);
  return alumno;
}

/** Busca al alumno en "Documentos del Alumno" y abre su drawer de documentos. */
async function abrirDocumentosDe(page: Page, apellido: string): Promise<void> {
  await page.getByPlaceholder('Buscar alumno por nombre o RUT...').fill(apellido);
  const fila = page.locator('tr, li').filter({ hasText: apellido }).first();
  await fila.locator('[data-llm-action="view-student-documents"]').click(CARGA);
  await expect(page.locator('app-dms-student-docs-drawer')).toBeVisible();
}

/** Borra de Storage los archivos que la UI subió para una matrícula y registra sus filas. */
async function limpiarSubidas(enrollmentId: number, cleanup: Cleanup): Promise<void> {
  const sb = await getAdminClient();
  const { data } = await sb
    .from('student_documents')
    .select('id, storage_url')
    .eq('enrollment_id', enrollmentId);
  const paths = (data ?? []).map((d) => d.storage_url).filter((p) => p?.startsWith('students/'));
  if (paths.length) await sb.storage.from('documents').remove(paths);
}

test('A01 · A02 · J20: el admin ve 4 pestañas y la secretaria 3, sin Plantillas', async ({
  pageAs,
}) => {
  const admin = await pageAs('admin');
  const errors = watchErrors(admin);
  await admin.setViewportSize(DESKTOP);
  await admin.goto('/app/admin/documentos');
  const tabsAdmin = admin.getByRole('tab');
  await expect(tabsAdmin.filter({ hasText: 'Plantillas' })).toBeVisible(CARGA);
  await expect(tabsAdmin).toHaveCount(4);
  errors.expectClean();

  const secretaria = await pageAs('secretariaA');
  await secretaria.setViewportSize(DESKTOP);
  await secretaria.goto('/app/secretaria/documentos');
  const tabsSec = secretaria.getByRole('tab');
  await expect(tabsSec.filter({ hasText: 'Documentos del Alumno' })).toBeVisible(CARGA);
  await expect(tabsSec).toHaveCount(3);
  await expect(tabsSec.filter({ hasText: 'Plantillas' })).toHaveCount(0);
});

test('C08 · D16 · G01 · G04: subir un documento desde el drawer del alumno, verlo y descargarlo', async ({
  pageAs,
  cleanup,
}) => {
  const alumno = await alumnoConDocumento('DmsSubir', cleanup);
  const enrollmentId = alumno.enrollmentIds[0];
  const page = await pageAs('admin');
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/documentos');
  try {
    await abrirDocumentosDe(page, alumno.paternalLastName);
    await page.locator('app-dms-student-docs-drawer [data-llm-action="upload-document"]').click();

    const drawer = page.locator('app-dms-upload-drawer');
    // fix-472-m: el alumno viene preseleccionado aunque el drawer de la matrícula siga cargando.
    await expect(drawer.locator('p-select').first()).toContainText(alumno.paternalLastName);
    await drawer.getByText('Seleccionar tipo...').click();
    await page.getByRole('option', { name: 'Foto (Carnet)' }).click();
    await drawer
      .locator('[data-llm-description="hidden file input for the document to upload"]')
      .setInputFiles(pdfFile('e2e-foto-carnet.pdf'));
    await drawer.locator('[data-llm-action="upload-document"]').click();
    await expect(page.getByText('Documento subido').first()).toBeVisible(CARGA);

    // Vuelve al drawer del alumno con el documento nuevo.
    const lista = page.locator('app-dms-student-docs-drawer');
    const nuevo = lista.locator('[data-llm-action="preview-document"]', {
      hasText: 'e2e-foto-carnet.pdf',
    });
    await expect(nuevo).toBeVisible(CARGA);

    await nuevo.click();
    const preview = page.locator('app-dms-doc-preview-drawer');
    await expect(preview.locator('iframe')).toBeVisible(CARGA);
    // fix-468-m: "Descargar" descarga de verdad, con el nombre del documento.
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      preview.locator('[data-llm-action="download-document"]').click(),
    ]);
    expect(descarga.suggestedFilename()).toBe('e2e-foto-carnet.pdf');
  } finally {
    await limpiarSubidas(enrollmentId, cleanup);
    const sb = await getAdminClient();
    await sb
      .from('student_documents')
      .delete()
      .eq('enrollment_id', enrollmentId)
      .eq('type', 'id_photo');
  }
});

test('F08 (fix-471-m): la secretaria reemplaza una cédula mal escaneada', async ({
  pageAs,
  cleanup,
}) => {
  const alumno = await alumnoConDocumento('DmsReemplazo', cleanup);
  const enrollmentId = alumno.enrollmentIds[0];
  const page = await pageAs('secretariaA');
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/secretaria/documentos');
  try {
    await abrirDocumentosDe(page, alumno.paternalLastName);
    const drawer = page.locator('app-dms-student-docs-drawer');
    // La secretaria no ve Eliminar, pero sí Reemplazar.
    await expect(drawer.locator('[data-llm-action="delete-document"]')).toHaveCount(0);

    const chooser = page.waitForEvent('filechooser');
    await drawer.locator('[data-llm-action="replace-student-document"]').first().click();
    await (await chooser).setFiles(pdfFile('cedula-buena.pdf'));

    const modal = page.getByRole('dialog').filter({ hasText: 'Reemplazar documento' });
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Reemplazar' }).click();
    await expect(page.getByText('Documento reemplazado').first()).toBeVisible(CARGA);
    await expect(drawer.getByText('cedula-buena.pdf')).toBeVisible(CARGA);

    const sb = await getAdminClient();
    const { data } = await sb
      .from('student_documents')
      .select('file_name, storage_url, status')
      .eq('enrollment_id', enrollmentId)
      .single();
    expect(data).toMatchObject({ file_name: 'cedula-buena.pdf', status: 'pending' });
    expect(data?.storage_url).toMatch(
      new RegExp(`^students/${enrollmentId}/\\d+_cedula_identidad\\.pdf$`),
    );
  } finally {
    await limpiarSubidas(enrollmentId, cleanup);
  }
});

test('C05 · C06 (fix-470-m): el drawer muestra el contrato firmado y el certificado, sin Eliminar', async ({
  pageAs,
  cleanup,
}) => {
  const alumno = await alumnoConDocumento('DmsCertificado', cleanup);
  const enrollmentId = alumno.enrollmentIds[0];
  const sb = await getAdminClient();
  const { error: certErr } = await sb
    .from('enrollments')
    .update({ certificate_b_pdf_url: `e2e/${enrollmentId}/certificado.pdf` })
    .eq('id', enrollmentId);
  if (certErr) throw new Error(`[e2e] No se pudo marcar el certificado: ${certErr.message}`);
  const { data: contrato, error: dcErr } = await sb
    .from('digital_contracts')
    .insert({
      enrollment_id: enrollmentId,
      file_name: 'E2E-contrato-generado.pdf',
      file_url: `e2e/${enrollmentId}/contract.pdf`,
      signed_contract_url: `e2e/${enrollmentId}/signed_contract.pdf`,
    })
    .select('id')
    .single();
  if (dcErr) throw new Error(`[e2e] No se pudo crear el contrato: ${dcErr.message}`);
  cleanup.track('digital_contracts', contrato.id);

  const page = await pageAs('admin');
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/documentos');
  await abrirDocumentosDe(page, alumno.paternalLastName);
  const drawer = page.locator('app-dms-student-docs-drawer');
  const fila = (texto: string) =>
    drawer.locator('[data-llm-action="preview-document"]').filter({ hasText: texto });

  await expect(fila('Contrato firmado')).toHaveCount(1, CARGA);
  await expect(fila('Certificado Clase B')).toHaveCount(1);
  await expect(fila('Contrato firmado').locator('[data-llm-action="delete-document"]')).toHaveCount(
    0,
  );
  await expect(
    fila('Certificado Clase B').locator('[data-llm-action="delete-document"]'),
  ).toHaveCount(0);
  // fix-475-m: el contrato tampoco se elimina desde el DMS; la cédula sí.
  await expect(
    drawer
      .locator('[data-llm-action="preview-document"]')
      .filter({ hasText: 'E2E-contrato-generado.pdf' })
      .locator('[data-llm-action="delete-document"]'),
  ).toHaveCount(0);
  await expect(
    fila('Cédula de Identidad').locator('[data-llm-action="delete-document"]'),
  ).toHaveCount(1);
});

test('J13 · J15 · J16 (fix-469-m): el editor de plantillas protege los cambios sin publicar', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/documentos');
  await page.getByRole('tab', { name: 'Plantillas' }).click(CARGA);

  const textarea = page.locator('app-document-clause-field textarea').first();
  await expect(textarea).toBeVisible(CARGA);
  const original = await textarea.inputValue();
  await textarea.fill(`${original} E2E`);

  const descartar = page.locator('[data-llm-action="discard-document-template-changes"]');
  await expect(descartar).toBeVisible();
  await expect(page.getByText('Cambios sin publicar')).toBeVisible();
  await expect(
    page.locator(
      '[data-llm-action="select-document-template-branch"] .p-disabled, [data-llm-action="select-document-template-branch"].p-disabled',
    ),
  ).toHaveCount(1);

  // Publicar confirma nombrando el documento; se cancela para no tocar la plantilla real.
  await page.locator('[data-llm-action="publish-document-template"]').click();
  const publicar = page.getByRole('dialog').filter({ hasText: '¿Publicar la plantilla?' });
  await expect(publicar).toContainText('Contrato Clase B');
  await publicar.getByRole('button', { name: 'Cancelar' }).click();

  // Salir de Documentos pide confirmación; "Quedarse" no navega.
  await page.locator('a[href="/app/admin/dashboard"]').first().click();
  const salir = page.getByRole('dialog').filter({ hasText: '¿Salir sin publicar?' });
  await expect(salir).toBeVisible();
  await salir.getByRole('button', { name: 'Quedarse' }).click();
  await expect(page).toHaveURL(/\/app\/admin\/documentos/);

  await descartar.click();
  await expect(textarea).toHaveValue(original);
  await expect(descartar).toHaveCount(0);

  // J16: si la carga de otra sede falla, no queda el formulario anterior.
  await page.route('**/rest/v1/document_templates*', (route) => route.abort());
  await page.locator('[data-llm-action="select-document-template-branch"]').click();
  await page.getByRole('option').nth(1).click();
  await expect(page.getByText('Error al cargar la plantilla').first()).toBeVisible(CARGA);
  await expect(page.locator('[data-llm-action="publish-document-template"]')).toBeDisabled();
  await expect(page.locator('app-document-clause-field')).toHaveCount(0);
});

test('L06 · L07 · P09: un alumno sin las prácticas completas no se certifica sin autorización', async ({
  pageAs,
  cleanup,
}) => {
  const alumno = await createE2eAlumno(
    { label: 'CertNoElegible', branchId: 1, enrollments: [{}] },
    cleanup,
  );
  const enrollmentId = alumno.enrollmentIds[0];
  await addCompletedPractices(enrollmentId, 5, cleanup);

  // Secretaria: un alumno que no cumple no aparece en su lista (fix-459-m).
  const secretaria = await pageAs('secretariaA');
  await secretaria.setViewportSize(DESKTOP);
  await secretaria.goto('/app/secretaria/certificados');
  await expect(secretaria.getByText('Gestión de Certificados')).toBeVisible(CARGA);
  await expect(secretaria.getByText(alumno.paternalLastName)).toHaveCount(0);

  // Ni por API con force (el bypass es solo del admin).
  const sbSec = await getClientFor(ACCOUNTS.secretariaA.email, ACCOUNTS.secretariaA.password);
  const { error } = await sbSec.functions.invoke('generate-certificate-b-pdf', {
    body: { enrollment_id: enrollmentId, force: true },
  });
  expect(error, 'la secretaria no puede forzar el certificado').toBeTruthy();
  expect((error as { context?: Response }).context?.status).toBe(400);

  // Admin: lo ve, y "Generar" avisa de las prácticas incompletas; al cancelar no se emite nada.
  const admin = await pageAs('admin');
  await admin.setViewportSize(DESKTOP);
  await admin.goto('/app/admin/certificacion');
  await admin.getByPlaceholder('Buscar por nombre o RUT...').fill(alumno.paternalLastName, CARGA);
  const fila = admin.locator('tr').filter({ hasText: alumno.paternalLastName });
  await expect(fila).toContainText('5/12', CARGA);
  await fila.locator('[data-llm-action="generate-certificate"]').click();
  const modal = admin.getByRole('dialog').filter({ hasText: 'Generar certificado' });
  await expect(modal).toContainText('5');
  await modal.getByRole('button', { name: 'Cancelar' }).click();

  const sb = await getAdminClient();
  const { data } = await sb
    .from('enrollments')
    .select('certificate_b_pdf_url')
    .eq('id', enrollmentId)
    .single();
  expect(data?.certificate_b_pdf_url).toBeNull();
});

test('O04 (hotfix-161-m): Documentos de la secretaria multisede recarga al cambiar de sede', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaMultisede');
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/secretaria/documentos');
  await expect(page.getByText('Alumnos con documentos')).toBeVisible(CARGA);

  const recarga = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/school_documents') && r.request().method() === 'GET',
    CARGA,
  );
  await page.locator('[data-llm-action="toggle-branch-dropdown"]').click();
  await page
    .getByRole('listbox', { name: 'Seleccionar sede' })
    .getByRole('option', { name: 'Conductores Chillán' })
    .click();
  const response = await recarga;
  expect(response.url()).toContain('branch_id.eq.2');
});
