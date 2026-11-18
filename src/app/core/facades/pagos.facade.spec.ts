import { TestBed } from '@angular/core/testing';
import { PagosFacade, mapEstado } from './pagos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AuthFacade } from './auth.facade';
import { BranchFacade } from './branch.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('PagosFacade', () => {
  let facade: PagosFacade;
  let supabaseSpy: any;
  let toastSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            resolveTo: vi.fn().mockResolvedValue({ data: [], error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          gt: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        PagosFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue(null) } },
        // Evita depender del signal real (leído sync desde localStorage) — sin esto,
        // el branchId efectivo queda a merced de estado ambiental entre tests (fix-248-m).
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn().mockReturnValue(null) } },
        {
          provide: NotificationsFacade,
          useValue: { notifyUsers: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    });

    facade = TestBed.inject(PagosFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  // fix-195-b (D06 de ASG-i-037): admin A → B → A rápido con la respuesta de B demorada. Antes
  // la respuesta vieja llegaba al final y dejaba la pantalla en "A" con los deudores de B.
  describe('respuestas fuera de orden al cambiar de sede (fix-195-b, spec 0005-m)', () => {
    let selected: number;
    let liberarB: () => void;
    let racer: PagosFacade;

    const deudor = (id: number, branchId: number) => ({
      id,
      base_price: 100,
      discount: 0,
      total_paid: 0,
      pending_balance: 100,
      created_at: '2026-01-01',
      branch_id: branchId,
      students: { users: { first_names: 'N', paternal_last_name: 'P', rut: '1-9' } },
      courses: { type: 'class_b', name: 'B' },
      branches: { name: `Sede ${branchId}` },
    });
    const DEUDORES: Record<number, unknown[]> = {
      1: [deudor(1, 1), deudor(2, 1)],
      2: [deudor(10, 2)],
    };

    beforeEach(() => {
      const bRetenida = new Promise<void>((r) => (liberarB = r));
      const builder = (table: string) => {
        const state: { branch?: number; cols?: string } = {};
        const b: any = {
          select: (cols: string) => ((state.cols = cols), b),
          eq: (col: string, val: unknown) => {
            if (col.endsWith('branch_id')) state.branch = val as number;
            return b;
          },
          in: () => b,
          gt: () => b,
          gte: () => b,
          lte: () => b,
          neq: () => b,
          not: () => b,
          order: () => b,
          limit: () => b,
          then: async (resolve: (v: unknown) => void) => {
            if (state.branch === 2) await bRetenida;
            const esDeudores = table === 'enrollments' && state.cols?.includes('students');
            resolve({ data: esDeudores ? DEUDORES[state.branch!] : [], count: 0, error: null });
          },
        };
        return b;
      };
      const channel: any = { on: () => channel, subscribe: () => channel };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          PagosFacade,
          {
            provide: SupabaseService,
            useValue: { client: { from: builder, channel: () => channel } },
          },
          { provide: ToastService, useValue: toastSpy },
          { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
          { provide: BranchFacade, useValue: { selectedBranchId: () => selected } },
          { provide: NotificationsFacade, useValue: { notifyUsers: vi.fn() } },
        ],
      });
      racer = TestBed.inject(PagosFacade);
    });

    it('primera visita A → B → A: queda con los deudores de A aunque B responda al final', async () => {
      selected = 2;
      const cargaB = racer.initialize();
      selected = 1;
      await racer.initialize();
      liberarB();
      await cargaB;

      expect(racer.alumnosConDeuda().map((d) => d.sedeId)).toEqual([1, 1]);
      expect(racer.isLoading()).toBe(false);
    });

    it('A ya cargada → B (lenta) → A (refresco SWR): deudores de A y sin skeleton colgado', async () => {
      selected = 1;
      await racer.initialize();
      selected = 2;
      const cargaB = racer.initialize();
      expect(racer.isLoading()).toBe(true);
      selected = 1;
      await racer.initialize();
      await flushMicrotasks();
      liberarB();
      await cargaB;

      expect(racer.alumnosConDeuda().map((d) => d.sedeId)).toEqual([1, 1]);
      expect(racer.isLoading()).toBe(false);
    });
  });

  it('should have initial empty state', () => {
    // spec 0060-b: sin carga no hay KPI, ni siquiera $0.
    expect(facade.ingresosHoy()).toBeNull();
    expect(facade.isLoading()).toBe(false);
    expect(facade.totalDeudores()).toBe(0);
  });

  it('seleccionarEnrollment should update signal', () => {
    facade.seleccionarEnrollment(123);
    expect(facade.enrollmentSeleccionado()).toBe(123);
  });

  // fix-049-i (B3-1 de fix-048-i): con el Estado de Cuenta de X abierto, "Ver detalle" de Y no
  // re-crea el drawer. Antes la pantalla seguía con X y "Registrar Pago" guardaba en Y.
  describe('seleccionarEnrollment (fix-049-i)', () => {
    let racer: PagosFacade;
    let retenidos: Record<number, Promise<void>>;
    let liberar: Record<number, () => void>;

    const resumenDe = (id: number) => ({
      id,
      base_price: 180000,
      discount: 0,
      total_paid: 0,
      pending_balance: 180000,
      payment_status: 'pending',
      students: { users: { first_names: `Alumno${id}`, paternal_last_name: 'P', rut: `${id}-9` } },
      courses: { name: 'Clase B' },
    });

    beforeEach(() => {
      retenidos = {};
      liberar = {};
      for (const id of [1, 2]) retenidos[id] = new Promise<void>((r) => (liberar[id] = r));
      const builder = (table: string) => {
        const state: { id?: number } = {};
        const b: any = {
          select: () => b,
          eq: (col: string, val: unknown) => {
            if (col === 'id' || col === 'enrollment_id') state.id = val as number;
            return b;
          },
          order: () => b,
          maybeSingle: async () => {
            await retenidos[state.id!];
            return { data: resumenDe(state.id!), error: null };
          },
          then: async (resolve: (v: unknown) => void) => {
            await retenidos[state.id!];
            resolve({
              data:
                table === 'payments'
                  ? [{ id: state.id! * 100, total_amount: 1000, status: 'paid' }]
                  : [],
              error: null,
            });
          },
        };
        return b;
      };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          PagosFacade,
          { provide: SupabaseService, useValue: { client: { from: builder } } },
          { provide: ToastService, useValue: toastSpy },
          { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
          { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
          { provide: NotificationsFacade, useValue: { notifyUsers: vi.fn() } },
        ],
      });
      racer = TestBed.inject(PagosFacade);
    });

    it('carga el Estado de Cuenta del alumno elegido (AC-F1)', async () => {
      racer.seleccionarEnrollment(1);
      liberar[1]();
      await flushMicrotasks();
      expect(racer.estadoCuentaResumen()?.enrollmentId).toBe(1);

      racer.seleccionarEnrollment(2);
      // Al cambiar, los datos de X desaparecen de inmediato: nunca se muestran bajo la selección de Y.
      expect(racer.estadoCuentaResumen()).toBeNull();
      expect(racer.estadoCuentaHistorial()).toEqual([]);
      liberar[2]();
      await flushMicrotasks();
      expect(racer.enrollmentSeleccionado()).toBe(2);
      expect(racer.estadoCuentaResumen()?.enrollmentId).toBe(2);
      expect(racer.estadoCuentaHistorial().map((p) => p.id)).toEqual([200]);
    });

    it('una respuesta lenta del alumno anterior no pisa la del nuevo (AC-F2)', async () => {
      racer.seleccionarEnrollment(1);
      racer.seleccionarEnrollment(2);
      liberar[2]();
      await flushMicrotasks();
      liberar[1]();
      await flushMicrotasks();

      expect(racer.estadoCuentaResumen()?.enrollmentId).toBe(2);
      expect(racer.estadoCuentaHistorial().map((p) => p.id)).toEqual([200]);
      expect(racer.isLoadingDetalle()).toBe(false);
    });
  });

  // ── fix-134-m: mapEstado no debe filtrar valores crudos de payments.status ──
  describe('mapEstado (fix-134-m)', () => {
    it('traduce "pending" a "pendiente"', () => {
      expect(mapEstado('pending')).toBe('pendiente');
    });

    it('traduce "paid" a "completado"', () => {
      expect(mapEstado('paid')).toBe('completado');
    });

    it('traduce "partial" a "pendiente"', () => {
      expect(mapEstado('partial')).toBe('pendiente');
    });

    it('cae a "pendiente" ante un status no reconocido, nunca devuelve el crudo', () => {
      expect(mapEstado('confirmed')).toBe('pendiente');
    });

    it('devuelve null si no hay status', () => {
      expect(mapEstado(null)).toBeNull();
    });
  });

  // ── fix-135-m: "Pagos recientes" no debe listar matrículas con pago pendiente ──
  describe('fetchPagosRecientes (fix-135-m)', () => {
    it('excluye status=pending de la query a payments', async () => {
      // payments: las 5 lecturas de esa tabla resuelven vacías. Desde spec 0060-b una lectura rota
      // (p. ej. un mock sin ) hace fallar la carga entera, así que el mock debe ser completo.
      const genericMock: any = {};
      for (const m of ['select', 'in', 'eq', 'gte', 'lte', 'neq', 'order', 'limit']) {
        genericMock[m] = () => genericMock;
      }
      genericMock.then = (resolve: (v: unknown) => void) =>
        resolve({ data: [], count: 0, error: null });
      const limitSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      const orderSpy = vi.fn().mockReturnValue({ limit: limitSpy });
      const neqSpy = vi.fn().mockReturnValue({ order: orderSpy });
      const paymentsSelectSpy = vi.fn().mockReturnValue({ neq: neqSpy });

      supabaseSpy.client.from = vi.fn((table: string) =>
        table === 'payments' ? { select: paymentsSelectSpy } : genericMock,
      );
      supabaseSpy.client.channel = vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      });

      await facade.initialize();
      await flushMicrotasks();

      expect(neqSpy).toHaveBeenCalledWith('status', 'pending');
    });
  });

  // ── fix-147-b: la lista de deudores no puede crecer sin techo ──
  describe('fetchAlumnosConDeuda (fix-147-b)', () => {
    it('aplica .limit(200) sobre la query de deudores', async () => {
      const genericMock = supabaseSpy.client.from();
      const limitSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      const orderSpy = vi.fn().mockReturnValue({ limit: limitSpy });
      const notSpy = vi.fn().mockReturnValue({ order: orderSpy });
      const gtSpy = vi.fn().mockReturnValue({ not: notSpy });
      const enrollmentsSelectSpy = vi.fn().mockReturnValue({ gt: gtSpy });

      supabaseSpy.client.from = vi.fn((table: string) =>
        table === 'enrollments' ? { select: enrollmentsSelectSpy } : genericMock,
      );
      supabaseSpy.client.channel = vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      });

      await facade.initialize();
      await flushMicrotasks();

      // Ordenada por saldo desc antes del recorte: si alguna vez hay que truncar,
      // los que quedan fuera son los deudores más chicos, no unos al azar.
      expect(orderSpy).toHaveBeenCalledWith('pending_balance', { ascending: false });
      expect(limitSpy).toHaveBeenCalledWith(200);
    });

    // fix-060-i: la limpieza nocturna deja `cancelled` un borrador vencido con consentimientos,
    // y una matrícula online vencida sin pago también queda `cancelled`. Ninguna es deuda.
    it('excluye borradores y matrículas canceladas del total pendiente y de la lista de deudores', async () => {
      const genericMock = supabaseSpy.client.from();
      // currentUser() = null → el scope de sede cae a -1 y ambas queries terminan en `.eq()`.
      const eqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      const limitSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      const orderSpy = vi.fn().mockReturnValue({ limit: limitSpy });
      const notSpy = vi.fn().mockReturnValue({ order: orderSpy, eq: eqSpy });
      const gtSpy = vi.fn().mockReturnValue({ not: notSpy });
      const enrollmentsSelectSpy = vi.fn().mockReturnValue({ gt: gtSpy });

      supabaseSpy.client.from = vi.fn((table: string) =>
        table === 'enrollments' ? { select: enrollmentsSelectSpy } : genericMock,
      );
      supabaseSpy.client.channel = vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      });

      await facade.initialize();
      await flushMicrotasks();

      // Una vez por fetchPagosPendientes y otra por fetchAlumnosConDeuda.
      expect(notSpy).toHaveBeenCalledTimes(2);
      for (const call of notSpy.mock.calls) {
        expect(call).toEqual(['status', 'in', '("draft","cancelled")']);
      }
    });
  });

  // ── fix-248-m: filtros de fecha/curso/sede en la tabla de deudores ──
  describe('fetchAlumnosConDeuda — mapeo de curso/fecha/sede (fix-248-m)', () => {
    it('mapea cursoTipo, cursoNombre, fechaMatricula, sedeId y sedeNombre desde el join', async () => {
      // payments: sus 5 lecturas resuelven vacías. Desde spec 0060-b una lectura rota (un mock
      // sin .in(), por ejemplo) hace fallar la carga entera, así que el mock debe estar completo.
      const genericMock: any = {};
      for (const m of ['select', 'in', 'eq', 'gte', 'lte', 'neq', 'order', 'limit']) {
        genericMock[m] = () => genericMock;
      }
      genericMock.then = (resolve: (v: unknown) => void) =>
        resolve({ data: [], count: 0, error: null });
      const row = {
        id: 1,
        base_price: 500000,
        discount: 0,
        total_paid: 100000,
        pending_balance: 400000,
        created_at: '2026-03-10T12:00:00Z',
        branch_id: 2,
        students: { users: { first_names: 'Ana', paternal_last_name: 'Soto', rut: '1-9' } },
        courses: { type: 'class_b', name: 'Clase B' },
        branches: { name: 'Conductores Chillán' },
      };
      // AuthFacade mockea currentUser() = null → resolveBranchScope cae a
      // NO_BRANCH_SCOPE (-1), no a null. Por eso todo método branch-scoped SIEMPRE
      // llama a `.eq('branch_id', ...)` en este describe — ambos caminos de la tabla
      // `enrollments` (fetchAlumnosConDeuda y fetchPagosPendientes) necesitan resolver
      // ese `.eq()` final para no cortar el Promise.all de fetchAll().
      const limitEqSpy = vi.fn().mockResolvedValue({ data: [row], error: null });
      const limitSpy = vi.fn().mockReturnValue({ eq: limitEqSpy });
      const orderSpy = vi.fn().mockReturnValue({ limit: limitSpy });
      const notEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      const notSpy = vi.fn().mockReturnValue({ order: orderSpy, eq: notEqSpy });
      const gtSpy = vi.fn().mockReturnValue({ not: notSpy });
      const enrollmentsSelectSpy = vi.fn().mockReturnValue({ gt: gtSpy });

      supabaseSpy.client.from = vi.fn((table: string) =>
        table === 'enrollments' ? { select: enrollmentsSelectSpy } : genericMock,
      );
      supabaseSpy.client.channel = vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      });

      await facade.initialize();
      await flushMicrotasks();

      const deudores = facade.alumnosConDeuda();
      expect(deudores).toHaveLength(1);
      expect(deudores[0].cursoTipo).toBe('class_b');
      expect(deudores[0].cursoNombre).toBe('Clase B');
      expect(deudores[0].fechaMatricula).toBe('2026-03-10T12:00:00Z');
      expect(deudores[0].sedeId).toBe(2);
      expect(deudores[0].sedeNombre).toBe('Conductores Chillán');
    });
  });

  // ── spec 0025 (T2.2): notificación al alumno tras registrar un abono ──
  describe('registrarNuevoPago — notificación al alumno (spec 0025, AC1, AC-E1)', () => {
    let notificationsSpy: any;

    const payload = {
      type: 'enrollment',
      total_amount: 50000,
      cash_amount: 50000,
      transfer_amount: 0,
      card_amount: 0,
      voucher_amount: 0,
      document_number: null,
      payment_date: '2026-04-01',
    };

    beforeEach(() => {
      notificationsSpy = TestBed.inject(NotificationsFacade) as any;

      // `cargarEstadoCuenta()` corre fire-and-forget tras registrarNuevoPago() —
      // el eq() de 'enrollments'/'payments' debe soportar single/maybeSingle/order
      // porque distintos métodos del facade encadenan distintos terminadores.
      const eqChain = {
        single: vi.fn().mockResolvedValue({ data: { students: { user_id: 77 } }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      const enrollmentsChain = {
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(eqChain) }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
      const paymentsChain = {
        insert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(eqChain) }),
      };

      supabaseSpy.client.from = vi.fn((table: string) => {
        if (table === 'payments') return paymentsChain;
        if (table === 'enrollments') return enrollmentsChain;
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
      });
    });

    it('notifica al alumno resolviendo enrollments → students.user_id', async () => {
      await facade.registrarNuevoPago(10, payload);
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [77],
        expect.objectContaining({ referenceType: 'payment' }),
      );
    });

    // fix-052-i: el monto salía como "$50000".
    it('fix-052-i: el aviso muestra el monto con separador de miles', async () => {
      await facade.registrarNuevoPago(10, payload);
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [77],
        expect.objectContaining({ message: 'Se registró un pago de $50.000 en tu matrícula.' }),
      );
    });

    it('monto $0 no dispara notificación (AC-E1)', async () => {
      await facade.registrarNuevoPago(10, { ...payload, total_amount: 0 });
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
    });

    it('un fallo en notifyUsers no revierte el abono', async () => {
      notificationsSpy.notifyUsers.mockRejectedValue(new Error('network error'));

      await expect(facade.registrarNuevoPago(10, payload)).resolves.toBeUndefined();
      await flushMicrotasks();
    });
  });

  // ── fix-114-m (ASG-b-063): lost-update en pending_balance/total_paid ──
  describe('registrarNuevoPago — fix-114-m: sin lost-update en pending_balance/total_paid', () => {
    const payload = {
      type: 'enrollment',
      total_amount: 50000,
      cash_amount: 50000,
      transfer_amount: 0,
      card_amount: 0,
      voucher_amount: 0,
      document_number: null,
      payment_date: '2026-04-01',
    };

    it('nunca escribe pending_balance/total_paid desde el cliente — es responsabilidad del trigger de BD', async () => {
      const enrollmentsUpdate = vi
        .fn()
        .mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const eqChain = {
        single: vi.fn().mockResolvedValue({ data: { students: { user_id: 77 } }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      supabaseSpy.client.from = vi.fn((table: string) => {
        if (table === 'payments') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(eqChain) }),
          };
        }
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(eqChain) }),
            update: enrollmentsUpdate,
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
      });

      await facade.registrarNuevoPago(10, payload);
      await flushMicrotasks();

      expect(enrollmentsUpdate).not.toHaveBeenCalled();
    });

    it('doble submit concurrente contra el mismo enrollment no pierde ningún abono (simula el trigger atómico recalculate_enrollment_balance)', async () => {
      // Simula el trigger `trg_update_balance`: pending_balance/total_paid se derivan
      // SIEMPRE de la suma de los `payments` ya insertados, nunca de un snapshot
      // pasado por parámetro — así ambos abonos concurrentes quedan reflejados.
      const basePrice = 300000;
      const insertedAmounts: number[] = [];
      const enrollmentState = { total_paid: 0, pending_balance: basePrice };

      const paymentsInsert = vi.fn().mockImplementation((row: any) => {
        insertedAmounts.push(row.total_amount);
        enrollmentState.total_paid = insertedAmounts.reduce((a, b) => a + b, 0);
        enrollmentState.pending_balance = basePrice - enrollmentState.total_paid;
        return Promise.resolve({ error: null });
      });
      const eqChain = {
        single: vi.fn().mockResolvedValue({ data: { students: { user_id: 77 } }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      supabaseSpy.client.from = vi.fn((table: string) => {
        if (table === 'payments') {
          return {
            insert: paymentsInsert,
            select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(eqChain) }),
          };
        }
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(eqChain) }),
            update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
      });

      // Dos promesas sin await intermedio contra el mismo enrollment (doble submit / dos pestañas).
      await Promise.all([
        facade.registrarNuevoPago(10, { ...payload, total_amount: 50000 }),
        facade.registrarNuevoPago(10, { ...payload, total_amount: 30000 }),
      ]);
      await flushMicrotasks();

      expect(enrollmentState.total_paid).toBe(80000);
      expect(enrollmentState.pending_balance).toBe(220000);
    });
  });

  // spec 0060-b (T1.1): una lectura que falla se ve como error, nunca como $0 o "sin deudores".
  describe('lecturas fallidas (spec 0060-b)', () => {
    type Consulta =
      | 'ingresosHoy'
      | 'ingresosMes'
      | 'boletas'
      | 'pendientes'
      | 'deudores'
      | 'recientes'
      | 'metodos'
      | 'resumen'
      | 'historial';

    let selected: number | null;
    let fallan: Set<Consulta>;
    let f: PagosFacade;
    let realtimeHandler: (() => void) | null;

    const ERROR = { message: 'network down', code: '' };

    const deudor = (id: number, branchId: number) => ({
      id,
      number: id,
      status: 'active',
      base_price: 100000,
      discount: 0,
      total_paid: 20000,
      pending_balance: 80000,
      created_at: '2026-01-01T12:00:00Z',
      branch_id: branchId,
      students: { users: { first_names: 'N', paternal_last_name: 'P', rut: '1-9' } },
      courses: { type: 'class_b', name: 'B' },
      branches: { name: `Sede ${branchId}` },
    });

    /** Identifica cada una de las lecturas del facade por su tabla, columnas y filtros. */
    const clasificar = (
      table: string,
      cols: string,
      ops: Set<string>,
      head: boolean,
    ): Consulta | null => {
      if (table === 'payments') {
        if (head) return 'boletas';
        if (cols.startsWith('transfer_amount')) return 'metodos';
        if (cols.includes('document_number')) {
          return ops.has('eq:enrollment_id') ? 'historial' : 'recientes';
        }
        if (cols.startsWith('total_amount')) {
          return ops.has('eq:payment_date') ? 'ingresosHoy' : 'ingresosMes';
        }
      }
      if (table === 'enrollments') {
        if (ops.has('maybeSingle')) return 'resumen';
        if (cols.includes('students')) return 'deudores';
        if (cols === 'pending_balance') return 'pendientes';
      }
      return null;
    };

    const datosDe = (c: Consulta, branch: number | null): unknown => {
      const sede = branch ?? 1;
      switch (c) {
        case 'ingresosHoy':
        case 'ingresosMes':
          return [{ total_amount: 1000 * sede }];
        case 'pendientes':
          return [{ pending_balance: 80000 }];
        case 'deudores':
          return [deudor(sede * 10, sede), deudor(sede * 10 + 1, sede)];
        case 'recientes':
          return [
            {
              id: sede,
              payment_date: '2026-11-10',
              type: 'Abono',
              total_amount: 1000,
              transfer_amount: 1000,
              cash_amount: 0,
              card_amount: 0,
              voucher_amount: 0,
              status: 'paid',
              enrollments: { students: { users: { first_names: 'N', paternal_last_name: 'P' } } },
            },
          ];
        case 'metodos':
          return [{ transfer_amount: 1000, cash_amount: 0, card_amount: 0, voucher_amount: 0 }];
        case 'resumen':
          return {
            id: 7,
            base_price: 100000,
            discount: 0,
            total_paid: 20000,
            pending_balance: 80000,
            payment_status: 'partial',
            students: { users: { first_names: 'N', paternal_last_name: 'P', rut: '1-9' } },
            courses: { name: 'B' },
          };
        case 'historial':
          return [{ id: 70, total_amount: 20000, status: 'paid' }];
        default:
          return [];
      }
    };

    beforeEach(() => {
      selected = 1;
      fallan = new Set();
      realtimeHandler = null;
      const builder = (table: string) => {
        const state = {
          cols: '',
          head: false,
          branch: null as number | null,
          ops: new Set<string>(),
        };
        const responder = () => {
          const c = clasificar(table, state.cols, state.ops, state.head);
          if (c && fallan.has(c)) return { data: null, count: null, error: ERROR };
          if (c === 'boletas') return { data: null, count: 3, error: null };
          return { data: c ? datosDe(c, state.branch) : [], count: null, error: null };
        };
        const b: any = {
          select: (cols: string, opts?: { head?: boolean }) => {
            state.cols = cols;
            state.head = !!opts?.head;
            return b;
          },
          eq: (col: string, val: unknown) => {
            state.ops.add(`eq:${col}`);
            if (col.endsWith('branch_id')) state.branch = val as number;
            return b;
          },
          in: () => b,
          gt: () => b,
          gte: () => b,
          lte: () => b,
          neq: () => b,
          not: () => b,
          order: () => b,
          limit: () => b,
          maybeSingle: async () => {
            state.ops.add('maybeSingle');
            return responder();
          },
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(responder()).then(resolve, reject),
        };
        return b;
      };
      const channel: any = {
        on: (_e: string, _f: unknown, handler: () => void) => (
          (realtimeHandler = handler),
          channel
        ),
        subscribe: () => channel,
      };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          PagosFacade,
          {
            provide: SupabaseService,
            useValue: { client: { from: builder, channel: () => channel, removeChannel: vi.fn() } },
          },
          { provide: ToastService, useValue: toastSpy },
          { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
          { provide: BranchFacade, useValue: { selectedBranchId: () => selected } },
          { provide: NotificationsFacade, useValue: { notifyUsers: vi.fn() } },
        ],
      });
      f = TestBed.inject(PagosFacade);
    });

    const kpis = () => [
      f.ingresosHoy(),
      f.ingresosMes(),
      f.boletasMes(),
      f.pagosPendientesTotales(),
    ];

    it('carga sin errores: aplica los 4 KPIs y las 3 listas', async () => {
      await f.initialize();
      expect(kpis()).toEqual([1000, 1000, 3, 80000]);
      expect(f.alumnosConDeuda()).toHaveLength(2);
      expect(f.pagosRecientes()).toHaveLength(1);
      expect(f.metodosPagoMes()).toHaveLength(1);
      expect(f.error()).toBeNull();
      expect(f.refreshFailed()).toBe(false);
    });

    it('caso A — primera carga con error: error propio, KPIs en null (no $0) y listas vacías', async () => {
      fallan.add('deudores');
      await f.initialize();

      expect(f.error()).toBe('No se pudieron cargar los pagos.');
      expect(kpis()).toEqual([null, null, null, null]);
      expect(f.alumnosConDeuda()).toEqual([]);
      expect(f.pagosRecientes()).toEqual([]);
      expect(f.metodosPagoMes()).toEqual([]);
      expect(f.isLoading()).toBe(false);
      expect(f.refreshFailed()).toBe(false);
    });

    it.each<Consulta>([
      'ingresosHoy',
      'ingresosMes',
      'boletas',
      'pendientes',
      'deudores',
      'recientes',
      'metodos',
    ])(
      'una sola consulta con error (%s) hace fallar la carga completa: ningún total parcial',
      async (c) => {
        fallan.add(c);
        await f.initialize();

        expect(f.error()).not.toBeNull();
        expect(kpis()).toEqual([null, null, null, null]);
        expect(f.alumnosConDeuda()).toEqual([]);
        expect(f.pagosRecientes()).toEqual([]);
        expect(f.metodosPagoMes()).toEqual([]);
      },
    );

    it('caso A — cambio de sede con error: no quedan los datos de la sede anterior', async () => {
      await f.initialize();
      expect(f.alumnosConDeuda().map((d) => d.sedeId)).toEqual([1, 1]);

      selected = 2;
      fallan.add('metodos');
      await f.initialize();

      expect(f.error()).not.toBeNull();
      expect(f.alumnosConDeuda()).toEqual([]);
      expect(kpis()).toEqual([null, null, null, null]);
      expect(f.refreshFailed()).toBe(false);
    });

    it('caso B — refresco (re-entrada SWR) con error: conserva lo visible y marca refreshFailed', async () => {
      await f.initialize();
      fallan.add('pendientes');
      await f.initialize(); // misma sede: refresco silencioso
      await flushMicrotasks();

      expect(f.refreshFailed()).toBe(true);
      expect(f.error()).toBeNull();
      expect(kpis()).toEqual([1000, 1000, 3, 80000]);
      expect(f.alumnosConDeuda()).toHaveLength(2);
      expect(f.isLoading()).toBe(false);
    });

    it('caso B — un evento Realtime que no puede refrescar también deja el aviso', async () => {
      await f.initialize();
      fallan.add('recientes');
      realtimeHandler!();
      await flushMicrotasks();

      expect(f.refreshFailed()).toBe(true);
      expect(f.alumnosConDeuda()).toHaveLength(2);
    });

    it('un refresco Realtime fallido sin datos vigentes no convierte el caso A en "sin deudores + aviso"', async () => {
      fallan.add('deudores');
      await f.initialize();
      realtimeHandler!();
      await flushMicrotasks();

      expect(f.error()).not.toBeNull();
      expect(f.refreshFailed()).toBe(false);
    });

    it('reintentar() tras el caso A: carga con skeleton y limpia el error', async () => {
      fallan.add('boletas');
      await f.initialize();
      expect(f.error()).not.toBeNull();

      fallan.clear();
      const loading: boolean[] = [];
      const p = f.reintentar();
      loading.push(f.isLoading());
      expect(f.error()).toBeNull(); // se limpia al empezar
      await p;

      expect(loading).toEqual([true]);
      expect(f.error()).toBeNull();
      expect(kpis()).toEqual([1000, 1000, 3, 80000]);
      expect(f.alumnosConDeuda()).toHaveLength(2);
    });

    it('reintentar() tras el caso B: refresca sin skeleton ni pérdida de datos y quita el aviso', async () => {
      await f.initialize();
      fallan.add('ingresosMes');
      await f.initialize();
      await flushMicrotasks();
      expect(f.refreshFailed()).toBe(true);

      fallan.clear();
      const p = f.reintentar();
      expect(f.isLoading()).toBe(false);
      expect(f.alumnosConDeuda()).toHaveLength(2);
      await p;

      expect(f.refreshFailed()).toBe(false);
      expect(f.error()).toBeNull();
    });

    it('una primera carga fallida no queda como inicializada: la siguiente visita vuelve a cargar con skeleton', async () => {
      fallan.add('ingresosHoy');
      await f.initialize();
      fallan.clear();

      const p = f.initialize();
      expect(f.isLoading()).toBe(true);
      await p;
      expect(f.error()).toBeNull();
      expect(f.ingresosHoy()).toBe(1000);
    });

    describe('Estado de Cuenta', () => {
      it('caso A — si no carga, expone errorDetalle y no muestra resumen ni historial', async () => {
        fallan.add('historial');
        await f.cargarEstadoCuenta(7);

        expect(f.errorDetalle()).toBe('No se pudo cargar el estado de cuenta.');
        expect(f.estadoCuentaResumen()).toBeNull();
        expect(f.estadoCuentaHistorial()).toEqual([]);
        expect(f.isLoadingDetalle()).toBe(false);
      });

      it('caso B — recargar la misma matrícula con error conserva lo visible y marca el aviso', async () => {
        await f.cargarEstadoCuenta(7);
        fallan.add('resumen');
        await f.cargarEstadoCuenta(7);

        expect(f.estadoCuentaResumen()?.saldoPendiente).toBe(80000);
        expect(f.detalleRefreshFailed()).toBe(true);
        expect(f.errorDetalle()).toBeNull();
      });

      it('reintentarEstadoCuenta() con la red de vuelta carga y limpia error y aviso', async () => {
        fallan.add('resumen');
        f.seleccionarEnrollment(7);
        await flushMicrotasks();
        expect(f.errorDetalle()).not.toBeNull();

        fallan.clear();
        await f.reintentarEstadoCuenta();

        expect(f.errorDetalle()).toBeNull();
        expect(f.detalleRefreshFailed()).toBe(false);
        expect(f.estadoCuentaResumen()?.enrollmentId).toBe(7);
      });
    });
  });
});
