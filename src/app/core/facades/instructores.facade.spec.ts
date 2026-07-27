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

  // ─── fix-072: "Clases activas" como COUNT en vivo (no columna cacheada) ────
  describe('clases activas en vivo (fix-072)', () => {
    function mockInstructorsAndSessions(instructorRows: any[], sessionRows: any[]): void {
      supabaseSpy.client.from = vi.fn((table: string) => {
        if (table === 'instructors') {
          return {
            select: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: instructorRows, error: null }),
              }),
            }),
          };
        }
        if (table === 'class_b_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockResolvedValue({ data: sessionRows, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Tabla inesperada en el test: ${table}`);
      });
    }

    function buildInstructorRow(id: number): any {
      return {
        id,
        user_id: id * 10,
        type: 'practice',
        license_number: 'X',
        license_class: 'B',
        license_expiry: null,
        license_status: 'valid',
        active: true,
        registration_date: null,
        users: {
          id: id * 10,
          rut: `${id}`,
          first_names: 'Juan',
          paternal_last_name: 'Perez',
          maternal_last_name: null,
          email: `instructor${id}@test.cl`,
          phone: null,
          active: true,
          branch_id: 1,
        },
        vehicle_assignments: [],
      };
    }

    it('activeClassesCount refleja el COUNT en vivo de class_b_sessions en status in_progress', async () => {
      mockInstructorsAndSessions(
        [buildInstructorRow(1), buildInstructorRow(2)],
        [{ instructor_id: 1 }, { instructor_id: 1 }],
      );

      await facade.initialize();

      const rows = facade.instructores();
      expect(rows.find((r) => r.id === 1)?.activeClassesCount).toBe(2);
    });

    it('activeClassesCount es 0 para un instructor sin sesiones in_progress', async () => {
      mockInstructorsAndSessions([buildInstructorRow(3)], []);

      await facade.initialize();

      expect(facade.instructores()[0].activeClassesCount).toBe(0);
    });

    it('no cuenta sesiones in_progress de días anteriores (huérfanas): acota la query al día de hoy', async () => {
      const gte = vi
        .fn()
        .mockReturnValue({ lte: vi.fn().mockResolvedValue({ data: [], error: null }) });
      const inFn = vi.fn().mockReturnValue({ gte });
      const eq = vi.fn().mockReturnValue({ in: inFn });

      supabaseSpy.client.from = vi.fn((table: string) => {
        if (table === 'instructors') {
          return {
            select: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [buildInstructorRow(4)], error: null }),
              }),
            }),
          };
        }
        if (table === 'class_b_sessions') {
          return { select: vi.fn().mockReturnValue({ eq }) };
        }
        throw new Error(`Tabla inesperada en el test: ${table}`);
      });

      await facade.initialize();

      const todayStr = new Date().toISOString().slice(0, 10);
      expect(gte).toHaveBeenCalledWith('scheduled_at', `${todayStr}T00:00:00`);
      expect(gte.mock.results[0].value.lte).toHaveBeenCalledWith(
        'scheduled_at',
        `${todayStr}T23:59:59`,
      );
    });
  });
});
