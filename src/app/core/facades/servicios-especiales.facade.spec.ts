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
  const lastOps = new Map<string, string>();
  const from = vi.fn().mockImplementation((table: string) => {
    // Cada from() arranca como lectura; un .select() después de una escritura (update().select())
    // no la convierte en lectura (fix-443-m).
    lastOps.set(table, 'select');
    if (!builders.has(table)) {
      const builder: any = {
        select: vi.fn(function (this: any) {
          return this;
        }),
        insert: vi.fn(function (this: any) {
          lastOps.set(table, 'insert');
          return this;
        }),
        update: vi.fn(function (this: any) {
          lastOps.set(table, 'update');
          return this;
        }),
        delete: vi.fn(function (this: any) {
          lastOps.set(table, 'delete');
          return this;
        }),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: any, reject: any) => {
          const res = tables[`${table}:${lastOps.get(table)}`] ?? tables[table] ?? { data: [], error: null };
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
      // fix-442-m: KPIs calculados en la BD.
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            ventas_mes: 0,
            ventas_totales: 0,
            recaudacion_mes: 0,
            recaudacion_total: 0,
            ventas_cobradas: 0,
            pendiente_cobro: 0,
          },
        ],
        error: null,
      }),
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
        useValue: {
          selectedBranchId: vi.fn(() => opts.selectedBranchId ?? null),
          branches: vi.fn(() => [
            { id: 1, name: 'Autoescuela Chillán', slug: 'a' },
            { id: 2, name: 'Conductores Chillán', slug: 'b' },
          ]),
        },
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

    it('propaga document_number a documentNumber, null si no se capturó (fix-026-i)', async () => {
      const { facade } = setup({
        tables: {
          special_service_sales: {
            data: [
              venta({ id: 1, document_number: 'B-9001' }),
              venta({ id: 2, document_number: null }),
            ],
            error: null,
          },
        },
      });
      await facade.initialize();
      const [conBoleta, sinBoleta] = facade.ventas();
      expect(conBoleta.documentNumber).toBe('B-9001');
      expect(sinBoleta.documentNumber).toBeNull();
    });
  });

  describe('KPIs — calculados en la BD, sin el tope de la lista (fix-442-m)', () => {
    it('los KPIs vienen de servicios_especiales_kpis para la sede activa, no de la lista cargada', async () => {
      const { facade, mockSupabase } = setup({
        selectedBranchId: 2,
        tables: { special_service_sales: { data: [venta({ id: 1 })], error: null } },
      });
      mockSupabase.client.rpc.mockResolvedValue({
        data: [
          {
            ventas_mes: 4,
            ventas_totales: 250,
            recaudacion_mes: 80000,
            recaudacion_total: 5000000,
            ventas_cobradas: 249,
            pendiente_cobro: 20000,
          },
        ],
        error: null,
      });

      await facade.initialize();

      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('servicios_especiales_kpis', {
        p_branch_id: 2,
      });
      expect(facade.kpis()).toEqual({
        ventasMes: 4,
        totalCobrado: 5000000,
        recaudacionMes: 80000,
        pendientesCobro: 20000,
        totalRegistros: 250,
        ventasCobradas: 249,
        ventasSinCobrar: 1,
      });
    });

    it('si la consulta de KPIs falla, la carga falla (no muestra ceros como si fueran reales)', async () => {
      const { facade, mockSupabase } = setup();
      mockSupabase.client.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

      await facade.initialize();

      expect(facade.loadError()).not.toBeNull();
    });

    it('historialTruncado avisa cuando la lista llegó al tope de 1000', async () => {
      const muchas = Array.from({ length: 1000 }, (_, k) => venta({ id: k + 1 }));
      const { facade } = setup({
        tables: { special_service_sales: { data: muchas, error: null } },
      });
      await facade.initialize();
      expect(facade.historialTruncado()).toBe(true);
    });
  });

  describe('cambio de sede — respuestas fuera de orden (fix-441-m)', () => {
    it('una respuesta vieja (sede anterior) no pisa a la más nueva', async () => {
      const { facade, mockSupabase } = setup({ user: { role: 'admin', dbId: 9, branchId: null } });
      const branch = TestBed.inject(BranchFacade) as unknown as {
        selectedBranchId: ReturnType<typeof vi.fn>;
      };

      // special_service_sales queda pendiente hasta que el test la resuelva, en el orden que elija.
      const pendientes: Array<(v: { data: unknown; error: null }) => void> = [];
      const original = mockSupabase.client.from.getMockImplementation()!;
      mockSupabase.client.from.mockImplementation((table: string) => {
        if (table !== 'special_service_sales') return original(table);
        const q: any = {
          select: () => q,
          order: () => q,
          limit: () => q,
          eq: () => q,
          then: (res: any, rej: any) =>
            new Promise((r) => pendientes.push(r as never)).then(res, rej),
        };
        return q;
      });

      branch.selectedBranchId.mockReturnValue(1);
      const primera = facade.initialize();
      branch.selectedBranchId.mockReturnValue(2);
      const segunda = facade.initialize();
      await Promise.resolve();

      pendientes[1]({ data: [venta({ id: 2, branch_id: 2 })], error: null });
      await segunda;
      pendientes[0]({ data: [venta({ id: 1, branch_id: 1 })], error: null });
      await primera;

      expect(facade.ventas().map((v) => v.id)).toEqual([2]);
    });
  });

  describe('registrarVenta — anclaje de sede en INSERT', () => {
    it('con scope "todas las sedes" (null) ancla el INSERT a la sede propia del usuario', async () => {
      const { facade, mockSupabase } = setup({ selectedBranchId: null });
      const ok = await facade.registrarVenta({
        servicioId: 5,
        nombre: 'Juan',
        rut: '1-9',
        fecha: '2026-07-01',
        precio: 25000,
      });
      expect(ok).toBe(true);
      const insertMock = mockSupabase._builders.get('special_service_sales').insert;
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
        nombre: 'x',
        rut: '1-9',
        fecha: '2026-07-01',
        precio: 1,
      });
      expect(ok).toBe(false);
      expect(facade.error()).toBe('RLS deny');
    });
  });

  // fix-194-b: el admin real no tiene sede propia (branchId null). Con "Todas" la venta no tenía
  // de dónde sacar la sede y se guardaba con branch_id null (mismo agujero que DG-082).
  describe('registrarVenta — nunca sin sede (fix-194-b)', () => {
    const adminSinSede = { role: 'admin', dbId: 2, branchId: null, canAccessBothBranches: false };
    const secretaria = { role: 'secretaria', dbId: 7, branchId: 1, canAccessBothBranches: false };
    const datos = {
      servicioId: 5,
      nombre: 'Juan',
      rut: '1-9',
      fecha: '2026-07-01',
      precio: 25000,
    };

    it('admin con "Todas" → requiere elegir sede y no propone ninguna', () => {
      const { facade } = setup({ user: adminSinSede, selectedBranchId: null });
      expect(facade.requiereElegirSede()).toBe(true);
      expect(facade.sedePorDefecto()).toBeNull();
      expect(facade.sedeOptions()).toEqual([
        { label: 'Autoescuela Chillán', value: 1 },
        { label: 'Conductores Chillán', value: 2 },
      ]);
    });

    it('admin con una sede en el topbar → el campo aparece precargado con ella', () => {
      const { facade } = setup({ user: adminSinSede, selectedBranchId: 2 });
      expect(facade.requiereElegirSede()).toBe(true);
      expect(facade.sedePorDefecto()).toBe(2);
    });

    it('secretaria de una sede → sin campo de sede', () => {
      const { facade } = setup({ user: secretaria, selectedBranchId: null });
      expect(facade.requiereElegirSede()).toBe(false);
    });

    it('sin sede (admin con "Todas", sin elegir) → false, motivo en error() y sin INSERT', async () => {
      const { facade, mockSupabase } = setup({ user: adminSinSede, selectedBranchId: null });
      const ok = await facade.registrarVenta(datos);
      expect(ok).toBe(false);
      expect(facade.error()).toBe('Selecciona la sede de la venta.');
      expect(mockSupabase._builders.get('special_service_sales')).toBeUndefined();
    });

    it('con la sede elegida en el formulario → se inserta con esa sede', async () => {
      const { facade, mockSupabase } = setup({ user: adminSinSede, selectedBranchId: null });
      const ok = await facade.registrarVenta({ ...datos, branchId: 2 });
      expect(ok).toBe(true);
      expect(mockSupabase._builders.get('special_service_sales').insert).toHaveBeenCalledWith(
        expect.objectContaining({ branch_id: 2 }),
      );
    });

    it('secretaria sin campo → la venta va a su sede', async () => {
      const { facade, mockSupabase } = setup({ user: secretaria, selectedBranchId: null });
      await facade.registrarVenta(datos);
      expect(mockSupabase._builders.get('special_service_sales').insert).toHaveBeenCalledWith(
        expect.objectContaining({ branch_id: 1 }),
      );
    });
  });

  describe('registrarVenta — cobro inmediato + N° de boleta (fix-025-i)', () => {
    it('siempre inserta paid=true y status="completed", sin importar lo que reciba', async () => {
      const { facade, mockSupabase } = setup({ selectedBranchId: null });
      await facade.registrarVenta({
        servicioId: 5,
        nombre: 'Juan',
        rut: '1-9',
        fecha: '2026-07-01',
        precio: 25000,
      });
      const insertMock = mockSupabase._builders.get('special_service_sales').insert;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ paid: true, status: 'completed' }),
      );
    });

    it('propaga documentNumber al INSERT cuando viene informado', async () => {
      const { facade, mockSupabase } = setup({ selectedBranchId: null });
      await facade.registrarVenta({
        servicioId: 5,
        nombre: 'Juan',
        rut: '1-9',
        fecha: '2026-07-01',
        precio: 25000,
        documentNumber: 'B-4582',
      });
      const insertMock = mockSupabase._builders.get('special_service_sales').insert;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ document_number: 'B-4582' }),
      );
    });

    it('fix-047-i: propaga el medio de pago elegido al INSERT', async () => {
      const { facade, mockSupabase } = setup({ selectedBranchId: null });
      await facade.registrarVenta({
        servicioId: 5,
        nombre: 'Juan',
        rut: '1-9',
        fecha: '2026-07-01',
        precio: 25000,
        paymentMethod: 'transferencia',
      });
      const insertMock = mockSupabase._builders.get('special_service_sales').insert;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ payment_method: 'transferencia' }),
      );
    });

    it('fix-047-i: sin medio de pago informado → inserta efectivo', async () => {
      const { facade, mockSupabase } = setup({ selectedBranchId: null });
      await facade.registrarVenta({
        servicioId: 5,
        nombre: 'Juan',
        rut: '1-9',
        fecha: '2026-07-01',
        precio: 25000,
      });
      const insertMock = mockSupabase._builders.get('special_service_sales').insert;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ payment_method: 'efectivo' }),
      );
    });

    it('documentNumber ausente → inserta document_number=null', async () => {
      const { facade, mockSupabase } = setup({ selectedBranchId: null });
      await facade.registrarVenta({
        servicioId: 5,
        nombre: 'Juan',
        rut: '1-9',
        fecha: '2026-07-01',
        precio: 25000,
      });
      const insertMock = mockSupabase._builders.get('special_service_sales').insert;
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ document_number: null }));
    });
  });

  describe('registrarVenta — venta a un alumno por su RUT (fix-438-m)', () => {
    const alumnoRow = {
      id: 55,
      first_names: 'Ana',
      paternal_last_name: 'Rojas',
      students: [{ id: 9 }],
    };

    it('buscarAlumnoPorRut busca las dos variantes del RUT (con y sin puntos)', async () => {
      const { facade, mockSupabase } = setup({
        tables: { users: { data: alumnoRow, error: null } },
      });

      const alumno = await facade.buscarAlumnoPorRut('12.345.678-5');

      expect(alumno).toEqual({ studentId: 9, userId: 55, nombre: 'Ana Rojas' });
      expect(mockSupabase._builders.get('users').or).toHaveBeenCalledWith(
        'rut.eq.12.345.678-5,rut.eq.12345678-5',
      );
    });

    it('un usuario sin ficha de alumno no se vincula', async () => {
      const { facade } = setup({
        tables: { users: { data: { ...alumnoRow, students: [] }, error: null } },
      });
      expect(await facade.buscarAlumnoPorRut('12.345.678-5')).toBeNull();
    });

    it('RUT incompleto → no consulta', async () => {
      const { facade, mockSupabase } = setup();
      expect(await facade.buscarAlumnoPorRut('1')).toBeNull();
      expect(mockSupabase.client.from).not.toHaveBeenCalledWith('users');
    });

    it('si el RUT es de un alumno: inserta student_id + is_student y le notifica', async () => {
      const { facade, mockSupabase, notificationsSpy } = setup({
        selectedBranchId: null,
        tables: { users: { data: alumnoRow, error: null } },
      });

      const ok = await facade.registrarVenta({
        servicioId: 5,
        nombre: 'Ana Rojas',
        rut: '12.345.678-5',
        fecha: '2026-10-15',
        precio: 20000,
      });

      expect(ok).toBe(true);
      expect(mockSupabase._builders.get('special_service_sales').insert).toHaveBeenCalledWith(
        expect.objectContaining({ student_id: 9, is_student: true }),
      );
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [55],
        expect.objectContaining({ subject: 'Pago registrado' }),
      );
    });

    it('cliente externo: student_id null, is_student false, sin notificación', async () => {
      const { facade, mockSupabase, notificationsSpy } = setup({
        selectedBranchId: null,
        tables: { users: { data: null, error: null } },
      });

      await facade.registrarVenta({
        servicioId: 5,
        nombre: 'Juan',
        rut: '11.111.111-1',
        fecha: '2026-10-15',
        precio: 20000,
      });

      expect(mockSupabase._builders.get('special_service_sales').insert).toHaveBeenCalledWith(
        expect.objectContaining({ student_id: null, is_student: false }),
      );
      expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
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

  describe('anularVenta (fix-443-m)', () => {
    const fila = (over: Record<string, unknown> = {}) =>
      venta({ id: 7, sale_date: '2026-08-10', paid: true, status: 'completed', ...over });

    it('el admin anula con motivo: UPDATE a anulado (nunca DELETE) y refresca', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          special_service_sales: { data: [fila()], error: null },
          'special_service_sales:update': { data: [{ id: 7 }], error: null },
          cash_closings: { data: [], error: null },
        },
      });
      await facade.initialize();

      const result = await facade.anularVenta(7, '  Cliente desistió  ');

      expect(result).toEqual({ success: true });
      const builder = mockSupabase._builders.get('special_service_sales');
      expect(builder.update).toHaveBeenCalledWith({
        status: 'anulado',
        void_reason: 'Cliente desistió',
      });
      expect(builder.delete).not.toHaveBeenCalled();
    });

    it('sin motivo no escribe', async () => {
      const { facade, mockSupabase } = setup({
        tables: { special_service_sales: { data: [fila()], error: null } },
      });
      await facade.initialize();

      const result = await facade.anularVenta(7, '   ');

      expect(result.success).toBe(false);
      expect(facade.error()).toBe('Indica el motivo de la anulación.');
      expect(mockSupabase._builders.get('special_service_sales').update).not.toHaveBeenCalled();
    });

    it('caja del día cerrada → aviso con la fecha en DD-MM-AAAA, sin UPDATE', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          special_service_sales: { data: [fila({ sale_date: '2026-08-01' })], error: null },
          cash_closings: { data: [{ id: 99 }], error: null },
        },
      });
      await facade.initialize();

      const result = await facade.anularVenta(7, 'Error de digitación');

      expect(result.success).toBe(false);
      expect(result.blockedReason).toBe('No se puede anular: la caja del 01-08-2026 ya está cerrada.');
      expect(mockSupabase._builders.get('special_service_sales').update).not.toHaveBeenCalled();
    });

    it('la BD la rechaza (P0001) → su mensaje como blockedReason', async () => {
      const mensaje = 'Solo un administrador puede anular una venta.';
      const { facade } = setup({
        tables: {
          special_service_sales: { data: [fila()], error: null },
          'special_service_sales:update': { data: null, error: { code: 'P0001', message: mensaje } },
          cash_closings: { data: [], error: null },
        },
      });
      await facade.initialize();

      expect(await facade.anularVenta(7, 'x')).toEqual({ success: false, blockedReason: mensaje });
    });

    it('0 filas (la RLS no la dejó tocar) no es éxito', async () => {
      const { facade } = setup({
        tables: {
          special_service_sales: { data: [fila()], error: null },
          'special_service_sales:update': { data: [], error: null },
          cash_closings: { data: [], error: null },
        },
      });
      await facade.initialize();

      expect((await facade.anularVenta(7, 'x')).success).toBe(false);
    });

    it('una venta anulada se mapea con su anulación', async () => {
      const { facade } = setup({
        tables: {
          special_service_sales: {
            data: [
              fila({
                status: 'anulado',
                paid: false,
                void_reason: 'Cliente desistió',
                voided_at: '2026-10-16T13:00:00.000Z',
                anulado_por: { first_names: 'Ana', paternal_last_name: 'Rojas' },
              }),
            ],
            error: null,
          },
        },
      });
      await facade.initialize();

      expect(facade.ventas()[0].anulacion).toEqual(
        expect.objectContaining({ motivo: 'Cliente desistió', por: 'Ana Rojas' }),
      );
    });

    it('puedeAnular: solo el admin', () => {
      expect(setup().facade.puedeAnular()).toBe(true);
      TestBed.resetTestingModule();
      expect(setup({ user: { role: 'secretary', branchId: 1 } }).facade.puedeAnular()).toBe(false);
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

  describe('editarServicio (fix-240-m)', () => {
    it('UPDATE exitoso → refresca catálogo con nombre/precio/estado nuevos', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          'service_catalog:update': { data: null, error: null },
        },
      });

      const result = await facade.editarServicio(1, {
        nombre: 'Psicotécnico Renovado',
        descripcion: 'Examen para licencia',
        precio: 30000,
        activo: false,
      });

      expect(result).toBe(true);
      const builder = mockSupabase._builders.get('service_catalog');
      expect(builder.update).toHaveBeenCalledWith({
        name: 'Psicotécnico Renovado',
        description: 'Examen para licencia',
        base_price: 30000,
        active: false,
      });
    });

    it('error del UPDATE → false, error saneado', async () => {
      const { facade } = setup({
        tables: {
          'service_catalog:update': { data: null, error: { message: 'RLS deny' } },
        },
      });

      const result = await facade.editarServicio(1, {
        nombre: 'X',
        descripcion: 'Y',
        precio: 1000,
        activo: true,
      });

      expect(result).toBe(false);
      expect(facade.error()).toBe('RLS deny');
    });
  });

  describe('catálogo: nombre único y descripción (fix-436-m)', () => {
    const catalogo = [
      { id: 1, name: 'Psicotécnico', description: '', base_price: 20000, active: true },
      { id: 2, name: 'Uso de Simulador', description: '', base_price: 5000, active: false },
    ];

    it('agregar con el nombre de un servicio inactivo → no inserta y sugiere reactivarlo', async () => {
      const { facade, mockSupabase } = setup({
        tables: { service_catalog: { data: catalogo, error: null } },
      });
      await facade.initialize();

      const ok = await facade.agregarServicio({
        nombre: '  uso de SIMULADOR ',
        descripcion: 'x',
        precio: 1000,
      });

      expect(ok).toBe(false);
      expect(facade.error()).toContain('Reactívalo');
      expect(mockSupabase._builders.get('service_catalog').insert).not.toHaveBeenCalled();
    });

    it('agregar recorta los espacios de nombre y descripción', async () => {
      const { facade, mockSupabase } = setup({
        tables: { service_catalog: { data: catalogo, error: null } },
      });
      await facade.initialize();

      await facade.agregarServicio({
        nombre: ' Informe ',
        descripcion: ' Para el SII ',
        precio: 1000,
      });

      expect(mockSupabase._builders.get('service_catalog').insert).toHaveBeenCalledWith({
        name: 'Informe',
        description: 'Para el SII',
        base_price: 1000,
        active: true,
      });
    });

    it('la BD rechaza el nombre repetido (23505) → mensaje legible', async () => {
      const { facade } = setup({
        tables: {
          service_catalog: { data: [], error: null },
          'service_catalog:insert': {
            data: null,
            error: { code: '23505', message: 'duplicate key' },
          },
        },
      });
      await facade.initialize();

      const ok = await facade.agregarServicio({
        nombre: 'Informe',
        descripcion: 'x',
        precio: 1000,
      });

      expect(ok).toBe(false);
      expect(facade.error()).toBe('Ya existe un servicio con ese nombre.');
    });

    it('renombrar con el nombre de otro → no actualiza; el propio nombre sí se puede conservar', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          service_catalog: { data: catalogo, error: null },
          'service_catalog:update': { data: null, error: null },
        },
      });
      await facade.initialize();

      const repetido = await facade.editarServicio(2, {
        nombre: 'psicotécnico',
        descripcion: '',
        precio: 5000,
        activo: false,
      });
      expect(repetido).toBe(false);
      expect(mockSupabase._builders.get('service_catalog').update).not.toHaveBeenCalled();

      const mismo = await facade.editarServicio(1, {
        nombre: 'Psicotécnico',
        descripcion: 'nueva',
        precio: 20000,
        activo: true,
      });
      expect(mismo).toBe(true);
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

  // ── fix-435-m: los errores se pueden mostrar ──
  describe('errores visibles (fix-435-m)', () => {
    it('si la carga inicial falla, expone loadError y no deja el catálogo como "vacío"', async () => {
      const { facade } = setup({
        tables: { service_catalog: { data: null, error: new Error('sin red') } },
      });

      await facade.initialize();

      expect(facade.loadError()).toBe('No se pudieron cargar los servicios especiales.');
      expect(facade.isLoading()).toBe(false);
    });

    it('reintentar() vuelve a cargar y limpia loadError si ahora responde', async () => {
      const tables: Record<string, { data: unknown; error: unknown }> = {
        service_catalog: { data: null, error: new Error('sin red') },
      };
      const { facade } = setup({ tables });
      await facade.initialize();
      expect(facade.loadError()).not.toBeNull();

      tables['service_catalog'] = { data: [], error: null };
      await facade.reintentar();

      expect(facade.loadError()).toBeNull();
    });

    it('una carga exitosa deja loadError en null', async () => {
      const { facade } = setup();
      await facade.initialize();
      expect(facade.loadError()).toBeNull();
    });

    it('exportarHistorial devuelve false si la función falla', async () => {
      const { facade, mockSupabase } = setup();
      mockSupabase.client.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: null, error: new Error('500') });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(facade.exportarHistorial('excel', [1])).resolves.toBe(false);
      expect(facade.error()).toBe('No se pudo exportar el historial.');
    });

    it('exportarHistorial devuelve true si descarga', async () => {
      const { facade, mockSupabase } = setup();
      mockSupabase.client.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: { headers: [], rows: [] }, error: null });

      await expect(facade.exportarHistorial('excel', [1])).resolves.toBe(true);
    });
  });

  // ── fix-440-m: el export es lo que muestra la pantalla (reemplaza a fix-147-b) ──
  describe('exportarHistorial — exporta lo que muestra la pantalla (fix-440-m)', () => {
    it('manda a la función los ids visibles, el formato y la sede', async () => {
      const { facade, mockSupabase } = setup({ selectedBranchId: 3 });
      mockSupabase.client.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: { headers: [], rows: [] }, error: null });

      await facade.exportarHistorial('excel', [7, 8]);

      expect(mockSupabase.client.functions.invoke).toHaveBeenCalledWith('export-special-services', {
        body: { format: 'excel', branch_id: 3, sale_ids: [7, 8] },
      });
    });

    it('sin ventas visibles no llama a la función y avisa', async () => {
      const { facade, mockSupabase } = setup();

      await expect(facade.exportarHistorial('pdf', [])).resolves.toBe(false);

      expect(mockSupabase.client.functions.invoke).not.toHaveBeenCalled();
      expect(facade.error()).toBe('No hay ventas para exportar.');
    });
  });
});
