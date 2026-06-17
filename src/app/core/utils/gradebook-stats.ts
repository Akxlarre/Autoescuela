/**
 * Functional Core de la grilla de evaluaciones profesionales.
 *
 * Funciones puras (Data In → Data Out) que derivan métricas de instrumentación
 * para el gradebook a partir de la `GrillaEvaluacion`. Sin dependencias de Angular:
 * testeables al instante y reutilizables por otras vistas tipo libro de notas
 * (Asistencia, Libro de Clases).
 */
import type {
  FilaEvaluacion,
  GrillaEvaluacion,
} from '@core/models/ui/evaluaciones-profesional.model';
import { GRADE_PASS, MODULE_COUNT } from './professional-modules';

/** Métricas agregadas de un curso para el KPI strip del gradebook. */
export interface GradebookStats {
  /** Alumnos con TODAS sus notas registradas. */
  alumnosCompletos: number;
  /** Total de alumnos en la grilla. */
  totalAlumnos: number;
  /** Promedio del curso (media de los promedios individuales no nulos), null si ninguno. */
  promedioCurso: number | null;
  /** Alumnos con promedio por debajo del mínimo de aprobación. */
  enRiesgo: number;
  /** Módulos que tienen al menos una nota registrada (de MODULE_COUNT). */
  modulosCargados: number;
}

/** Cuenta cuántos módulos tienen nota registrada para una fila. */
export function countModulosCompletos(fila: FilaEvaluacion): number {
  return fila.notas.filter((n) => n.grade !== null).length;
}

/** ¿La fila tiene TODAS sus notas registradas? */
export function isFilaCompleta(fila: FilaEvaluacion): boolean {
  return fila.notas.length > 0 && fila.notas.every((n) => n.grade !== null);
}

/**
 * Deriva las métricas agregadas del curso a partir de la grilla.
 * Retorna ceros/null seguros cuando la grilla es null o no tiene filas.
 */
export function computeGradebookStats(grilla: GrillaEvaluacion | null): GradebookStats {
  if (!grilla || grilla.filas.length === 0) {
    return {
      alumnosCompletos: 0,
      totalAlumnos: grilla?.totalAlumnos ?? 0,
      promedioCurso: null,
      enRiesgo: 0,
      modulosCargados: 0,
    };
  }

  const filas = grilla.filas;
  const alumnosCompletos = filas.filter(isFilaCompleta).length;

  const promedios = filas
    .map((f) => f.promedio)
    .filter((p): p is number => p !== null && !isNaN(p));
  const promedioCurso =
    promedios.length > 0
      ? Math.round((promedios.reduce((sum, p) => sum + p, 0) / promedios.length) * 10) / 10
      : null;

  const enRiesgo = filas.filter((f) => f.promedio !== null && f.promedio < GRADE_PASS).length;

  let modulosCargados = 0;
  for (let i = 0; i < MODULE_COUNT; i++) {
    if (filas.some((f) => f.notas[i] != null && f.notas[i].grade !== null)) {
      modulosCargados++;
    }
  }

  return {
    alumnosCompletos,
    totalAlumnos: grilla.totalAlumnos,
    promedioCurso,
    enRiesgo,
    modulosCargados,
  };
}
