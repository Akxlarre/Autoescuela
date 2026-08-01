import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GlobalSearchFacade, buildAlumnoQuickActions } from './global-search.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { InstructoresFacade } from '@core/facades/instructores.facade';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeAlumno = (overrides: Record<string, string> = {}) => ({
  id: 'stu-1',
  nombre: 'Juan',
  apellido: 'García',
  rut: '12.345.678-9',
  status: 'Activo',
  ...overrides,
});

const makeInstructorStudent = (overrides: Record<string, unknown> = {}) => ({
  studentId: 1,
  enrollmentId: 10,
  name: 'Pedro Soto',
  rut: '11.111.111-1',
  statusLabel: 'Activo',
  ...overrides,
});

const makeInstructor = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  nombre: 'María López',
  rut: '9.999.999-9',
  ...overrides,
});

// ── Mocks ────────────────────────────────────────────────────────────────────

const currentUser$ = signal<{ role: string } | null>({ role: 'admin' });
const alumnos$ = signal<ReturnType<typeof makeAlumno>[]>([]);
const instructorStudents$ = signal<ReturnType<typeof makeInstructorStudent>[]>([]);
const instructores$ = signal<ReturnType<typeof makeInstructor>[]>([]);

const authMock = { currentUser: currentUser$.asReadonly() };
const adminAlumnosMock = {
  alumnos: alumnos$.asReadonly(),
  loadAlumnos: vi.fn().mockResolvedValue(undefined),
};
const instructorAlumnosMock = {
  students: instructorStudents$.asReadonly(),
  initialize: vi.fn().mockResolvedValue(undefined),
};
const instructoresMock = {
  instructores: instructores$.asReadonly(),
  initialize: vi.fn().mockResolvedValue(undefined),
};
const routerMock = { navigate: vi.fn().mockResolvedValue(true) };

// ── Suite ────────────────────────────────────────────────────────────────────

describe('GlobalSearchFacade', () => {
  let facade: GlobalSearchFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    currentUser$.set({ role: 'admin' });
    alumnos$.set([]);
    instructorStudents$.set([]);
    instructores$.set([]);

    TestBed.configureTestingModule({
      providers: [
        GlobalSearchFacade,
        { provide: AuthFacade, useValue: authMock },
        { provide: AdminAlumnosFacade, useValue: adminAlumnosMock },
        { provide: InstructorAlumnosFacade, useValue: instructorAlumnosMock },
        { provide: InstructoresFacade, useValue: instructoresMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    facade = TestBed.inject(GlobalSearchFacade);
  });

  // ── buildAlumnoQuickActions (pure function) ─────────────────────────────

  describe('buildAlumnoQuickActions', () => {
    const base = '/app/admin/alumnos';
    const prefix = '/app/admin';
    const id = 'abc-123';

    it('should return exactly 4 actions', () => {
      expect(buildAlumnoQuickActions(base, prefix, id)).toHaveLength(4);
    });

    it('should include view action pointing to student detail', () => {
      const actions = buildAlumnoQuickActions(base, prefix, id);
      const view = actions.find((a) => a.actionType === 'view')!;
      expect(view.route).toEqual([`${base}/${id}`]);
      expect(view.icon).toBe('user');
      expect(view.label).toBe('Ver Ficha');
    });

    it('should include payment action pointing to pagos', () => {
      const actions = buildAlumnoQuickActions(base, prefix, id);
      const pago = actions.find((a) => a.actionType === 'payment')!;
      expect(pago.route).toEqual([`${prefix}/pagos`]);
      expect(pago.icon).toBe('credit-card');
    });

    it('should include schedule action pointing to agenda', () => {
      const actions = buildAlumnoQuickActions(base, prefix, id);
      const sched = actions.find((a) => a.actionType === 'schedule')!;
      expect(sched.route).toEqual([`${prefix}/agenda`]);
      expect(sched.icon).toBe('calendar');
    });

    it('should include enrollment action pointing to matricula', () => {
      const actions = buildAlumnoQuickActions(base, prefix, id);
      const enroll = actions.find((a) => a.actionType === 'enrollment')!;
      expect(enroll.route).toEqual([`${prefix}/matricula`]);
      expect(enroll.icon).toBe('user-plus');
    });

    it('should use the given studentId in the view route', () => {
      const actions = buildAlumnoQuickActions(base, prefix, 'xyz-999');
      expect(actions[0].route[0]).toContain('xyz-999');
    });

    it('should return only "Ver Ficha" for role instructor', () => {
      const actions = buildAlumnoQuickActions(base, prefix, id, 'instructor');
      expect(actions).toHaveLength(1);
      expect(actions[0].actionType).toBe('view');
    });
  });

  // ── alumnoResults computed ──────────────────────────────────────────────

  describe('alumnoResults', () => {
    it('should return empty when query is empty', () => {
      facade.setQuery('');
      expect(facade.alumnoResults()).toEqual([]);
    });

    it('should return empty when query has only 1 character', () => {
      facade.setQuery('J');
      alumnos$.set([makeAlumno()]);
      expect(facade.alumnoResults()).toEqual([]);
    });

    it('should match by first name (case insensitive)', () => {
      alumnos$.set([makeAlumno({ nombre: 'PEDRO', apellido: 'Roa' })]);
      facade.setQuery('ped');
      expect(facade.alumnoResults()).toHaveLength(1);
      expect(facade.alumnoResults()[0].label).toBe('PEDRO Roa');
    });

    it('should match by last name (case insensitive)', () => {
      alumnos$.set([makeAlumno({ nombre: 'Ana', apellido: 'FERNÁNDEZ' })]);
      facade.setQuery('fern');
      expect(facade.alumnoResults()).toHaveLength(1);
    });

    it('should match by full name across spaces', () => {
      alumnos$.set([makeAlumno({ nombre: 'Juan', apellido: 'García' })]);
      facade.setQuery('juan ga');
      expect(facade.alumnoResults()).toHaveLength(1);
    });

    it('should match by RUT ignoring dots and dashes', () => {
      alumnos$.set([makeAlumno({ rut: '12.345.678-9' })]);
      facade.setQuery('123456789');
      expect(facade.alumnoResults()).toHaveLength(1);
    });

    it('should match by partial RUT', () => {
      alumnos$.set([makeAlumno({ rut: '12.345.678-9' })]);
      facade.setQuery('345');
      expect(facade.alumnoResults()).toHaveLength(1);
    });

    it('should not match when query does not fit name or RUT', () => {
      alumnos$.set([makeAlumno()]);
      facade.setQuery('xyz');
      expect(facade.alumnoResults()).toEqual([]);
    });

    it('should limit results to 5 alumnos', () => {
      const many = Array.from({ length: 10 }, (_, i) =>
        makeAlumno({ id: `s-${i}`, nombre: 'Juan', apellido: `Apellido${i}` }),
      );
      alumnos$.set(many);
      facade.setQuery('juan');
      expect(facade.alumnoResults()).toHaveLength(5);
    });

    it('should include 4 quickActions per result', () => {
      alumnos$.set([makeAlumno()]);
      facade.setQuery('juan');
      expect(facade.alumnoResults()[0].quickActions).toHaveLength(4);
    });

    it('should include view quickAction route that matches main route', () => {
      alumnos$.set([makeAlumno({ id: 'stu-42' })]);
      facade.setQuery('juan');
      const result = facade.alumnoResults()[0];
      const viewAction = result.quickActions.find((a) => a.actionType === 'view')!;
      expect(viewAction.route).toEqual(result.route);
    });

    it('should use role prefix from AuthFacade', () => {
      currentUser$.set({ role: 'secretaria' });
      alumnos$.set([makeAlumno({ id: 'stu-99' })]);
      facade.setQuery('juan');
      const result = facade.alumnoResults()[0];
      expect(result.route[0]).toContain('/app/secretaria/');
      const sched = result.quickActions.find((a) => a.actionType === 'schedule')!;
      expect(sched.route[0]).toContain('/app/secretaria/agenda');
    });

    it('should default to admin role when currentUser is null', () => {
      currentUser$.set(null);
      alumnos$.set([makeAlumno()]);
      facade.setQuery('juan');
      const result = facade.alumnoResults()[0];
      expect(result.route[0]).toContain('/app/admin/');
    });

    // ── Scope por rol (H-031 / ampliación cliente 2026-07-28) ─────────────

    it('instructor role: reads from InstructorAlumnosFacade, not AdminAlumnosFacade', () => {
      currentUser$.set({ role: 'instructor' });
      alumnos$.set([makeAlumno({ nombre: 'Otro', apellido: 'DeAdmin' })]);
      instructorStudents$.set([makeInstructorStudent({ name: 'Pedro Soto' })]);
      facade.setQuery('pedro');
      const results = facade.alumnoResults();
      expect(results).toHaveLength(1);
      expect(results[0].label).toBe('Pedro Soto');
    });

    it('instructor role: quickActions only include "Ver Ficha"', () => {
      currentUser$.set({ role: 'instructor' });
      instructorStudents$.set([makeInstructorStudent()]);
      facade.setQuery('pedro');
      const result = facade.alumnoResults()[0];
      expect(result.quickActions).toHaveLength(1);
      expect(result.quickActions[0].actionType).toBe('view');
    });

    it('instructor role: route points to /app/instructor/alumnos/:id', () => {
      currentUser$.set({ role: 'instructor' });
      instructorStudents$.set([makeInstructorStudent({ studentId: 7 })]);
      facade.setQuery('pedro');
      const result = facade.alumnoResults()[0];
      expect(result.route).toEqual(['/app/instructor/alumnos/7']);
    });

    it('alumno role: never returns alumno results, regardless of AdminAlumnosFacade data', () => {
      currentUser$.set({ role: 'alumno' });
      alumnos$.set([makeAlumno()]);
      facade.setQuery('juan');
      expect(facade.alumnoResults()).toEqual([]);
    });
  });

  // ── instructorResults computed ───────────────────────────────────────────

  describe('instructorResults', () => {
    it('should return empty when query is empty', () => {
      facade.setQuery('');
      expect(facade.instructorResults()).toEqual([]);
    });

    it('admin role: matches instructors by name', () => {
      instructores$.set([makeInstructor({ nombre: 'María López' })]);
      facade.setQuery('maría');
      expect(facade.instructorResults()).toHaveLength(1);
      expect(facade.instructorResults()[0].label).toBe('María López');
    });

    it('admin role: matches instructors by RUT ignoring dots/dashes', () => {
      instructores$.set([makeInstructor({ rut: '9.999.999-9' })]);
      facade.setQuery('99999999');
      expect(facade.instructorResults()).toHaveLength(1);
    });

    it('admin role: result route points to the instructores list', () => {
      instructores$.set([makeInstructor()]);
      facade.setQuery('maría');
      expect(facade.instructorResults()[0].route).toEqual(['/app/admin/instructores']);
    });

    it('secretaria role: uses secretaria route prefix', () => {
      currentUser$.set({ role: 'secretaria' });
      instructores$.set([makeInstructor()]);
      facade.setQuery('maría');
      expect(facade.instructorResults()[0].route).toEqual(['/app/secretaria/instructores']);
    });

    it('instructor role: never returns instructor results', () => {
      currentUser$.set({ role: 'instructor' });
      instructores$.set([makeInstructor()]);
      facade.setQuery('maría');
      expect(facade.instructorResults()).toEqual([]);
    });

    it('alumno role: never returns instructor results', () => {
      currentUser$.set({ role: 'alumno' });
      instructores$.set([makeInstructor()]);
      facade.setQuery('maría');
      expect(facade.instructorResults()).toEqual([]);
    });
  });

  // ── actionResults computed ──────────────────────────────────────────────

  describe('actionResults', () => {
    it('should return empty when query is empty', () => {
      facade.setQuery('');
      expect(facade.actionResults()).toEqual([]);
    });

    it('should match agenda keywords', () => {
      facade.setQuery('agenda');
      const results = facade.actionResults();
      expect(results.some((r) => r.id === 'agenda')).toBe(true);
    });

    it('should match pagos keywords', () => {
      facade.setQuery('pagos');
      const results = facade.actionResults();
      expect(results.some((r) => r.id === 'pagos')).toBe(true);
    });

    it('should build route with role prefix', () => {
      currentUser$.set({ role: 'admin' });
      facade.setQuery('agenda');
      const results = facade.actionResults();
      const agenda = results.find((r) => r.id === 'agenda')!;
      expect(agenda.route[0]).toBe('/app/admin/agenda');
    });
  });

  // ── groups computed ─────────────────────────────────────────────────────

  describe('groups', () => {
    it('should return empty array when no results', () => {
      facade.setQuery('');
      expect(facade.groups()).toEqual([]);
    });

    it('should include alumnos group when students match', () => {
      alumnos$.set([makeAlumno()]);
      facade.setQuery('juan');
      const groups = facade.groups();
      expect(groups.some((g) => g.label === 'Alumnos encontrados')).toBe(true);
    });

    it('should include instructores group when instructors match', () => {
      instructores$.set([makeInstructor()]);
      facade.setQuery('maría');
      const groups = facade.groups();
      expect(groups.some((g) => g.label === 'Instructores encontrados')).toBe(true);
    });

    it('should include actions group when keywords match', () => {
      facade.setQuery('agenda');
      const groups = facade.groups();
      expect(groups.some((g) => g.label === 'Acciones sugeridas')).toBe(true);
    });
  });

  // ── hasResults / tooShortForAlumnos ────────────────────────────────────

  describe('hasResults', () => {
    it('should be false when query is empty', () => {
      facade.setQuery('');
      expect(facade.hasResults()).toBe(false);
    });

    it('should be true when there are matching results', () => {
      alumnos$.set([makeAlumno()]);
      facade.setQuery('juan');
      expect(facade.hasResults()).toBe(true);
    });
  });

  describe('tooShortForAlumnos', () => {
    it('should be true when query has exactly 1 char', () => {
      facade.setQuery('j');
      expect(facade.tooShortForAlumnos()).toBe(true);
    });

    it('should be false when query is empty', () => {
      facade.setQuery('');
      expect(facade.tooShortForAlumnos()).toBe(false);
    });

    it('should be false when query has 2+ chars', () => {
      facade.setQuery('ju');
      expect(facade.tooShortForAlumnos()).toBe(false);
    });
  });

  // ── loadBusinessData (H-031 root cause) ──────────────────────────────────

  describe('business data loading', () => {
    it('admin role: triggers AdminAlumnosFacade.loadAlumnos() and InstructoresFacade.initialize() once query reaches 2 chars', () => {
      facade.setQuery('ju');
      expect(adminAlumnosMock.loadAlumnos).toHaveBeenCalledTimes(1);
      expect(instructoresMock.initialize).toHaveBeenCalledTimes(1);
      expect(instructorAlumnosMock.initialize).not.toHaveBeenCalled();
    });

    it('instructor role: triggers InstructorAlumnosFacade.initialize() only', () => {
      currentUser$.set({ role: 'instructor' });
      facade.setQuery('pe');
      expect(instructorAlumnosMock.initialize).toHaveBeenCalledTimes(1);
      expect(adminAlumnosMock.loadAlumnos).not.toHaveBeenCalled();
      expect(instructoresMock.initialize).not.toHaveBeenCalled();
    });

    it('does not re-trigger on every keystroke while the panel stays open', () => {
      facade.setQuery('j');
      facade.setQuery('ju');
      facade.setQuery('jua');
      facade.setQuery('juan');
      expect(adminAlumnosMock.loadAlumnos).toHaveBeenCalledTimes(1);
    });

    it('re-triggers after reset() (panel closed and reopened)', () => {
      facade.setQuery('ju');
      facade.reset();
      facade.setQuery('ju');
      expect(adminAlumnosMock.loadAlumnos).toHaveBeenCalledTimes(2);
    });

    it('alumno role: does not trigger any business data load', () => {
      currentUser$.set({ role: 'alumno' });
      facade.setQuery('ju');
      expect(adminAlumnosMock.loadAlumnos).not.toHaveBeenCalled();
      expect(instructoresMock.initialize).not.toHaveBeenCalled();
      expect(instructorAlumnosMock.initialize).not.toHaveBeenCalled();
    });
  });

  // ── navigate ───────────────────────────────────────────────────────────

  describe('navigate', () => {
    it('should call router.navigate with result.route', () => {
      const result = {
        type: 'action' as const,
        id: 'test',
        label: 'Test',
        description: '',
        icon: 'test',
        route: ['/app/admin/agenda'],
      };
      facade.navigate(result);
      expect(routerMock.navigate).toHaveBeenCalledWith(['/app/admin/agenda']);
    });
  });

  // ── reset ──────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('should clear the query signal', () => {
      facade.setQuery('juan');
      facade.reset();
      expect(facade.query()).toBe('');
    });
  });
});
