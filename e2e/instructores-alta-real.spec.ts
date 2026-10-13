/**
 * Alta REAL de instructores del checklist 034 (ASG-i-034, fix-197-b): C03, C24, C25 y T01.
 *
 * ⚠️ A diferencia de instructores-alta.spec.ts, aquí `create-instructor` NO se intercepta: cada
 * corrida deja 2 instructores de prueba con su cuenta de Auth (correo `e2e.alta.*@e2e.test`,
 * nombre "Zzprueba"). No se borran solos — una cuenta de Auth no se puede borrar con la sesión
 * admin —; el test imprime los ids para limpiarlos por SQL. Por eso NO corre con la suite: hay que
 * pedirlo con E2E_ALTA_REAL=1.
 *
 * Con el portal de instructores en piloto la invitación no se envía (fix-214-b): no sale ningún
 * correo. C28 (llega el correo) queda fuera.
 */
import type { Page } from '@playwright/test';
import { getAdminClient } from './support/supabase-admin';
import { expect, test } from './support/fixtures';

const SEDE_A = { id: 1, name: 'Autoescuela Chillán' };
const DESKTOP = { width: 1600, height: 900 };
const CARGA = { timeout: 30_000 };
const PDF = Buffer.from('%PDF-1.4\n% e2e\n%%EOF\n');

test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.skip(!process.env['E2E_ALTA_REAL'], 'Crea cuentas reales: correr con E2E_ALTA_REAL=1');

interface Persona {
  nombres: string;
  paterno: string;
  materno: string;
  rut: string;
  email: string;
  nombreLista: string;
}

/** Letras únicas por corrida (los nombres no admiten dígitos). */
function sufijo(): string {
  return Date.now()
    .toString(26)
    .replace(/\d/g, (d) => 'qrstuvwxyz'[Number(d)]);
}

function rutValido(cuerpo: number): string {
  let suma = 0;
  let factor = 2;
  for (const d of String(cuerpo).split('').reverse()) {
    suma += Number(d) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return `${cuerpo}-${dv}`;
}

function persona(etiqueta: string, offset: number): Persona {
  const s = sufijo();
  const paterno = `${etiqueta}${s}`;
  return {
    nombres: 'Zzprueba',
    paterno,
    materno: 'Borrar',
    rut: rutValido(40_000_000 + (Math.floor(Date.now() / 1000) % 9_000_000) + offset),
    email: `e2e.alta.${s}${offset}@e2e.test`,
    nombreLista: `Zzprueba ${paterno}`,
  };
}

async function abrirAlta(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.addInitScript(
    (sede) => localStorage.setItem('autoescuela:selectedBranchId', JSON.stringify(sede)),
    SEDE_A,
  );
  await page.goto('/app/admin/instructores');
  await page.locator('[data-llm-action="new"]').first().click();
  await expect(page.locator('#c-type')).toBeVisible(CARGA);
}

async function llenarDatos(page: Page, p: Persona): Promise<void> {
  await page.locator('#c-nombres').fill(p.nombres);
  await page.locator('#c-paterno').fill(p.paterno);
  await page.locator('#c-materno').fill(p.materno);
  await page.locator('#c-rut').fill(p.rut);
  await page.locator('#c-rut').blur();
  await page.locator('#c-email').fill(p.email);
  await page.locator('#c-telefono').fill('912345678');
  await page.locator('#c-license-num').fill(p.rut.split('-')[0]);
  const fecha = page.locator(
    '[data-llm-description="Fecha de vencimiento de la licencia del instructor"] input',
  );
  await fecha.click();
  await fecha.pressSequentially('31/12/2030', { delay: 30 });
  await fecha.press('Tab');
  // C03 paso 3: a más de 30 días se muestra "Vigente".
  await expect(page.getByText('Vigente: más de 30 días para vencer')).toBeVisible();

  const sede = page.locator('#branch-scope-sede');
  if (await sede.count()) {
    await sede.click();
    await page.getByRole('option', { name: SEDE_A.name, exact: true }).click();
  }
  await page.locator('#c-type').click();
  await page.getByRole('option', { name: 'Práctico', exact: true }).click();
}

async function adjuntar(page: Page, archivo: string): Promise<string> {
  await page.locator('#c-doc-type').click();
  const opcion = page.getByRole('option').first();
  const tipo = (await opcion.innerText()).trim();
  await opcion.click();
  await page
    .locator('app-admin-instructor-crear-drawer input[type="file"]')
    .setInputFiles({ name: archivo, mimeType: 'application/pdf', buffer: PDF });
  await expect(page.getByText(archivo)).toBeVisible();
  return tipo;
}

async function opcionesVehiculo(page: Page): Promise<string[]> {
  await page.locator('#c-vehicle').click();
  // Con la lista vacía PrimeNG muestra "No se encontraron resultados", que no es una opción real.
  const opciones = (await page.locator('.p-select-option').allInnerTexts()).map((o) => o.trim());
  await page.keyboard.press('Escape');
  return opciones;
}

/**
 * Vehículo libre de la sede A. En el seed todos están asignados, así que se siembra uno; queda en
 * la BD junto con el instructor (se limpia por SQL con los ids que imprime el test).
 */
async function sembrarVehiculo(): Promise<{ id: number; patente: string }> {
  const sb = await getAdminClient();
  const patente = `ZZ${String(Date.now()).slice(-4)}`;
  const { data, error } = await sb
    .from('vehicles')
    .insert({
      license_plate: patente,
      brand: 'E2E',
      model: 'Prueba',
      year: 2024,
      branch_id: SEDE_A.id,
      status: 'available',
    })
    .select('id')
    .single();
  if (error) throw new Error(`[e2e] No se pudo sembrar el vehículo: ${error.message}`);
  return { id: data.id, patente };
}

async function filasEnBd(email: string) {
  const sb = await getAdminClient();
  const { data: user } = await sb
    .from('users')
    .select('id, branch_id, active, first_login, supabase_uid')
    .eq('email', email)
    .maybeSingle();
  if (!user) return null;
  const { data: instructor } = await sb
    .from('instructors')
    .select('id, type, active, both_branches')
    .eq('user_id', user.id)
    .maybeSingle();
  const instructorId = instructor?.id ?? -1;
  const { data: asignaciones } = await sb
    .from('vehicle_assignments')
    .select('id, vehicle_id, end_date')
    .eq('instructor_id', instructorId);
  const { data: documentos } = await sb
    .from('instructor_documents')
    .select('*')
    .eq('instructor_id', instructorId);
  const { data: auditoria } = await sb
    .from('audit_log')
    .select('entity, entity_id, action, user_id')
    .or(
      `and(entity.eq.users,entity_id.eq.${user.id}),and(entity.eq.instructors,entity_id.eq.${instructorId})`,
    );
  return { user, instructor, asignaciones, documentos, auditoria };
}

async function adminId(): Promise<number> {
  const sb = await getAdminClient();
  const { data } = await sb.from('users').select('id').eq('email', 'admin@test.com').single();
  return data!.id;
}

test('C03 + C24 + T01: alta completa con vehículo y 2 documentos', async ({ pageAs }) => {
  const p = persona('Alta', 0);
  const sembrado = await sembrarVehiculo();
  const patente = sembrado.patente;
  console.log('[alta-real] vehículo sembrado', JSON.stringify(sembrado));
  const page = await pageAs('admin');
  await abrirAlta(page);
  await llenarDatos(page, p);

  const libres = await opcionesVehiculo(page);
  const vehiculo = libres.find((o) => o.startsWith(patente));
  expect(vehiculo, `El vehículo libre ${patente} debe ofrecerse (hay: ${libres})`).toBeTruthy();
  await page.locator('#c-vehicle').click();
  await page.locator('.p-select-option').filter({ hasText: patente }).click();

  const tipo1 = await adjuntar(page, 'e2e-doc-uno.pdf');
  const tipo2 = await adjuntar(page, 'e2e-doc-dos.pdf');
  expect(tipo2, 'El tipo ya usado no se vuelve a ofrecer').not.toBe(tipo1);

  await page.locator('[data-llm-action="confirmar-crear-instructor"]').click();
  await expect(page.getByText('Instructor creado')).toBeVisible(CARGA);
  // Piloto (fix-214-b): se avisa que la invitación queda pendiente; no sale correo.
  await expect(page.getByText(/se enviará cuando termine el piloto/)).toBeVisible();

  // C03 paso 6: en la lista, con su vehículo y "Activo".
  const fila = page.locator('tr, [class*="card"]').filter({ hasText: p.email }).first();
  await expect(fila).toBeVisible(CARGA);
  await expect(fila).toContainText(patente);
  await expect(fila).toContainText('Activo');

  const bd = await expect
    .poll(async () => (await filasEnBd(p.email))?.documentos?.length ?? -1, CARGA)
    .toBe(2)
    .then(() => filasEnBd(p.email));
  console.log('[alta-real] C03/C24', JSON.stringify({ persona: p, vehiculo, bd }));
  expect(bd!.user.branch_id).toBe(SEDE_A.id);
  expect(bd!.user.supabase_uid, 'Cuenta de Auth creada y vinculada').toBeTruthy();
  expect(bd!.instructor).toMatchObject({ type: 'practice', active: true });
  expect(bd!.asignaciones).toHaveLength(1);
  expect(bd!.asignaciones![0].end_date).toBeNull();
  // C24: los 2 documentos quedan en su ficha.
  expect(bd!.documentos).toHaveLength(2);

  // T01: el alta queda en la auditoría a nombre del admin.
  const admin = await adminId();
  const altas = (bd!.auditoria ?? []).filter((a) => a.action === 'INSERT');
  expect(altas.map((a) => a.entity).sort()).toEqual(['instructors', 'users']);
  expect(altas.every((a) => a.user_id === admin)).toBe(true);

  // C03 paso 9: ese vehículo ya no se ofrece.
  await page.locator('[data-llm-action="new"]').first().click();
  await expect(page.locator('#c-type')).toBeVisible(CARGA);
  expect((await opcionesVehiculo(page)).some((o) => o.startsWith(patente))).toBe(false);

  // C03 paso 8: aparece en el filtro de instructores de la Agenda de su sede.
  await page.goto('/app/admin/agenda');
  const filtro = page.locator('[data-llm-description="Filtrar calendario por instructor"]');
  await expect(filtro).toBeVisible(CARGA);
  await filtro.click();
  await expect(page.getByRole('option', { name: p.nombreLista, exact: true })).toBeVisible(CARGA);
});

test('C25: si falla la subida de un documento, el instructor igual queda creado', async ({
  pageAs,
}) => {
  const p = persona('Docfalla', 1);
  const page = await pageAs('admin');
  await abrirAlta(page);
  await llenarDatos(page, p);
  await adjuntar(page, 'e2e-doc-falla.pdf');

  // "Se corta la red" justo para la subida del archivo.
  await page.route('**/storage/v1/object/**', (route) =>
    route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.continue(),
  );

  await page.locator('[data-llm-action="confirmar-crear-instructor"]').click();
  await expect(page.getByText('No se pudo subir un documento')).toBeVisible(CARGA);

  const bd = await filasEnBd(p.email);
  console.log('[alta-real] C25', JSON.stringify({ persona: p, bd }));
  expect(bd?.instructor, 'El instructor queda creado').toBeTruthy();
  expect(bd!.documentos).toHaveLength(0);
  expect(bd!.asignaciones).toHaveLength(0);
});
