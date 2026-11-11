import { TestBed } from '@angular/core/testing';
import { InstructorAlumnosFacade } from './instructor-alumnos.facade';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('InstructorAlumnosFacade', () => {
  let facade: InstructorAlumnosFacade;
  let supabaseMock: any;
  let profileMock: any;

  function createChainMock(resolvedValue: any = { data: [], error: null }) {
    const chain: any = {};
    const methods = [
      'select',
      'eq',
      'in',
      'gte',
      'lte',
      'order',
      'limit',
      'maybeSingle',
      'insert',
      'not',
    ];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.order = vi.fn().mockResolvedValue(resolvedValue);
    chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.lte = vi.fn().mockResolvedValue(resolvedValue);
    return chain;
  }

  beforeEach(() => {
    const chain = createChainMock();
    supabaseMock = {
      client: {
        from: vi.fn().mockReturnValue(chain),
      },
    };

    profileMock = {
      getInstructorId: vi.fn().mockResolvedValue(1),
      instructorId: vi.fn().mockReturnValue(1),
    };

    TestBed.configureTestingModule({
      providers: [
        InstructorAlumnosFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: InstructorProfileFacade, useValue: profileMock },
        {
          provide: ToastService,
          useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
        },
      ],
    });

    facade = TestBed.inject(InstructorAlumnosFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialize with empty state', () => {
    expect(facade.students()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  it('fetchStudents should first query class_b_sessions for instructor enrollment IDs', async () => {
    await facade.fetchStudents();
    const firstCall = supabaseMock.client.from.mock.calls[0];
    expect(firstCall[0]).toBe('class_b_sessions');
  });

  it('fetchStudents should set empty when instructor has no sessions', async () => {
    await facade.fetchStudents();
    expect(facade.students()).toEqual([]);
  });

  // ── fix-170-b ──────────────────────────────────────────────────────────────
  //
  // La Ficha Técnica del instructor son las 12 clases prácticas de Clase B. Antes
  // resolvía la matrícula con `order('id', desc).limit(1)` sin filtrar por tipo de
  // curso, así que en un alumno con Clase B Y Profesional agarraba la de id mayor —
  // la de Profesional, que no tiene clases B— y pintaba las 12 en blanco.
  //
  // Se afirma sobre los filtros que se le piden a PostgREST, no sobre las filas
  // devueltas: el bug estaba en la consulta, no en el mapeo.
  describe('loadStudentDetail — matrícula de la Ficha Técnica (fix-170-b)', () => {
    /** Registra los filtros aplicados a cada tabla consultada. */
    function mockConFiltros() {
      const filtros: Record<string, string[]> = {};
      const from = vi.fn().mockImplementation((tabla: string) => {
        filtros[tabla] = filtros[tabla] ?? [];
        const chain: any = {};
        for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'limit', 'not']) {
          chain[m] = vi.fn().mockImplementation((...args: unknown[]) => {
            if (m === 'eq') filtros[tabla].push(`eq:${String(args[0])}=${String(args[1])}`);
            return chain;
          });
        }
        chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        return chain;
      });
      return { from, filtros };
    }

    it('pide la matrícula filtrando por curso de tipo class_b', async () => {
      const { from, filtros } = mockConFiltros();
      supabaseMock.client.from = from;

      await facade.loadStudentDetail(84);

      expect(filtros['enrollments']).toBeDefined();
      expect(filtros['enrollments'].some((f) => /courses.*type.*class_b/.test(f))).toBe(true);
    });

    it('sigue acotando al alumno pedido', async () => {
      const { from, filtros } = mockConFiltros();
      supabaseMock.client.from = from;

      await facade.loadStudentDetail(84);

      expect(filtros['enrollments']).toContain('eq:student_id=84');
    });
  });

  describe('Manejo explícito de errores de lectura (0060-b / DoD-F)', () => {
    it('Caso A: primera carga con error deja lista vacía y error visible', async () => {
      supabaseMock.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'db connection failed' },
        }),
      });

      await facade.initialize();

      expect(facade.students()).toEqual([]);
      expect(facade.error()).toBe('No se pudo cargar la lista de alumnos.');
      expect(facade.isLoading()).toBe(false);
      expect((facade as any)._initialized).toBe(false);
    });

    it('Caso A: si v_student_progress_b falla en Promise.all, la carga entera falla', async () => {
      const sessionsChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [{ enrollment_id: 10 }], error: null }),
      };
      const enrollmentsChain: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };
      enrollmentsChain.in = vi.fn().mockImplementation((col: string) => {
        if (col === 'status') {
          return Promise.resolve({ data: [{ id: 10, number: 1, status: 'active' }], error: null });
        }
        return enrollmentsChain;
      });
      const progressChain: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'progress view error' },
        }),
      };

      supabaseMock.client.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'class_b_sessions') return sessionsChain;
        if (table === 'enrollments') return enrollmentsChain;
        if (table === 'v_student_progress_b') return progressChain;
        return createChainMock();
      });

      await facade.initialize();

      expect(facade.students()).toEqual([]);
      expect(facade.error()).toBe('No se pudo cargar la lista de alumnos.');
    });

    it('Caso B: refresco que falla mantiene los datos visibles y activa refreshFailed', async () => {
      // 1. Carga inicial exitosa
      const sessionsChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [{ enrollment_id: 10 }], error: null }),
      };
      const enrollmentsChain: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };
      enrollmentsChain.in = vi.fn().mockImplementation((col: string) => {
        if (col === 'status') {
          return Promise.resolve({
            data: [
              {
                id: 10,
                number: 100,
                status: 'active',
                courses: { name: 'Clase B', code: 'B' },
                students: { id: 5, users: { first_names: 'Ana', paternal_last_name: 'Pérez' } },
                class_b_sessions: [],
              },
            ],
            error: null,
          });
        }
        return enrollmentsChain;
      });
      const progressChain: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ enrollment_id: 10, completed_practices: 3 }],
          error: null,
        }),
      };

      supabaseMock.client.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'class_b_sessions') return sessionsChain;
        if (table === 'enrollments') return enrollmentsChain;
        if (table === 'v_student_progress_b') return progressChain;
        return createChainMock();
      });

      await facade.initialize();
      expect(facade.students().length).toBe(1);
      expect(facade.error()).toBeNull();
      expect(facade.refreshFailed()).toBe(false);

      // 2. Refresco con error
      sessionsChain.eq = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'temporary network failure' },
      });

      await facade.refreshSilently();

      // Lo visible se queda (Caso B)
      expect(facade.students().length).toBe(1);
      expect(facade.refreshFailed()).toBe(true);
      expect(facade.error()).toBeNull();
    });

    it('reintentar limpia el error y recarga', async () => {
      // 1. Falla la primera carga
      supabaseMock.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'network err' } }),
      });

      await facade.initialize();
      expect(facade.error()).toBe('No se pudo cargar la lista de alumnos.');

      // 2. Mock exitoso para el reintento
      supabaseMock.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      await facade.reintentar();
      expect(facade.error()).toBeNull();
      expect(facade.refreshFailed()).toBe(false);
      expect(facade.students()).toEqual([]);
    });

    it('Reintentar en caso B: con refreshFailed y datos visibles, un reintento que falla deja los datos intactos, isLoading nunca pasa a true y no aparece error() de caso A', async () => {
      const sessionsChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [{ enrollment_id: 10 }], error: null }),
      };
      const enrollmentsChain: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };
      enrollmentsChain.in = vi.fn().mockImplementation((col: string) => {
        if (col === 'status') {
          return Promise.resolve({
            data: [
              {
                id: 10,
                number: 100,
                status: 'active',
                courses: { name: 'Clase B', code: 'B' },
                students: { id: 5, users: { first_names: 'Ana', paternal_last_name: 'Pérez' } },
                class_b_sessions: [],
              },
            ],
            error: null,
          });
        }
        return enrollmentsChain;
      });
      const progressChain: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ enrollment_id: 10, completed_practices: 3 }],
          error: null,
        }),
      };

      supabaseMock.client.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'class_b_sessions') return sessionsChain;
        if (table === 'enrollments') return enrollmentsChain;
        if (table === 'v_student_progress_b') return progressChain;
        return createChainMock();
      });

      await facade.initialize();
      expect(facade.students().length).toBe(1);

      sessionsChain.eq = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'temporary network failure' },
      });
      await facade.refreshSilently();
      expect(facade.refreshFailed()).toBe(true);

      const observedLoading: boolean[] = [];
      supabaseMock.client.from = vi.fn().mockImplementation(() => {
        observedLoading.push(facade.isLoading());
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'retry failed' } }),
        };
      });

      await facade.reintentar();

      expect(observedLoading.length).toBeGreaterThan(0);
      expect(observedLoading.every((v) => v === false)).toBe(true);
      expect(facade.isLoading()).toBe(false);
      expect(facade.students().length).toBe(1);
      expect(facade.students()[0].name).toContain('Ana');
      expect(facade.refreshFailed()).toBe(true);
      expect(facade.error()).toBeNull();
    });

    it('Reintentar en caso B: un reintento que funciona actualiza los datos y limpia refreshFailed', async () => {
      const sessionsChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [{ enrollment_id: 10 }], error: null }),
      };
      const enrollmentsChain: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };
      enrollmentsChain.in = vi.fn().mockImplementation((col: string) => {
        if (col === 'status') {
          return Promise.resolve({
            data: [
              {
                id: 10,
                number: 100,
                status: 'active',
                courses: { name: 'Clase B', code: 'B' },
                students: { id: 5, users: { first_names: 'Ana', paternal_last_name: 'Pérez' } },
                class_b_sessions: [],
              },
            ],
            error: null,
          });
        }
        return enrollmentsChain;
      });
      const progressChain: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ enrollment_id: 10, completed_practices: 3 }],
          error: null,
        }),
      };

      supabaseMock.client.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'class_b_sessions') return sessionsChain;
        if (table === 'enrollments') return enrollmentsChain;
        if (table === 'v_student_progress_b') return progressChain;
        return createChainMock();
      });

      await facade.initialize();

      sessionsChain.eq = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'temporary network failure' },
      });
      await facade.refreshSilently();
      expect(facade.refreshFailed()).toBe(true);

      const observedLoading: boolean[] = [];
      const updatedSessionsChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ enrollment_id: 10 }, { enrollment_id: 11 }],
          error: null,
        }),
      };
      const updatedEnrollmentsChain: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };
      updatedEnrollmentsChain.in = vi.fn().mockImplementation((col: string) => {
        if (col === 'status') {
          return Promise.resolve({
            data: [
              {
                id: 10,
                number: 100,
                status: 'active',
                courses: { name: 'Clase B', code: 'B' },
                students: { id: 5, users: { first_names: 'Ana', paternal_last_name: 'Pérez' } },
                class_b_sessions: [],
              },
              {
                id: 11,
                number: 101,
                status: 'active',
                courses: { name: 'Clase B', code: 'B' },
                students: { id: 6, users: { first_names: 'Luis', paternal_last_name: 'Soto' } },
                class_b_sessions: [],
              },
            ],
            error: null,
          });
        }
        return updatedEnrollmentsChain;
      });
      const updatedProgressChain: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            { enrollment_id: 10, completed_practices: 4 },
            { enrollment_id: 11, completed_practices: 1 },
          ],
          error: null,
        }),
      };

      supabaseMock.client.from = vi.fn().mockImplementation((table: string) => {
        observedLoading.push(facade.isLoading());
        if (table === 'class_b_sessions') return updatedSessionsChain;
        if (table === 'enrollments') return updatedEnrollmentsChain;
        if (table === 'v_student_progress_b') return updatedProgressChain;
        return createChainMock();
      });

      await facade.reintentar();

      expect(observedLoading.length).toBeGreaterThan(0);
      expect(observedLoading.every((v) => v === false)).toBe(true);
      expect(facade.isLoading()).toBe(false);
      expect(facade.students().length).toBe(2);
      expect(facade.refreshFailed()).toBe(false);
      expect(facade.error()).toBeNull();
    });

    it('loadStudentDetail: limpia studentDetail al empezar (Caso A al cambiar de alumno)', async () => {
      // Seteamos un alumno previo
      (facade as any)._studentDetail.set({
        studentId: 99,
        enrollmentId: 999,
        name: 'Otro Alumno',
        rut: '9.999.999-9',
        phone: null,
        email: null,
        courseCode: 'B',
        courseName: 'Clase B',
        practiceProgress: 2,
        totalSessions: 12,
        theoryPercent: 0,
        fichaTecnica: [],
      });
      expect(facade.studentDetail()).not.toBeNull();

      // Cuando la carga de detalle falla:
      supabaseMock.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
      });

      await facade.loadStudentDetail(84);

      // Nunca debe verse el detalle del alumno anterior ni ensuciar el error de la lista
      expect(facade.studentDetail()).toBeNull();
      expect(facade.detailError()).toBe('No se pudo cargar la ficha del alumno.');
      expect(facade.error()).toBeNull();
    });

    it('loadStudentDetail: chequea error de class_b_topics', async () => {
      const enrollmentChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 1,
            status: 'active',
            courses: { name: 'Clase B', code: 'B', type: 'class_b' },
            students: { id: 84, users: { first_names: 'Juan', paternal_last_name: 'Pérez' } },
          },
          error: null,
        }),
      };
      const sessionsChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      const topicsChain: any = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'topics error' } }),
      };

      supabaseMock.client.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'enrollments') return enrollmentChain;
        if (table === 'class_b_sessions') return sessionsChain;
        if (table === 'class_b_topics') return topicsChain;
        return createChainMock();
      });

      await facade.loadStudentDetail(84);

      expect(facade.studentDetail()).toBeNull();
      expect(facade.detailError()).toBe('No se pudo cargar la ficha del alumno.');
      expect(facade.error()).toBeNull();
    });

    it('loadStudentDetail: request guard descarta respuesta vieja', async () => {
      let resolveFirst: any;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      const firstEnrollmentChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => firstPromise),
      };

      const secondEnrollmentChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 2,
            status: 'active',
            courses: { name: 'Clase B', code: 'B', type: 'class_b' },
            students: { id: 85, users: { first_names: 'Segundo', paternal_last_name: 'Alumno' } },
          },
          error: null,
        }),
      };

      let callCount = 0;
      supabaseMock.client.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'enrollments') {
          callCount++;
          return callCount === 1 ? firstEnrollmentChain : secondEnrollmentChain;
        }
        if (table === 'class_b_sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'class_b_topics') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return createChainMock();
      });

      const p1 = facade.loadStudentDetail(84);
      const p2 = facade.loadStudentDetail(85);

      await p2;
      expect(facade.studentDetail()?.studentId).toBe(85);

      // Ahora resuelve la primera con error
      resolveFirst({ data: null, error: { message: 'stale error' } });
      await p1;

      // La respuesta vieja NO pisa la vigente ni setea error
      expect(facade.studentDetail()?.studentId).toBe(85);
      expect(facade.detailError()).toBeNull();
    });

    it('Lección 5: un refresco que pide token nuevo no deja isLoading pegado en true', async () => {
      let resolveFirst: any;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      let first = true;
      supabaseMock.client.from = vi.fn().mockImplementation(() => {
        if (first) {
          first = false;
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => firstPromise),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const pInit = facade.initialize();
      const pRefresh = facade.refreshSilently();
      resolveFirst({ data: [], error: null });

      await Promise.all([pInit, pRefresh]);

      expect(facade.isLoading()).toBe(false);
    });

    it('listGuard descarta respuesta vieja de initialize cuando hay recarga posterior', async () => {
      let resolveFirst: any;
      const firstPromise = new Promise((r) => {
        resolveFirst = r;
      });

      let call = 0;
      supabaseMock.client.from = vi.fn().mockImplementation((table: string) => {
        call++;
        if (call === 1 && table === 'class_b_sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => firstPromise),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const p1 = facade.initialize();
      const p2 = facade.reintentar();
      await p2;

      resolveFirst({ data: null, error: { message: 'stale list failure' } });
      await p1;

      expect(facade.error()).toBeNull();
      expect(facade.isLoading()).toBe(false);
    });
  });
});
