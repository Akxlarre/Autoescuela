/**
 * Dashboards (fix-395-m, ASG-i-030) — casos "Auto ✓" del checklist
 * specs/testing-piloto/030-dashboards.md, más la regresión de los fixes 396 a 406.
 *
 * Dos pantallas distintas: el ejecutivo de admin (/app/admin/dashboard, funciones SQL
 * exec_dashboard_*) y el operativo de secretaria (/app/secretaria/dashboard).
 *
 * Los números se comparan de forma relativa (antes y después de sembrar) o contra lo que
 * devuelve la BD en ese momento: nunca contra un valor fijo. No se automatiza acá:
 * - Iniciar y finalizar una clase desde "Clases Actuales": e2e/asistencia-clase-b.spec.ts.
 * - El costo de instructores del mes en curso (fix-396-m) y los vehículos disponibles del
 *   ejecutivo (fix-397-m): se ensayaron como migración en una transacción que se revierte.
 */
import type { Page } from '@playwright/test';
import { chileToday } from '../src/app/core/utils/chile-time.utils';
import { describeRange, resolvePresetRange } from '../src/app/core/utils/executive-dashboard.utils';
import { resolveVehicleStatus } from '../src/app/core/utils/vehicle-status.utils';
import { ACCOUNTS } from './support/accounts';
import { createE2eAlumno } from './support/alumnos-seed';
import { SEDE_A, SEDE_B, limpiarAsistencia, seedClase } from './support/asistencia-seed';
import { expect, test, watchErrors } from './support/fixtures';
import { getAdminClient, getClientFor } from './support/supabase-admin';

const DESKTOP = { width: 1440, height: 900 };
const CARGA = { timeout: 30_000 };
const SEDE_A_NOMBRE = 'Autoescuela Chillán';
const SEDE_B_NOMBRE = 'Conductores Chillán';
const EJECUTIVO = '/app/admin/dashboard';
const SECRETARIA = '/app/secretaria/dashboard';

// Uno tras otro, no en paralelo entre sí: cada dashboard dispara unas 34 consultas y varios a la
// vez saturan la BD de desarrollo (timeouts al sembrar y al limpiar en este y en otros archivos).
test.describe.configure({ mode: 'default', timeout: 150_000 });
test.afterEach(limpiarAsistencia);

// ── Ayudas ────────────────────────────────────────────────────────────────────

const accion = (page: Page, name: string) => page.locator(`[data-llm-action="${name}"]`);
const drawer = (page: Page) => page.locator('[data-drawer-panel]');
const hero = (page: Page) => page.locator('app-section-hero');
const clp = (n: number) => Math.round(n).toLocaleString('es-CL');

/**
 * Valor de un KPI de la tira del hero, por su etiqueta ("Clases Hoy" → "3"). Mientras el hero
 * está en skeleton (recarga por cambio de sede) devuelve '': se usa dentro de `expect.poll`.
 */
async function heroKpi(page: Page, label: string): Promise<string> {
  const text = await hero(page).innerText();
  return text.match(new RegExp(`${label}\\s+(\\S+)`, 'i'))?.[1] ?? '';
}

async function abrirEjecutivo(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(EJECUTIVO);
  await expect(page.locator('.exec-kpis')).toContainText('Ingresos Clase B', CARGA);
  await expect(page.locator('main app-skeleton-block')).toHaveCount(0, CARGA);
}

async function abrirSecretaria(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(SECRETARIA);
  await secretariaLista(page);
}

async function secretariaLista(page: Page): Promise<void> {
  await expect(hero(page)).toContainText(/Alumnos Activos/i, CARGA);
  await expect(page.locator('main app-skeleton-block')).toHaveCount(0, CARGA);
}

async function elegirSede(page: Page, nombre: string): Promise<void> {
  const boton = page.locator('header button[aria-label^="Sede activa"]');
  if ((await boton.getAttribute('aria-expanded')) !== 'true') await boton.click();
  await page.getByRole('option', { name: nombre, exact: true }).click();
}

async function elegirPeriodo(page: Page, nombre: string): Promise<void> {
  await page.locator('app-exec-period-filter p-select').click();
  await page.getByRole('option', { name: nombre, exact: true }).click();
}

const tabEjecutivo = (page: Page, nombre: string) =>
  page.locator('main app-tabs').locator('[role="tab"], button').filter({ hasText: nombre }).first();

/** Junta las llamadas a las funciones del ejecutivo que hace la página. */
function contarRpc(page: Page): { nombres: () => string[]; reiniciar: () => void } {
  let llamadas: string[] = [];
  page.on('request', (req) => {
    const match = req.url().match(/rpc\/(exec_\w+)/);
    if (match) llamadas.push(match[1]);
  });
  return { nombres: () => [...llamadas], reiniciar: () => (llamadas = []) };
}

interface Kpis {
  ingresos: number;
  nuevas_matriculas: number;
  alumnos_activos: number;
}

async function kpisDelRango(branchId: number | null, from: string, to: string): Promise<Kpis> {
  const sb = await getAdminClient();
  const { data, error } = await sb.rpc('exec_dashboard_kpis', {
    p_from: from,
    p_to: to,
    p_branch_id: branchId,
  });
  if (error) throw new Error(`[e2e] exec_dashboard_kpis falló: ${error.message}`);
  return data as Kpis;
}

/** KPIs de "Este mes" (día 1 → hoy), lo que muestra el ejecutivo al abrirse. */
function kpisDelMes(branchId: number | null): Promise<Kpis> {
  const hoy = chileToday();
  return kpisDelRango(branchId, `${hoy.slice(0, 7)}-01`, hoy);
}

/**
 * El ejecutivo muestra, para la sede elegida, los ingresos y los alumnos activos que devuelve la
 * BD. Otros tests crean y borran alumnos y pagos mientras tanto, y el ejecutivo no se refresca
 * solo: si no coinciden, se recarga la página (la sede elegida se conserva) y se compara de nuevo.
 */
async function ejecutivoCoincideConLaBd(page: Page, branchId: number): Promise<void> {
  const enPantalla = async () => {
    const tarjeta = await page.locator('.exec-kpi').first().innerText();
    const ingresos = tarjeta.match(/\$\s*([\d.]+)/);
    return `${ingresos?.[1] ?? ''} · ${await heroKpi(page, 'Alumnos activos')}`;
  };
  await expect(async () => {
    const bd = await kpisDelMes(branchId);
    const esperado = `${clp(bd.ingresos)} · ${clp(bd.alumnos_activos)}`;
    if ((await enPantalla()) !== esperado) {
      await page.reload();
      await expect(page.locator('.exec-kpis')).toContainText('Ingresos Clase B', CARGA);
      await expect(page.locator('main app-skeleton-block')).toHaveCount(0, CARGA);
      const fresco = await kpisDelMes(branchId);
      // El contador de la tarjeta se anima: se espera a que llegue al valor final.
      await expect
        .poll(enPantalla, { timeout: 10_000 })
        .toBe(`${clp(fresco.ingresos)} · ${clp(fresco.alumnos_activos)}`);
    }
  }).toPass({ timeout: 90_000 });
}

// ── Ejecutivo: carga, acceso y período ────────────────────────────────────────

test('A01 · B01 · J08: el admin ve el ejecutivo con "Este mes", una ronda de 7 consultas y sin scroll de página', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const errores = watchErrors(page);
  const rpc = contarRpc(page);

  await abrirEjecutivo(page);

  await expect(hero(page)).toContainText('Dashboard ejecutivo');
  const esteMes = describeRange(resolvePresetRange('this_month', chileToday()));
  await expect(hero(page)).toContainText(new RegExp(`Todas las escuelas · ${esteMes}`, 'i'));
  await expect(page.locator('app-exec-period-filter p-select')).toContainText('Este mes');
  await expect(tabEjecutivo(page, 'Tendencias')).toBeVisible();
  await expect(page.locator('main')).toContainText('Ventas mensuales Clase B');

  expect(rpc.nombres().sort()).toEqual(
    [
      'exec_dashboard_instructor_hours',
      'exec_dashboard_kpis',
      'exec_dashboard_kpis',
      'exec_dashboard_kpis',
      'exec_dashboard_monthly_series',
      'exec_dashboard_receivables',
      'exec_dashboard_today_ops',
    ].sort(),
  );
  // App-like: la página no scrollea; el contenido largo scrollea dentro de la celda de tabs.
  const medidas = await page.evaluate(() => ({
    documento: document.documentElement.scrollHeight,
    ventana: window.innerHeight,
  }));
  expect(medidas.documento).toBe(medidas.ventana);
  errores.expectClean();
});

test('A03 · A04 · A05: cada rol cae en su propio dashboard y no entra al del otro', async ({
  pageAs,
}) => {
  const secretaria = await pageAs('secretariaA');
  await secretaria.goto(EJECUTIVO);
  await expect(secretaria).toHaveURL(new RegExp(`${SECRETARIA}$`), CARGA);
  await secretariaLista(secretaria);

  const admin = await pageAs('admin');
  await admin.goto(SECRETARIA);
  await expect(admin).toHaveURL(new RegExp(`${EJECUTIVO}$`), CARGA);
  await expect(hero(admin)).toContainText('Dashboard ejecutivo', CARGA);
});

test('B02 · B04 · B05 · B06: cambiar de período recarga una sola vez; el rango personalizado solo al aplicar', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  const rpc = contarRpc(page);
  await abrirEjecutivo(page);

  // Mes anterior: una ronda de 7, sin skeleton, y el hero muestra el mes completo.
  rpc.reiniciar();
  await elegirPeriodo(page, 'Mes anterior');
  const mesAnterior = describeRange(resolvePresetRange('last_month', chileToday()));
  await expect(hero(page)).toContainText(new RegExp(mesAnterior, 'i'), CARGA);
  await expect.poll(() => rpc.nombres().length, CARGA).toBe(7);
  await expect(page.locator('main app-skeleton-block')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(rpc.nombres()).toHaveLength(7);

  // Personalizado → Cancelar: no recarga y el selector vuelve al preset vigente.
  rpc.reiniciar();
  await elegirPeriodo(page, 'Personalizado');
  const calendario = page.locator('.p-popover');
  await expect(calendario).toBeVisible();
  await calendario.getByRole('button', { name: 'Cancelar' }).click();
  await expect(calendario).toBeHidden();
  await expect(page.locator('app-exec-period-filter p-select')).toContainText('Mes anterior');
  expect(rpc.nombres()).toHaveLength(0);

  // Personalizado → un solo día → Aplicar: una ronda de 7.
  await accion(page, 'open-executive-dashboard-custom-range').click();
  await expect(calendario).toBeVisible();
  await calendario
    .locator('td:not(.p-datepicker-other-month) .p-datepicker-day')
    .getByText('1', { exact: true })
    .click();
  expect(rpc.nombres()).toHaveLength(0);
  await accion(page, 'apply-executive-dashboard-custom-range').click();
  await expect(page.locator('app-exec-period-filter p-select')).toContainText('Personalizado');
  await expect.poll(() => rpc.nombres().length, CARGA).toBe(7);
});

// ── Ejecutivo: números contra datos sembrados ─────────────────────────────────

test('C01 · C03 · D01 · D03: una matrícula y un pago nuevos mueven solo lo que corresponde', async ({
  pageAs,
  cleanup,
}) => {
  const sb = await getAdminClient();
  // Un día de 2019: ningún otro test ni persona crea matrículas o pagos con esa fecha, así que
  // los KPIs "del período" de ese día se pueden comparar de forma exacta aunque la suite corra
  // en paralelo. Los que son foto de hoy (activos, cartera) los mueve cualquier otro test: se
  // comprueban al final, comparando la pantalla contra la BD.
  const DIA = '2019-03-12';
  const antes = await kpisDelRango(SEDE_A, DIA, DIA);

  const alumno = await createE2eAlumno(
    {
      label: 'DashEjec',
      branchId: SEDE_A,
      enrollments: [
        {
          status: 'active',
          paymentStatus: 'partial',
          pendingBalance: 150_000,
          createdAt: `${DIA}T15:00:00.000Z`,
        },
      ],
    },
    cleanup,
  );
  const conMatricula = await kpisDelRango(SEDE_A, DIA, DIA);
  expect(conMatricula.nuevas_matriculas).toBe(antes.nuevas_matriculas + 1);

  // Un pago recibido suma; uno "Cobrar después" (pending), no.
  const { data: pagos, error } = await sb
    .from('payments')
    .insert([
      {
        enrollment_id: alumno.enrollmentIds[0],
        total_amount: 100_000,
        cash_amount: 100_000,
        status: 'paid',
        payment_date: DIA,
      },
      {
        enrollment_id: alumno.enrollmentIds[0],
        total_amount: 50_000,
        status: 'pending',
        payment_date: DIA,
      },
    ])
    .select('id');
  if (error) throw new Error(`[e2e] No se pudieron sembrar los pagos: ${error.message}`);
  for (const pago of pagos ?? []) cleanup.track('payments', pago.id);

  const conPago = await kpisDelRango(SEDE_A, DIA, DIA);
  expect(conPago.ingresos).toBe(conMatricula.ingresos + 100_000);

  // La pantalla muestra lo mismo que devuelve la función para esa sede.
  const page = await pageAs('admin');
  await abrirEjecutivo(page);
  await elegirSede(page, SEDE_A_NOMBRE);
  await expect(hero(page)).toContainText(new RegExp(SEDE_A_NOMBRE, 'i'), CARGA);
  await ejecutivoCoincideConLaBd(page, SEDE_A);
});

test('E01: las variaciones se muestran con coma decimal, nunca con punto', async ({ pageAs }) => {
  const page = await pageAs('admin');
  await abrirEjecutivo(page);

  for (const periodo of ['Mes anterior', 'Este año', 'Este mes']) {
    await elegirPeriodo(page, periodo);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main app-skeleton-block')).toHaveCount(0);
    const texto = await page.locator('main').innerText();
    expect(texto, `"${periodo}" muestra un porcentaje con punto decimal`).not.toMatch(/\d\.\d%/);
  }
});

test('J01 · J02: el ejecutivo sigue a la sede elegida, también al cambiar varias veces seguidas', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await abrirEjecutivo(page);

  await elegirSede(page, SEDE_A_NOMBRE);
  await expect(hero(page)).toContainText(new RegExp(SEDE_A_NOMBRE, 'i'), CARGA);
  await ejecutivoCoincideConLaBd(page, SEDE_A);

  // Cambio rápido: gana la última sede pedida y no queda ningún skeleton pegado.
  await elegirSede(page, SEDE_B_NOMBRE);
  await elegirSede(page, SEDE_A_NOMBRE);
  await elegirSede(page, SEDE_B_NOMBRE);
  await expect(hero(page)).toContainText(new RegExp(SEDE_B_NOMBRE, 'i'), CARGA);
  await ejecutivoCoincideConLaBd(page, SEDE_B);
  await expect(page.locator('main app-skeleton-block')).toHaveCount(0);

  // "Todas" suma las dos sedes.
  const [a, b, todas] = await Promise.all([
    kpisDelMes(SEDE_A),
    kpisDelMes(SEDE_B),
    kpisDelMes(null),
  ]);
  expect(todas.alumnos_activos).toBe(a.alumnos_activos + b.alumnos_activos);
  expect(todas.ingresos).toBe(a.ingresos + b.ingresos);
});

test('J05 · J06: si falla una sola sección, solo esa muestra el error y "Reintentar" la recupera', async ({
  pageAs,
}) => {
  const page = await pageAs('admin');
  await page.route('**/rpc/exec_dashboard_instructor_hours', (route) => route.abort());
  await abrirEjecutivo(page);

  await expect(page.locator('.exec-kpis')).toContainText('Saldo por cobrar');
  await tabEjecutivo(page, 'Alumnos y cartera').click();
  await expect(page.locator('main')).toContainText('Estado de alumnos');
  await tabEjecutivo(page, 'Instructores').click();
  await expect(page.locator('main')).toContainText(
    'No se pudieron cargar las horas de instrucción',
  );

  await page.unroute('**/rpc/exec_dashboard_instructor_hours');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.locator('main')).toContainText('Horas de instrucción', CARGA);
});

test('J07 · R05: las funciones del ejecutivo son solo del admin y la secretaria no lee la otra sede', async () => {
  const secretaria = await getClientFor(ACCOUNTS.secretariaA.email, ACCOUNTS.secretariaA.password);
  const hoy = chileToday();
  const rango = { p_from: `${hoy.slice(0, 7)}-01`, p_to: hoy };
  const llamadas: [string, Record<string, unknown>][] = [
    ['exec_dashboard_kpis', { ...rango, p_branch_id: null }],
    ['exec_dashboard_kpis', { ...rango, p_branch_id: SEDE_B }],
    ['exec_dashboard_monthly_series', { p_year: Number(hoy.slice(0, 4)), p_branch_id: null }],
    ['exec_dashboard_instructor_hours', { ...rango, p_branch_id: null }],
    ['exec_dashboard_receivables', { p_branch_id: SEDE_B }],
    ['exec_dashboard_today_ops', { p_branch_id: null }],
    ['exec_instructor_accrued_cost', { ...rango, p_branch_id: null }],
  ];
  for (const [fn, args] of llamadas) {
    const { data, error } = await secretaria.rpc(fn, args);
    expect(data, `${fn} devolvió datos a una secretaria`).toBeNull();
    expect(error?.code, `${fn} debe rechazar a una secretaria`).toBe('42501');
  }

  // RLS por sede: nada de la sede 2 para la secretaria de la sede 1.
  for (const tabla of ['class_b_sessions', 'payments']) {
    const { count, error } = await secretaria
      .from(tabla)
      .select('id, enrollments!inner(branch_id)', { count: 'exact', head: true })
      .eq('enrollments.branch_id', SEDE_B);
    expect(error).toBeNull();
    expect(count, `${tabla} de la otra sede`).toBe(0);
  }
});

// ── Secretaria: carga, KPIs y Clases Actuales ─────────────────────────────────

test('A02 · K01 · K07: la secretaria ve su dashboard completo, con montos en pesos', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  const errores = watchErrors(page);

  await abrirSecretaria(page);

  await expect(hero(page)).toContainText('¡Bienvenido,');
  for (const kpi of ['Alumnos Activos', 'Clases Hoy', 'Ingresos Mes', 'Vehículos']) {
    await expect(hero(page)).toContainText(new RegExp(kpi, 'i'));
  }
  // fix-399-m: monto completo con separador de miles, sin "M".
  expect(await heroKpi(page, 'Ingresos Mes')).toMatch(/^\$\d{1,3}(\.\d{3})*$/);
  for (const panel of ['Clases Actuales', 'Actividad reciente', 'Alertas Importantes']) {
    await expect(page.locator('main')).toContainText(panel);
  }
  for (const boton of ['Matricular', 'Registrar Pago', 'Agenda', 'Registrar Egreso']) {
    await expect(hero(page).getByRole('button', { name: boton })).toBeVisible();
  }
  errores.expectClean();
});

test('K04 · K10 · M01 · M03 · M15 · N01: "Clases Hoy" y el panel cuentan lo mismo, sin canceladas, y el detalle dice qué clase es', async ({
  pageAs,
  cleanup,
}) => {
  const page = await pageAs('secretariaA');
  await abrirSecretaria(page);
  const antes = Number(await heroKpi(page, 'Clases Hoy'));

  const hoy = chileToday();
  const base = { branchId: SEDE_A, dia: hoy };
  const porIniciar = await seedClase(
    { ...base, label: 'DashPend', cupo: { inst: 0, hora: 2 }, classNumber: 2 },
    cleanup,
  );
  const finalizada = await seedClase(
    { ...base, label: 'DashFin', cupo: { inst: 1, hora: 2 }, classNumber: 4, status: 'completed' },
    cleanup,
  );
  const noAsistio = await seedClase(
    { ...base, label: 'DashFalta', cupo: { inst: 2, hora: 3 }, classNumber: 5, status: 'no_show' },
    cleanup,
  );
  const cancelada = await seedClase(
    { ...base, label: 'DashCanc', cupo: { inst: 3, hora: 3 }, status: 'cancelled' },
    cleanup,
  );

  await page.reload();
  await secretariaLista(page);

  // fix-398-m: tres clases válidas más; la cancelada no cuenta en el KPI ni en el chip.
  await expect.poll(() => heroKpi(page, 'Clases Hoy'), CARGA).toBe(String(antes + 3));
  await expect(hero(page)).toContainText(`${antes + 3} clases programadas`);

  const panel = page.locator('app-live-classes-panel');
  const fila = (nombre: string) => panel.locator('.live-class-item').filter({ hasText: nombre });
  await expect(fila(porIniciar.alumno.firstNames)).toContainText('Por Iniciar');
  await expect(fila(finalizada.alumno.firstNames)).toContainText('Finalizada');
  await expect(fila(noAsistio.alumno.firstNames)).toContainText('No Asistió');
  await expect(fila(cancelada.alumno.firstNames)).toHaveCount(0);

  // fix-406-m: el detalle de una clase cerrada dice "Clase N".
  await fila(finalizada.alumno.firstNames).click();
  await expect(drawer(page)).toContainText('Clase 4');
  await page.keyboard.press('Escape');
  await expect(drawer(page)).toBeHidden();

  // Desde "Agenda de Hoy", el detalle de la inasistencia también, y permite deshacerla.
  await accion(page, 'view-all-classes').click();
  const agendaDeHoy = drawer(page).locator('.live-class-item');
  await agendaDeHoy.filter({ hasText: noAsistio.alumno.firstNames }).click();
  await expect(drawer(page).last()).toContainText('Clase 5');
  await expect(
    drawer(page)
      .last()
      .getByRole('button', { name: /Deshacer/ }),
  ).toBeVisible();
});

test('L01 · L03 · L05 · L06: cada acceso rápido abre su drawer', async ({ pageAs }) => {
  const page = await pageAs('secretariaA');
  await abrirSecretaria(page);

  const casos: [string, RegExp][] = [
    ['Registrar Pago', /Registrar Pago/],
    ['Registrar Egreso', /Registrar Egreso/],
    ['Agenda', /Agenda Semanal/],
    ['Matricular', /Nueva Matrícula/],
  ];
  for (const [boton, titulo] of casos) {
    await hero(page).getByRole('button', { name: boton }).click();
    await expect(page.locator('[data-drawer-panel], [data-drawer-title]').first()).toBeVisible(
      CARGA,
    );
    await expect(page.locator('body')).toContainText(titulo);
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toBeHidden();
  }
});

test('P01 · P05 · Q19: la actividad y las alertas se abren completas en su drawer', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  await abrirSecretaria(page);

  await accion(page, 'view-all-activity').click();
  await expect(page.locator('body')).toContainText('Actividad Reciente', CARGA);
  await page.keyboard.press('Escape');
  await expect(drawer(page)).toBeHidden();

  await accion(page, 'view-all-alerts').click();
  await expect(drawer(page)).toContainText('Alertas del sistema', CARGA);
  await expect(drawer(page)).toContainText(/\d+ alertas? activas?/);
  // Orden por gravedad: ninguna alerta de error después de una de menor gravedad.
  const gravedades = await drawer(page)
    .locator('[role="listitem"] > div:first-child')
    .evaluateAll((iconos) =>
      iconos.map((el) => (el.className.match(/text-(error|warning|info|success)/) ?? [])[1]),
    );
  const orden = ['error', 'warning', 'info', 'success'];
  const indices = gravedades.map((g) => orden.indexOf(g ?? ''));
  expect(indices).toEqual([...indices].sort((x, y) => x - y));
});

test('Q08: "Ir a Cuadratura" lleva a cada rol a su propia Cuadratura', async ({ pageAs }) => {
  // La alerta existe mientras la caja del día no esté cerrada; si ya se cerró, no hay nada que probar.
  const secretaria = await pageAs('secretariaA');
  await abrirSecretaria(secretaria);
  await accion(secretaria, 'view-all-alerts').click();
  await expect(drawer(secretaria)).toContainText('Alertas del sistema', CARGA);
  // Esperar a que termine la revisión: mientras carga, la lista todavía no trae la alerta.
  await expect(drawer(secretaria)).toContainText(/\d+ alertas? activas?/, CARGA);
  const irACuadratura = accion(secretaria, 'execute-alert-action-navigate');
  test.skip((await irACuadratura.count()) === 0, 'La caja de hoy ya está cerrada en la sede 1');

  await irACuadratura.click();
  await expect(secretaria).toHaveURL(/\/app\/secretaria\/contabilidad\/cuadratura$/, CARGA);
  await expect(drawer(secretaria)).toBeHidden();
});

// ── Secretaria: errores, sedes y tiempo real ──────────────────────────────────

test('A09: si la carga falla, la secretaria ve un aviso con "Reintentar", no un dashboard en cero', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  await page.setViewportSize(DESKTOP);
  // Se entra por otra pantalla para que la sesión cargue; recién ahí se corta la BD.
  await page.goto('/app/secretaria/alumnos');
  await expect(page.locator('a[href$="/app/secretaria/dashboard"]').first()).toBeVisible(CARGA);
  await page.waitForLoadState('networkidle');
  await page.route('**/rest/v1/**', (route) => route.abort());
  await page.locator('a[href$="/app/secretaria/dashboard"]').first().click();

  const main = page.locator('main');
  await expect(main).toContainText('No se pudo cargar el panel', CARGA);
  await expect(main).not.toContainText('Sin clases actuales');
  await expect(main).not.toContainText('Caja sin cerrar');
  await expect(hero(page)).not.toContainText(/Alumnos Activos/i);

  await page.unroute('**/rest/v1/**');
  await main.getByRole('button', { name: 'Reintentar' }).click();
  await secretariaLista(page);
  await expect(main).not.toContainText('No se pudo cargar el panel');
});

test('R01 · R02 · K09: la secretaria multi-sede ve otra sede al cambiarla, sin salir del dashboard', async ({
  pageAs,
}) => {
  // Un vehículo de "ambas sedes" cuenta en las dos (fix-411-m). Se relee cada vez: otros tests
  // crean y borran vehículos mientras tanto.
  const disponibles = async (branchId: number | null) => {
    const sb = await getAdminClient();
    const { data, error } = await sb.from('vehicles').select('branch_id, both_branches, status');
    if (error) throw new Error('[e2e] No se pudieron leer los vehículos: ' + error.message);
    return (data ?? []).filter(
      (v) =>
        (branchId === null || v.branch_id === branchId || v.both_branches) &&
        resolveVehicleStatus(v.status) === 'available',
    ).length;
  };
  /** Sede por la que el dashboard pidió los vehículos la última vez ('' = todas). */
  let ultimaSedePedida: string | null = null;
  const page = await pageAs('secretariaMultisede');
  page.on('request', (req) => {
    const url = decodeURIComponent(req.url());
    if (!url.includes('/rest/v1/vehicles?')) return;
    ultimaSedePedida = url.match(/branch_id\.eq\.(\d+)/)?.[1] ?? '';
  });
  const muestraLaSede = async (branchId: number | null) => {
    await expect
      .poll(() => ultimaSedePedida, CARGA)
      .toBe(branchId === null ? '' : String(branchId));
    await expect(page.locator('main app-skeleton-block')).toHaveCount(0, CARGA);
    await expect(async () => {
      expect(await heroKpi(page, 'Vehículos')).toBe(String(await disponibles(branchId)));
    }).toPass({ timeout: 30_000 });
  };

  await abrirSecretaria(page);
  await muestraLaSede(null);

  await elegirSede(page, SEDE_B_NOMBRE);
  await muestraLaSede(SEDE_B);

  // Cambio seguido: termina con la última sede pedida.
  await elegirSede(page, SEDE_A_NOMBRE);
  await elegirSede(page, SEDE_B_NOMBRE);
  await elegirSede(page, SEDE_A_NOMBRE);
  await muestraLaSede(SEDE_A);
});

test('O05: al salir del dashboard se cierra su canal de tiempo real y al volver se abre otra vez', async ({
  pageAs,
}) => {
  const page = await pageAs('secretariaA');
  const tramas: string[] = [];
  page.on('websocket', (ws) =>
    ws.on('framesent', (frame) => {
      const texto = String(frame.payload);
      if (!texto.includes('dashboard-realtime')) return;
      if (texto.includes('phx_join')) tramas.push('join');
      if (texto.includes('phx_leave')) tramas.push('leave');
    }),
  );

  await abrirSecretaria(page);
  await expect.poll(() => tramas.at(-1), CARGA).toBe('join');

  await page.locator('a[href*="/app/secretaria/alumnos"]').first().click();
  await expect(page).toHaveURL(/\/app\/secretaria\/alumnos/, CARGA);
  await expect.poll(() => tramas.at(-1), CARGA).toBe('leave');

  await page.locator('a[href$="/app/secretaria/dashboard"]').first().click();
  await secretariaLista(page);
  await expect.poll(() => tramas.at(-1), CARGA).toBe('join');
});

test('O01 · O02: una clase y un pago registrados desde otra sesión aparecen sin recargar', async ({
  pageAs,
  cleanup,
}) => {
  const sb = await getAdminClient();
  const page = await pageAs('secretariaA');
  await abrirSecretaria(page);
  // '' mientras el hero recarga → -1, para que expect.poll siga esperando.
  const pesos = async () => {
    const digitos = (await heroKpi(page, 'Ingresos Mes')).replace(/[^0-9]/g, '');
    return digitos === '' ? -1 : Number(digitos);
  };
  const ingresosAntes = await pesos();

  // Otra sesión agenda una clase para hoy: aparece sola en "Clases Actuales".
  const clase = await seedClase(
    { label: 'DashVivo', branchId: SEDE_A, dia: chileToday(), cupo: { inst: 4, hora: 4 } },
    cleanup,
  );
  const fila = page
    .locator('app-live-classes-panel .live-class-item')
    .filter({ hasText: clase.alumno.firstNames });
  await expect(fila).toContainText('Por Iniciar', CARGA);

  // Otra sesión la cierra: la etiqueta cambia sin recargar.
  const { error: cierre } = await sb
    .from('class_b_sessions')
    .update({ status: 'completed' })
    .eq('id', clase.sessionId);
  expect(cierre).toBeNull();
  await expect(fila).toContainText('Finalizada', CARGA);

  // Otra sesión registra un pago de esa matrícula: "Ingresos Mes" sube ese monto.
  const { error: saldo } = await sb
    .from('enrollments')
    .update({ pending_balance: 40_000, payment_status: 'partial' })
    .eq('id', clase.enrollmentId);
  expect(saldo).toBeNull();
  const { data: pago, error: pagoError } = await sb
    .from('payments')
    .insert({
      enrollment_id: clase.enrollmentId,
      total_amount: 25_000,
      cash_amount: 25_000,
      status: 'paid',
      payment_date: chileToday(),
    })
    .select('id')
    .single();
  if (pagoError) throw new Error('[e2e] No se pudo sembrar el pago: ' + pagoError.message);
  cleanup.track('payments', pago.id);
  await expect.poll(pesos, CARGA).toBe(ingresosAntes + 25_000);
});

test('S05: una clase de "Clases Actuales" se abre con el teclado y dice qué hace', async ({
  pageAs,
  cleanup,
}) => {
  const clase = await seedClase(
    { label: 'DashTecla', branchId: SEDE_A, dia: chileToday(), cupo: { inst: 5, hora: 5 } },
    cleanup,
  );
  const page = await pageAs('secretariaA');
  await abrirSecretaria(page);

  const fila = page
    .locator('app-live-classes-panel .live-class-item')
    .filter({ hasText: clase.alumno.firstNames });
  await expect(fila).toHaveAttribute('role', 'button');
  await expect(fila).toHaveAttribute(
    'aria-label',
    new RegExp(`^Iniciar la clase de ${clase.alumno.firstNames}`),
  );
  await expect(fila).toHaveAttribute('data-llm-action', 'start-live-class');

  await fila.focus();
  await expect(fila).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(drawer(page)).toContainText('Comenzar Clase', CARGA);
  await expect(drawer(page)).toContainText(clase.alumno.firstNames);
});
