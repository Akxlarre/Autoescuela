import { describe, expect, it } from 'vitest';
import { computeGradebookStats, countModulosCompletos, isFilaCompleta } from './gradebook-stats';
import { MODULE_COUNT } from './professional-modules';
import type {
  CeldaNota,
  FilaEvaluacion,
  GrillaEvaluacion,
} from '@core/models/ui/evaluaciones-profesional.model';

/** Helper: construye una celda con una nota dada (o null). */
function celda(grade: number | null): CeldaNota {
  return {
    grade,
    passed: grade === null ? null : grade >= 75,
    status: 'draft',
    gradeId: null,
    dirty: false,
  };
}

/** Helper: construye una fila con un patrón de notas y promedio derivado. */
function fila(enrollmentId: number, nombre: string, grades: (number | null)[]): FilaEvaluacion {
  const notas = grades.map(celda);
  const valid = grades.filter((g): g is number => g !== null);
  const promedio =
    valid.length > 0
      ? Math.round((valid.reduce((s, g) => s + g, 0) / valid.length) * 10) / 10
      : null;
  return {
    enrollmentId,
    nombre,
    rut: '11.111.111-1',
    initials: 'XX',
    notas,
    promedio,
    promedioAprobado: promedio === null ? null : promedio >= 75,
  };
}

function grilla(filas: FilaEvaluacion[]): GrillaEvaluacion {
  return {
    promotionCourseId: 1,
    promotionName: 'Promo Test',
    courseName: 'Profesional A2',
    licenseClass: 'A2',
    moduleNames: Array.from({ length: MODULE_COUNT }, (_, i) => `Módulo ${i + 1}`),
    totalAlumnos: filas.length,
    filas,
    confirmed: false,
  };
}

const ALL = (g: number | null) => Array.from({ length: MODULE_COUNT }, () => g);

describe('countModulosCompletos', () => {
  it('cuenta solo los módulos con nota registrada', () => {
    const f = fila(1, 'Ana', [80, 75, null, 90, null, null, null]);
    expect(countModulosCompletos(f)).toBe(3);
  });

  it('retorna 0 cuando no hay ninguna nota', () => {
    expect(countModulosCompletos(fila(1, 'Ana', ALL(null)))).toBe(0);
  });

  it('retorna MODULE_COUNT cuando todas están registradas', () => {
    expect(countModulosCompletos(fila(1, 'Ana', ALL(80)))).toBe(MODULE_COUNT);
  });
});

describe('isFilaCompleta', () => {
  it('es true solo si todas las notas están registradas', () => {
    expect(isFilaCompleta(fila(1, 'Ana', ALL(80)))).toBe(true);
  });

  it('es false si falta al menos una nota', () => {
    const grades = ALL(80);
    grades[3] = null;
    expect(isFilaCompleta(fila(1, 'Ana', grades))).toBe(false);
  });

  it('es false si la fila no tiene notas', () => {
    expect(isFilaCompleta(fila(1, 'Ana', []))).toBe(false);
  });
});

describe('computeGradebookStats', () => {
  it('retorna valores seguros para grilla null', () => {
    const stats = computeGradebookStats(null);
    expect(stats).toEqual({
      alumnosCompletos: 0,
      totalAlumnos: 0,
      promedioCurso: null,
      enRiesgo: 0,
      modulosCargados: 0,
    });
  });

  it('cuenta alumnos completos correctamente', () => {
    const g = grilla([
      fila(1, 'Ana', ALL(80)), // completa
      fila(2, 'Beto', [80, 80, null, 80, 80, 80, 80]), // incompleta
      fila(3, 'Caro', ALL(76)), // completa
    ]);
    expect(computeGradebookStats(g).alumnosCompletos).toBe(2);
  });

  it('calcula el promedio del curso como media de promedios individuales no nulos', () => {
    const g = grilla([
      fila(1, 'Ana', ALL(80)), // prom 80
      fila(2, 'Beto', ALL(90)), // prom 90
      fila(3, 'Sin notas', ALL(null)), // prom null → ignorado
    ]);
    // (80 + 90) / 2 = 85
    expect(computeGradebookStats(g).promedioCurso).toBe(85);
  });

  it('promedio del curso es null si ningún alumno tiene notas', () => {
    const g = grilla([fila(1, 'Ana', ALL(null)), fila(2, 'Beto', ALL(null))]);
    expect(computeGradebookStats(g).promedioCurso).toBeNull();
  });

  it('cuenta alumnos en riesgo (promedio < 75)', () => {
    const g = grilla([
      fila(1, 'Ana', ALL(80)), // aprueba
      fila(2, 'Beto', ALL(60)), // riesgo
      fila(3, 'Caro', ALL(74)), // riesgo
      fila(4, 'Sin notas', ALL(null)), // sin promedio → no cuenta
    ]);
    expect(computeGradebookStats(g).enRiesgo).toBe(2);
  });

  it('cuenta módulos cargados (al menos una nota en la columna)', () => {
    const g = grilla([
      fila(1, 'Ana', [80, null, null, null, null, null, null]),
      fila(2, 'Beto', [null, 70, 90, null, null, null, null]),
    ]);
    // columnas con datos: 1, 2, 3 → 3
    expect(computeGradebookStats(g).modulosCargados).toBe(3);
  });

  it('redondea el promedio del curso a un decimal', () => {
    const g = grilla([
      fila(1, 'Ana', ALL(80)), // 80
      fila(2, 'Beto', ALL(75)), // 75
    ]);
    // (80 + 75) / 2 = 77.5
    expect(computeGradebookStats(g).promedioCurso).toBe(77.5);
  });
});
