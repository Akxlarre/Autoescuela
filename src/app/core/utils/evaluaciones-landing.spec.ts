import { describe, expect, it } from 'vitest';
import {
  buildCursoResumen,
  buildLanding,
  cursoPromedioAprueba,
  type CourseLite,
  type EnrollmentLite,
  type GradeLite,
  type PromotionLite,
} from './evaluaciones-landing';
import { MODULE_COUNT } from './professional-modules';

function course(promotionCourseId: number, promotionId: number, code: string): CourseLite {
  return { promotionCourseId, promotionId, courseCode: code, courseName: `Profesional ${code}` };
}

function enrollmentsFor(promotionCourseId: number, ids: number[]): EnrollmentLite[] {
  return ids.map((id) => ({ id, promotionCourseId }));
}

/** Genera N notas para un alumno con un valor dado y estado. */
function gradesFor(
  enrollmentId: number,
  count: number,
  grade: number,
  status: 'draft' | 'confirmed' = 'draft',
): GradeLite[] {
  return Array.from({ length: count }, () => ({ enrollmentId, grade, status }));
}

describe('buildCursoResumen', () => {
  it('estado sin_iniciar cuando no hay notas', () => {
    const r = buildCursoResumen(course(1, 9, 'A2'), enrollmentsFor(1, [101, 102]), []);
    expect(r.estado).toBe('sin_iniciar');
    expect(r.totalAlumnos).toBe(2);
    expect(r.alumnosConNotas).toBe(0);
    expect(r.promedio).toBeNull();
  });

  it('estado en_edicion cuando hay notas draft pero ninguna confirmada', () => {
    const grades = gradesFor(101, 3, 80, 'draft');
    const r = buildCursoResumen(course(1, 9, 'A2'), enrollmentsFor(1, [101, 102]), grades);
    expect(r.estado).toBe('en_edicion');
    expect(r.alumnosConNotas).toBe(1);
  });

  it('estado confirmada cuando al menos una nota está confirmada', () => {
    const grades = [...gradesFor(101, 7, 80, 'confirmed')];
    const r = buildCursoResumen(course(1, 9, 'A2'), enrollmentsFor(1, [101]), grades);
    expect(r.estado).toBe('confirmada');
  });

  it('cuenta alumnos completos (7 notas) vs con notas parciales', () => {
    const grades = [...gradesFor(101, MODULE_COUNT, 80), ...gradesFor(102, 3, 70)];
    const r = buildCursoResumen(course(1, 9, 'A2'), enrollmentsFor(1, [101, 102, 103]), grades);
    expect(r.totalAlumnos).toBe(3);
    expect(r.alumnosConNotas).toBe(2);
    expect(r.alumnosCompletos).toBe(1);
  });

  it('promedio = media de promedios individuales, redondeado a 1 decimal', () => {
    // Alumno 101 promedia 80, alumno 102 promedia 75 → (80+75)/2 = 77.5
    const grades = [...gradesFor(101, 2, 80), ...gradesFor(102, 2, 75)];
    const r = buildCursoResumen(course(1, 9, 'A2'), enrollmentsFor(1, [101, 102]), grades);
    expect(r.promedio).toBe(77.5);
  });

  it('ignora notas de matrículas que no pertenecen al curso', () => {
    const grades = [...gradesFor(999, 7, 90)]; // 999 no está matriculado
    const r = buildCursoResumen(course(1, 9, 'A2'), enrollmentsFor(1, [101]), grades);
    expect(r.alumnosConNotas).toBe(0);
    expect(r.estado).toBe('sin_iniciar');
  });
});

describe('buildLanding', () => {
  const promos: PromotionLite[] = [
    { id: 9, name: 'Promo Junio', code: 'P9', status: 'in_progress' },
    { id: 10, name: 'Promo Agosto', code: 'P10', status: 'planned' },
  ];
  const courses: CourseLite[] = [course(1, 9, 'A2'), course(2, 9, 'A3'), course(3, 10, 'A2')];
  const enrollments: EnrollmentLite[] = [
    ...enrollmentsFor(1, [101, 102]),
    ...enrollmentsFor(2, [201]),
    ...enrollmentsFor(3, [301, 302, 303]),
  ];
  const grades: GradeLite[] = [
    ...gradesFor(101, MODULE_COUNT, 80, 'confirmed'), // curso 1 confirmado
    ...gradesFor(201, 2, 60, 'draft'), // curso 2 en edición
  ];

  it('arma un grupo por promoción preservando el orden', () => {
    const landing = buildLanding(promos, courses, enrollments, grades);
    expect(landing.map((p) => p.id)).toEqual([9, 10]);
  });

  it('anida los cursos correctos bajo cada promoción', () => {
    const landing = buildLanding(promos, courses, enrollments, grades);
    expect(landing[0].cursos.map((c) => c.courseCode)).toEqual(['A2', 'A3']);
    expect(landing[1].cursos.map((c) => c.courseCode)).toEqual(['A2']);
  });

  it('calcula totales de la promoción (alumnos + cursos confirmados)', () => {
    const landing = buildLanding(promos, courses, enrollments, grades);
    // Promo 9: curso1 (2 alumnos) + curso2 (1) = 3 alumnos, 1 confirmado
    expect(landing[0].totalAlumnos).toBe(3);
    expect(landing[0].cursosConfirmados).toBe(1);
    // Promo 10: curso3 (3 alumnos), 0 confirmados
    expect(landing[1].totalAlumnos).toBe(3);
    expect(landing[1].cursosConfirmados).toBe(0);
  });

  it('promoción sin cursos → grupo vacío con totales en cero', () => {
    const landing = buildLanding(
      [{ id: 50, name: 'Vacía', code: 'V', status: 'planned' }],
      [],
      [],
      [],
    );
    expect(landing[0].cursos).toEqual([]);
    expect(landing[0].totalAlumnos).toBe(0);
  });

  it('cero promociones → aterrizaje vacío', () => {
    expect(buildLanding([], courses, enrollments, grades)).toEqual([]);
  });
});

describe('cursoPromedioAprueba', () => {
  it('null cuando no hay promedio', () => {
    const r = buildCursoResumen(course(1, 9, 'A2'), enrollmentsFor(1, [101]), []);
    expect(cursoPromedioAprueba(r)).toBeNull();
  });

  it('true si promedio >= 75, false si menor', () => {
    const aprob = buildCursoResumen(
      course(1, 9, 'A2'),
      enrollmentsFor(1, [101]),
      gradesFor(101, 1, 80),
    );
    const repro = buildCursoResumen(
      course(2, 9, 'A3'),
      enrollmentsFor(2, [201]),
      gradesFor(201, 1, 60),
    );
    expect(cursoPromedioAprueba(aprob)).toBe(true);
    expect(cursoPromedioAprueba(repro)).toBe(false);
  });
});
