import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ArchivoFacade } from './archivo-profesional.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

type TableResponse = { data: unknown; error: unknown };

function createMockSupabase(tables: Record<string, TableResponse>) {
  const builders = new Map<string, any>();
  const from = vi.fn().mockImplementation((table: string) => {
    if (!builders.has(table)) {
      const res = tables[table] ?? { data: [], error: null };
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: any, reject: any) => Promise.resolve(res).then(resolve, reject),
      };
      builders.set(table, builder);
    }
    return builders.get(table);
  });
  return { client: { from }, _builders: builders };
}

function setup(tables: Record<string, TableResponse> = {}) {
  const mockSupabase = createMockSupabase(tables);
  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: mockSupabase },
      {
        provide: AuthFacade,
        useValue: {
          currentUser: vi.fn(() => ({
            role: 'admin',
            branchId: null,
            canAccessBothBranches: false,
          })),
        },
      },
      { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });
  return { facade: TestBed.inject(ArchivoFacade), mockSupabase };
}

function enrollment(id: number, nombre: Partial<Record<string, string>> = {}) {
  return {
    id,
    branch_id: 1,
    students: {
      id: id * 10,
      users: {
        first_names: nombre['first'] ?? 'Ana María',
        paternal_last_name: nombre['pat'] ?? 'Pérez',
        maternal_last_name: nombre['mat'] ?? 'Soto',
        rut: '12345678-5',
      },
    },
  };
}

/** 7 notas iguales para todos los módulos del enrollment. */
function gradesFor(enrollmentId: number, grade: number) {
  return Array.from({ length: 7 }, (_, i) => ({
    enrollment_id: enrollmentId,
    module_number: i + 1,
    grade,
    passed: grade >= 75,
  }));
}

describe('ArchivoFacade (archivo profesional)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('mapea promociones finalizadas con label "code — name"', async () => {
    const { facade } = setup({
      professional_promotions: {
        data: [
          {
            id: 1,
            name: 'Otoño 2026',
            code: 'P-2026-1',
            start_date: '2026-03-01',
            end_date: '2026-06-30',
            status: 'finished',
          },
        ],
        error: null,
      },
    });
    await facade.initialize();
    expect(facade.promociones()[0].label).toBe('P-2026-1 — Otoño 2026');
  });

  it('selectPromocion limpia curso y alumnos anteriores (cascada)', async () => {
    const { facade } = setup({
      promotion_courses: {
        data: [{ id: 5, courses: { name: 'Camiones', license_class: 'A4' } }],
        error: null,
      },
    });
    await facade.selectPromocion(1);
    expect(facade.cursos()[0].label).toBe('Camiones (A4)');
    expect(facade.selectedCursoId()).toBeNull();
    expect(facade.alumnos()).toEqual([]);
    await facade.selectPromocion(null);
    expect(facade.cursos()).toEqual([]);
  });

  describe('regla de aprobación (teoría ≥75% Y promedio ≥75)', () => {
    function alumnosTables(opts: {
      theorySessions: number;
      presentTheory: number;
      grade: number;
    }): Record<string, TableResponse> {
      const theoryIds = Array.from({ length: opts.theorySessions }, (_, i) => ({ id: i + 1 }));
      const theoryAtt = Array.from({ length: opts.presentTheory }, () => ({
        enrollment_id: 1,
        status: 'present',
      }));
      return {
        enrollments: { data: [enrollment(1)], error: null },
        professional_theory_sessions: { data: theoryIds, error: null },
        professional_practice_sessions: { data: [{ id: 90 }], error: null },
        professional_theory_attendance: { data: theoryAtt, error: null },
        professional_practice_attendance: { data: [], error: null },
        professional_module_grades: { data: gradesFor(1, opts.grade), error: null },
      };
    }

    it('teoría 100% + promedio 80 → aprobado', async () => {
      const { facade } = setup(alumnosTables({ theorySessions: 4, presentTheory: 4, grade: 80 }));
      await facade.selectCurso(5);
      const alumno = facade.alumnos()[0];
      expect(alumno.pctTeoria).toBe(100);
      expect(alumno.notaPromedio).toBe(80);
      expect(alumno.aprobado).toBe(true);
    });

    it('teoría 50% + promedio 80 → reprobado (asistencia insuficiente)', async () => {
      const { facade } = setup(alumnosTables({ theorySessions: 4, presentTheory: 2, grade: 80 }));
      await facade.selectCurso(5);
      expect(facade.alumnos()[0].pctTeoria).toBe(50);
      expect(facade.alumnos()[0].aprobado).toBe(false);
    });

    it('teoría 100% + promedio 70 → reprobado (nota bajo el corte 75)', async () => {
      const { facade } = setup(alumnosTables({ theorySessions: 4, presentTheory: 4, grade: 70 }));
      await facade.selectCurso(5);
      expect(facade.alumnos()[0].promedioAprobado).toBe(false);
      expect(facade.alumnos()[0].aprobado).toBe(false);
    });

    it('sin sesiones de teoría → pctTeoria null y no aprobado', async () => {
      const { facade } = setup({
        enrollments: { data: [enrollment(1)], error: null },
        professional_theory_sessions: { data: [], error: null },
        professional_practice_sessions: { data: [], error: null },
        professional_module_grades: { data: gradesFor(1, 90), error: null },
      });
      await facade.selectCurso(5);
      expect(facade.alumnos()[0].pctTeoria).toBeNull();
      expect(facade.alumnos()[0].aprobado).toBe(false);
    });
  });

  it('nombre "Paterno Materno Nombres", iniciales de 2 palabras y notas de 7 módulos', async () => {
    const { facade } = setup({
      enrollments: {
        data: [enrollment(1, { pat: 'García', mat: 'Luna', first: 'Pedro' })],
        error: null,
      },
      professional_theory_sessions: { data: [], error: null },
      professional_practice_sessions: { data: [], error: null },
      professional_module_grades: { data: [], error: null },
    });
    await facade.selectCurso(5);
    const alumno = facade.alumnos()[0];
    expect(alumno.nombre).toBe('García Luna Pedro');
    expect(alumno.initials).toBe('GL');
    expect(alumno.notas).toHaveLength(7);
    expect(alumno.notaPromedio).toBeNull(); // sin notas registradas
  });

  it('KPIs: cuenta aprobados/reprobados y redondea el % de aprobación', async () => {
    const { facade } = setup({
      enrollments: {
        data: [enrollment(1), enrollment(2, { pat: 'Zúñiga' }), enrollment(3, { pat: 'Araya' })],
        error: null,
      },
      professional_theory_sessions: { data: [{ id: 1 }], error: null },
      professional_practice_sessions: { data: [], error: null },
      professional_theory_attendance: {
        // solo el enrollment 1 asistió
        data: [{ enrollment_id: 1, status: 'present' }],
        error: null,
      },
      professional_practice_attendance: { data: [], error: null },
      professional_module_grades: {
        data: [...gradesFor(1, 90), ...gradesFor(2, 90), ...gradesFor(3, 90)],
        error: null,
      },
    });
    await facade.selectCurso(5);
    expect(facade.kpis()).toEqual({
      totalAlumnos: 3,
      aprobados: 1,
      reprobados: 2,
      pctAprobacion: 33,
    });
  });
});
