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
});
