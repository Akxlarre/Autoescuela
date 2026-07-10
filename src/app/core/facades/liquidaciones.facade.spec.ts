import { TestBed } from '@angular/core/testing';
import { LiquidacionesFacade } from './liquidaciones.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import type { LiquidacionRow } from '@core/models/ui/liquidaciones.model';

describe('LiquidacionesFacade', () => {
  let facade: LiquidacionesFacade;
  let supabaseSpy: any;
  let authFacadeSpy: any;
  let branchFacadeSpy: any;
  let toastSpy: any;
  let notificationsSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    authFacadeSpy = { currentUser: vi.fn() };
    branchFacadeSpy = { selectedBranchId: vi.fn().mockReturnValue(null) };
    toastSpy = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
    notificationsSpy = { notifyUsers: vi.fn().mockResolvedValue(undefined) };

    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };

    (supabaseSpy as any).client = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            resolveTo: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          resolveTo: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        LiquidacionesFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: authFacadeSpy },
        { provide: BranchFacade, useValue: branchFacadeSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: NotificationsFacade, useValue: notificationsSpy },
      ],
    });

    facade = TestBed.inject(LiquidacionesFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial month and year', () => {
    const now = new Date();
    expect(facade.mesActual()).toBe(now.getMonth() + 1);
    expect(facade.anioActual()).toBe(now.getFullYear());
  });

  it('mesAnterior should decrement mesActual', () => {
    const initialMes = facade.mesActual();
    facade.mesAnterior();
    if (initialMes === 1) {
      expect(facade.mesActual()).toBe(12);
    } else {
      expect(facade.mesActual()).toBe(initialMes - 1);
    }
  });

  it('mesSiguiente should increment mesActual', () => {
    const initialMes = facade.mesActual();
    facade.mesSiguiente();
    if (initialMes === 12) {
      expect(facade.mesActual()).toBe(1);
    } else {
      expect(facade.mesActual()).toBe(initialMes + 1);
    }
  });

  // ─── spec 0017 (T2.4): grant multi-sede de la secretaria ───────────────────
  // Verifica el cableado del resolver en una facade de Finanzas. Que getActiveBranchId()
  // cambie según el grant es lo que invalida la caché SWR (_lastBranchId) al cambiarlo.
  describe('grant multi-sede (spec 0017, AC1/AC2)', () => {
    it('secretaria con grant: getActiveBranchId respeta el selector (sede elegida)', () => {
      authFacadeSpy.currentUser.mockReturnValue({
        role: 'secretaria',
        branchId: 1,
        canAccessBothBranches: true,
      });
      branchFacadeSpy.selectedBranchId.mockReturnValue(2);

      expect((facade as any).getActiveBranchId()).toBe(2);
    });

    it('secretaria con grant + "Todas" (null): getActiveBranchId es null (como admin)', () => {
      authFacadeSpy.currentUser.mockReturnValue({
        role: 'secretaria',
        branchId: 1,
        canAccessBothBranches: true,
      });
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);

      expect((facade as any).getActiveBranchId()).toBeNull();
    });

    it('secretaria sin grant: anclada a su sede, ignora el selector', () => {
      authFacadeSpy.currentUser.mockReturnValue({
        role: 'secretaria',
        branchId: 1,
        canAccessBothBranches: false,
      });
      branchFacadeSpy.selectedBranchId.mockReturnValue(2);

      expect((facade as any).getActiveBranchId()).toBe(1);
    });
  });

  // ─── spec 0025 (T1.1): notificar liquidación pagada al instructor ──────────
  describe('registrarPago — notificación al instructor (spec 0025, AC5)', () => {
    const row: LiquidacionRow = {
      instructorId: 7,
      userId: 42,
      nombre: 'Juan Pérez',
      rut: '11.111.111-1',
      initials: 'JP',
      avatarColor: '#000',
      practicalSessions: 10,
      totalHours: 15,
      amountPerHour: 5000,
      totalBaseAmount: 75000,
      totalAdvances: 10000,
      finalPaymentAmount: 65000,
      status: 'pending',
    };

    beforeEach(() => {
      authFacadeSpy.currentUser.mockReturnValue({ dbId: 1, role: 'admin' });
    });

    it('notifica al instructor usando row.userId directamente', async () => {
      const ok = await facade.registrarPago(row, { amountPerHour: 5000 } as any);

      expect(ok).toBe(true);
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledTimes(1);
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [42],
        expect.objectContaining({ referenceType: 'payment' }),
      );
    });

    it('no notifica si row.userId es falsy (guard)', async () => {
      const rowSinUserId: LiquidacionRow = { ...row, userId: 0 };

      const ok = await facade.registrarPago(rowSinUserId, { amountPerHour: 5000 } as any);

      expect(ok).toBe(true);
      expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
    });

    it('un fallo en notifyUsers no revierte el registro del pago', async () => {
      notificationsSpy.notifyUsers.mockRejectedValue(new Error('network error'));

      const ok = await facade.registrarPago(row, { amountPerHour: 5000 } as any);

      expect(ok).toBe(true);
    });
  });
});
