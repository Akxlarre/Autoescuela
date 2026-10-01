/**
 * Opciones del filtro "Curso" de una lista de alumnos (hotfix-114-m). Functional Core.
 */

export interface CourseFilterOption {
  label: string;
  value: string;
}

/** Marcador que usan las filas de alumnos sin curso asignado. */
const NO_COURSE = '—';

/**
 * Una opción por cada curso que aparece en las filas cargadas, sin repetir y en orden
 * alfabético. Se deriva de los datos para que un curso nuevo (p. ej. "Refuerzo Clase B") se
 * pueda filtrar sin tocar código.
 */
export function buildCourseFilterOptions(
  rows: readonly { cursos: readonly { nombre: string }[] }[],
): CourseFilterOption[] {
  const names = new Set<string>();
  for (const row of rows) {
    for (const curso of row.cursos) {
      if (curso.nombre && curso.nombre !== NO_COURSE) names.add(curso.nombre);
    }
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((nombre) => ({ label: nombre, value: nombre }));
}
