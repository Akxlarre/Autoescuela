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
            neq: vi.fn().mockResolvedValue({ data: [], error: null }),
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
          gt: () => b,
          gte: () => b,
          lte: () => b,
          neq: () => b,
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
    expect(facade.ingresosHoy()).toBe(0);
    expect(facade.isLoading()).toBe(false);
    expect(facade.totalDeudores()).toBe(0);
  });

  it('seleccionarEnrollment should update signal', () => {
    facade.seleccionarEnrollment(123);
    expect(facade.enrollmentSeleccionado()).toBe(123);
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
      const genericMock = supabaseSpy.client.from();
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
      const neqSpy = vi.fn().mockReturnValue({ order: orderSpy });
      const gtSpy = vi.fn().mockReturnValue({ neq: neqSpy });
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
  });

  // ── fix-248-m: filtros de fecha/curso/sede en la tabla de deudores ──
  describe('fetchAlumnosConDeuda — mapeo de curso/fecha/sede (fix-248-m)', () => {
    it('mapea cursoTipo, cursoNombre, fechaMatricula, sedeId y sedeNombre desde el join', async () => {
      const genericMock = supabaseSpy.client.from();
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
      const neqEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      const neqSpy = vi.fn().mockReturnValue({ order: orderSpy, eq: neqEqSpy });
      const gtSpy = vi.fn().mockReturnValue({ neq: neqSpy });
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
});
