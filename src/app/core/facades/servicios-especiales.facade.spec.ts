import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ServiciosEspecialesFacade } from './servicios-especiales.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { NotificationsFacade } from '@core/facades/notifications.facade';

type TableResponse = { data: unknown; error: unknown };

/**
 * `tables` acepta keys `"tabla"` (respuesta fija sin importar el método) o
 * `"tabla:delete"`/`"tabla:update"`/etc. (respuesta específica por operación,
 * necesario para simular un DELETE que falla y un UPDATE de fallback sobre la
 * misma tabla — ver `borrarServicio`).
 */
function createMockSupabase(tables: Record<string, TableResponse>) {
  const builders = new Map<string, any>();
  const from = vi.fn().mockImplementation((table: string) => {
    if (!builders.has(table)) {
      let lastOp = 'select';
      const builder: any = {
        select: vi.fn(function (this: any) {
          lastOp = 'select';
          return this;
        }),
        insert: vi.fn(function (this: any) {
          lastOp = 'insert';
          return this;
        }),
        update: vi.fn(function (this: any) {
          lastOp = 'update';
          return this;
        }),
        delete: vi.fn(function (this: any) {
          lastOp = 'delete';
          return this;
        }),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: any, reject: any) => {
          const res = tables[`${table}:${lastOp}`] ?? tables[table] ?? { data: [], error: null };
          return Promise.resolve(res).then(resolve, reject);
        },
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
  notificationsSpy?: { notifyUsers: ReturnType<typeof vi.fn> };
}

function setup(opts: SetupOpts = {}) {
  const mockSupabase = createMockSupabase(opts.tables ?? {});
  const user = opts.user ?? {
    role: 'admin',
    dbId: 9,
    branchId: 3,
    canAccessBothBranches: false,
  };
  const notificationsSpy = opts.notificationsSpy ?? {
    notifyUsers: vi.fn().mockResolvedValue(undefined),
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
      { provide: NotificationsFacade, useValue: notificationsSpy },
    ],
  });
  return { facade: TestBed.inject(ServiciosEspecialesFacade), mockSupabase, notificationsSpy };
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
    branch_id: 3,
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
    it('usa "—" para cliente/rut/servicio nulos', async () => {
      const { facade } = setup({
        tables: {
          special_service_sales: {
            data: [
              venta({ paid: true }),
              venta({ id: 2, client_name: null, client_rut: null, service_catalog: null }),
            ],
            error: null,
          },
        },
      });
      await facade.initialize();
      const [, anonima] = facade.ventas();
      expect(anonima.cliente).toBe('—');
      expect(anonima.rut).toBe('—');
      expect(anonima.servicio).toBe('—');
    });

    // fix-023-i: "Estado" se fusiona con "Cobro" (paid) — status de BD ya no se usa para mostrarlo.
    it('estado se deriva de "paid", no de "status" (fix-023-i)', async () => {
      const { facade } = setup({
        tables: {
          special_service_sales: {
            data: [
              venta({ id: 1, paid: true, status: 'pending' }), // status desalineado a propósito
              venta({ id: 2, paid: false, status: 'completed' }),
            ],
            error: null,
          },
        },
      });
      await facade.initialize();
      const [cobrada, sinCobrar] = facade.ventas();
      expect(cobrada.estado).toBe('completado');
      expect(sinCobrar.estado).toBe('pendiente');
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
      // fix-023-i: status refleja "cobrado" (paid) en el INSERT, no queda hardcodeado.
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ branch_id: 3, registered_by: 9, status: 'completed' }),
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

    // ── spec 0025 (T2.4): notificación al alumno (studentUserId ya resuelto) ──
    it('notifica al alumno usando studentUserId ya resuelto (spec 0025, AC1)', async () => {
      const { facade, notificationsSpy } = setup({
        tables: {
          special_service_sales: {
            data: [venta({ id: 7, paid: false, students: { user_id: 55 } })],
            error: null,
          },
        },
      });
      await facade.initialize();

      await facade.registrarCobro(7);

      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [55],
        expect.objectContaining({ referenceType: 'payment' }),
      );
    });

    it('venta a cliente externo (student_id null) NO notifica ni lanza error (AC-E1)', async () => {
      const { facade, notificationsSpy } = setup({
        tables: {
          special_service_sales: {
            data: [venta({ id: 7, paid: false, is_student: false, students: null })],
            error: null,
          },
        },
      });
      await facade.initialize();

      await expect(facade.registrarCobro(7)).resolves.toBeUndefined();

      expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
    });

    it('un fallo en notifyUsers no revierte el cobro ya registrado', async () => {
      const { facade, notificationsSpy } = setup({
        tables: {
          special_service_sales: {
            data: [venta({ id: 7, paid: false, students: { user_id: 55 } })],
            error: null,
          },
        },
      });
      await facade.initialize();
      notificationsSpy.notifyUsers.mockRejectedValue(new Error('network error'));

      await facade.registrarCobro(7);

      expect(facade.ventas()[0].cobrado).toBe(true);
    });
  });

  describe('borrarVenta — candado de cuadratura cerrada (fix-022-i, ASG-b-050)', () => {
    it('golden path: sin cash_closings para la fecha → borra y refresca', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          special_service_sales: { data: [venta({ id: 7, sale_date: '2026-08-10' })], error: null },
          cash_closings: { data: [], error: null },
        },
      });
      await facade.initialize();

      const result = await facade.borrarVenta(7);

      expect(result).toEqual({ success: true });
      const deleteMock = mockSupabase._builders.get('special_service_sales').delete;
      expect(deleteMock).toHaveBeenCalled();
    });

    it('AC-E1: la fecha ya tiene cash_closings → bloquea, no ejecuta DELETE', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          special_service_sales: { data: [venta({ id: 7, sale_date: '2026-08-01' })], error: null },
          cash_closings: { data: [{ id: 99 }], error: null },
        },
      });
      await facade.initialize();

      const result = await facade.borrarVenta(7);

      expect(result.success).toBe(false);
      expect(result.blockedReason).toContain('2026-08-01');
      const deleteMock = mockSupabase._builders.get('special_service_sales').delete;
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it('venta inexistente en el estado local → falla sin consultar cash_closings', async () => {
      const { facade, mockSupabase } = setup({
        tables: { special_service_sales: { data: [], error: null } },
      });
      await facade.initialize();

      const result = await facade.borrarVenta(999);

      expect(result.success).toBe(false);
      expect(mockSupabase.client.from).not.toHaveBeenCalledWith('cash_closings');
    });
  });

  describe('borrarServicio — fallback a desactivar si tiene ventas asociadas (fix-022-i, ASG-b-050)', () => {
    it('sin ventas asociadas: DELETE duro exitoso', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          'service_catalog:delete': { data: null, error: null },
        },
      });

      const result = await facade.borrarServicio(1);

      expect(result).toEqual({ success: true, deactivated: false });
      const builder = mockSupabase._builders.get('service_catalog');
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.update).not.toHaveBeenCalled();
    });

    it('con ventas asociadas: DELETE falla con FK (23503) → fallback a active=false', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          'service_catalog:delete': {
            data: null,
            error: { code: '23503', message: 'FK violation' },
          },
          'service_catalog:update': { data: null, error: null },
        },
      });

      const result = await facade.borrarServicio(1);

      expect(result).toEqual({ success: true, deactivated: true });
      const builder = mockSupabase._builders.get('service_catalog');
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.update).toHaveBeenCalledWith({ active: false });
    });

    it('error genérico (no FK) → success:false, error saneado', async () => {
      const { facade } = setup({
        tables: {
          'service_catalog:delete': { data: null, error: { code: '42501', message: 'RLS deny' } },
        },
      });

      const result = await facade.borrarServicio(1);

      expect(result.success).toBe(false);
      expect(facade.error()).toBe('RLS deny');
    });

    it('el fallback de UPDATE también falla → success:false', async () => {
      const { facade } = setup({
        tables: {
          'service_catalog:delete': {
            data: null,
            error: { code: '23503', message: 'FK violation' },
          },
          'service_catalog:update': { data: null, error: new Error('update failed') },
        },
      });

      const result = await facade.borrarServicio(1);

      expect(result.success).toBe(false);
    });
  });

  describe('reactivarServicio (fix-023-i)', () => {
    it('UPDATE active=true exitoso → refresca catálogo', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          'service_catalog:update': { data: null, error: null },
        },
      });

      const result = await facade.reactivarServicio(1);

      expect(result).toEqual({ success: true });
      const builder = mockSupabase._builders.get('service_catalog');
      expect(builder.update).toHaveBeenCalledWith({ active: true });
    });

    it('error del UPDATE → success:false, error saneado', async () => {
      const { facade } = setup({
        tables: {
          'service_catalog:update': { data: null, error: { message: 'RLS deny' } },
        },
      });

      const result = await facade.reactivarServicio(1);

      expect(result.success).toBe(false);
      expect(facade.error()).toBe('RLS deny');
    });
  });

  describe('mapeo — service_name sobrevive a un catálogo borrado (fix-024-i)', () => {
    it('usa service_name como snapshot, con fallback al join service_catalog.name', async () => {
      const { facade } = setup({
        tables: {
          special_service_sales: {
            data: [
              venta({ id: 1, service_name: 'Psicotécnico (snapshot)', service_catalog: null }),
              venta({ id: 2, service_name: null, service_catalog: { name: 'Del join' } }),
            ],
            error: null,
          },
        },
      });
      await facade.initialize();
      const [conSnapshot, sinSnapshot] = facade.ventas();
      expect(conSnapshot.servicio).toBe('Psicotécnico (snapshot)');
      expect(sinSnapshot.servicio).toBe('Del join');
    });
  });

  describe('borrarServicioDefinitivo (fix-024-i)', () => {
    it('desvincula las ventas (service_id=null) y borra el catálogo', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          'special_service_sales:update': { data: null, error: null },
          'service_catalog:delete': { data: null, error: null },
        },
      });

      const result = await facade.borrarServicioDefinitivo(1);

      expect(result).toEqual({ success: true });
      const ventasBuilder = mockSupabase._builders.get('special_service_sales');
      expect(ventasBuilder.update).toHaveBeenCalledWith({ service_id: null });
      const catalogoBuilder = mockSupabase._builders.get('service_catalog');
      expect(catalogoBuilder.delete).toHaveBeenCalled();
    });

    it('si falla desvincular las ventas, no intenta el DELETE del catálogo', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          'special_service_sales:update': { data: null, error: { message: 'RLS deny' } },
        },
      });

      const result = await facade.borrarServicioDefinitivo(1);

      expect(result.success).toBe(false);
      expect(facade.error()).toBe('RLS deny');
      expect(mockSupabase.client.from).not.toHaveBeenCalledWith('service_catalog');
    });

    it('si el DELETE del catálogo falla, reporta el error', async () => {
      const { facade } = setup({
        tables: {
          'special_service_sales:update': { data: null, error: null },
          'service_catalog:delete': { data: null, error: { message: 'FK inesperada' } },
        },
      });

      const result = await facade.borrarServicioDefinitivo(1);

      expect(result.success).toBe(false);
      expect(facade.error()).toBe('FK inesperada');
    });
  });
});
