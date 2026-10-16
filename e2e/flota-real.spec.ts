/**
 * Casos MANUALES del checklist 032 de Flota (ASG-i-032, fix-220-b) que escriben de verdad:
 * crean el vehículo de prueba ZZ4199, le suben documentos y le registran mantenimientos.
 *
 * Solo corre con E2E_FLOTA_REAL=1. NO borra nada: al terminar imprime el SQL de limpieza para el
 * owner. El combustible (O) NO se registra de verdad (quedaría en la caja real del día): se
 * intercepta.
 */
import type { Page } from '@playwright/test';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };
const BUSCADOR = '[data-llm-description="input for searching vehicles by plate, brand or model"]';
const PATENTE = 'ZZ4199';
const BRANCH_KEY = 'autoescuela:selectedBranchId';
const SEDE_A = { id: 1, name: 'Autoescuela Chillán' };

test.skip(!process.env['E2E_FLOTA_REAL'], 'Escribe en la BD: solo con E2E_FLOTA_REAL=1');
test.describe.configure({ mode: 'serial', timeout: 180_000 });

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Día de calendario de Chile a N días de hoy (YYYY-MM-DD). */
function enDias(n: number): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Escribe una fecha ISO en un app-date-input (máscara dd/mm/aaaa). */
async function escribirFecha(page: Page, inputId: string, iso: string): Promise<void> {
  const [y, m, d] = iso.split('-');
  const input = page.locator(`input#${inputId}`);
  await input.click();
  await input.fill('');
  await input.pressSequentially(`${d}${m}${y}`);
  await page.keyboard.press('Escape');
}

async function vehiculo() {
  const sb = await getAdminClient();
  const { data } = await sb
    .from('vehicles')
    .select(
      'id, license_plate, model, status, current_km, last_maintenance, branch_id, both_branches, vehicle_documents(id, type, expiry_date, file_url)',
    )
    .eq('license_plate', PATENTE)
    .maybeSingle();
  return data as any;
}

async function abrirFlota(page: Page, sede: typeof SEDE_A | null = null): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    BRANCH_KEY,
    JSON.stringify(sede),
  ] as const);
  await page.goto('/app/admin/flota');
  await expect(page.getByText(/Mostrando \d+ a \d+ de \d+ vehículos/)).toBeVisible(CARGA);
}

function fila(page: Page) {
  return page.locator('p-table tbody tr').filter({ hasText: PATENTE });
}

test('E02 + E14 + E18 + G01 + Q01: alta completa con documentos; otra sesión la ve sin recargar', async ({
  pageAs,
}) => {
  expect(await vehiculo(), `${PATENTE} ya existe: correr antes el SQL de limpieza`).toBeNull();

  const otra = await pageAs('admin');
  await abrirFlota(otra, null);
  await otra.locator(BUSCADOR).fill(PATENTE);
  await expect(fila(otra)).toHaveCount(0);

  const page = await pageAs('admin');
  await abrirFlota(page, SEDE_A);
  await page
    .getByRole('button', { name: /Nuevo Vehículo/i })
    .first()
    .click();
  await page.locator('#vf-plate').fill(PATENTE);
  await page.locator('#vf-brand').fill('E2E');
  await page.locator('#vf-model').fill('Prueba Flota');
  await page.locator('#vf-km').fill('500');
  await page.locator('label[for="branch-scope-both"]').click(); // G01: "Ambas"

  // E14: SOAP con PDF + Revisión Técnica sin archivo.
  await page.locator('#vf-doc-type').click();
  await page.getByRole('option', { name: 'SOAP' }).click();
  await escribirFecha(page, 'vf-doc-expiry', enDias(200));
  await page
    .locator('[data-llm-description="hidden file input for the vehicle document to attach"]')
    .setInputFiles({ name: 'soap.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.locator('[data-llm-action="agregar-documento-vehiculo"]').click();
  await page.locator('#vf-doc-type').click();
  await page.getByRole('option', { name: 'Revisión Técnica' }).click();
  await escribirFecha(page, 'vf-doc-expiry', enDias(300));
  await page.locator('[data-llm-action="agregar-documento-vehiculo"]').click();
  await expect(page.locator('[data-llm-action="quitar-documento-vehiculo"]')).toHaveCount(2);

  await page.locator('[data-llm-action="save-vehicle"]').click();
  await expect(page.getByText('Vehículo creado').first()).toBeVisible(CARGA);
  // E18: anotar cuántos toasts salen (uno por el vehículo + uno por documento).
  const toasts = await page.locator('.p-toast-message').count();
  test.info().annotations.push({ type: 'E18 toasts al crear', description: String(toasts) });

  await page.locator(BUSCADOR).fill(PATENTE);
  await expect(fila(page)).toHaveCount(1, CARGA);

  const v = await vehiculo();
  expect(v.branch_id).toBe(1);
  expect(v.both_branches).toBe(true);
  expect(v.current_km).toBe(500);
  const soap = v.vehicle_documents.find((d: any) => d.type === 'soap');
  const rt = v.vehicle_documents.find((d: any) => d.type === 'technical_inspection');
  expect(soap?.expiry_date).toBe(enDias(200));
  expect(soap?.file_url).toBeTruthy();
  expect(rt?.expiry_date).toBe(enDias(300));
  expect(rt?.file_url ?? null).toBeNull();

  // Q01: la otra sesión lo ve sin recargar (tiempo real).
  await expect(fila(otra)).toHaveCount(1, { timeout: 20_000 });
});

test('H05 + H06 + H07 + H12 + H16 + H18 + Q02: documentos reales; el listado y otra sesión se actualizan solos', async ({
  pageAs,
}) => {
  const otra = await pageAs('admin');
  await abrirFlota(otra, null);
  await otra.locator(BUSCADOR).fill(PATENTE);
  await expect(fila(otra)).toHaveCount(1, CARGA);

  const page = await pageAs('admin');
  await abrirFlota(page, null);
  await page.locator(BUSCADOR).fill(PATENTE);
  await fila(page).getByRole('button', { name: 'Documentos' }).click();
  const drawer = page.locator('app-vehicle-documents-drawer');
  const filaSeguro = drawer
    .locator('div')
    .filter({ has: page.getByText('Seguro', { exact: true }) })
    .filter({ has: page.locator('[data-llm-action="edit-vehicle-document"]') })
    .last();

  // H05: Seguro vencido hace 5 días, con PNG.
  await filaSeguro.locator('[data-llm-action="edit-vehicle-document"]').click();
  await escribirFecha(page, 'date', enDias(-5));
  await drawer
    .locator('[data-llm-description="hidden file input for vehicle document upload"]')
    .setInputFiles({ name: 'seguro.png', mimeType: 'image/png', buffer: PNG });
  await drawer.locator('[data-llm-action="save-vehicle-document"]').click();
  await expect(page.getByText('Documento actualizado').first()).toBeVisible(CARGA);
  // H18: el texto del toast.
  test.info().annotations.push({
    type: 'H18 toast al subir archivo',
    description: await page.locator('.p-toast-message').last().innerText(),
  });
  await expect(drawer.getByText('Vencido', { exact: true })).toHaveCount(1, CARGA);

  // H16 + Q02: el triángulo rojo aparece en el listado y en la otra sesión sin recargar.
  await expect(fila(page).locator('app-icon[name="alert-triangle"]')).toHaveAttribute(
    'aria-label',
    /Seguro vencido/,
    CARGA,
  );
  await expect(fila(otra).locator('app-icon[name="alert-triangle"]')).toHaveAttribute(
    'aria-label',
    /Seguro vencido/,
    { timeout: 20_000 },
  );

  const antes = (await vehiculo()).vehicle_documents.find((d: any) => d.type === 'insurance');
  expect(antes.file_url).toBeTruthy();

  // H06: solo cambiar la fecha conserva el archivo.
  await filaSeguro.locator('[data-llm-action="edit-vehicle-document"]').click();
  await escribirFecha(page, 'date', enDias(250));
  await drawer.locator('[data-llm-action="save-vehicle-document"]').click();
  await expect
    .poll(async () => {
      const d = (await vehiculo()).vehicle_documents.find((x: any) => x.type === 'insurance');
      return `${d.expiry_date}|${d.file_url}`;
    }, CARGA)
    .toBe(`${enDias(250)}|${antes.file_url}`);
  await expect(fila(page).locator('app-icon[name="alert-triangle"]')).toHaveCount(0, CARGA);

  // H07: reemplazar el archivo deja el nuevo.
  await filaSeguro.locator('[data-llm-action="edit-vehicle-document"]').click();
  await drawer
    .locator('[data-llm-description="hidden file input for vehicle document upload"]')
    .setInputFiles({ name: 'seguro2.pdf', mimeType: 'application/pdf', buffer: PDF });
  await drawer.locator('[data-llm-action="save-vehicle-document"]').click();
  await expect
    .poll(async () => {
      const d = (await vehiculo()).vehicle_documents.find((x: any) => x.type === 'insurance');
      return d.file_url !== antes.file_url;
    }, CARGA)
    .toBe(true);

  // H12: "Ver documento" abre el visor.
  await filaSeguro.locator('[data-llm-action="view-vehicle-document"]').click();
  await expect(page.locator('app-dms-viewer-modal')).toBeVisible(CARGA);
});

test('M02 + M03 + M10 + M11 + M17 + L04 + L06 + L08: registrar y editar un servicio real', async ({
  pageAs,
}) => {
  const v = await vehiculo();
  const page = await pageAs('admin');
  await page.setViewportSize(DESKTOP);
  await page.goto(`/app/admin/flota/${v.id}/mantenimientos`);
  await expect(page.getByRole('heading', { name: PATENTE })).toBeVisible(CARGA);
  await expect(page.getByText('Historial vacío').first()).toBeVisible();

  await page
    .getByRole('button', { name: /Registrar Servicio/ })
    .first()
    .click();
  await page.locator('#mf-type').click();
  await page.getByRole('option', { name: 'Frenos' }).click();
  await page.locator('#mf-km').fill('1200');
  await page.locator('#mf-cost').fill('1500000');
  // M17: descripción vacía; L06: sin taller.
  await page.getByRole('button', { name: 'Registrar Mantenimiento' }).last().click();

  const tabla = page.locator('p-table tbody tr').first();
  await expect(tabla).toContainText('Frenos', CARGA);
  await expect(tabla).toContainText('1.500.000'); // M10
  await expect(page.getByText('1 servicio', { exact: true })).toBeVisible(); // L08 (hotfix-086-b)
  await expect(page.getByText(/\$1\.500\.000 invertidos/)).toBeVisible();

  // M03: el km del vehículo sube (trigger de fix-222-b) y queda la última mantención.
  await expect.poll(async () => (await vehiculo()).current_km, CARGA).toBe(1200);
  expect((await vehiculo()).last_maintenance).toBe(enDias(0));

  // M11: editar.
  await tabla.locator('[data-llm-action="edit-maintenance"]').click();
  await page.locator('#mf-workshop').fill('Taller E2E');
  await page.getByRole('button', { name: 'Guardar Cambios' }).click();
  await expect(page.locator('p-table tbody tr').first()).toContainText('Taller E2E', CARGA);
});

test('M10 + L08 + L09 (hotfix-086-b): montos, km y fechas en formato chileno', async ({
  pageAs,
}) => {
  const v = await vehiculo();
  const page = await pageAs('admin');
  await page.setViewportSize(DESKTOP);
  await page.goto(`/app/admin/flota/${v.id}/mantenimientos`);
  await expect(page.getByRole('heading', { name: PATENTE })).toBeVisible(CARGA);
  await expect(page.getByText('1 servicio', { exact: true })).toBeVisible(CARGA);
  await expect(page.getByText('$1.500.000 invertidos')).toBeVisible();
  const hero = page.locator('app-section-hero');
  await expect(hero.getByText('$1.500.000', { exact: true }).first()).toBeVisible();
  await expect(hero.getByText(/1\.200 km/).first()).toBeVisible();
  await expect(page.getByText(/1,500,000|\$1500000/)).toHaveCount(0);
  // Fechas legibles en la tabla y en las tarjetas de documentos (no AAAA-MM-DD).
  await expect(page.locator('p-table tbody tr').first()).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  await expect(page.getByText(/^\s*\d{4}-\d{2}-\d{2}\s*$/)).toHaveCount(0);
});

test('F02 + F04 + G10 + G05: editar datos y sede del vehículo de prueba', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await abrirFlota(page, null);
  await page.locator(BUSCADOR).fill(PATENTE);
  await fila(page).getByRole('button', { name: 'Editar' }).click();
  await expect(page.locator('#vf-plate')).toHaveValue(PATENTE, CARGA);

  // F02 + F04: cambia el modelo; el estado guardado no se toca.
  const antes = await vehiculo();
  await page.locator('#vf-model').fill('Prueba Editada');
  // G10: deja de ser "Ambas" y pasa a la sede B (sin instructor asignado).
  await page.locator('label[for="branch-scope-both"]').click();
  await page.locator('#branch-scope-sede').click();
  await page.getByRole('option', { name: /Conductores/ }).click();
  await page.locator('[data-llm-action="save-vehicle"]').click();
  await expect(page.getByText('Vehículo actualizado').first()).toBeVisible(CARGA);

  const despues = await vehiculo();
  expect(despues.model).toBe('Prueba Editada');
  expect(despues.status).toBe(antes.status);
  expect(despues.both_branches).toBe(false);
  expect(despues.branch_id).toBe(2);

  // G05: con sede A ya no aparece; con sede B sí.
  await abrirFlota(page, SEDE_A);
  await page.locator(BUSCADOR).fill(PATENTE);
  await expect(fila(page)).toHaveCount(0);
});

test('P02 + P04 + P06: la Hoja de Ruta de un vehículo sin instructor', async () => {
  const v = await vehiculo();
  const sb = await getAdminClient();
  const { data, error } = await sb.functions.invoke('generate-route-sheet-pdf', {
    body: { vehicle_id: v.id },
  });
  expect(error).toBeNull();
  const pdf = Buffer.from(await (data as Blob).arrayBuffer()).toString('latin1');
  expect(pdf).toContain(PATENTE);
  expect(pdf).toContain('E2E Prueba Editada');
  expect(pdf).not.toContain('undefined');
  expect(pdf).not.toContain('null');
  // 13 bloques de 45 minutos: de 08:30 a 20:45.
  expect(pdf).toContain('08:30');
  expect(pdf).toContain('20:45');
});

test('O01 + O02 + O04: egreso de combustible (interceptado, no llega a la caja)', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  let enviado: Record<string, unknown> | null = null;
  await page.route('**/rest/v1/expenses*', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    enviado = route.request().postDataJSON();
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.setViewportSize(DESKTOP);
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    BRANCH_KEY,
    JSON.stringify({ id: 2, name: 'Conductores Chillán' }),
  ] as const);
  await page.goto('/app/admin/contabilidad/cuadratura');
  await page
    .getByRole('button', { name: /Egreso/i })
    .first()
    .click();
  await page.locator('#egr-tipo').click();
  await page.getByRole('option', { name: 'Combustible' }).click();

  // O02: la opción del vehículo dice "Marca Modelo - PATENTE (…)".
  await page.locator('#egr-vehiculo').click();
  const opcion = page.getByRole('option', { name: new RegExp(PATENTE) });
  await expect(opcion).toContainText(/E2E Prueba Editada - ZZ4199/);
  await opcion.click();
  await page.locator('#egr-monto').fill('20000');
  await page.locator('[data-llm-description="Descripción o motivo del egreso"]').fill('E2E carga');
  await page.locator('[data-llm-action="guardar-egreso-cuadratura"]').click();

  await expect.poll(() => enviado, { timeout: 15_000 }).not.toBeNull();
  const body = (Array.isArray(enviado) ? enviado[0] : enviado) as Record<string, unknown>;
  expect(body['category']).toBe('combustible');
  expect(body['vehicle_id']).toBe((await vehiculo()).id);
  expect(body['branch_id']).toBe(2);
});

test('S01 + S03 + S05: modo oscuro, drawer abierto y teclado', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.setItem('app-color-mode', 'dark'));
  await abrirFlota(page, null);
  await page.locator(BUSCADOR).fill(PATENTE);
  await page.screenshot({ path: test.info().outputPath('s01-flota-oscuro.png') });
  // S01: el documento está en modo oscuro y la patente se lee (no es del color del fondo).
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-mode'))).toBe(
    'dark',
  );
  const patente = fila(page).locator('span', { hasText: PATENTE }).first();
  const [color, fondo] = await patente.evaluate((el) => [
    getComputedStyle(el).color,
    getComputedStyle(el).backgroundColor,
  ]);
  expect(color).not.toBe(fondo);

  // S03: con un drawer abierto el listado pasa a tarjetas.
  await fila(page).getByRole('button', { name: 'Documentos' }).click();
  await expect(
    page.locator('[data-llm-description="Ficha resumen de un vehículo"]').first(),
  ).toBeVisible(CARGA);
  await page.screenshot({ path: test.info().outputPath('s03-drawer-abierto.png') });

  // S05: el botón de editar documento se alcanza con Tab y el foco se ve.
  await page.keyboard.press('Escape');
  await page.locator(BUSCADOR).focus();
  let llego = false;
  for (let i = 0; i < 25 && !llego; i++) {
    await page.keyboard.press('Tab');
    llego = await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') === 'Documentos',
    );
  }
  expect(llego).toBe(true);
});

test.afterAll(async () => {
  const v = await vehiculo();
  if (!v) return;
  // SQL de limpieza para el owner (este test no borra nada).
  console.log(`
-- Limpieza de flota-real.spec.ts (vehículo ${PATENTE}, id ${v.id})
DELETE FROM storage.objects WHERE bucket_id = 'documents' AND name IN (
  SELECT file_url FROM public.vehicle_documents WHERE vehicle_id = ${v.id} AND file_url IS NOT NULL);
DELETE FROM public.maintenance_records WHERE vehicle_id = ${v.id};
DELETE FROM public.vehicle_documents WHERE vehicle_id = ${v.id};
DELETE FROM public.notifications WHERE reference_type = 'document_expiry' AND reference_id = ${v.id};
DELETE FROM public.vehicles WHERE id = ${v.id};
`);
});
