import { TestBed } from '@angular/core/testing';
import { InstructoresFacade } from './instructores.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { toISODate } from '@core/utils/date.utils';

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

      // Mismo cómputo de fecha que usa la facade (toISODate = huso Chile) — comparar
      // contra new Date().toISOString() (UTC) es flaky en el borde del día UTC/Chile.
      const todayStr = toISODate(new Date());
      expect(gte).toHaveBeenCalledWith('scheduled_at', `${todayStr}T00:00:00`);
      expect(gte.mock.results[0].value.lte).toHaveBeenCalledWith(
        'scheduled_at',
        `${todayStr}T23:59:59`,
      );
    });
  });

  // ─── spec 0004-m: instructores/vehículos "Ambas sedes" ─────────────────────
  describe('scope multi-sede — both_branches (spec 0004-m)', () => {
    function buildInstructorRow(id: number, branchId: number, bothBranches = false): any {
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
        both_branches: bothBranches,
        users: {
          id: id * 10,
          rut: `${id}`,
          first_names: 'Juan',
          paternal_last_name: 'Perez',
          maternal_last_name: null,
          email: `instructor${id}@test.cl`,
          phone: null,
          active: true,
          branch_id: branchId,
        },
        vehicle_assignments: [],
      };
    }

    /**
     * PostgREST rechaza `or=()` mezclando una columna de recurso embebido
     * (`users.branch_id`) con una columna raíz (`both_branches`) — confirmado
     * empíricamente contra Supabase local (PGRST100). Por eso `fetchData()` hace
     * dos queries (la de siempre por `users.branch_id`, y una segunda por
     * `both_branches=true`) y las mergea client-side, dedupe por `id`.
     */
    function mockInstructorsTwoQueries(
      byBranchRows: any[],
      bothBranchesRows: any[],
    ): { eqCalls: [string, unknown][] } {
      const eqCalls: [string, unknown][] = [];
      supabaseSpy.client.from = vi.fn((table: string) => {
        if (table === 'class_b_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        const builder: any = {
          select: vi.fn(() => builder),
          is: vi.fn(() => builder),
          order: vi.fn(() => builder),
          eq: vi.fn((col: string, val: unknown) => {
            eqCalls.push([col, val]);
            const isBranchFilter = col === 'users.branch_id';
            builder._lastResult = isBranchFilter ? byBranchRows : bothBranchesRows;
            return builder;
          }),
          then: (resolve: any) =>
            Promise.resolve({ data: builder._lastResult ?? byBranchRows, error: null }).then(
              resolve,
            ),
        };
        return builder;
      });
      return { eqCalls };
    }

    it('AC6 — con sede seleccionada, incluye instructores both_branches=true de OTRA sede', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'admin', branchId: null });
      branchFacadeSpy.selectedBranchId.mockReturnValue(1);
      mockInstructorsTwoQueries(
        [buildInstructorRow(1, 1, false)],
        [buildInstructorRow(2, 2, true)],
      );

      await facade.initialize();

      const ids = facade.instructores().map((r) => r.id);
      expect(ids).toContain(1);
      expect(ids).toContain(2);
    });

    it('AC6 — dedup: un instructor both_branches=true de la MISMA sede no aparece duplicado', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'admin', branchId: null });
      branchFacadeSpy.selectedBranchId.mockReturnValue(1);
      mockInstructorsTwoQueries([buildInstructorRow(1, 1, true)], [buildInstructorRow(1, 1, true)]);

      await facade.initialize();

      const ids = facade.instructores().map((r) => r.id);
      expect(ids.filter((id) => id === 1)).toHaveLength(1);
    });

    it('admin con "Todas las sedes" (null): no ejecuta la segunda query de both_branches', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'admin', branchId: null });
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);
      const { eqCalls } = mockInstructorsTwoQueries([], []);

      await facade.initialize();

      expect(eqCalls.find(([col]) => col === 'both_branches')).toBeUndefined();
    });

    it('loadVehicles() propaga branchId y bothBranches en VehicleOption', async () => {
      supabaseSpy.client.from = vi.fn((table: string) => {
        if (table === 'instructors') {
          return {
            select: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'vehicles') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 1,
                    license_plate: 'AA1111',
                    brand: 'Suzuki',
                    model: 'Swift',
                    year: 2022,
                    status: 'available',
                    branch_id: 1,
                    both_branches: true,
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'vehicle_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        throw new Error(`Tabla inesperada en el test: ${table}`);
      });

      await facade.loadVehicles();

      const options = facade.vehicles();
      expect(options[0].branchId).toBe(1);
      expect(options[0].bothBranches).toBe(true);
    });

    it('crearInstructor() propaga bothBranches en el body de la edge function', async () => {
      await facade.crearInstructor({
        firstNames: 'Juan',
        paternalLastName: 'Perez',
        maternalLastName: '',
        rut: '11111111-1',
        email: 'juan@test.cl',
        phone: '',
        type: 'practice',
        licenseNumber: '',
        licenseClass: 'B',
        licenseExpiry: '2030-01-01',
        vehicleId: null,
        branchId: 1,
        bothBranches: true,
      } as any);

      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledWith(
        'create-instructor',
        expect.objectContaining({ body: expect.objectContaining({ bothBranches: true }) }),
      );
    });

    it('editarInstructor() propaga bothBranches en el body de la edge function', async () => {
      await facade.editarInstructor(1, 10, {
        firstNames: 'Juan',
        paternalLastName: 'Perez',
        maternalLastName: '',
        phone: '',
        email: 'juan@test.cl',
        currentEmail: 'juan@test.cl',
        type: 'practice',
        licenseNumber: '',
        licenseClass: 'B',
        licenseExpiry: '2030-01-01',
        active: true,
        vehicleId: null,
        currentVehicleId: null,
        branchId: 1,
        bothBranches: true,
      } as any);

      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledWith(
        'update-instructor',
        expect.objectContaining({ body: expect.objectContaining({ bothBranches: true }) }),
      );
    });
  });

  describe('enviarInvitacion — fix-168-m', () => {
    it('invoca activate-instructor-account con el userId y email, y muestra un toast de éxito', async () => {
      const invokeFn = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
      supabaseSpy.client.functions = { invoke: invokeFn };

      const ok = await facade.enviarInvitacion(55, 'Instructor@Example.com');

      expect(ok).toBe(true);
      expect(invokeFn).toHaveBeenCalledWith('activate-instructor-account', {
        body: { userId: 55, email: 'instructor@example.com' },
      });
      expect(toastSpy.success).toHaveBeenCalled();
    });

    it('captura el error, muestra un toast y retorna false (ej. el instructor ya activó su cuenta)', async () => {
      const invokeFn = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Este instructor ya activó su cuenta.'),
      });
      supabaseSpy.client.functions = { invoke: invokeFn };

      const ok = await facade.enviarInvitacion(55, 'otro@example.com');

      expect(ok).toBe(false);
      expect(toastSpy.error).toHaveBeenCalled();
      expect(toastSpy.success).not.toHaveBeenCalled();
    });
  });
});
