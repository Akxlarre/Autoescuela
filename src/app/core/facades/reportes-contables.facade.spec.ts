import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { effect, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReportesContablesFacade } from './reportes-contables.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

type TableResponse = { data: unknown; error: unknown };
/** Decide si una lectura falla, según la tabla y el inicio del rango pedido. */
type ReadFailure = (table: string, desde: string | undefined) => boolean;

const BUILDER_METHODS = ['select', 'insert', 'eq', 'in', 'gte', 'lte', 'lt', 'order'] as const;

function createMockSupabase(tables: Record<string, TableResponse>) {
  const builders = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  const control = {
    readFailure: null as ReadFailure | null,
    /** Mientras exista, las lecturas que se esperen quedan retenidas hasta resolverla. */
    gate: null as Promise<void> | null,
  };

  const from = vi.fn().mockImplementation((table: string) => {
    if (!builders.has(table)) {
      builders.set(table, Object.fromEntries(BUILDER_METHODS.map((m) => [m, vi.fn()])));
    }
    const shared = builders.get(table)!;
    // Cada from() es una consulta propia: las de un Promise.all no se pisan el rango.
    const query: any = { isInsert: false, desde: undefined as string | undefined };
    for (const method of BUILDER_METHODS) {
      query[method] = (...args: unknown[]) => {
        shared[method](...args);
        if (method === 'insert') query.isInsert = true;
        if (method === 'gte') query.desde = args[1];
        return query;
      };
    }
    query.then = (resolve: any, reject: any) => {
      const fails = !query.isInsert && control.readFailure?.(table, query.desde);
      const res = fails
        ? { data: null, count: null, error: new Error(`lectura caída: ${table}`) }
        : (tables[table] ?? { data: [], error: null });
      return (control.gate ?? Promise.resolve()).then(() => res).then(resolve, reject);
    };
    return query;
  });
  return {
    client: {
      from,
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    },
    _builders: builders,
    control,
  };
}

interface SetupOpts {
  tables?: Record<string, TableResponse>;
  user?: Record<string, unknown> | null;
  selectedBranchId?: number | null;
}

function setup(opts: SetupOpts = {}) {
  const mockSupabase = createMockSupabase(opts.tables ?? {});
  const user =
    opts.user === undefined
      ? { role: 'admin', dbId: 9, branchId: null, canAccessBothBranches: false }
      : opts.user;
  const mockAuth = { currentUser: vi.fn(() => user) };
  const selectedBranchId = signal<number | null>(opts.selectedBranchId ?? null);
  const mockBranch = {
    selectedBranchId,
    selectedBranchLabel: vi.fn(() => 'Escuela Centro'),
    branches: vi.fn(() => [
      { id: 1, name: 'Escuela Centro' },
      { id: 2, name: 'Escuela Norte' },
    ]),
  };
  const mockToast = { success: vi.fn(), error: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: mockSupabase },
      { provide: AuthFacade, useValue: mockAuth },
      { provide: BranchFacade, useValue: mockBranch },
      { provide: ToastService, useValue: mockToast },
    ],
  });
  return {
    facade: TestBed.inject(ReportesContablesFacade),
    mockSupabase,
    mockToast,
    selectedBranchId,
    /** Hace fallar las lecturas de esas tablas (todas si no se indica ninguna). */
    failReads: (...only: string[]) => {
      mockSupabase.control.readFailure = (table) => only.length === 0 || only.includes(table);
    },
    restoreReads: () => {
      mockSupabase.control.readFailure = null;
    },
  };
}

const PAGO_ABRIL = {
  total_amount: 100_000,
  type: 'enrollment',
  payment_date: '2026-04-01',
  enrollments: { branch_id: 1, license_group: 'class_b' },
};
const GASTO_FIJO = {
  id: 1,
  category: 'rent',
  description: 'Local',
  amount: 500,
  date: '2026-04-01',
};
const CON_DATOS = {
  payments: { data: [PAGO_ABRIL], error: null },
  fixed_expenses: { data: [GASTO_FIJO], error: null },
};
const MARZO = { rango: 'personalizado', desde: '2026-03-01', hasta: '2026-03-31' } as const;
const ENERO_2020 = { rango: 'personalizado', desde: '2020-01-01', hasta: '2020-01-31' } as const;

describe('ReportesContablesFacade', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('etiqueta de escuela por rol (hotfix-017)', () => {
    it('admin con "todas las sedes" → "Ambas escuelas"', async () => {
      const { facade } = setup({ selectedBranchId: null });
      await facade.initialize();
      expect(facade.escuela()).toBe('Ambas escuelas');
    });

    it('secretaria sin grant → SIEMPRE el nombre de su sede fija (ignora selector)', async () => {
      const { facade } = setup({
        user: { role: 'secretaria', dbId: 9, branchId: 2, canAccessBothBranches: false },
        selectedBranchId: 1,
      });
      await facade.initialize();
      expect(facade.escuela()).toBe('Escuela Norte');
    });

    it('secretaria CON grant → usa la sede del selector como un admin', async () => {
      const { facade } = setup({
        user: { role: 'secretaria', dbId: 9, branchId: 2, canAccessBothBranches: true },
        selectedBranchId: 1,
      });
      await facade.initialize();
      expect(facade.escuela()).toBe('Escuela Centro');
    });
  });

  describe('gastos fijos', () => {
    it('mapea la categoría a su label y cae al valor crudo si no existe', async () => {
      const { facade } = setup({
        tables: {
          fixed_expenses: {
            data: [
              {
                id: 1,
                category: 'rent',
                description: 'Local',
                amount: 500,
                date: '2026-07-01',
              },
              {
                id: 2,
                category: 'categoria_fantasma',
                description: 'X',
                amount: 10,
                date: '2026-07-02',
              },
            ],
            error: null,
          },
        },
      });
      await facade.initialize();
      const rows = facade.gastosFijos();
      expect(rows[0].categoryLabel).toBe('Arriendo'); // label humano del catálogo
      expect(rows[1].categoryLabel).toBe('categoria_fantasma'); // fallback crudo
    });

    it('registrarGastoFijo inserta con la sede efectiva y el autor, y retorna true', async () => {
      const { facade, mockSupabase, mockToast } = setup({ selectedBranchId: 4 });
      const ok = await facade.registrarGastoFijo({
        category: 'arriendo',
        description: 'Local julio',
        amount: 350000,
        date: '2026-07-01',
      } as any);
      expect(ok).toBe(true);
      const insertMock = mockSupabase._builders.get('fixed_expenses').insert;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ branch_id: 4, created_by: 9, amount: 350000 }),
      );
      expect(mockToast.success).toHaveBeenCalled();
      expect(facade.isRegistrando()).toBe(false);
    });

    it('registrarGastoFijo usa el branchId explícito del payload por sobre la sede efectiva', async () => {
      const { facade, mockSupabase } = setup({ selectedBranchId: 1 });
      const ok = await facade.registrarGastoFijo({
        branchId: 2,
        category: 'arriendo',
        description: 'Local',
        amount: 100,
        date: '2026-07-01',
      } as any);
      expect(ok).toBe(true);
      const insertMock = mockSupabase._builders.get('fixed_expenses').insert;
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ branch_id: 2 }));
    });

    it('registrarGastoFijo rechaza y NO inserta cuando no hay sede (payload y selector null) — DG-082', async () => {
      const { facade, mockSupabase, mockToast } = setup({ selectedBranchId: null });
      const ok = await facade.registrarGastoFijo({
        category: 'arriendo',
        description: 'Local',
        amount: 100,
        date: '2026-07-01',
      } as any);
      expect(ok).toBe(false);
      expect(mockToast.error).toHaveBeenCalled();
      expect(mockSupabase._builders.has('fixed_expenses')).toBe(false);
      expect(facade.isRegistrando()).toBe(false);
    });

    it('registrarGastoFijo con error de BD → toast de error y false, sin colgar el flag', async () => {
      const { facade, mockToast } = setup({
        tables: { fixed_expenses: { data: null, error: new Error('RLS') } },
      });
      const ok = await facade.registrarGastoFijo({
        category: 'arriendo',
        description: 'x',
        amount: 1,
        date: '2026-07-01',
      } as any);
      expect(ok).toBe(false);
      expect(mockToast.error).toHaveBeenCalled();
      expect(facade.isRegistrando()).toBe(false);
    });
  });

  describe('servicios especiales como ingreso (fix-047-i, ASG-i-051)', () => {
    const tablas = {
      payments: {
        data: [
          {
            total_amount: 100_000,
            type: 'enrollment',
            payment_date: '2026-04-01',
            enrollments: { branch_id: 1, license_group: 'class_b' },
          },
        ],
        error: null,
      },
      special_service_sales: {
        data: [
          { price: 25_000, sale_date: '2026-04-02', branch_id: 1 },
          { price: 40_000, sale_date: '2026-04-03', branch_id: 2 },
        ],
        error: null,
      },
    };

    it('suma las ventas cobradas de servicios especiales al total de ingresos', async () => {
      const { facade, mockSupabase } = setup({ tables: tablas });
      await facade.initialize();

      expect(mockSupabase.client.from).toHaveBeenCalledWith('special_service_sales');
      expect(mockSupabase._builders.get('special_service_sales').eq).toHaveBeenCalledWith(
        'paid',
        true,
      );
      expect(facade.kpis()?.totalIngresos).toBe(165_000);
      expect(facade.kpis()?.operacionesIngresos).toBe(3);
    });

    it('aparecen como categoría "Psicotécnico / Servicios"', async () => {
      const { facade } = setup({ tables: tablas });
      await facade.initialize();

      const cat = facade.ingresosCategoria().find((c) => /Servicios/.test(c.nombre));
      expect(cat?.monto).toBe(65_000);
    });

    it('respetan la sede: con sede 1 solo cuenta la venta de esa sede', async () => {
      const { facade } = setup({ tables: tablas, selectedBranchId: 1 });
      await facade.initialize();

      expect(facade.kpis()?.totalIngresos).toBe(125_000);
    });
  });

  describe('rentabilidad por tipo de curso (fix-237-m)', () => {
    it('expone rentabilidadCursos derivado de payments + expenses del rango', async () => {
      const { facade } = setup({
        tables: {
          payments: {
            data: [
              {
                total_amount: 600_000,
                type: 'enrollment',
                payment_date: '2026-04-01',
                enrollments: { branch_id: 1, license_group: 'class_b' },
              },
              {
                total_amount: 400_000,
                type: 'enrollment',
                payment_date: '2026-04-02',
                enrollments: { branch_id: 2, license_group: 'professional' },
              },
            ],
            error: null,
          },
          expenses: {
            data: [{ amount: 100_000, category: 'fuel', date: '2026-04-01' }],
            error: null,
          },
        },
      });
      await facade.initialize();
      const filas = facade.rentabilidadCursos();
      expect(filas.map((f) => f.tipoCurso).sort()).toEqual(['Clase B', 'Profesional']);
      // sin conteo de clases (mock cuenta 0) → fuel se reparte por ingresos 60/40
      const total = filas.reduce((s, f) => s + f.gastosDirectos, 0);
      expect(total).toBe(100_000);
    });

    it('consulta class_b_sessions y professional_practice_sessions para el conteo', async () => {
      const { facade, mockSupabase } = setup();
      await facade.initialize();
      expect(mockSupabase.client.from).toHaveBeenCalledWith('class_b_sessions');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('professional_practice_sessions');
    });
  });

  describe('evolución mensual — serie fija de últimos meses (fix-242-m)', () => {
    // Reloj fijo: la serie son los últimos 6 meses desde "hoy". Sin fijarlo, el pago de
    // mayo-2026 sale de la ventana en cuanto el reloj real pasa de octubre-2026.
    // 2026-05-20T16:00Z = 12:00 hora Chile del 20 de mayo.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-05-20T16:00:00.000Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('expone la serie aunque el filtro sea "Mes actual" (no depende del rango)', async () => {
      const { facade } = setup({
        tables: {
          payments: {
            data: [
              {
                total_amount: 300_000,
                type: 'enrollment',
                payment_date: '2026-05-15',
                enrollments: { branch_id: 1, license_group: 'class_b' },
              },
            ],
            error: null,
          },
        },
      });
      await facade.initialize();
      // filtro por defecto = "mes actual"; la serie igual incluye el mes del pago.
      expect(facade.filtros().rango).toBe('mes_actual');
      expect(facade.evolucionMensual().some((m) => /mayo/i.test(m.mes))).toBe(true);
    });
  });

  describe('rango propio de Evolución Mensual (spec 0015-m)', () => {
    it('el rango de evolución arranca en "ultimos_6_meses" y la serie trae 6 meses', async () => {
      const { facade } = setup();
      await facade.initialize();
      expect(facade.rangoEvolucion()).toBe('ultimos_6_meses');
      expect(facade.evolucionMensual()).toHaveLength(6);
    });

    it('aplicarRangoEvolucion("ultimos_12_meses") repuebla la serie con 12 meses', async () => {
      const { facade } = setup();
      await facade.initialize();
      await facade.aplicarRangoEvolucion('ultimos_12_meses');
      expect(facade.rangoEvolucion()).toBe('ultimos_12_meses');
      expect(facade.evolucionMensual()).toHaveLength(12);
    });

    it('aplicarRangoEvolucion NO toca el filtro general ni dispara skeleton (AC8, AC10)', async () => {
      const { facade } = setup();
      await facade.initialize();
      const filtrosAntes = facade.filtros();
      await facade.aplicarRangoEvolucion('anio_anterior');

      // El rango general y su ventana quedan intactos.
      expect(facade.filtros()).toEqual(filtrosAntes);
      expect(facade.filtros().rango).toBe('mes_actual');
      // Sin skeleton: aplicarRangoEvolucion nunca toca isLoading.
      expect(facade.isLoading()).toBe(false);
    });

    it('"anio_anterior" → 12 meses, todos del año calendario anterior (AC6)', async () => {
      const { facade } = setup();
      await facade.initialize();
      await facade.aplicarRangoEvolucion('anio_anterior');
      const serie = facade.evolucionMensual();
      const anioPasado = String(new Date().getFullYear() - 1);
      expect(serie).toHaveLength(12);
      expect(serie.every((m) => m.mes.includes(anioPasado))).toBe(true);
      // Meses sin datos igual vienen, marcados sinMovimientos (AC7).
      expect(serie.every((m) => m.sinMovimientos === true)).toBe(true);
    });
  });

  describe('SWR al aplicar filtros (fix-237-m)', () => {
    it('con datos previos, aplicarFiltros NO muestra skeleton (isLoading queda en false)', async () => {
      const { facade } = setup({
        tables: {
          payments: {
            data: [
              {
                total_amount: 1000,
                type: 'enrollment',
                payment_date: '2026-04-01',
                enrollments: { branch_id: 1, license_group: 'class_b' },
              },
            ],
            error: null,
          },
        },
      });
      await facade.initialize();
      expect(facade.kpis()).not.toBeNull();

      const p = facade.aplicarFiltros({
        rango: 'mes_anterior',
        desde: '2026-03-01',
        hasta: '2026-03-31',
      });
      // Durante el refresco silencioso el skeleton NO aparece.
      expect(facade.isLoading()).toBe(false);
      await p;
      expect(facade.isLoading()).toBe(false);
      expect(facade.filtros().rango).toBe('mes_anterior');
    });

    it('primera carga SIN datos previos SÍ usa skeleton', async () => {
      const { facade } = setup();
      const p = facade.aplicarFiltros({
        rango: 'mes_actual',
        desde: '2026-04-01',
        hasta: '2026-04-30',
      });
      expect(facade.isLoading()).toBe(true);
      await p;
      expect(facade.isLoading()).toBe(false);
    });
  });

  describe('manejo de errores del reporte', () => {
    it('exportar con error de la Edge Function → toast de error y flag liberado', async () => {
      const { facade, mockSupabase, mockToast } = setup();
      mockSupabase.client.functions.invoke.mockResolvedValue({
        data: null,
        error: new Error('EF down'),
      });
      await facade.exportar('excel');
      expect(mockToast.error).toHaveBeenCalled();
      expect(facade.isExporting()).toBe(false);
    });
  });

  describe('lecturas que fallan (spec 0060-b)', () => {
    const MENSAJE = 'No se pudo cargar el reporte contable.';
    const MENSAJE_EVOLUCION = 'No se pudo cargar la evolución mensual.';

    function expectReporteRetirado(facade: ReportesContablesFacade): void {
      expect(facade.error()).toBe(MENSAJE);
      expect(facade.kpis()).toBeNull();
      expect(facade.ingresosCategoria()).toEqual([]);
      expect(facade.gastosCategoria()).toEqual([]);
      expect(facade.rentabilidadCursos()).toEqual([]);
      expect(facade.gastosFijos()).toEqual([]);
      expect(facade.refreshFailed()).toBe(false);
      expect(facade.isLoading()).toBe(false);
    }

    /** Deja correr los `await` ya lanzados, hasta que cada lectura quedó pedida. */
    const lecturasEnCurso = () => new Promise((resolve) => setTimeout(resolve));

    async function conReporteCargado(opts: SetupOpts = {}) {
      const ctx = setup({ tables: CON_DATOS, ...opts });
      await ctx.facade.initialize();
      expect(ctx.facade.kpis()?.totalIngresos).toBe(100_000);
      return ctx;
    }

    it('llamado desde el effect de la pantalla, un reporte nuevo no dispara otra carga', async () => {
      const { facade, mockSupabase } = setup({ tables: CON_DATOS });
      TestBed.runInInjectionContext(() => effect(() => void facade.initialize()));
      for (let ronda = 0; ronda < 4; ronda++) {
        TestBed.tick();
        await lecturasEnCurso();
      }
      expect(facade.kpis()?.totalIngresos).toBe(100_000);
      const lecturasDePagos = mockSupabase.client.from.mock.calls.filter(
        ([tabla]) => tabla === 'payments',
      );
      // Una del reporte y una de la serie de Evolución.
      expect(lecturasDePagos).toHaveLength(2);
    });

    it('primera carga con error: caso A, sin ceros ni listas que parezcan "no hay nada"', async () => {
      const { facade, failReads } = setup({ tables: CON_DATOS });
      failReads();
      await facade.initialize();
      expectReporteRetirado(facade);
      expect(facade.evolucionMensual()).toEqual([]);
      expect(facade.evolucionError()).toBe(MENSAJE_EVOLUCION);
    });

    it('una primera carga fallida se reintenta con skeleton al volver a la pantalla', async () => {
      const { facade, failReads, restoreReads } = setup({ tables: CON_DATOS });
      failReads();
      await facade.initialize();
      restoreReads();

      const reentrada = facade.initialize();
      expect(facade.isLoading()).toBe(true);
      expect(facade.error()).toBeNull();
      await reentrada;
      expect(facade.kpis()?.totalIngresos).toBe(100_000);
    });

    it('cambio de período con error: retira el reporte del período anterior (caso A)', async () => {
      const { facade, failReads } = await conReporteCargado();
      failReads();
      await facade.aplicarFiltros(MARZO);
      expect(facade.filtros()).toEqual(MARZO);
      expectReporteRetirado(facade);
    });

    it('cambio de sede con error: retira reporte y serie de la sede anterior (caso A)', async () => {
      const { facade, failReads, selectedBranchId } = await conReporteCargado({
        selectedBranchId: 1,
      });
      expect(facade.evolucionMensual()).toHaveLength(6);
      failReads();
      selectedBranchId.set(2);
      facade.initialize();
      await vi.waitFor(() => expect(facade.error()).toBe(MENSAJE));
      expectReporteRetirado(facade);
      await vi.waitFor(() => expect(facade.evolucionError()).toBe(MENSAJE_EVOLUCION));
      expect(facade.evolucionMensual()).toEqual([]);
    });

    it('refresco del mismo período con error: conserva los datos y avisa (caso B)', async () => {
      const { facade, failReads } = await conReporteCargado();
      const serie = facade.evolucionMensual();
      failReads();
      facade.initialize();
      await vi.waitFor(() => expect(facade.refreshFailed()).toBe(true));
      expect(facade.error()).toBeNull();
      expect(facade.evolucionError()).toBeNull();
      expect(facade.kpis()?.totalIngresos).toBe(100_000);
      expect(facade.gastosFijos()).toHaveLength(1);
      expect(facade.evolucionMensual()).toBe(serie);
      expect(facade.isLoading()).toBe(false);
    });

    it('reintentar tras el caso A: muestra skeleton, carga y borra el error', async () => {
      const { facade, failReads, restoreReads } = await conReporteCargado();
      failReads();
      await facade.aplicarFiltros(MARZO);
      restoreReads();

      const reintento = facade.reintentar();
      expect(facade.isLoading()).toBe(true);
      expect(facade.error()).toBeNull();
      await reintento;
      expect(facade.isLoading()).toBe(false);
      expect(facade.error()).toBeNull();
      expect(facade.kpis()?.totalIngresos).toBe(100_000);
    });

    it('reintentar tras el caso B: sin skeleton, sin perder datos y baja el aviso', async () => {
      const { facade, failReads, restoreReads } = await conReporteCargado();
      failReads();
      await facade.reintentar();
      expect(facade.refreshFailed()).toBe(true);
      restoreReads();

      const reintento = facade.reintentar();
      expect(facade.isLoading()).toBe(false);
      expect(facade.kpis()).not.toBeNull();
      await reintento;
      expect(facade.refreshFailed()).toBe(false);
    });

    it('un cambio de período que sale bien después de un refresco fallido baja el aviso', async () => {
      const { facade, failReads, restoreReads } = await conReporteCargado();
      failReads('class_b_sessions'); // solo la usa el reporte: la serie de Evolución sigue bien
      await facade.reintentar();
      expect(facade.refreshFailed()).toBe(true);
      restoreReads();
      await facade.aplicarFiltros(MARZO);
      expect(facade.refreshFailed()).toBe(false);
      expect(facade.error()).toBeNull();
    });

    it.each([
      'payments',
      'standalone_course_enrollments',
      'special_service_sales',
      'expenses',
      'fixed_expenses',
      'class_b_sessions',
      'professional_practice_sessions',
    ])('si falla solo %s, no se arma un reporte parcial', async (tabla) => {
      const { facade, failReads } = setup({ tables: CON_DATOS });
      failReads(tabla);
      await facade.initialize();
      expectReporteRetirado(facade);
    });

    it('la evolución no depende del conteo de clases: sigue visible si solo este falla', async () => {
      const { facade, failReads } = setup({ tables: CON_DATOS });
      failReads('class_b_sessions');
      await facade.initialize();
      expect(facade.error()).toBe(MENSAJE);
      expect(facade.evolucionError()).toBeNull();
      expect(facade.evolucionMensual()).toHaveLength(6);
    });

    it('cambiar la ventana de Evolución con error retira solo la serie (caso A)', async () => {
      const { facade, failReads } = await conReporteCargado();
      failReads();
      await facade.aplicarRangoEvolucion('ultimos_12_meses');
      expect(facade.evolucionMensual()).toEqual([]);
      expect(facade.evolucionError()).toBe(MENSAJE_EVOLUCION);
      expect(facade.error()).toBeNull();
      expect(facade.refreshFailed()).toBe(false);
      expect(facade.kpis()?.totalIngresos).toBe(100_000);
    });

    it('un reporte que refresca bien no borra el aviso de una serie que sigue fallando', async () => {
      const { facade, mockSupabase } = await conReporteCargado();
      await facade.aplicarFiltros(ENERO_2020);
      const serie = facade.evolucionMensual();
      // Solo falla la lectura de la ventana de Evolución; la del reporte (2020) responde.
      mockSupabase.control.readFailure = (tabla, desde) =>
        tabla === 'payments' && desde !== ENERO_2020.desde;
      await facade.reintentar();
      expect(facade.refreshFailed()).toBe(true);
      expect(facade.error()).toBeNull();
      expect(facade.evolucionMensual()).toBe(serie);
      expect(facade.kpis()).not.toBeNull();
    });

    it('cambiar de período vuelve a pedir la serie cuyo refresco había fallado', async () => {
      const { facade, failReads, restoreReads } = await conReporteCargado();
      failReads();
      await facade.reintentar();
      expect(facade.refreshFailed()).toBe(true);
      restoreReads();

      await facade.aplicarFiltros(MARZO);
      expect(facade.refreshFailed()).toBe(false);
    });

    it('cambiar de período no vuelve a pedir la serie si estaba bien', async () => {
      const { facade, mockSupabase } = await conReporteCargado();
      mockSupabase.client.from.mockClear();
      await facade.aplicarFiltros(ENERO_2020);
      // Una ronda de reporte: la serie haría una segunda lectura de pagos.
      const lecturasDePagos = mockSupabase.client.from.mock.calls.filter(
        ([tabla]) => tabla === 'payments',
      );
      expect(lecturasDePagos).toHaveLength(1);
    });

    it('un error de una respuesta vieja no pisa la carga vigente', async () => {
      const { facade, failReads, restoreReads, mockSupabase } = await conReporteCargado();
      let soltar!: () => void;
      mockSupabase.control.gate = new Promise<void>((r) => (soltar = r));
      failReads();
      const vieja = facade.aplicarFiltros(MARZO);
      await lecturasEnCurso(); // la lectura vieja ya tomó su error y quedó retenida

      mockSupabase.control.gate = null;
      restoreReads();
      await facade.aplicarFiltros(ENERO_2020);
      soltar();
      await vieja;

      expect(facade.filtros()).toEqual(ENERO_2020);
      expect(facade.error()).toBeNull();
      expect(facade.refreshFailed()).toBe(false);
      expect(facade.kpis()?.totalIngresos).toBe(100_000);
    });

    it('la carga vieja que termina no apaga el skeleton de la vigente', async () => {
      // Con sede 1 el conteo de clases es una sola lectura: cada carga queda en su compuerta.
      const { facade, mockSupabase } = setup({ tables: CON_DATOS, selectedBranchId: 1 });
      let soltarVieja!: () => void;
      let soltarVigente!: () => void;
      mockSupabase.control.gate = new Promise<void>((r) => (soltarVieja = r));
      const vieja = facade.aplicarFiltros(MARZO);
      await lecturasEnCurso();

      mockSupabase.control.gate = new Promise<void>((r) => (soltarVigente = r));
      const vigente = facade.aplicarFiltros(ENERO_2020);
      await lecturasEnCurso();

      soltarVieja();
      await vieja;
      expect(facade.isLoading()).toBe(true);

      soltarVigente();
      await vigente;
      expect(facade.isLoading()).toBe(false);
    });

    it('registrar un gasto cuya relectura falla informa éxito y deja el aviso de refresco', async () => {
      const { facade, failReads, mockToast } = await conReporteCargado({ selectedBranchId: 1 });
      failReads();
      const ok = await facade.registrarGastoFijo({
        category: 'rent',
        description: 'Local',
        amount: 1,
        date: '2026-04-02',
      } as any);
      // El gasto SÍ quedó guardado: decir lo contrario invita a registrarlo dos veces.
      expect(ok).toBe(true);
      expect(mockToast.success).toHaveBeenCalled();
      expect(mockToast.error).not.toHaveBeenCalled();
      expect(facade.refreshFailed()).toBe(true);
    });

    it('exportar no se bloquea con un refresco fallido: el archivo lo calcula el servidor', async () => {
      const { facade, failReads, mockSupabase } = await conReporteCargado({ selectedBranchId: 1 });
      failReads();
      await facade.reintentar();
      expect(facade.refreshFailed()).toBe(true);
      await facade.exportar('pdf').catch(() => undefined);
      const { desde, hasta } = facade.filtros();
      expect(mockSupabase.client.functions.invoke).toHaveBeenCalledWith(
        'generate-financial-report',
        { body: { format: 'pdf', desde, hasta, branch_id: 1 } },
      );
    });
  });
});
