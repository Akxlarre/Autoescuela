import { TestBed } from '@angular/core/testing';
import { InstructoresFacade } from './instructores.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';

describe('InstructoresFacade', () => {
  let facade: InstructoresFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  let branchFacadeSpy: any;
  let authFacadeSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn() };
    branchFacadeSpy = { selectedBranchId: vi.fn().mockReturnValue(null) };
    // Default: admin con "Todas las escuelas" → sin filtro de sede.
    authFacadeSpy = { currentUser: vi.fn().mockReturnValue({ role: 'admin', branchId: null }) };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        InstructoresFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: BranchFacade, useValue: branchFacadeSpy },
        { provide: AuthFacade, useValue: authFacadeSpy },
      ],
    });

    facade = TestBed.inject(InstructoresFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.instructores()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.totalInstructores()).toBe(0);
  });

  it('selectInstructor should update selectedInstructor signal', () => {
    const inst = { id: 1 } as any;
    facade.selectInstructor(inst);
    expect(facade.selectedInstructor()).toBe(inst);
  });

  // ─── fix-027: aislamiento por sede de la secretaria ────────────────────────
  describe('aislamiento por sede (fix-027, AC-F27-2)', () => {
    /** Builder encadenable y thenable que captura las llamadas a `.eq(...)`. */
    function mockInstructorsCapturingEq(): { eq: any } {
      const eq = vi.fn(() => builder);
      const builder: any = {
        select: vi.fn(() => builder),
        is: vi.fn(() => builder),
        order: vi.fn(() => builder),
        eq,
        then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      supabaseSpy.client.from = vi.fn(() => builder);
      return { eq };
    }

    it('secretaria: filtra por users.branch_id de su sede aunque el selector sea null', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'secretaria', branchId: 1 });
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);
      const { eq } = mockInstructorsCapturingEq();

      await facade.initialize();

      expect(eq).toHaveBeenCalledWith('users.branch_id', 1);
    });

    it('secretaria sin sede (misconfig): filtra por sentinel → ninguna fila', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'secretaria', branchId: null });
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);
      const { eq } = mockInstructorsCapturingEq();

      await facade.initialize();

      expect(eq).toHaveBeenCalledWith('users.branch_id', -1);
    });

    it('admin con "Todas las escuelas" (null): NO aplica filtro de sede', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'admin', branchId: null });
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);
      const { eq } = mockInstructorsCapturingEq();

      await facade.initialize();

      expect(eq).not.toHaveBeenCalled();
    });
  });

  // ─── spec 0017 (T2.4): grant multi-sede de la secretaria ───────────────────
  describe('grant multi-sede (spec 0017, AC1/AC2)', () => {
    function mockInstructorsCapturingEq(): { eq: any } {
      const eq = vi.fn(() => builder);
      const builder: any = {
        select: vi.fn(() => builder),
        is: vi.fn(() => builder),
        order: vi.fn(() => builder),
        eq,
        then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      supabaseSpy.client.from = vi.fn(() => builder);
      return { eq };
    }

    it('secretaria con grant: respeta el selector (sede elegida), no su sede propia', async () => {
      authFacadeSpy.currentUser.mockReturnValue({
        role: 'secretaria',
        branchId: 1,
        canAccessBothBranches: true,
      });
      branchFacadeSpy.selectedBranchId.mockReturnValue(2);
      const { eq } = mockInstructorsCapturingEq();

      await facade.initialize();

      expect(eq).toHaveBeenCalledWith('users.branch_id', 2);
    });

    it('secretaria con grant + "Todas" (null): NO aplica filtro de sede (como admin)', async () => {
      authFacadeSpy.currentUser.mockReturnValue({
        role: 'secretaria',
        branchId: 1,
        canAccessBothBranches: true,
      });
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);
      const { eq } = mockInstructorsCapturingEq();

      await facade.initialize();

      expect(eq).not.toHaveBeenCalled();
    });
  });
});
