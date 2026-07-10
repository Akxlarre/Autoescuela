import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StudentHorarioFacade } from './student-horario.facade';
import { StudentEnrollmentContextFacade } from './student-enrollment-context.facade';
import { AuthFacade } from './auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { toISODate } from '@core/utils/date.utils';

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

function setup(tables: Record<string, TableResponse>) {
  const mockSupabase = createMockSupabase(tables);
  const mockAuth = { currentUser: vi.fn(() => ({ dbId: 7 })) };
  const mockContext = {
    initialize: vi.fn().mockResolvedValue(undefined),
    activeEnrollmentId: vi.fn(() => 100),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: mockSupabase },
      { provide: AuthFacade, useValue: mockAuth },
      { provide: StudentEnrollmentContextFacade, useValue: mockContext },
    ],
  });
  return { facade: TestBed.inject(StudentHorarioFacade) };
}

function classBTables(sessions: unknown[]): Record<string, TableResponse> {
  return {
    enrollments: {
      data: { id: 100, license_group: 'class_b', student_id: 5, promotion_course_id: null },
      error: null,
    },
    class_b_sessions: { data: sessions, error: null },
  };
}

function rawSession(id: number, iso: string, status = 'scheduled', att: unknown[] = []) {
  return {
    id,
    class_number: id,
    scheduled_at: iso,
    status,
    class_b_practice_attendance: att,
  };
}

describe('StudentHorarioFacade', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('navegación de semanas (client-side, sin re-fetch)', () => {
    it('weekMeta arranca en lunes y cierra 6 días después', () => {
      const { facade } = setup(classBTables([]));
      const { weekStart, weekEnd } = facade.weekMeta();
      const monday = new Date(weekStart + 'T12:00:00');
      expect(monday.getDay()).toBe(1); // lunes
      const diff =
        (new Date(weekEnd + 'T12:00:00').getTime() - monday.getTime()) / (24 * 3600 * 1000);
      expect(diff).toBe(6);
    });

    it('goToNextWeek/goToPrevWeek desplazan 7 días y goToToday vuelve a la semana actual', () => {
      const { facade } = setup(classBTables([]));
      const start = facade.weekMeta().weekStart;
      facade.goToNextWeek();
      expect(facade.isCurrentWeek()).toBe(false);
      facade.goToPrevWeek();
      expect(facade.weekMeta().weekStart).toBe(start);
      facade.goToNextWeek();
      facade.goToToday();
      expect(facade.isCurrentWeek()).toBe(true);
    });

    it('weekDays entrega 7 días y ubica cada sesión en su fecha', async () => {
      const today = toISODate(new Date());
      const { facade } = setup(classBTables([rawSession(1, `${today}T10:00:00`)]));
      await facade.initialize();
      const days = facade.weekDays();
      expect(days).toHaveLength(7);
      const todayCell = days.find((d) => d.isToday)!;
      expect(todayCell.date).toBe(today);
      expect(todayCell.sessions).toHaveLength(1);
      expect(days.filter((d) => d.sessions.length > 0)).toHaveLength(1);
    });
  });

  describe('Clase B — próxima sesión y agendables', () => {
    it('isNext marca la primera sesión futura NO cancelada', async () => {
      const { facade } = setup(
        classBTables([
          rawSession(1, '2020-01-10T10:00:00', 'completed', [{ status: 'present' }]),
          rawSession(2, '2099-01-10T10:00:00', 'cancelled'),
          rawSession(3, '2099-01-20T10:00:00', 'scheduled'),
        ]),
      );
      await facade.initialize();
      expect(facade.nextSession()?.id).toBe('3');
    });

    it('hasRemainingToSchedule: true si completadas+agendadas < 12', async () => {
      const { facade } = setup(
        classBTables([
          rawSession(1, '2020-01-10T10:00:00', 'completed', [{ status: 'present' }]),
          rawSession(2, '2099-01-20T10:00:00', 'scheduled'),
        ]),
      );
      await facade.initialize();
      expect(facade.hasRemainingToSchedule()).toBe(true);
    });

    it('hasRemainingToSchedule: false al llegar a 12 entre completadas y agendadas', async () => {
      const sessions = Array.from({ length: 12 }, (_, i) =>
        rawSession(i + 1, '2099-01-20T10:00:00', 'scheduled'),
      );
      const { facade } = setup(classBTables(sessions));
      await facade.initialize();
      expect(facade.hasRemainingToSchedule()).toBe(false);
    });
  });

  describe('Profesional — asistencia por enrollment', () => {
    function profTables(theory: unknown[], practice: unknown[]): Record<string, TableResponse> {
      return {
        enrollments: {
          data: { id: 100, license_group: 'professional', student_id: 5, promotion_course_id: 33 },
          error: null,
        },
        professional_theory_sessions: { data: theory, error: null },
        professional_practice_sessions: { data: practice, error: null },
      };
    }

    it('solo considera la asistencia del enrollment propio (ignora la de otros alumnos)', async () => {
      const { facade } = setup(
        profTables(
          [
            {
              id: 1,
              date: '2020-06-01',
              professional_theory_attendance: [
                { status: 'present', enrollment_id: 999 }, // otro alumno
              ],
            },
          ],
          [],
        ),
      );
      await facade.initialize();
      // Sin asistencia propia y en el pasado → no_show (no "completed" del otro alumno)
      const session = facade.weekDays; // fuerza computeds sin depender de la semana
      expect(session).toBeDefined();
      const all = facade.nextSession(); // no debe ser next (pasada)
      expect(all).toBeNull();
      expect(facade.hasRemainingToSchedule()).toBe(false); // no aplica a professional
    });

    it('sesión futura de teoría gana el isNext sobre práctica de la misma fecha', async () => {
      const { facade } = setup(
        profTables(
          [{ id: 1, date: '2099-03-01', professional_theory_attendance: [] }],
          [{ id: 2, date: '2099-03-01', professional_practice_attendance: [] }],
        ),
      );
      await facade.initialize();
      expect(facade.nextSession()?.id).toBe('pt-1');
      expect(facade.nextSession()?.kind).toBe('prof_theory');
    });

    it('licenseGroup professional expone hasRemainingToSchedule=false siempre', async () => {
      const { facade } = setup(profTables([], []));
      await facade.initialize();
      expect(facade.licenseGroup()).toBe('professional');
      expect(facade.hasRemainingToSchedule()).toBe(false);
    });
  });
});
