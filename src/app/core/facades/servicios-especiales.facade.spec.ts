import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ServiciosEspecialesFacade } from './servicios-especiales.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
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
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
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
  user?: Record<string, unknown>;
  selectedBranchId?: number | null;
}

function setup(opts: SetupOpts = {}) {
  const mockSupabase = createMockSupabase(opts.tables ?? {});
  const user = opts.user ?? {
    role: 'admin',
    dbId: 9,
    branchId: 3,
    canAccessBothBranches: false,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: mockSupabase },
      { provide: AuthFacade, useValue: { currentUser: vi.fn(() => user) } },
      {
        provide: BranchFacade,
        useValue: { selectedBranchId: vi.fn(() => opts.selectedBranchId ?? null) },
      },
      { provide: LayoutDrawerFacadeService, useValue: { open: vi.fn() } },
      { provide: ErrorSanitizerService, useValue: { sanitize: vi.fn((e: Error) => e) } },
    ],
  });
  return { facade: TestBed.inject(ServiciosEspecialesFacade), mockSupabase };
}

function venta(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    client_name: 'Juan',
    client_rut: '11.111.111-1',
    is_student: false,
    service_id: 5,
    price: 25000,
    sale_date: '2026-07-01',
    status: 'pending',
    paid: false,
    metadata: null,
    service_catalog: { name: 'Psicotécnico' },
    ...overrides,
  };
}

describe('ServiciosEspecialesFacade', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('mapeo del catálogo → UI (ícono/color por nombre)', () => {
    it('asigna brain/truck/file-text según keywords y receipt por defecto', async () => {
      const { facade } = setup({
        tables: {
          service_catalog: {
            data: [
              {
                id: 1,
                name: 'Examen Psicotécnico',
                description: null,
                base_price: 1,
                active: true,
              },
              {
                id: 2,
                name: 'Curso Maquinaria Pesada',
                description: 'd',
                base_price: 2,
                active: true,
              },
              { id: 3, name: 'Informe de Alumno', description: 'd', base_price: 3, active: true },
              { id: 4, name: 'Servicio Genérico', description: 'd', base_price: 4, active: true },
            ],
            error: null,
          },
        },
      });
      await facade.initialize();
      expect(facade.catalogo().map((s) => s.icono)).toEqual([
        'brain',
        'truck',
        'file-text',
        'receipt',
      ]);
      expect(facade.catalogo()[0].descripcion).toBe(''); // null → string vacío
    });
  });

  describe('mapeo de ventas', () => {
    it('traduce status y usa "—" para cliente/rut/servicio nulos', async () => {
      const { facade } = setup({
        tables: {
          special_service_sales: {
            data: [
              venta({ status: 'completed' }),
              venta({ id: 2, client_name: null, client_rut: null, service_catalog: null }),
            ],
            error: null,
          },
        },
      });
      await facade.initialize();
      const [completada, anonima] = facade.ventas();
      expect(completada.estado).toBe('completado');
      expect(anonima.estado).toBe('pendiente');
      expect(anonima.cliente).toBe('—');
      expect(anonima.rut).toBe('—');
      expect(anonima.servicio).toBe('—');
    });
  });

  describe('KPIs', () => {
    it('separa cobrado vs pendiente y cuenta solo las ventas del mes actual', async () => {
      const esteMes = new Date().toISOString().slice(0, 7);
      const { facade } = setup({
        tables: {
          special_service_sales: {
            data: [
              venta({ id: 1, paid: true, price: 10000, sale_date: `${esteMes}-05` }),
              venta({ id: 2, paid: false, price: 4000, sale_date: '2020-01-05' }),
              venta({ id: 3, paid: false, price: 6000, sale_date: `${esteMes}-10` }),
            ],
            error: null,
          },
        },
      });
      await facade.initialize();
      expect(facade.kpis()).toEqual({
        ventasMes: 2,
        totalCobrado: 10000,
        pendientesCobro: 10000,
        totalRegistros: 3,
        ventasCobradas: 1,
        ventasSinCobrar: 2,
      });
    });
  });

  describe('registrarVenta — anclaje de sede en INSERT', () => {
    it('con scope "todas las sedes" (null) ancla el INSERT a la sede propia del usuario', async () => {
      const { facade, mockSupabase } = setup({ selectedBranchId: null });
      const ok = await facade.registrarVenta({
        servicioId: 5,
        esAlumno: false,
        nombre: 'Juan',
        rut: '1-9',
        fecha: '2026-07-01',
        precio: 25000,
        cobrado: true,
      } as any);
      expect(ok).toBe(true);
      const insertMock = mockSupabase._builders.get('special_service_sales').insert;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ branch_id: 3, registered_by: 9, status: 'pending' }),
      );
    });

    it('error del INSERT → señal de error saneada y false', async () => {
      const { facade } = setup({
        tables: { special_service_sales: { data: null, error: new Error('RLS deny') } },
      });
      const ok = await facade.registrarVenta({
        servicioId: 5,
        esAlumno: false,
        nombre: 'x',
        rut: '1-9',
        fecha: '2026-07-01',
        precio: 1,
        cobrado: false,
      } as any);
      expect(ok).toBe(false);
      expect(facade.error()).toBe('RLS deny');
    });
  });

  describe('registrarCobro', () => {
    it('marca la venta como cobrada con update optimista (sin re-fetch)', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          special_service_sales: { data: [venta({ id: 7, paid: false })], error: null },
        },
      });
      await facade.initialize();
      const fromCallsBefore = mockSupabase.client.from.mock.calls.length;
      await facade.registrarCobro(7);
      expect(facade.ventas()[0].cobrado).toBe(true);
      // Solo la llamada del UPDATE — sin re-fetch de la lista
      expect(mockSupabase.client.from.mock.calls.length).toBe(fromCallsBefore + 1);
    });
  });
});
