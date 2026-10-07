import { TestBed } from '@angular/core/testing';
import { InstructoresFacade } from './instructores.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { getChileDateTimeRange, toISODate } from '@core/utils/date.utils';

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

      // fix-207-b (S15): el día de Chile con su offset (sin offset, Postgres lo leía en UTC y
      // perdía las clases en curso de la tarde-noche).
      const { start, end } = getChileDateTimeRange(toISODate(new Date()));
      expect(start).toMatch(/T00:00:00[+-]\d\d:00$/);
      expect(gte).toHaveBeenCalledWith('scheduled_at', start);
      expect(gte.mock.results[0].value.lte).toHaveBeenCalledWith('scheduled_at', end);
    });

    // fix-202-b (S7): license_status solo se recalcula al editar; el estado se calcula con la fecha.
    it('licencia vencida ayer pero guardada como "valid" → se muestra vencida y cuenta en "por vencer" solo si corresponde', async () => {
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      const en10 = new Date();
      en10.setDate(en10.getDate() + 10);
      mockInstructorsAndSessions(
        [
          { ...buildInstructorRow(5), license_expiry: toISODate(ayer), license_status: 'valid' },
          { ...buildInstructorRow(6), license_expiry: toISODate(en10), license_status: 'valid' },
          { ...buildInstructorRow(7), license_expiry: null, license_status: 'valid' },
        ],
        [],
      );

      await facade.initialize();

      const byId = (id: number) => facade.instructores().find((r) => r.id === id)!;
      expect(byId(5).licenseStatus).toBe('expired');
      expect(byId(5).licenseStatusLabel).toBe('Vencida');
      expect(byId(6).licenseStatus).toBe('expiring_soon');
      expect(byId(7).licenseStatus).toBe('valid'); // sin fecha: el valor guardado
      expect(facade.licenciasPorVencer()).toBe(1);
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

    it('editarInstructor() con email duplicado — fix-029-i: lee error.context y muestra el mensaje de negocio real, no el genérico del sanitizer', async () => {
      const duplicateEmailError = Object.assign(
        new Error('Edge Function returned a non-2xx status code'),
        {
          name: 'FunctionsHttpError',
          context: {
            status: 500,
            json: vi.fn().mockResolvedValue({
              error:
                'Error al actualizar usuario: duplicate key value violates unique constraint "users_email_key"',
            }),
          },
        },
      );
      supabaseSpy.client.functions = {
        invoke: vi.fn().mockResolvedValue({ data: null, error: duplicateEmailError }),
      };

      const ok = await facade.editarInstructor(1, 10, {
        firstNames: 'Juan',
        paternalLastName: 'Perez',
        maternalLastName: '',
        phone: '',
        email: 'ocupado@test.cl',
        currentEmail: 'juan@test.cl',
        type: 'practice',
        licenseNumber: '',
        licenseClass: 'B',
        licenseExpiry: '2030-01-01',
        active: true,
        vehicleId: null,
        currentVehicleId: null,
        branchId: 1,
        bothBranches: false,
      } as any);

      expect(ok).toBe(false);
      expect(toastSpy.error).toHaveBeenCalledWith(
        'Error',
        'Ya existe otro usuario registrado con ese correo electrónico.',
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

  // fix-200-b (S6 de ASG-i-034): crear/reenviar re-envolvían el error y el toast mostraba un texto
  // genérico; ahora un 4xx muestra el mensaje de la función y un 5xx el genérico.
  describe('errores reales de la Edge Function — fix-200-b', () => {
    const httpError = (status: number, error: string) =>
      Object.assign(new Error('Edge Function returned a non-2xx status code'), {
        name: 'FunctionsHttpError',
        context: { status, json: vi.fn().mockResolvedValue({ error }) },
      });
    const payload = {
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
      bothBranches: false,
    } as any;

    it('crearInstructor() con 409 → muestra el mensaje de la función', async () => {
      supabaseSpy.client.functions = {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: httpError(409, 'Ya existe un usuario con ese correo electrónico'),
        }),
      };
      expect(await facade.crearInstructor(payload)).toBeNull();
      expect(toastSpy.error).toHaveBeenCalledWith(
        'Error',
        'Ya existe un usuario con ese correo electrónico',
      );
    });

    it('crearInstructor() con 500 → muestra el genérico, no el texto técnico', async () => {
      supabaseSpy.client.functions = {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: httpError(500, 'duplicate key value violates unique constraint'),
        }),
      };
      expect(await facade.crearInstructor(payload)).toBeNull();
      expect(toastSpy.error).toHaveBeenCalledWith('Error', 'Error al crear instructor');
    });

    it('enviarInvitacion() con 403 → muestra el mensaje de la función', async () => {
      supabaseSpy.client.functions = {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: httpError(403, 'No puedes reenviar invitaciones de instructores de otra sede'),
        }),
      };
      expect(await facade.enviarInvitacion(55, 'x@test.cl')).toBe(false);
      expect(toastSpy.error).toHaveBeenCalledWith(
        'Error',
        'No puedes reenviar invitaciones de instructores de otra sede',
      );
    });
  });

  // fix-205-b (S9 de ASG-i-034): al desactivar se avisa cuántas clases futuras quedan colgando.
  describe('cargarClasesFuturas — fix-205-b', () => {
    function mockCount(result: { count: number | null; error: unknown }): {
      eq: any;
      gte: any;
      select: any;
    } {
      const gte = vi.fn().mockResolvedValue(result);
      const eq: any = vi.fn();
      const chain = { eq, gte };
      eq.mockReturnValue(chain);
      const select = vi.fn().mockReturnValue(chain);
      supabaseSpy.client.from = vi.fn().mockReturnValue({ select });
      return { eq, gte, select };
    }

    it('cuenta las clases scheduled del instructor desde ahora', async () => {
      const { eq, gte, select } = mockCount({ count: 3, error: null });
      await facade.cargarClasesFuturas(7);
      expect(supabaseSpy.client.from).toHaveBeenCalledWith('class_b_sessions');
      expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(eq).toHaveBeenCalledWith('instructor_id', 7);
      expect(eq).toHaveBeenCalledWith('status', 'scheduled');
      expect(gte.mock.calls[0][0]).toBe('scheduled_at');
      expect(facade.clasesFuturasSeleccionado()).toBe(3);
    });

    it('con error → null (el aviso no inventa un número)', async () => {
      mockCount({ count: null, error: { message: 'boom' } });
      await facade.cargarClasesFuturas(7);
      expect(facade.clasesFuturasSeleccionado()).toBeNull();
    });

    it('una respuesta vieja no pisa la del instructor vigente', async () => {
      let resolveOld!: (v: unknown) => void;
      const gte = vi
        .fn()
        .mockReturnValueOnce(new Promise((r) => (resolveOld = r)))
        .mockResolvedValueOnce({ count: 5, error: null });
      const eq: any = vi.fn();
      const chain = { eq, gte };
      eq.mockReturnValue(chain);
      supabaseSpy.client.from = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

      const old = facade.cargarClasesFuturas(1);
      await facade.cargarClasesFuturas(2);
      resolveOld({ count: 9, error: null });
      await old;
      expect(facade.clasesFuturasSeleccionado()).toBe(5);
    });
  });
});
