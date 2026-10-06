import { TestBed } from '@angular/core/testing';
import { AdminAlumnosProfesionalFacade } from './admin-alumnos-profesional.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

describe('AdminAlumnosProfesionalFacade', () => {
  let facade: AdminAlumnosProfesionalFacade;
  let supabaseSpy: any;
  let branchFacadeSpy: any;
  let authFacadeSpy: any;
  let builders: Record<string, any>;

  /** Builder thenable: cualquier método encadena, `await` resuelve {data,error}. */
  function makeBuilder(data: any[]): any {
    const result = { data, error: null };
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      update: vi.fn(() => builder),
      then: (resolve: (v: any) => void) => resolve(result),
    };
    return builder;
  }

  /** Mapea nombre de tabla → data. Reutiliza el builder por tabla para poder asertar. */
  function mockTables(tables: Record<string, any[]>): void {
    builders = {};
    supabaseSpy.client.from = vi.fn((table: string) => {
      if (!builders[table]) builders[table] = makeBuilder(tables[table] ?? []);
      return builders[table];
    });
  }

  function makeUser(over: Record<string, unknown> = {}): any {
    return {
      id: 9,
      rut: '9-9',
      first_names: 'Ana',
      paternal_last_name: 'Pérez',
      maternal_last_name: 'Soto',
      email: 'ana@a.cl',
      phone: '+569',
      branch_id: 2,
      ...over,
    };
  }

  function makeProEnrollment(over: Record<string, unknown> = {}): any {
    return {
      id: 100,
      number: 'P-0001',
      status: 'active',
      pending_balance: 120000,
      branch_id: 2,
      students: { id: 5, status: 'active', users: makeUser() },
      courses: { license_class: 'A4' },
      promotion_courses: {
        id: 3,
        professional_promotions: { code: '280', start_date: '2026-10-05' },
      },
      ...over,
    };
  }

  beforeEach(() => {
    branchFacadeSpy = { selectedBranchId: vi.fn().mockReturnValue(null) };
    // Default: admin con "Todas las escuelas" → sin filtro de sede.
    authFacadeSpy = { currentUser: vi.fn().mockReturnValue({ role: 'admin', branchId: null }) };
    supabaseSpy = {
      client: {
        from: vi.fn(),
        channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
        removeChannel: vi.fn(),
      },
    };
    mockTables({});

    TestBed.configureTestingModule({
      providers: [
        AdminAlumnosProfesionalFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: BranchFacade, useValue: branchFacadeSpy },
        { provide: AuthFacade, useValue: authFacadeSpy },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
      ],
    });

    facade = TestBed.inject(AdminAlumnosProfesionalFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.alumnos()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  it('filtra la query a license_group = professional (AC6)', async () => {
    mockTables({ enrollments: [] });
    await facade.initialize();
    expect(builders['enrollments'].eq).toHaveBeenCalledWith('license_group', 'professional');
  });

  it('trae solo matrículas activas — completed ya son Ex-Alumnos (fix-084); inactive/cancelled no existen en Profesional (fix-329-m)', async () => {
    mockTables({ enrollments: [] });
    await facade.initialize();
    expect(builders['enrollments'].in).toHaveBeenCalledWith('status', ['active']);
  });

  // fix-330-m (D11): la columna "Promoción" muestra la promoción; la categoría sale del curso
  // de la matrícula (también existe cuando el alumno aún no tiene promoción).
  describe('columna Promoción y categoría (fix-330-m)', () => {
    it('sin promoción → "—", pero la categoría sale igual del curso de la matrícula', async () => {
      mockTables({ enrollments: [makeProEnrollment({ promotion_courses: null })] });
      await facade.initialize();
      expect(facade.alumnos()[0].promocion).toBe('—');
      expect(facade.alumnos()[0].licenseClass).toBe('A4');
    });

    it('promoción sin número → se identifica por su fecha de inicio', async () => {
      mockTables({
        enrollments: [
          makeProEnrollment({
            promotion_courses: {
              id: 3,
              professional_promotions: { code: null, start_date: '2026-10-12' },
            },
          }),
        ],
      });
      await facade.initialize();
      expect(facade.alumnos()[0].promocion).toBe('Promoción del 12-10-2026');
    });
  });

  it('mapea un alumno profesional con promoción, semáforo, módulos y saldo (AC6)', async () => {
    mockTables({
      enrollments: [makeProEnrollment()],
      v_professional_attendance: [{ enrollment_id: 100, attendance_flag: 'yellow' }],
      professional_module_grades: [
        { enrollment_id: 100, passed: true },
        { enrollment_id: 100, passed: true },
        { enrollment_id: 100, passed: false },
      ],
    });

    await facade.initialize();

    const row = facade.alumnos()[0];
    expect(row.id).toBe('5');
    expect(row.promocion).toBe('Promoción 280');
    expect(row.licenseClass).toBe('A4');
    expect(row.semaforo).toBe('yellow');
    expect(row.modulosAprobados).toBe(2);
    expect(row.modulosTotal).toBe(7);
    expect(row.saldo).toBe(120000);
    expect(row.nroMatricula).toBe('P-0001');
    expect(row.estado).toBe('Activo');
  });

  it('mapea convalidatedLicense desde license_validations cuando el alumno convalida (fix-195)', async () => {
    mockTables({
      enrollments: [makeProEnrollment()],
      v_professional_attendance: [],
      professional_module_grades: [],
      license_validations: [{ enrollment_id: 100, convalidated_license: 'A4' }],
    });

    await facade.initialize();

    const row = facade.alumnos()[0];
    expect(row.convalidatedLicense).toBe('A4');
  });

  it('convalidatedLicense es null cuando el alumno no tiene registro de convalidación (fix-195)', async () => {
    mockTables({
      enrollments: [makeProEnrollment()],
      v_professional_attendance: [],
      professional_module_grades: [],
      license_validations: [],
    });

    await facade.initialize();

    const row = facade.alumnos()[0];
    expect(row.convalidatedLicense).toBeNull();
  });

  it('edge: alumno sin promoción ni notas no rompe (AC-E3)', async () => {
    mockTables({
      enrollments: [
        makeProEnrollment({ id: 200, number: null, promotion_courses: null, pending_balance: 0 }),
      ],
      v_professional_attendance: [],
      professional_module_grades: [],
    });

    await facade.initialize();

    const row = facade.alumnos()[0];
    expect(row.promocion).toBe('—');
    // fix-330-m: la categoría sale del curso de la matrícula, no de la promoción.
    expect(row.licenseClass).toBe('A4');
    expect(row.semaforo).toBeNull();
    expect(row.modulosAprobados).toBe(0);
    expect(row.nroMatricula).toBe('—');
  });

  it('aplica el filtro de sede cuando hay sede activa (facades.md §7)', async () => {
    branchFacadeSpy.selectedBranchId.mockReturnValue(2);
    mockTables({ enrollments: [] });
    await facade.initialize();
    expect(builders['enrollments'].eq).toHaveBeenCalledWith('branch_id', 2);
  });

  // ─── fix-027: aislamiento por sede de la secretaria ────────────────────────
  it('secretaria: filtra por su branchId aunque el selector (admin) sea null (fix-027)', async () => {
    authFacadeSpy.currentUser.mockReturnValue({ role: 'secretaria', branchId: 1 });
    branchFacadeSpy.selectedBranchId.mockReturnValue(null);
    mockTables({ enrollments: [] });
    await facade.initialize();
    expect(builders['enrollments'].eq).toHaveBeenCalledWith('branch_id', 1);
  });

  it('secretaria sin sede (misconfig): filtra por sentinel → ninguna fila (fix-027)', async () => {
    authFacadeSpy.currentUser.mockReturnValue({ role: 'secretaria', branchId: null });
    branchFacadeSpy.selectedBranchId.mockReturnValue(null);
    mockTables({ enrollments: [] });
    await facade.initialize();
    expect(builders['enrollments'].eq).toHaveBeenCalledWith('branch_id', -1);
  });

  describe('checkHistorial — homologación con AdminAlumnosFacade (Clase B)', () => {
    /**
     * Builder que distingue entre queries de filas (`.select('id')` → {data})
     * y queries de conteo (`.select('id', {count:'exact', head:true})` → {count}),
     * necesario porque checkHistorial usa ambas formas sobre distintas tablas.
     */
    function makeHistorialMock(config: {
      enrollmentIds: number[];
      payments?: number;
      theory?: number;
      practice?: number;
      /** fix-333-m: matrículas de Clase B de la misma persona (id → status). */
      claseB?: { id: number; status: string }[];
      /** fix-333-m: clases de Clase B agendadas a futuro. */
      futureClassB?: number;
    }): void {
      const counts: Record<string, number> = {
        payments: config.payments ?? 0,
        professional_theory_attendance: config.theory ?? 0,
        professional_practice_attendance: config.practice ?? 0,
        class_b_sessions: config.futureClassB ?? 0,
      };
      const rows = [
        ...config.enrollmentIds.map((id) => ({
          id,
          license_group: 'professional',
          status: 'active',
        })),
        ...(config.claseB ?? []).map((e) => ({ ...e, license_group: 'class_b' })),
      ];

      supabaseSpy.client.from = vi.fn((table: string) => {
        let countMode = false;
        const builder: any = {
          select: vi.fn((_col: string, opts?: { count?: string; head?: boolean }) => {
            countMode = opts?.count === 'exact';
            return builder;
          }),
          eq: vi.fn(() => builder),
          neq: vi.fn(() => builder),
          in: vi.fn(() => builder),
          gte: vi.fn(() => builder),
          then: (resolve: any) =>
            countMode
              ? resolve({ count: counts[table] ?? 0, error: null })
              : resolve({ data: rows, error: null }),
        };
        return builder;
      });
    }

    it('sin matrículas no-draft → sin historial (no consulta pagos/asistencia)', async () => {
      makeHistorialMock({ enrollmentIds: [] });
      const result = await facade.checkHistorial(5);
      expect(result.hasHistory).toBe(false);
    });

    it('con matrículas pero sin pagos ni asistencia → sin historial', async () => {
      makeHistorialMock({ enrollmentIds: [100] });
      const result = await facade.checkHistorial(5);
      expect(result.hasHistory).toBe(false);
    });

    it('con pagos registrados → hasHistory=true', async () => {
      makeHistorialMock({ enrollmentIds: [100], payments: 2 });
      const result = await facade.checkHistorial(5);
      expect(result.hasHistory).toBe(true);
    });

    it('con asistencia teórica registrada → hasHistory=true', async () => {
      makeHistorialMock({ enrollmentIds: [100], theory: 1 });
      const result = await facade.checkHistorial(5);
      expect(result.hasHistory).toBe(true);
    });

    it('con asistencia práctica registrada → hasHistory=true', async () => {
      makeHistorialMock({ enrollmentIds: [100], practice: 3 });
      const result = await facade.checkHistorial(5);
      expect(result.hasHistory).toBe(true);
    });

    // ── fix-333-m (D8): archivar desde Profesional archiva a la persona completa ──
    it('detecta que la persona también tiene una matrícula de Clase B vigente', async () => {
      makeHistorialMock({ enrollmentIds: [100], claseB: [{ id: 200, status: 'active' }] });
      expect((await facade.checkHistorial(5)).hasClaseB).toBe(true);
    });

    it('una Clase B ya completada no cuenta como vigente', async () => {
      makeHistorialMock({ enrollmentIds: [100], claseB: [{ id: 200, status: 'completed' }] });
      expect((await facade.checkHistorial(5)).hasClaseB).toBe(false);
    });

    it('prepararArchivado: con clases de Clase B agendadas a futuro no deja archivar (regla de fix-277-m)', async () => {
      makeHistorialMock({
        enrollmentIds: [100],
        claseB: [{ id: 200, status: 'active' }],
        futureClassB: 2,
      });
      const toast = TestBed.inject(ToastService) as any;

      const result = await facade.prepararArchivado(5);

      expect(result.permitido).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        'No se puede archivar',
        'Tiene 2 clases agendadas. Cancélalas o reagéndalas antes de archivar al alumno.',
      );
    });

    it('prepararArchivado: sin clases futuras deja archivar e informa si tiene Clase B', async () => {
      makeHistorialMock({ enrollmentIds: [100], claseB: [{ id: 200, status: 'active' }] });
      const result = await facade.prepararArchivado(5);
      expect(result).toEqual({ permitido: true, hasHistory: false, hasClaseB: true });
    });
  });

  // fix-333-m: si el archivado falla, el toast ya avisa; no debe quedar una promesa rechazada
  it('archivarAlumno con error → false y toast, sin lanzar', async () => {
    supabaseSpy.client.from = vi.fn(() => {
      const b: any = {
        update: vi.fn(() => b),
        eq: vi.fn(() => b),
        then: (resolve: any) => resolve({ error: { message: 'boom' } }),
      };
      return b;
    });
    const toast = TestBed.inject(ToastService) as any;

    await expect(facade.archivarAlumno(5)).resolves.toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });

  // fix-337-m (I10): el buscador global necesita la lista, pero no tiene ciclo de vida para cerrar
  // un canal Realtime (swr-pattern.md: nunca suscribir sin su dispose()).
  describe('loadForSearch (fix-337-m)', () => {
    it('carga la lista sin suscribir Realtime', async () => {
      mockTables({ enrollments: [makeProEnrollment()] });

      await facade.loadForSearch();

      expect(facade.alumnos()).toHaveLength(1);
      expect(supabaseSpy.client.channel).not.toHaveBeenCalled();
    });

    it('no vuelve a consultar si ya hay datos de la misma sede', async () => {
      mockTables({ enrollments: [makeProEnrollment()] });
      await facade.loadForSearch();
      supabaseSpy.client.from.mockClear();

      await facade.loadForSearch();

      expect(supabaseSpy.client.from).not.toHaveBeenCalled();
    });

    it('si la consulta falla no lanza (el buscador sigue con lo que tenga)', async () => {
      supabaseSpy.client.from = vi.fn(() => {
        throw new Error('red caída');
      });
      await expect(facade.loadForSearch()).resolves.toBeUndefined();
    });
  });
});
