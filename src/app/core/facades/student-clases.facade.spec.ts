import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StudentClasesFacade } from './student-clases.facade';
import { StudentEnrollmentContextFacade } from './student-enrollment-context.facade';
import { AuthFacade } from './auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

// ── Mock Supabase con respuesta por tabla ──

type TableResponse = { data: unknown; error: unknown };

function createMockSupabase(tables: Record<string, TableResponse>) {
  const from = vi.fn().mockImplementation((table: string) => {
    const res = tables[table] ?? { data: null, error: null };
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(res),
      then: (resolve: any, reject: any) => Promise.resolve(res).then(resolve, reject),
    };
    return builder;
  });
  return { client: { from } };
}

function setup(opts: {
  tables: Record<string, TableResponse>;
  dbId?: number | null;
  activeEnrollmentId?: number | null;
}) {
  const mockSupabase = createMockSupabase(opts.tables);
  const mockAuth = {
    currentUser: vi.fn(() => (opts.dbId === null ? null : { dbId: opts.dbId ?? 7 })),
  };
  const mockContext = {
    initialize: vi.fn().mockResolvedValue(undefined),
    activeEnrollmentId: vi.fn(() => opts.activeEnrollmentId ?? 100),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: mockSupabase },
      { provide: AuthFacade, useValue: mockAuth },
      { provide: StudentEnrollmentContextFacade, useValue: mockContext },
    ],
  });
  return { facade: TestBed.inject(StudentClasesFacade), mockSupabase };
}

const FUTURE = '2099-01-15T10:00:00Z';
const PAST = '2020-01-15T10:00:00Z';

function classBTables(sessions: unknown[], completedPractices = 0): Record<string, TableResponse> {
  return {
    enrollments: {
      data: { id: 100, license_group: 'class_b', student_id: 5, promotion_course_id: null },
      error: null,
    },
    class_b_sessions: { data: sessions, error: null },
    v_student_progress_b: { data: { completed_practices: completedPractices }, error: null },
  };
}

describe('StudentClasesFacade', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('Clase B — derivación de estado por sesión', () => {
    it('sin asistencia y en el futuro → scheduled; en el pasado → no_show', async () => {
      const { facade } = setup({
        tables: classBTables([
          {
            id: 1,
            class_number: 1,
            scheduled_at: FUTURE,
            duration_min: 45,
            status: 'scheduled',
            class_b_practice_attendance: [],
          },
          {
            id: 2,
            class_number: 2,
            scheduled_at: PAST,
            duration_min: 45,
            status: 'scheduled',
            class_b_practice_attendance: [],
          },
        ]),
      });
      await facade.initialize();
      const [futura, pasada] = facade.practiceSessions();
      expect(futura.status).toBe('scheduled');
      expect(pasada.status).toBe('no_show');
    });

    it('present y late cuentan como completed; absent como absent', async () => {
      const { facade } = setup({
        tables: classBTables([
          {
            id: 1,
            class_number: 1,
            scheduled_at: PAST,
            duration_min: 45,
            status: 'completed',
            class_b_practice_attendance: [{ status: 'present' }],
          },
          {
            id: 2,
            class_number: 2,
            scheduled_at: PAST,
            duration_min: 45,
            status: 'completed',
            class_b_practice_attendance: [{ status: 'late' }],
          },
          {
            id: 3,
            class_number: 3,
            scheduled_at: PAST,
            duration_min: 45,
            status: 'completed',
            class_b_practice_attendance: [{ status: 'absent' }],
          },
        ]),
      });
      await facade.initialize();
      expect(facade.practiceSessions().map((s) => s.status)).toEqual([
        'completed',
        'completed',
        'absent',
      ]);
    });

    it('cancelled e in_progress de la sesión mandan sobre la asistencia', async () => {
      const { facade } = setup({
        tables: classBTables([
          {
            id: 1,
            class_number: 1,
            scheduled_at: FUTURE,
            duration_min: 45,
            status: 'cancelled',
            class_b_practice_attendance: [{ status: 'present' }],
          },
          {
            id: 2,
            class_number: 2,
            scheduled_at: FUTURE,
            duration_min: 45,
            status: 'in_progress',
            class_b_practice_attendance: [],
          },
        ]),
      });
      await facade.initialize();
      expect(facade.practiceSessions().map((s) => s.status)).toEqual(['cancelled', 'in_progress']);
    });

    it('KPIs: completadas desde la vista de progreso y próximas = scheduled + in_progress', async () => {
      const { facade } = setup({
        tables: classBTables(
          [
            {
              id: 1,
              class_number: 1,
              scheduled_at: FUTURE,
              duration_min: 45,
              status: 'scheduled',
              class_b_practice_attendance: [],
            },
            {
              id: 2,
              class_number: 2,
              scheduled_at: FUTURE,
              duration_min: 45,
              status: 'in_progress',
              class_b_practice_attendance: [],
            },
            {
              id: 3,
              class_number: 3,
              scheduled_at: PAST,
              duration_min: 45,
              status: 'completed',
              class_b_practice_attendance: [{ status: 'present' }],
            },
          ],
          4,
        ),
      });
      await facade.initialize();
      expect(facade.kpis()).toEqual({
        completedPractices: 4,
        totalPractices: 12,
        scheduledUpcoming: 2,
        theoryPct: 0,
      });
    });

    it('classNumber cae al índice+1 cuando la BD no lo trae', async () => {
      const { facade } = setup({
        tables: classBTables([
          {
            id: 1,
            class_number: null,
            scheduled_at: FUTURE,
            duration_min: null,
            status: 'scheduled',
            class_b_practice_attendance: [],
          },
        ]),
      });
      await facade.initialize();
      expect(facade.practiceSessions()[0].classNumber).toBe(1);
      expect(facade.practiceSessions()[0].durationMin).toBe(45);
    });

    it('Refuerzo Clase B (spec 0006-m, AC2): totalPractices deriva de courses.practical_hours (4.5h → 6)', async () => {
      const { facade } = setup({
        tables: {
          enrollments: {
            data: {
              id: 100,
              license_group: 'class_b',
              student_id: 5,
              promotion_course_id: null,
              courses: { practical_hours: 4.5 },
            },
            error: null,
          },
          class_b_sessions: { data: [], error: null },
          v_student_progress_b: { data: { completed_practices: 3 }, error: null },
        },
      });
      await facade.initialize();
      expect(facade.kpis()?.totalPractices).toBe(6);
    });

    it('regresión AC-E1: sin practical_hours en el fixture, sigue usando 12', async () => {
      const { facade } = setup({ tables: classBTables([]) });
      await facade.initialize();
      expect(facade.kpis()?.totalPractices).toBe(12);
    });
  });

  describe('Profesional', () => {
    function profTables(theory: unknown[], practice: unknown[]): Record<string, TableResponse> {
      return {
        enrollments: {
          data: { id: 100, license_group: 'professional', student_id: 5, promotion_course_id: 33 },
          error: null,
        },
        professional_theory_attendance: { data: theory, error: null },
        professional_practice_attendance: { data: practice, error: null },
      };
    }

    it('sin promoción asignada → data vacía sin consultar asistencias', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          enrollments: {
            data: {
              id: 100,
              license_group: 'professional',
              student_id: 5,
              promotion_course_id: null,
            },
            error: null,
          },
        },
      });
      await facade.initialize();
      expect(facade.licenseGroup()).toBe('professional');
      expect(facade.profSessions()).toEqual([]);
      expect(mockSupabase.client.from).not.toHaveBeenCalledWith('professional_theory_attendance');
    });

    it('mezcla teoría y práctica ordenadas por fecha descendente', async () => {
      const { facade } = setup({
        tables: profTables(
          [{ status: 'present', professional_theory_sessions: { id: 1, date: '2026-06-01' } }],
          [{ status: 'present', professional_practice_sessions: { id: 2, date: '2026-06-15' } }],
        ),
      });
      await facade.initialize();
      expect(facade.profSessions().map((s) => s.id)).toEqual(['pp-2', 'pt-1']);
    });

    it('theoryPct redondea presentes+atrasados sobre el total de teoría', async () => {
      const { facade } = setup({
        tables: profTables(
          [
            { status: 'present', professional_theory_sessions: { id: 1, date: '2026-06-01' } },
            { status: 'late', professional_theory_sessions: { id: 2, date: '2026-06-02' } },
            { status: 'absent', professional_theory_sessions: { id: 3, date: '2026-06-03' } },
          ],
          [],
        ),
      });
      await facade.initialize();
      expect(facade.kpis()?.theoryPct).toBe(67); // 2/3 → 66.67 → 67
    });

    it('ignora asistencias con sesión nula (LEFT JOIN roto)', async () => {
      const { facade } = setup({
        tables: profTables([{ status: 'present', professional_theory_sessions: null }], []),
      });
      await facade.initialize();
      expect(facade.profSessions()).toEqual([]);
    });
  });

  describe('errores y SWR', () => {
    it('sin usuario autenticado → señal de error y sin skeleton colgado', async () => {
      const { facade } = setup({ tables: {}, dbId: null });
      await facade.initialize();
      expect(facade.error()).toBe('Usuario no autenticado');
      expect(facade.isLoading()).toBe(false);
    });

    it('sin matrícula activa → data null sin error', async () => {
      const { facade } = setup({ tables: {}, activeEnrollmentId: null });
      await facade.initialize();
      expect(facade.data()).toBeNull();
      expect(facade.error()).toBeNull();
    });
  });

  describe('Manejo explícito de errores de lectura (0060-b / DoD-F)', () => {
    it('Caso A: si falla enrollments en primera carga, data es null y error visible', async () => {
      const { facade } = setup({
        tables: {
          enrollments: { data: null, error: { message: 'db error' } },
        },
      });

      await facade.initialize();

      expect(facade.data()).toBeNull();
      expect(facade.kpis()).toBeNull();
      expect(facade.error()).toBe('No se pudieron cargar tus clases.');
      expect(facade.isLoading()).toBe(false);
      expect((facade as any)._initialized).toBe(false);
    });

    it('Caso A (Clase B): si falla v_student_progress_b en Promise.all, la carga entera falla', async () => {
      const { facade } = setup({
        tables: {
          enrollments: {
            data: { id: 100, license_group: 'class_b', student_id: 5, promotion_course_id: null },
            error: null,
          },
          class_b_sessions: { data: [], error: null },
          v_student_progress_b: { data: null, error: { message: 'view error' } },
        },
      });

      await facade.initialize();

      expect(facade.data()).toBeNull();
      expect(facade.kpis()).toBeNull();
      expect(facade.error()).toBe('No se pudieron cargar tus clases.');
    });

    it('Caso A (Profesional): si falla professional_practice_attendance en Promise.all, falla toda la carga', async () => {
      const { facade } = setup({
        tables: {
          enrollments: {
            data: {
              id: 100,
              license_group: 'professional',
              student_id: 5,
              promotion_course_id: 77,
            },
            error: null,
          },
          professional_theory_attendance: { data: [], error: null },
          professional_practice_attendance: { data: null, error: { message: 'practice err' } },
        },
      });

      await facade.initialize();

      expect(facade.data()).toBeNull();
      expect(facade.error()).toBe('No se pudieron cargar tus clases.');
    });

    it('Caso A (cambio de matrícula): limpia datos previos al empezar y expone error si falla', async () => {
      let currentId = 100;
      const tables = classBTables(
        [
          {
            id: 1,
            class_number: 1,
            scheduled_at: FUTURE,
            duration_min: 45,
            status: 'scheduled',
            class_b_practice_attendance: [],
          },
        ],
        1,
      );

      const mockSupabase = createMockSupabase(tables);
      const mockAuth = { currentUser: vi.fn(() => ({ dbId: 7 })) };
      const mockContext = {
        initialize: vi.fn().mockResolvedValue(undefined),
        activeEnrollmentId: vi.fn(() => currentId),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: AuthFacade, useValue: mockAuth },
          { provide: StudentEnrollmentContextFacade, useValue: mockContext },
        ],
      });
      const facade = TestBed.inject(StudentClasesFacade);

      await facade.initialize();
      expect(facade.practiceSessions().length).toBe(1);

      // Cambiar a otra matrícula que falla
      currentId = 200;
      mockSupabase.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'err 200' } }),
      });

      await facade.initialize();

      // Nunca debe seguir mostrando clases de la matrícula 100
      expect(facade.data()).toBeNull();
      expect(facade.practiceSessions()).toEqual([]);
      expect(facade.error()).toBe('No se pudieron cargar tus clases.');
    });

    it('Caso B: refresco que falla mantiene datos visibles y activa refreshFailed', async () => {
      const { facade, mockSupabase } = setup({
        tables: classBTables(
          [
            {
              id: 1,
              class_number: 1,
              scheduled_at: FUTURE,
              duration_min: 45,
              status: 'scheduled',
              class_b_practice_attendance: [],
            },
          ],
          1,
        ),
      });

      await facade.initialize();
      expect(facade.practiceSessions().length).toBe(1);
      expect(facade.refreshFailed()).toBe(false);

      // Falla en refresco posterior
      mockSupabase.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'temp err' } }),
      });

      await facade.initialize();

      expect(facade.practiceSessions().length).toBe(1);
      expect(facade.refreshFailed()).toBe(true);
      expect(facade.error()).toBeNull();
    });

    it('reintentar limpia el error y recarga con éxito', async () => {
      const { facade, mockSupabase } = setup({
        tables: {
          enrollments: { data: null, error: { message: 'db down' } },
        },
      });

      await facade.initialize();
      expect(facade.error()).toBe('No se pudieron cargar tus clases.');

      // Ahora reponemos datos exitosos
      const okTables = classBTables([], 2);
      mockSupabase.client.from = createMockSupabase(okTables).client.from;

      await facade.reintentar();

      expect(facade.error()).toBeNull();
      expect(facade.refreshFailed()).toBe(false);
      expect(facade.kpis()?.completedPractices).toBe(2);
    });

    it('Reintentar en caso B: con refreshFailed y datos visibles, un reintento que falla deja los datos intactos, isLoading nunca pasa a true y no aparece error() de caso A', async () => {
      const { facade, mockSupabase } = setup({
        tables: classBTables(
          [
            {
              id: 1,
              class_number: 1,
              scheduled_at: FUTURE,
              duration_min: 45,
              status: 'scheduled',
              class_b_practice_attendance: [],
            },
          ],
          1,
        ),
      });

      await facade.initialize();
      expect(facade.practiceSessions().length).toBe(1);

      mockSupabase.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'temp err' } }),
      });
      await facade.initialize();
      expect(facade.refreshFailed()).toBe(true);

      const observedLoading: boolean[] = [];
      mockSupabase.client.from = vi.fn().mockImplementation(() => {
        observedLoading.push(facade.isLoading());
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'retry err' } }),
        };
      });

      await facade.reintentar();

      expect(observedLoading.length).toBeGreaterThan(0);
      expect(observedLoading.every((v) => v === false)).toBe(true);
      expect(facade.isLoading()).toBe(false);
      expect(facade.practiceSessions().length).toBe(1);
      expect(facade.kpis()?.completedPractices).toBe(1);
      expect(facade.refreshFailed()).toBe(true);
      expect(facade.error()).toBeNull();
    });

    it('Reintentar en caso B: un reintento que funciona actualiza los datos y limpia refreshFailed', async () => {
      const { facade, mockSupabase } = setup({
        tables: classBTables(
          [
            {
              id: 1,
              class_number: 1,
              scheduled_at: FUTURE,
              duration_min: 45,
              status: 'scheduled',
              class_b_practice_attendance: [],
            },
          ],
          1,
        ),
      });

      await facade.initialize();

      mockSupabase.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'temp err' } }),
      });
      await facade.initialize();
      expect(facade.refreshFailed()).toBe(true);

      const observedLoading: boolean[] = [];
      const okFrom = createMockSupabase(
        classBTables(
          [
            {
              id: 1,
              class_number: 1,
              scheduled_at: FUTURE,
              duration_min: 45,
              status: 'scheduled',
              class_b_practice_attendance: [],
            },
            {
              id: 2,
              class_number: 2,
              scheduled_at: FUTURE,
              duration_min: 45,
              status: 'scheduled',
              class_b_practice_attendance: [],
            },
          ],
          2,
        ),
      ).client.from;

      mockSupabase.client.from = vi.fn().mockImplementation((table: string) => {
        observedLoading.push(facade.isLoading());
        return okFrom(table);
      });

      await facade.reintentar();

      expect(observedLoading.length).toBeGreaterThan(0);
      expect(observedLoading.every((v) => v === false)).toBe(true);
      expect(facade.isLoading()).toBe(false);
      expect(facade.practiceSessions().length).toBe(2);
      expect(facade.kpis()?.completedPractices).toBe(2);
      expect(facade.refreshFailed()).toBe(false);
      expect(facade.error()).toBeNull();
    });

    it('request guard descarta respuesta vieja fuera de orden', async () => {
      let currentId = 100;
      let resolveFirst: any;
      const firstPromise = new Promise((r) => {
        resolveFirst = r;
      });

      const mockSupabase = {
        client: {
          from: vi.fn().mockImplementation((table: string) => {
            if (currentId === 100 && table === 'enrollments') {
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockImplementation(() => firstPromise),
              };
            }
            const ok = classBTables([], 5)[table] ?? { data: null, error: null };
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue(ok),
              then: (res: any, rej: any) => Promise.resolve(ok).then(res, rej),
            };
          }),
        },
      };

      const mockContext = {
        initialize: vi.fn().mockResolvedValue(undefined),
        activeEnrollmentId: vi.fn(() => currentId),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: AuthFacade, useValue: { currentUser: vi.fn(() => ({ dbId: 7 })) } },
          { provide: StudentEnrollmentContextFacade, useValue: mockContext },
        ],
      });
      const facade = TestBed.inject(StudentClasesFacade);

      const p1 = facade.initialize();
      currentId = 200;
      const p2 = facade.initialize();

      await p2;
      expect(facade.kpis()?.completedPractices).toBe(5);

      resolveFirst({ data: null, error: { message: 'stale err' } });
      await p1;

      expect(facade.kpis()?.completedPractices).toBe(5);
      expect(facade.error()).toBeNull();
    });

    it('Lección 5: un refresco que pide token nuevo no deja isLoading pegado en true', async () => {
      let resolveFirst: any;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      let firstCall = true;
      const mockSupabase = {
        client: {
          from: vi.fn().mockImplementation((table: string) => {
            if (firstCall && table === 'enrollments') {
              firstCall = false;
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockImplementation(() => firstPromise),
              };
            }
            const ok = classBTables([], 3)[table] ?? { data: null, error: null };
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue(ok),
              then: (res: any, rej: any) => Promise.resolve(ok).then(res, rej),
            };
          }),
        },
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: AuthFacade, useValue: { currentUser: vi.fn(() => ({ dbId: 7 })) } },
          {
            provide: StudentEnrollmentContextFacade,
            useValue: {
              initialize: vi.fn().mockResolvedValue(undefined),
              activeEnrollmentId: vi.fn(() => 100),
            },
          },
        ],
      });
      const facade = TestBed.inject(StudentClasesFacade);

      const pInit = facade.initialize();
      const pRefresh = (facade as any).refreshSilently();
      resolveFirst({
        data: { id: 100, license_group: 'class_b', student_id: 5, promotion_course_id: null },
        error: null,
      });

      await Promise.all([pInit, pRefresh]);

      expect(facade.isLoading()).toBe(false);
    });
  });
});
