/**
 * Documentos (DMS) — segunda tanda: casos que suben y borran (ASG-i-033, fix-447-m).
 * IDs del checklist specs/testing-piloto/033-documentos-certificacion.md.
 *
 * Todo lo que suben estos tests lleva el prefijo E2E- y se borra (fila y archivo) al terminar.
 * El certificado médico (E03/E04) no está acá: `consents` no admite borrar filas (es una bitácora),
 * así que un alumno E2E- con consentimiento no se podría limpiar.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { ACCOUNTS } from './support/accounts';
import { addStudentDocuments, createE2eAlumno } from './support/alumnos-seed';
import { getAdminClient } from './support/supabase-admin';

const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };

test.describe.configure({ timeout: 120_000 });

function pdfFile(name: string) {
  return { name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') };
}

async function abrirDms(page: Page, ruta: string): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(ruta);
  await expect(page.getByText('Alumnos con documentos')).toBeVisible(CARGA);
}

/** Borra filas y archivos de una tabla del DMS cuyo file_name empieza con `prefix`. */
async function limpiarPorNombre(
  table: 'school_documents' | 'instructor_documents' | 'student_documents',
  prefix: string,
): Promise<void> {
  const sb = await getAdminClient();
  const { data } = await sb.from(table).select('id, storage_url').like('file_name', `${prefix}%`);
  const paths = (data ?? []).map((d) => d.storage_url).filter(Boolean);
  if (paths.length) await sb.storage.from('documents').remove(paths);
  if (data?.length)
    await sb
      .from(table)
      .delete()
      .in(
        'id',
        data.map((d) => d.id),
      );
}

test('D05 · D07 · D08: con 2 matrículas se elige la matrícula y los tipos ya subidos son por matrícula', async ({
  pageAs,
  cleanup,
}) => {
  const alumno = await createE2eAlumno(
    { label: 'Dms2Matriculas', branchId: 1, enrollments: [{}, {}] },
    cleanup,
  );
  await addStudentDocuments(alumno.enrollmentIds[0], ['cedula_identidad'], cleanup);

  const page = await pageAs('admin');
  await abrirDms(page, '/app/admin/documentos');
  await page.locator('app-section-hero button').first().click();
  const drawer = page.locator('app-dms-upload-drawer');

  await drawer.getByText('Seleccionar alumno...').click();
  await page.getByRole('searchbox').fill(alumno.paternalLastName);
  await page.getByRole('option', { name: new RegExp(alumno.paternalLastName) }).click();

  const matricula = drawer.getByText('Seleccionar matrícula...');
  await expect(matricula).toBeVisible(CARGA);
  await expect(drawer.locator('[data-llm-action="upload-document"]')).toBeDisabled();

  const tiposDe = async (numero: string) => {
    await drawer.locator('p-select').nth(1).click();
    // Los tipos ya subidos se filtran con los documentos de ESA matrícula: esperar su carga.
    const docs = page.waitForResponse((r) => r.url().includes('/rest/v1/students?'));
    await page.getByRole('option', { name: new RegExp(numero) }).click();
    await docs;
    await drawer.locator('p-select').last().click();
    const tipos = await page.getByRole('option').allInnerTexts();
    await page.keyboard.press('Escape');
    return tipos;
  };
  expect(await tiposDe(alumno.enrollmentNumbers[0])).not.toContain('Cédula de Identidad');
  expect(await tiposDe(alumno.enrollmentNumbers[1])).toContain('Cédula de Identidad');
});

test('F01 · F09 · F10: el admin elimina el único documento y el alumno sale de la lista', async ({
  pageAs,
  cleanup,
}) => {
  const alumno = await createE2eAlumno(
    { label: 'DmsEliminar', branchId: 1, enrollments: [{}] },
    cleanup,
  );
  // Sin cleanup.track: el test lo borra; si falla antes, lo borra el finally.
  const sb = await getAdminClient();
  await sb.from('student_documents').insert({
    enrollment_id: alumno.enrollmentIds[0],
    type: 'cedula_identidad',
    file_name: 'E2E-cedula-a-borrar.jpg',
    storage_url: `e2e/${alumno.enrollmentIds[0]}/cedula.jpg`,
    status: 'approved',
  });

  try {
    const page = await pageAs('admin');
    await abrirDms(page, '/app/admin/documentos');
    await page.getByPlaceholder('Buscar alumno por nombre o RUT...').fill(alumno.paternalLastName);
    await page.locator('[data-llm-action="view-student-documents"]').first().click(CARGA);

    const lista = page.locator('app-dms-student-docs-drawer');
    await lista.locator('[data-llm-action="delete-document"]').click(CARGA);
    await page
      .getByRole('dialog')
      .filter({ hasText: 'Eliminar documento' })
      .getByRole('button', { name: 'Eliminar' })
      .click();
    await expect(page.getByText('Documento eliminado').first()).toBeVisible(CARGA);
    await expect(lista.getByText('Sin documentos')).toBeVisible(CARGA);

    // F10: ya no tiene documentos → no aparece en la lista.
    await page.keyboard.press('Escape');
    await expect(page.getByText('No se encontraron resultados')).toBeVisible(CARGA);

    // F09: el tipo vuelve a ofrecerse para esa matrícula.
    await page.reload();
    await expect(page.getByText('Alumnos con documentos')).toBeVisible(CARGA);
    await page.locator('app-section-hero button').first().click();
    const drawer = page.locator('app-dms-upload-drawer');
    await drawer.getByText('Seleccionar alumno...').click();
    await page.getByRole('searchbox').fill(alumno.paternalLastName);
    await page.getByRole('option', { name: new RegExp(alumno.paternalLastName) }).click();
    await drawer.locator('p-select').last().click();
    await expect(page.getByRole('option', { name: 'Cédula de Identidad' })).toBeVisible();
  } finally {
    await sb.from('student_documents').delete().eq('enrollment_id', alumno.enrollmentIds[0]);
  }
});

test('I02 · I04 · I08: la secretaria sube un documento de la escuela; el admin lo ve con su nombre y lo elimina', async ({
  pageAs,
}) => {
  const nombre = `E2E-escuela-${Date.now()}.pdf`;
  const sb = await getAdminClient();
  const { data: secretaria } = await sb
    .from('users')
    .select('first_names, paternal_last_name')
    .eq('email', ACCOUNTS.secretariaA.email)
    .single();

  try {
    const sec = await pageAs('secretariaA');
    await abrirDms(sec, '/app/secretaria/documentos');
    await sec.getByRole('tab', { name: 'Documentos de la Escuela' }).click();
    await sec.locator('app-section-hero button').first().click();
    const drawer = sec.locator('app-dms-upload-drawer');
    await drawer.getByText('Seleccionar tipo...').click();
    await sec.getByRole('option', { name: 'Otro' }).click();
    await drawer
      .locator('[data-llm-description="input for the school document description"]')
      .fill('Prueba E2E');
    await drawer
      .locator('[data-llm-description="hidden file input for the document to upload"]')
      .setInputFiles(pdfFile(nombre));
    await drawer.locator('[data-llm-action="upload-document"]').click();
    await expect(sec.getByText('Documento subido').first()).toBeVisible(CARGA);
    await expect(sec.locator('li').filter({ hasText: nombre })).toBeVisible(CARGA);
    // La secretaria no puede eliminar documentos de la escuela.
    await expect(sec.locator('[data-llm-action="delete-school-document"]')).toHaveCount(0);
    const { data: fila0 } = await sb
      .from('school_documents')
      .select('id, branch_id, uploaded_by')
      .eq('file_name', nombre);
    expect(fila0, 'la subida de la secretaria quedó en la BD').toHaveLength(1);
    // fix-476-m (I07): queda de la sede de la secretaria (sede 1), no para ambas.
    expect(fila0?.[0].branch_id).toBe(1);

    const admin = await pageAs('admin');
    await abrirDms(admin, '/app/admin/documentos');
    await admin.getByRole('tab', { name: 'Documentos de la Escuela' }).click();
    const fila = admin.locator('li').filter({ hasText: nombre });
    await expect(fila).toContainText(`${secretaria?.first_names}`, CARGA);
    await expect(fila).not.toContainText('Sistema');

    await fila.locator('[data-llm-action="delete-school-document"]').click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
    await expect(admin.getByText('Documento eliminado').first()).toBeVisible(CARGA);
    await expect(fila).toHaveCount(0);
  } finally {
    await limpiarPorNombre('school_documents', 'E2E-escuela-');
  }
});

test('H05 · H07 · H08: subir, ver y eliminar un documento de instructor', async ({ pageAs }) => {
  const nombre = `E2E-instructor-${Date.now()}.pdf`;
  try {
    const page = await pageAs('admin');
    await abrirDms(page, '/app/admin/documentos');
    await page.getByRole('tab', { name: 'Documentos de Instructores' }).click();
    await page.locator('[data-llm-action="view-instructor-documents"]').first().click(CARGA);
    const lista = page.locator('app-dms-instructor-docs-drawer');
    await lista.locator('[data-llm-action="upload-document"]').click(CARGA);

    const drawer = page.locator('app-dms-upload-drawer');
    await drawer.getByText('Seleccionar tipo...').click();
    await page.getByRole('option').first().click();
    await drawer
      .locator('[data-llm-description="hidden file input for the document to upload"]')
      .setInputFiles(pdfFile(nombre));
    await drawer.locator('[data-llm-action="upload-document"]').click();

    const doc = lista.locator('[data-llm-action="preview-document"]').filter({ hasText: nombre });
    await expect(doc).toBeVisible(CARGA);
    await doc.click();
    await expect(page.locator('app-dms-doc-preview-drawer iframe')).toBeVisible(CARGA);
    await page.getByRole('button', { name: 'Volver' }).click();

    await doc.locator('[data-llm-action="delete-document"]').click();
    await page
      .getByRole('dialog')
      .filter({ hasText: 'Eliminar documento' })
      .getByRole('button', { name: 'Eliminar', exact: true })
      .click();
    await expect(page.getByText('Documento eliminado').first()).toBeVisible(CARGA);
    await expect(doc).toHaveCount(0);
  } finally {
    await limpiarPorNombre('instructor_documents', 'E2E-instructor-');
  }
});
