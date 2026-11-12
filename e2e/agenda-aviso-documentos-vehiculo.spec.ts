/**
 * Agenda: aviso de documentos del vehículo visible fuera del tooltip (fix-251-b). Misma regla que
 * fix-247-b: avisar en ámbar, no bloquear.
 *
 * Solo lectura: se intercepta `vehicle_documents` y se le pone el SOAP vencido a todos los
 * vehículos de la sede. La BD no se toca.
 */
import { expect, test } from './support/fixtures';

test.describe.configure({ timeout: 120_000 });

const RESUMEN = '[data-testid="agenda-aviso-documentos-vehiculos"]';
const DETALLE = '[data-testid="slot-detalle-documentos-vehiculo"]';

test('fix-251-b: resumen sobre la grilla, aviso en el detalle del horario y acceso a Flota', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');

  let resolveIds: (ids: number[]) => void = () => {};
  const vehicleIds = new Promise<number[]>((r) => (resolveIds = r));
  await page.route('**/rest/v1/vehicles?select=id%2Clicense_plate*', async (route) => {
    const res = await route.fetch();
    const rows = (await res.json()) as { id: number }[];
    resolveIds(rows.map((r) => r.id));
    await route.fulfill({ response: res, json: rows });
  });
  await page.route('**/rest/v1/vehicle_documents*', async (route) => {
    const ids = await vehicleIds;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        ids.map((id) => ({
          vehicle_id: id,
          type: 'soap',
          expiry_date: '2020-01-01',
          status: 'valid',
        })),
      ),
    });
  });

  await page.goto('/app/secretaria/agenda');

  // A5: una sola línea sobre la grilla, que dice que las horas se siguen ofreciendo.
  const resumen = page.locator(RESUMEN).first();
  await expect(resumen).toBeVisible({ timeout: 30_000 });
  await expect(resumen).toContainText('SOAP vencido');
  await expect(resumen).toContainText('Sus horas se siguen ofreciendo.');

  // A3: el aria-label del horario libre incluye el aviso.
  const libre = page.locator('app-agenda-slot[aria-label^="Slot disponible"]').first();
  await expect(libre).toBeVisible();
  await expect(libre).toHaveAttribute('aria-label', /Vehículo \S+: SOAP vencido\./);
  await page.screenshot({ path: 'test-results/fix-251-b-grilla.png' });

  // A1: el detalle del horario muestra el aviso con la patente, y nada se bloquea.
  await libre.click();
  const aviso = page.locator(DETALLE);
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  await expect(aviso).toContainText(/Vehículo \S+: SOAP vencido/);
  await expect(aviso).toContainText('El horario se sigue ofreciendo.');
  await page.screenshot({ path: 'test-results/fix-251-b-detalle.png' });

  // A1: "Ver en Flota" lleva a la Flota del portal actual.
  await aviso.locator('[data-llm-nav="flota-desde-detalle-agenda"]').click();
  await expect(page).toHaveURL(/\/app\/secretaria\/flota$/, { timeout: 15_000 });
});

test('fix-251-b: en "Todos los instructores" cada horario libre dice instructor y patente', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  await page.goto('/app/secretaria/agenda');

  await page.locator('[data-llm-description="Filtrar calendario por instructor"]').first().click();
  await page.getByRole('option', { name: 'Todos los instructores' }).click();

  // Abre la primera celda que tenga horarios libres.
  const celda = page.locator('.cell-condensed:has(.cell-pill--available)').first();
  await expect(celda).toBeVisible({ timeout: 30_000 });
  await celda.click();

  // A4: "Nombre · PATENTE" en los libres de la celda expandida.
  const identidad = page.locator('.cell-expanded-content app-agenda-slot .slot-student').first();
  await expect(identidad).toHaveText(/^\S+ · \S+$/);

  // La celda expandida contiene su lista: no se monta sobre las filas de abajo.
  const alto = await page.evaluate(() => {
    const c = document.querySelector('.cell-condensed--expanded')!;
    const lista = c.querySelector('.cell-expanded-content')!;
    return { celda: c.getBoundingClientRect().bottom, lista: lista.getBoundingClientRect().bottom };
  });
  expect(alto.lista).toBeLessThanOrEqual(alto.celda + 1);
  // Y la fila crece para mostrar varios horarios, no uno solo metido en 56px.
  const visibles = await page.evaluate(() => {
    const lista = document.querySelector('.cell-condensed--expanded .cell-expanded-content')!;
    return lista.getBoundingClientRect().height;
  });
  expect(visibles).toBeGreaterThan(150);
  await page.screenshot({ path: 'test-results/fix-251-b-todos.png' });
});
