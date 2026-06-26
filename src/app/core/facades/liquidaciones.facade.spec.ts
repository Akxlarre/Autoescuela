import { TestBed } from '@angular/core/testing';
import { LiquidacionesFacade } from './liquidaciones.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ToastService } from '@core/services/ui/toast.service';

describe('LiquidacionesFacade', () => {
  let facade: LiquidacionesFacade;
  let supabaseSpy: any;
  let authFacadeSpy: any;
  let branchFacadeSpy: any;
  let toastSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    authFacadeSpy = { currentUser: vi.fn() };
    branchFacadeSpy = { selectedBranchId: vi.fn().mockReturnValue(null) };
    toastSpy = { error: vi.fn(), success: vi.fn() };

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
});
