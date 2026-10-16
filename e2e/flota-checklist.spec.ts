/**
 * Checklist de Flota (ASG-i-032, fix-220-b): casos A–S de
 * specs/testing-piloto/032-flota-mantenimientos.md que no cubren flota-listado / -documentos /
 * -formulario / -agenda / -secretaria. Los IDs son los del checklist.
 *
 * Escrituras: solo sobre el vehículo de prueba ZZ4103 y deshaciéndolas al final del test. Lo que
 * crearía datos (alta de vehículo, mantenimiento, documento) se intercepta antes de llegar al
 * servidor; el intento con patente duplicada sí llega y lo rechaza la BD (UNIQUE).
 */
import type { Page } from '@playwright/test';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };
const BUSCADOR = '[data-llm-description="input for searching vehicles by plate, brand or model"]';
const PATENTE_PRUEBA = 'ZZ4103';
const BRANCH_KEY = 'autoescuela:selectedBranchId';
const NO_OPERATIVO = ['maintenance', 'mantenimiento', 'out_of_service', 'blocked'];

test.describe.configure({ timeout: 150_000 });

interface Vehiculo {
  id: number;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  status: string | null;
  current_km: number | null;
  branch_id: number | null;
  both_branches: boolean;
}

async function vehiculos(): Promise<Vehiculo[]> {
  const sb = await getAdminClient();
  const { data, error } = await sb
    .from('vehicles')
    .select('id, license_plate, brand, model, year, status, current_km, branch_id, both_branches')
    .order('id');
  if (error) throw error;
  return data as Vehiculo[];
}

/** Día de calendario de Chile a N días de hoy (YYYY-MM-DD). */
function enDias(n: number): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function total(page: Page): Promise<number> {
  const pie = page.getByText(/Mostrando \d+ a \d+ de \d+ vehículos/);
  await expect(pie).toBeVisible(CARGA);
  return Number((await pie.innerText()).match(/de (\d+) vehículos/)![1]);
}

/** Abre Flota del admin con una sede elegida (null = todas). */
async function abrirFlota(page: Page, sede: { id: number; name: string } | null = null) {
  await page.setViewportSize(DESKTOP);
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    BRANCH_KEY,
    JSON.stringify(sede),
  ] as const);
  await page.goto('/app/admin/flota');
  await total(page);
}

function fila(page: Page, patente: string) {
  return page.locator('p-table tbody tr').filter({ hasText: patente });
}

/** Valor de un KPI del hero por su etiqueta. */
async function kpi(page: Page, etiqueta: string): Promise<number> {
  const valor = page
    .locator('app-section-hero p')
    .filter({ hasText: new RegExp(`^\\s*${etiqueta}\\s*$`) })
    .locator('xpath=following-sibling::div[1]/span[1]');
  return Number((await valor.innerText()).replace(/\D/g, ''));
}

function operativo(status: string | null): boolean {
  return !NO_OPERATIVO.includes((status ?? '').toLowerCase());
}

// ── A. Carga y acceso ────────────────────────────────────────────────────────────────────────

test('A01 + A07: Flota y Mantenimientos cargan sin errores de consola ni de red, también con F5', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('response', (r) => {
    if (r.url().includes('supabase.co') && r.status() >= 400)
      errores.push(`${r.status()} ${r.url()}`);
  });

  await abrirFlota(page);
  await page.reload();
  await total(page);

  const v = (await vehiculos()).find((x) => x.license_plate === PATENTE_PRUEBA)!;
  await page.goto(`/app/admin/flota/${v.id}/mantenimientos`);
  await expect(page.getByRole('heading', { name: PATENTE_PRUEBA })).toBeVisible(CARGA);
  await page.reload();
  await expect(page.getByRole('heading', { name: PATENTE_PRUEBA })).toBeVisible(CARGA);

  expect(errores).toEqual([]);
});

test('A03: la secretaria no entra a las rutas de Flota del admin', async ({ pageAs }) => {
  const page = await pageAs('secretariaA');
  for (const url of ['/app/admin/flota', '/app/admin/flota/1/mantenimientos']) {
    await page.goto(url);
    await expect(page).not.toHaveURL(/\/app\/admin\//, CARGA);
  }
});

test('A10: la búsqueda global del admin lleva a Flota', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/dashboard');
  for (const termino of ['revisión técnica', 'mantención']) {
    await page.locator('[data-llm-action="open-search-panel"] button').click();
    await page
      .locator('[data-llm-description="Global command palette — alumnos, acciones, vistas"]')
      .fill(termino);
    await page
      .locator('[data-llm-action="search-result-item"]')
      .filter({ hasText: 'Flota Vehicular' })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/admin\/flota$/, CARGA);
    await page.goto('/app/admin/dashboard');
  }
});

// ── B + C. Filas, KPIs y paginación ──────────────────────────────────────────────────────────

test('B + C01–C03 + G04: filas, KPIs y paginador coinciden con la BD (todas las sedes)', async ({
  pageAs,
}) => {
  const todos = await vehiculos();
  const page = await pageAs('admin');
  await abrirFlota(page, null);

  // C01–C03
  expect(await total(page)).toBe(todos.length);
  await expect(page.getByText(`${todos.length} vehículos`, { exact: true })).toBeVisible();
  expect(await kpi(page, 'Total')).toBe(todos.length);
  expect(await kpi(page, 'Disponibles')).toBe(todos.filter((v) => operativo(v.status)).length);
  expect(await kpi(page, 'En Taller')).toBe(
    todos.filter((v) => ['maintenance', 'mantenimiento'].includes(`${v.status}`)).length,
  );
  // C04 (hotfix-080-b): KPI "De Baja".
  expect(await kpi(page, 'De Baja')).toBe(
    todos.filter((v) => ['out_of_service', 'blocked'].includes(`${v.status}`)).length,
  );

  // B12: 10 por página. B11 (hotfix-080-b): ordenadas por patente.
  const filas = page.locator('p-table tbody tr');
  await expect(filas).toHaveCount(Math.min(10, todos.length));
  await expect(page.getByText(`Mostrando 1 a ${Math.min(10, todos.length)} de`)).toBeVisible();

  // G04: columna Sede con "todas".
  await expect(page.locator('p-table thead th', { hasText: 'Sede' })).toHaveCount(1);

  // B01, B02, B06, B09, B13 sobre la primera fila.
  const v = [...todos].sort((a, b) => a.license_plate.localeCompare(b.license_plate))[0];
  const f = filas.first();
  await expect(f).toContainText(v.license_plate);
  await expect(f).toContainText(`${v.brand} ${v.model}`);
  await expect(f).toContainText(String(v.year));
  await expect(f).toContainText(`${new Intl.NumberFormat('es-CL').format(v.current_km ?? 0)} km`);
  await expect(f).toContainText(operativo(v.status) ? 'Disponible' : /Taller|Baja/);
  for (const etiqueta of ['Agenda', 'Documentos', 'Editar']) {
    await expect(f.getByRole('button', { name: etiqueta })).toHaveCount(1);
  }
  await expect(f.locator('[data-llm-nav="mantenimientos-vehiculo"]')).toHaveCount(1);
});

test('G02 + G03: con una sede elegida se ven sus vehículos y los "Ambas", sin columna Sede', async ({
  pageAs,
}) => {
  const todos = await vehiculos();
  const page = await pageAs('admin');
  for (const sede of [
    { id: 1, name: 'Autoescuela Chillán' },
    { id: 2, name: 'Conductores Chillán' },
  ]) {
    await abrirFlota(page, sede);
    const esperados = todos.filter((v) => v.branch_id === sede.id || v.both_branches);
    expect(await total(page)).toBe(esperados.length);
    await expect(page.locator('p-table thead th', { hasText: 'Sede' })).toHaveCount(0);
  }
});

// ── D. Filtros ───────────────────────────────────────────────────────────────────────────────

test('D06 + D09: filtro de estado y "Limpiar filtros"', async ({ pageAs }) => {
  const todos = await vehiculos();
  const page = await pageAs('admin');
  await abrirFlota(page, null);

  await page.locator('[data-llm-action="filtrar-flota-por-estado"]').first().click();
  await page.getByRole('option', { name: 'Disponible', exact: true }).click();
  await expect.poll(() => total(page)).toBe(todos.filter((v) => operativo(v.status)).length);

  await page.locator(BUSCADOR).fill('zzzz-no-existe');
  await page.getByRole('button', { name: 'Limpiar filtros' }).first().click();
  await expect(page.locator(BUSCADOR)).toHaveValue('');
  await expect.poll(() => total(page)).toBe(todos.length);
});

// ── E. Alta ──────────────────────────────────────────────────────────────────────────────────

test('E01 + E07 + E10: el alta abre con valores por defecto y exige marca, modelo y sede', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirFlota(page, null);
  await page
    .getByRole('button', { name: /Nuevo Vehículo/i })
    .first()
    .click();
  await expect(page.locator('#vf-plate')).toBeVisible(CARGA);

  await expect(page.locator('#vf-year')).toHaveValue(String(Number(enDias(0).slice(0, 4))));
  await expect(page.locator('#vf-status')).toContainText('Disponible');

  const guardar = page.locator('[data-llm-action="save-vehicle"]');
  await page.locator('#vf-plate').fill('ZZZZ98');
  await expect(guardar).toBeDisabled();
  await page.locator('#vf-brand').fill('Prueba');
  await page.locator('#vf-model').fill('E2E');
  // Con "todas las sedes" el admin aún debe elegir la sede.
  await expect(guardar).toBeDisabled();
});

test('E06: una patente ya registrada no crea otro vehículo y avisa', async ({ pageAs }) => {
  const antes = await vehiculos();
  const existente = antes.find((v) => v.license_plate !== PATENTE_PRUEBA)!;
  const page = await pageAs('admin');
  await abrirFlota(page, { id: 1, name: 'Autoescuela Chillán' });
  await page
    .getByRole('button', { name: /Nuevo Vehículo/i })
    .first()
    .click();
  await page.locator('#vf-plate').fill(existente.license_plate);
  await page.locator('#vf-brand').fill('Prueba');
  await page.locator('#vf-model').fill('Duplicada');
  const guardar = page.locator('[data-llm-action="save-vehicle"]');
  if (await guardar.isEnabled()) await guardar.click();

  await expect(page.getByText(/Ya existe un vehículo con la patente/)).toBeVisible(CARGA);
  expect((await vehiculos()).length).toBe(antes.length);
});

test('E17: el alta rechaza adjuntos de tipo o tamaño inválido', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await abrirFlota(page, { id: 1, name: 'Autoescuela Chillán' });
  await page
    .getByRole('button', { name: /Nuevo Vehículo/i })
    .first()
    .click();
  await expect(page.locator('#vf-plate')).toBeVisible(CARGA);
  const input = page.locator(
    '[data-llm-description="hidden file input for the vehicle document to attach"]',
  );

  await input.setInputFiles({
    name: 'contrato.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from('x'),
  });
  await expect(page.getByText('Solo se permiten archivos PDF, JPG, PNG o WEBP.')).toBeVisible();

  await input.setInputFiles({
    name: 'grande.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(6 * 1024 * 1024),
  });
  await expect(page.getByText('El archivo no puede superar los 5 MB.')).toBeVisible();
});

// ── F + G. Edición ───────────────────────────────────────────────────────────────────────────

test('F01 + F03 + F10: editar el vehículo de prueba — estado, KPIs y patente duplicada', async ({
  pageAs,
}) => {
  const todos = await vehiculos();
  const v = todos.find((x) => x.license_plate === PATENTE_PRUEBA)!;
  const otra = todos.find((x) => x.id !== v.id)!;
  const sb = await getAdminClient();
  const page = await pageAs('admin');
  await abrirFlota(page, null);
  const enTaller = await kpi(page, 'En Taller');

  try {
    await page.locator(BUSCADOR).fill(PATENTE_PRUEBA);
    // F01: precargado y sin la sección de documentos.
    await fila(page, PATENTE_PRUEBA).getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('#vf-plate')).toHaveValue(PATENTE_PRUEBA, CARGA);
    await expect(page.locator('#vf-brand')).toHaveValue(v.brand);
    await expect(page.locator('#vf-doc-type')).toHaveCount(0);

    // F10: patente de otro vehículo → error, no guarda.
    await page.locator('#vf-plate').fill(otra.license_plate);
    const guardar = page.locator('[data-llm-action="save-vehicle"]');
    if (await guardar.isEnabled()) await guardar.click();
    await expect(page.getByText(/Ya existe un vehículo con la patente/)).toBeVisible(CARGA);
    const { data: sigue } = await sb.from('vehicles').select('license_plate').eq('id', v.id);
    expect(sigue![0].license_plate).toBe(PATENTE_PRUEBA);
    await page.locator('#vf-plate').fill(PATENTE_PRUEBA);

    // F03: a Mantenimiento → badge "Taller" y KPI +1.
    await page.locator('#vf-status').click();
    await page.getByRole('option', { name: 'Mantenimiento' }).click();
    await guardar.click();
    await expect(fila(page, PATENTE_PRUEBA)).toContainText('Taller', CARGA);
    await expect.poll(() => kpi(page, 'En Taller')).toBe(enTaller + 1);
  } finally {
    await sb.from('vehicles').update({ status: v.status }).eq('id', v.id);
  }
});

test('G08: con instructor asignado, la sede del vehículo no se puede cambiar', async ({
  pageAs,
}) => {
  const sb = await getAdminClient();
  const { data: asig } = await sb
    .from('vehicle_assignments')
    .select('vehicle_id, vehicles(license_plate)')
    .is('end_date', null)
    .limit(1);
  const patente = (asig![0] as any).vehicles.license_plate as string;
  const page = await pageAs('admin');
  await abrirFlota(page, null);
  await page.locator(BUSCADOR).fill(patente);
  await fila(page, patente).getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByText(/Este vehículo está asignado a/)).toBeVisible(CARGA);
  await expect(page.locator('#branch-scope-sede')).toBeDisabled();
});

// ── H. Documentos ────────────────────────────────────────────────────────────────────────────

test('H01 + H03 + H08 + H09: drawer de documentos del vehículo de prueba', async ({ pageAs }) => {
  const page = await pageAs('admin');
  // Nada se guarda: cualquier escritura a vehicle_documents o Storage se corta.
  await page.route('**/rest/v1/vehicle_documents*', (r) =>
    r.request().method() === 'GET' ? r.continue() : r.abort(),
  );
  await page.route('**/storage/v1/object/**', (r) => r.abort());
  await abrirFlota(page, null);
  await page.locator(BUSCADOR).fill(PATENTE_PRUEBA);
  await fila(page, PATENTE_PRUEBA).getByRole('button', { name: 'Documentos' }).click();

  const drawer = page.locator('app-vehicle-documents-drawer');
  for (const tipo of ['SOAP', 'Revisión Técnica', 'Permiso de Circulación', 'Seguro']) {
    await expect(drawer.getByText(tipo, { exact: true })).toBeVisible(CARGA);
  }

  const sinCargar = await drawer.getByText('Sin cargar', { exact: true }).count();
  if (sinCargar > 0) {
    // H08: guardar sin fecha.
    const filaDoc = drawer
      .locator('div')
      .filter({ has: page.getByText('Sin cargar', { exact: true }) })
      .filter({ has: page.locator('[data-llm-action="edit-vehicle-document"]') })
      .last();
    await filaDoc.locator('[data-llm-action="edit-vehicle-document"]').click();
    await drawer.locator('[data-llm-action="save-vehicle-document"]').click();
    await expect(drawer.getByText('La fecha de vencimiento es obligatoria.')).toBeVisible();

    // H09: archivo inválido.
    await drawer
      .locator('[data-llm-description="hidden file input for vehicle document upload"]')
      .setInputFiles({ name: 'x.docx', mimeType: 'application/msword', buffer: Buffer.from('x') });
    await expect(drawer.getByText('Solo se permiten archivos PDF, JPG, PNG o WEBP.')).toBeVisible();
  }
});

// ── I. Estado según la fecha ─────────────────────────────────────────────────────────────────

test('I01–I06 + I10: el triángulo del listado sigue las fechas (vence hoy = por vencer)', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const casos: { dias: number | null; esperado: 'vencido' | 'por vencer' | null }[] = [
    { dias: -1, esperado: 'vencido' },
    { dias: 0, esperado: 'por vencer' },
    { dias: 1, esperado: 'por vencer' },
    { dias: 30, esperado: 'por vencer' },
    { dias: 31, esperado: null },
    { dias: null, esperado: null },
  ];
  const patentes: string[] = [];
  await page.route('**/rest/v1/vehicles?*vehicle_documents*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (Array.isArray(body)) {
      // Los primeros por patente: los de la primera página del listado (hotfix-080-b).
      const orden = [...body].sort((a, b) => a.license_plate.localeCompare(b.license_plate));
      casos.forEach((c, i) => {
        if (!orden[i]) return;
        patentes[i] = orden[i].license_plate;
        orden[i].vehicle_documents =
          c.dias === null
            ? []
            : [{ type: 'soap', expiry_date: enDias(c.dias), status: null, file_url: null }];
      });
      // I10: el séptimo con uno vencido y otro por vencer.
      if (orden[6]) {
        patentes[6] = orden[6].license_plate;
        orden[6].vehicle_documents = [
          { type: 'soap', expiry_date: enDias(-3), status: null, file_url: null },
          { type: 'insurance', expiry_date: enDias(5), status: null, file_url: null },
        ];
      }
    }
    await route.fulfill({ response, json: body });
  });
  await abrirFlota(page, null);

  for (const [i, c] of casos.entries()) {
    const triangulo = fila(page, patentes[i]).locator('app-icon[name="alert-triangle"]');
    if (c.esperado === null) {
      await expect(triangulo, `caso ${c.dias} días`).toHaveCount(0);
    } else {
      await expect(triangulo, `caso ${c.dias} días`).toHaveAttribute(
        'aria-label',
        new RegExp(c.esperado, 'i'),
      );
    }
  }
  const doble = fila(page, patentes[6]).locator('app-icon[name="alert-triangle"]');
  await expect(doble).toHaveAttribute('aria-label', /SOAP vencido; Seguro por vencer/);
});

// ── L + M + P. Mantenimientos ────────────────────────────────────────────────────────────────

test('L01 + L03 + L04 + M01 + M04 + M02: página de mantenimientos y registrar servicio', async ({
  pageAs,
}) => {
  const sb = await getAdminClient();
  const { data: regs } = await sb
    .from('maintenance_records')
    .select('vehicle_id, completed_date, scheduled_date, created_at')
    .order('created_at', { ascending: false });
  const conMantenciones = regs?.[0]?.vehicle_id as number | undefined;
  const v = (await vehiculos()).find((x) =>
    conMantenciones ? x.id === conMantenciones : x.license_plate === PATENTE_PRUEBA,
  )!;

  const page = await pageAs('admin');
  let enviado: Record<string, unknown> | null = null;
  await page.route('**/rest/v1/maintenance_records*', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    enviado = route.request().postDataJSON();
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });

  await abrirFlota(page, null);
  await page.locator(BUSCADOR).fill(v.license_plate);
  await fila(page, v.license_plate).locator('[data-llm-nav="mantenimientos-vehiculo"]').click();

  // L01
  await expect(page).toHaveURL(new RegExp(`/app/admin/flota/${v.id}/mantenimientos$`));
  await expect(page.getByRole('heading', { name: v.license_plate })).toBeVisible(CARGA);
  await expect(page.getByText(new RegExp(`${v.brand} ${v.model}`)).first()).toBeVisible();

  // M01: km = km actual, fecha = hoy; M04: sin tipo no se puede.
  await page
    .getByRole('button', { name: /Registrar Servicio/ })
    .first()
    .click();
  await expect(page.locator('#mf-km')).toHaveValue(
    new RegExp(String(v.current_km ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, '\\.?')),
    CARGA,
  );
  const registrar = page.getByRole('button', { name: 'Registrar Mantenimiento' }).last();
  await expect(registrar).toBeDisabled();

  // M02: lo que se enviaría (interceptado).
  await page.locator('#mf-type').click();
  await page.getByRole('option', { name: 'Frenos' }).click();
  await expect(registrar).toBeEnabled();
  await registrar.click();
  await expect.poll(() => enviado, { timeout: 15_000 }).not.toBeNull();
  const body = (Array.isArray(enviado) ? enviado[0] : enviado) as Record<string, unknown>;
  expect(body['vehicle_id']).toBe(v.id);
  expect(body['type']).toBe('Frenos');
  expect(body['status']).toBe('completed');
  expect(body['completed_date']).toBe(enDias(0));
  // M15: el error queda en el drawer.
  await expect(page.locator('app-maintenance-form-drawer')).toBeVisible();

  // L03
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: /Flota/ }).first().click();
  await expect(page).toHaveURL(/\/app\/admin\/flota$/, CARGA);
});

test('L11 + L12: un id inexistente o no numérico no deja la página en blanco', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/flota/99999/mantenimientos');
  await expect(page.getByText(/Vehículo no encontrado|Hubo un problema/).first()).toBeVisible(
    CARGA,
  );
  await expect(page.getByRole('button', { name: /Registrar Servicio/ })).toHaveCount(0);

  await page.goto('/app/admin/flota/abc/mantenimientos');
  await expect(page.getByText(/Vehículo no encontrado|Hubo un problema/).first()).toBeVisible(
    CARGA,
  );
});

test('P01: la Hoja de Ruta se genera y se previsualiza', async ({ pageAs }) => {
  const v = (await vehiculos()).find((x) => x.license_plate === PATENTE_PRUEBA)!;
  const page = await pageAs('admin');
  await page.setViewportSize(DESKTOP);
  await page.goto(`/app/admin/flota/${v.id}/mantenimientos`);
  await page
    .getByRole('button', { name: /Hoja de Ruta/ })
    .first()
    .click();
  await expect(page.locator('app-route-sheet-drawer iframe')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('No se pudo generar la Hoja de Ruta')).toHaveCount(0);
});

// ── S. Visual ────────────────────────────────────────────────────────────────────────────────

test('S02: en 375 px se ven tarjetas y no hay scroll horizontal', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/app/admin/flota');
  await expect(
    page.locator('[data-llm-description="Ficha resumen de un vehículo"]').first(),
  ).toBeVisible(CARGA);
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(desborde).toBeLessThanOrEqual(0);
});

test('P03 (hotfix-085-b): el encabezado de la Hoja de Ruta es la sede del vehículo', async () => {
  const sb = await getAdminClient();
  const { data: sedes } = await sb.from('branches').select('id, name').order('id');
  const todos = await vehiculos();
  for (const sede of sedes ?? []) {
    const v = todos.find((x) => x.branch_id === sede.id && !x.both_branches);
    if (!v) continue;
    const { data, error } = await sb.functions.invoke('generate-route-sheet-pdf', {
      body: { vehicle_id: v.id },
    });
    expect(error, `sede ${sede.name}`).toBeNull();
    const pdf = Buffer.from(await (data as Blob).arrayBuffer()).toString('latin1');
    // Hasta antes de la tilde: el PDF escapa los caracteres fuera de ASCII.
    const encabezado = sede.name.toLocaleUpperCase('es-CL').split(/[ÁÉÍÓÚÑ]/)[0];
    expect(pdf, `sede ${sede.name}`).toContain(`(${encabezado}`);
    for (const otra of (sedes ?? []).filter((s) => s.id !== sede.id)) {
      const ajeno = otra.name.toLocaleUpperCase('es-CL').split(/[ÁÉÍÓÚÑ]/)[0];
      expect(pdf, `sede ${sede.name}`).not.toContain(`(${ajeno}`);
    }
  }
});

// ── Casos de error, reintento y doble clic (sin escrituras: se corta la respuesta) ─────────────

test('A08: si falla la carga de la flota se avisa, no "No se encontraron vehículos"', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.route('**/rest/v1/vehicles?*vehicle_documents*', (r) => r.abort());
  await page.setViewportSize(DESKTOP);
  await page.goto('/app/admin/flota');
  await expect(page.getByText(/Error al cargar|No se pudo cargar/i).first()).toBeVisible(CARGA);
  await expect(page.getByText('No se encontraron vehículos')).toHaveCount(0);
});

test('A06 + A09: volver a Flota muestra los datos al instante; "Actualizar" vuelve a pedirlos', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirFlota(page, null);
  await page.locator('a[href="/app/admin/dashboard"]').first().click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.locator('a[href="/app/admin/flota"]').first().click();
  // A06: sin skeleton, las filas están de inmediato.
  await expect(page.locator('p-table tbody tr').first()).toBeVisible({ timeout: 2_000 });

  const pedido = page.waitForRequest((r) => r.url().includes('/rest/v1/vehicles?'));
  await page.locator('[data-llm-action="actualizar-lista-flota"]').click();
  await pedido;
});

test('D10: sin resultados en la vista de tarjetas también ofrece "Limpiar filtros"', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/app/admin/flota');
  await expect(
    page.locator('[data-llm-description="Ficha resumen de un vehículo"]').first(),
  ).toBeVisible(CARGA);
  await page.locator(BUSCADOR).fill('zzzz-no-existe');
  await expect(page.getByText(/Sin resultados|No se encontraron vehículos/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Limpiar filtros' }).filter({ visible: true }).first()).toBeVisible();
});

test('H14 + H15 + H17: documentos — cambiar de fila, cancelar y error al guardar', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.route('**/rest/v1/vehicle_documents*', (r) =>
    r.request().method() === 'GET'
      ? r.continue()
      : r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"x"}' }),
  );
  await abrirFlota(page, null);
  await page.locator(BUSCADOR).fill(PATENTE_PRUEBA);
  await fila(page, PATENTE_PRUEBA).getByRole('button', { name: 'Documentos' }).click();
  const drawer = page.locator('app-vehicle-documents-drawer');
  const lapices = drawer.locator('[data-llm-action="edit-vehicle-document"]');
  await expect(lapices.first()).toBeVisible(CARGA);

  // H14: abrir otra fila cierra la primera.
  await lapices.nth(0).click();
  await lapices.nth(1).click();
  await expect(drawer.locator('[data-llm-action="save-vehicle-document"]')).toHaveCount(1);

  // H15: cancelar cierra sin guardar.
  await drawer.locator('[data-llm-action="cancel-edit-vehicle-document"]').click();
  await expect(drawer.locator('[data-llm-action="save-vehicle-document"]')).toHaveCount(0);

  // H17: error del servidor → mensaje en la fila y sin toast de éxito.
  await lapices.nth(0).click();
  const fecha = drawer.locator('input#date');
  await fecha.click();
  await fecha.pressSequentially('01012030');
  await page.keyboard.press('Escape');
  await drawer.locator('[data-llm-action="save-vehicle-document"]').click();
  await expect(drawer.locator('p.text-error')).toBeVisible(CARGA);
  await expect(page.getByText('Documento actualizado')).toHaveCount(0);
});

test('L13 + L14 + P07: errores en Mantenimientos — historial, reintento y Hoja de Ruta', async ({
  pageAs,
}) => {
  const v = (await vehiculos()).find((x) => x.license_plate === PATENTE_PRUEBA)!;
  const page = await pageAs('admin');
  let cortar = true;
  await page.route('**/rest/v1/maintenance_records*', (r) => (cortar ? r.abort() : r.continue()));
  await page.setViewportSize(DESKTOP);
  await page.goto(`/app/admin/flota/${v.id}/mantenimientos`);
  // L13: falla el historial → error, no "Historial vacío".
  await expect(page.getByText('Hubo un problema al cargar los datos del vehículo.')).toBeVisible(
    CARGA,
  );
  // L14: Reintentar recarga.
  cortar = false;
  await page.getByRole('button', { name: 'Reintentar' }).first().click();
  await expect(page.getByRole('heading', { name: PATENTE_PRUEBA })).toBeVisible(CARGA);

  // P07: falla la Hoja de Ruta → aviso en el drawer, la página sigue bien.
  await page.route('**/functions/v1/generate-route-sheet-pdf', (r) => r.abort());
  await page
    .getByRole('button', { name: /Hoja de Ruta/ })
    .first()
    .click();
  await expect(page.getByText('No se pudo generar la Hoja de Ruta')).toBeVisible(CARGA);
  await expect(page.getByText('Hubo un problema al cargar los datos del vehículo.')).toHaveCount(0);
});

test('E13 + M16: doble clic en guardar envía una sola vez', async ({ pageAs }) => {
  const page = await pageAs('admin');
  const posts: Record<string, number> = { vehicles: 0, maintenance_records: 0 };
  for (const tabla of Object.keys(posts)) {
    await page.route(`**/rest/v1/${tabla}*`, async (r) => {
      if (r.request().method() !== 'POST') return r.continue();
      posts[tabla]++;
      await new Promise((res) => setTimeout(res, 800));
      return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
  }
  await abrirFlota(page, { id: 1, name: 'Autoescuela Chillán' });
  await page
    .getByRole('button', { name: /Nuevo Vehículo/i })
    .first()
    .click();
  await page.locator('#vf-plate').fill('ZZZZ97');
  await page.locator('#vf-brand').fill('Prueba');
  await page.locator('#vf-model').fill('Doble');
  await page.locator('[data-llm-action="save-vehicle"]').dblclick();
  await page.waitForTimeout(2_000);
  expect(posts['vehicles']).toBe(1);

  const v = (await vehiculos()).find((x) => x.license_plate === PATENTE_PRUEBA)!;
  await page.goto(`/app/admin/flota/${v.id}/mantenimientos`);
  await page
    .getByRole('button', { name: /Registrar Servicio/ })
    .first()
    .click();
  await page.locator('#mf-type').click();
  await page.getByRole('option', { name: 'Frenos' }).click();
  await page.getByRole('button', { name: 'Registrar Mantenimiento' }).last().dblclick();
  await page.waitForTimeout(2_000);
  expect(posts['maintenance_records']).toBe(1);
});
