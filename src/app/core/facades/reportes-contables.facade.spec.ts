import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ReportesContablesFacade } from './reportes-contables.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

type TableResponse = { data: unknown; error: unknown };

function createMockSupabase(tables: Record<string, TableResponse>) {
  const builders = new Map<string, any>();
  const from = vi.fn().mockImplementation((table: string) => {
    if (!builders.has(table)) {
      const res = tables[table] ?? { data: [], error: null };
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: any, reject: any) => Promise.resolve(res).then(resolve, reject),
      };
      builders.set(table, builder);
    }
    return builders.get(table);
  });
  return {
    client: {
      from,
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    },
    _builders: builders,
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
  const mockBranch = {
    selectedBranchId: vi.fn(() => opts.selectedBranchId ?? null),
    selectedBranchLabel: vi.fn(() => 'Escuela Centro'),
    branches: vi.fn(() => [
      { id: 1, name: 'Escuela Centro' },
      { id: 2, name: 'Escuela Norte' },
    ]),
  };
  const mockToast = { success: vi.fn(), error: vi.fn() };
  const mockSanitizer = { sanitize: vi.fn((e: Error) => e) };

  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: mockSupabase },
      { provide: AuthFacade, useValue: mockAuth },
      { provide: BranchFacade, useValue: mockBranch },
      { provide: ToastService, useValue: mockToast },
      { provide: ErrorSanitizerService, useValue: mockSanitizer },
    ],
  });
  return {
    facade: TestBed.inject(ReportesContablesFacade),
    mockSupabase,
    mockToast,
  };
}

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
    it('error en una query → señal de error saneada + toast, sin reventar', async () => {
      const { facade, mockToast } = setup({
        tables: { payments: { data: null, error: new Error('boom interno') } },
      });
      await facade.initialize();
      expect(facade.error()).toBe('boom interno');
      expect(mockToast.error).toHaveBeenCalled();
      expect(facade.isLoading()).toBe(false);
    });

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
});
