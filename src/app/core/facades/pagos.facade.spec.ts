import { TestBed } from '@angular/core/testing';
import { PagosFacade, mapEstado } from './pagos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AuthFacade } from './auth.facade';
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
