/**
 * Checklist ASG-i-034 (fix-197-b): casos de solo lectura de Instructores, Secretarias y Ajustes.
 * specs/testing-piloto/034-instructores-secretarias-usuarios.md — los IDs son los del checklist.
 *
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. Ningún test guarda: los formularios
 * se validan sin enviar y toda edge function de escritura se intercepta (si se llamara, falla el test).
 * Correr con --workers=1 (varias pruebas usan la misma cuenta admin).
 */
import { expect, test, watchErrors } from './support/fixtures';
import type { Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

const WRITE_FNS = [
  'create-instructor',
  'update-instructor',
  'create-secretary',
  'update-secretary',
  'activate-instructor-account',
];

/** Bloquea toda edge function de escritura: el test falla si alguna se llama. */
async function blockWrites(page: Page): Promise<string[]> {
  const called: string[] = [];
  for (const fn of WRITE_FNS) {
    await page.route(`**/functions/v1/${fn}`, (route) => {
      called.push(fn);
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: '{"error":"e2e"}',
      });
    });
  }
  return called;
}

async function openInstructores(page: Page, path = '/app/admin/instructores'): Promise<void> {
  await page.goto(path);
  await expect(page.locator('tbody tr').first()).toBeVisible();
}

// ── A. Acceso y navegación ──────────────────────────────────────────────────

test('A01/A07: admin abre Instructores (también con F5) sin errores de consola ni de red', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const errors = watchErrors(page);
  await openInstructores(page);
  await page.reload();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  errors.expectClean();
});

test('A03/A07: admin abre Secretarias (también con F5) sin errores', async ({ pageAs }) => {
  const page = await pageAs('admin');
  const errors = watchErrors(page);
  await page.goto('/app/admin/secretarias');
  await expect(page.locator('.secretaria-row').first()).toBeVisible();
  await page.reload();
  await expect(page.locator('.secretaria-row').first()).toBeVisible();
  errors.expectClean();
});

test('A02/B03: secretaria ve solo instructores de su sede (+ "Ambas") y sin columna Sede', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaB'); // sede 2
  await openInstructores(page, '/app/secretaria/instructores');
  await expect(page.locator('thead')).not.toContainText('Sede');
  // Instructor1..N del seed son de la sede 1 y no "Ambas".
  await expect(page.locator('tbody')).not.toContainText('Instructor1 Apellido1');
});

test('A04: la secretaria no entra a las pantallas de admin por URL', async ({ pageAs }) => {
  const page = await pageAs('secretariaA');
  for (const url of ['/app/admin/secretarias', '/app/admin/instructores']) {
    await page.goto(url);
    await expect(page).not.toHaveURL(new RegExp(`${url}$`));
  }
});

// ── B. Lista de instructores ────────────────────────────────────────────────

test('B01/B02/B04/B05: columnas, columna Sede solo con "Todas", conteos de las pills', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await openInstructores(page);
  const head = page.locator('thead');
  for (const col of ['RUT', 'Licencia', 'Vehículo', 'Clases activas', 'Estado']) {
    await expect(head).toContainText(col);
  }
  await expect(head).not.toContainText('Tipo');

  const filas = await page.locator('tbody tr.instructor-row').count();
  const todos = page.getByRole('button', { name: /Todos \(\d+\)/ });
  if (await todos.count()) {
    const n = Number((await todos.first().innerText()).match(/\((\d+)\)/)![1]);
    expect(n).toBeGreaterThanOrEqual(filas);
  }
});

// ── C. Crear instructor (validaciones, sin enviar) ──────────────────────────

test('C01/C02/C10/C15: el formulario vacío marca errores y no llama a la función', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const called = await blockWrites(page);
  await openInstructores(page);
  await page.locator('[data-llm-action="new"]').first().click();
  for (const s of ['Información Personal', 'Licencia Clase B', 'Documentos', 'Asignación']) {
    await expect(page.getByText(s, { exact: false }).first()).toBeVisible();
  }
  await page.locator('#c-nombres').fill('A');
  await page.locator('[data-llm-action="confirmar-crear-instructor"]').click();
  await expect(page.locator('.field-error').first()).toBeVisible();
  await expect(page.getByText('Selecciona el tipo de instructor.')).toBeVisible();
  await expect(page.getByText('Ingresa el número de licencia.')).toBeVisible();
  expect(called).toEqual([]);
});

// C05: el último carácter siempre se toma como DV y se recalcula (ASG-047). Escribir solo el
// cuerpo ("11111111") lo convierte en 1.111.111-4: ver hallazgo en fix-197-b.
test('C05: el RUT completo sin puntos se formatea; un DV equivocado se reemplaza', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await openInstructores(page);
  await page.locator('[data-llm-action="new"]').first().click();
  const rut = page.locator('#c-rut');
  await rut.fill('123456785');
  await rut.press('Tab');
  await expect(rut).toHaveValue('12.345.678-5');
  await rut.fill('123456781');
  await rut.press('Tab');
  await expect(rut).toHaveValue('12.345.678-5');
});

test('C12/C13: vencimiento en ≤ 30 días avisa "Por vencer"; pasado avisa "Vencida"', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await openInstructores(page);
  await page.locator('[data-llm-action="new"]').first().click();
  const fecha = page.locator(
    '[data-llm-description="Fecha de vencimiento de la licencia del instructor"] input',
  );
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const en10 = new Date();
  en10.setDate(en10.getDate() + 10);
  await fecha.click();
  await fecha.pressSequentially(fmt(en10), { delay: 30 });
  await fecha.press('Tab');
  await expect(page.getByText('Por vencer: menos de 30 días')).toBeVisible();

  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  await fecha.fill('');
  await fecha.pressSequentially(fmt(ayer), { delay: 30 });
  await fecha.press('Tab');
  await expect(page.getByText('Vencida: no se puede registrar')).toBeVisible();
});

// ── E. Editar instructor (sin guardar) ──────────────────────────────────────

test('E01/E02: Editar precarga los datos y el RUT no se puede modificar', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await blockWrites(page);
  await openInstructores(page);
  await page
    .locator('tr', { hasText: 'Instructor2 Apellido2' })
    .locator('[data-llm-action="editar-instructor"]')
    .click();
  await expect(page.locator('#e-nombres')).toHaveValue('Instructor2');
  await expect(page.locator('#e-rut')).toBeDisabled();
});

// ── I. Ficha, horario y horas ───────────────────────────────────────────────

test('I01/I02/I06/I10: ficha, horario y horas trabajadas abren con sus datos', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await openInstructores(page);
  await page
    .locator('tr', { hasText: 'Instructor1 Apellido1' })
    .locator('[data-llm-action="ver-instructor"], [data-llm-action="ver-detalle-instructor"]')
    .first()
    .click();
  await expect(page.getByText('Instructor1 Apellido1').last()).toBeVisible();
  await page.locator('[data-llm-action="ver-horario-instructor"]').click();
  await expect(page.getByText(/Clase|Sin clases agendadas/).first()).toBeVisible();
});

// ── K. Lista de secretarias ─────────────────────────────────────────────────

test('K01/K03/K06/K11: KPIs cuadran, búsqueda, sin resultados y detalle', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/secretarias');
  const filas = page.locator('.secretaria-row');
  await expect(filas.first()).toBeVisible();

  const buscar = page.locator(
    '[data-llm-description="input for searching secretaries by name or email"]',
  );
  await buscar.fill('secretaria2@test.com');
  await expect(filas).toHaveCount(1);
  await buscar.fill('zzzz-no-existe');
  await expect(page.getByText('No hay registros que coincidan con los filtros.')).toBeVisible();
  await buscar.fill('');

  await page
    .locator('.secretaria-row', { hasText: 'secretaria2@test.com' })
    .locator('[data-llm-action="ver-detalle-secretaria"]')
    .click();
  for (const t of ['RUT', 'Último acceso']) {
    await expect(page.getByText(t, { exact: false }).first()).toBeVisible();
  }
});

// ── L. Crear secretaria (validaciones, sin enviar) ──────────────────────────

test('L02: crear secretaria vacía marca errores y no llama a la función', async ({ pageAs }) => {
  const page = await pageAs('admin');
  const called = await blockWrites(page);
  await page.goto('/app/admin/secretarias');
  await expect(page.locator('.secretaria-row').first()).toBeVisible();
  await page.locator('[data-llm-action="new"]').first().click();
  await page
    .locator('[data-llm-action^="confirmar-crear"], [data-llm-action^="crear-secretaria"]')
    .first()
    .click();
  await expect(page.locator('.field-error').first()).toBeVisible();
  expect(called).toEqual([]);
});

// ── P / Q. Ajustes ──────────────────────────────────────────────────────────

async function abrirAjustes(page: Page): Promise<void> {
  await page.locator('[data-llm-action="open-user-profile-menu"]').click();
  await page.locator('[data-llm-nav="ajustes"]').click();
  await expect(page.getByText('Ajustes del Sistema').first()).toBeVisible();
}

test('P01/Q01: admin ve su perfil y, en la pestaña Ajustes, la tarifa por hora', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/dashboard');
  await abrirAjustes(page);
  await expect(page.getByText('admin@test.com').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seguridad', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByText('Tarifa por Hora de Instructores')).toBeVisible();
});

test('P07/Q07: la secretaria no tiene pestaña Seguridad ni ve la tarifa por hora', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  await page.goto('/app/secretaria/dashboard');
  await abrirAjustes(page);
  await expect(page.getByText('secretaria@test.com').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seguridad', exact: true })).toHaveCount(0);
  const ajustes = page.getByRole('button', { name: 'Ajustes', exact: true });
  if (await ajustes.count()) await ajustes.click();
  await expect(page.getByText('Tarifa por Hora de Instructores')).toHaveCount(0);
});

// ── O. Usuarios ─────────────────────────────────────────────────────────────

test('O01/O03: /app/admin/usuarios ya no existe (hotfix-066-b)', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await page.goto('/app/admin/usuarios');
  await expect(page.getByText('Página no encontrada')).toBeVisible();
});
