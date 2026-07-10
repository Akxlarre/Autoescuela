import { TestBed } from '@angular/core/testing';
import { PagosFacade } from './pagos.facade';
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

  // ── spec 0025 (T2.2): notificación al alumno tras registrar un abono ──
  describe('registrarNuevoPago — notificación al alumno (spec 0025, AC1, AC-E1)', () => {
    let notificationsSpy: any;

    const montosActuales = { total_paid: 100000, pending_balance: 200000 };
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
      await facade.registrarNuevoPago(10, payload, montosActuales);
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [77],
        expect.objectContaining({ referenceType: 'payment' }),
      );
    });

    it('monto $0 no dispara notificación (AC-E1)', async () => {
      await facade.registrarNuevoPago(10, { ...payload, total_amount: 0 }, montosActuales);
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
    });

    it('un fallo en notifyUsers no revierte el abono', async () => {
      notificationsSpy.notifyUsers.mockRejectedValue(new Error('network error'));

      await expect(facade.registrarNuevoPago(10, payload, montosActuales)).resolves.toBeUndefined();
      await flushMicrotasks();
    });
  });
});
