/**
 * Alcance de un evento de tiempo real (fix-360-m).
 *
 * Un canal de `postgres_changes` sobre una tabla completa avisa de los cambios de TODAS sus filas
 * visibles. Una pantalla que muestra a un solo alumno tiene que decidir si el evento es suyo antes
 * de recargar.
 */

/** Lo que se usa del payload de `postgres_changes`: la fila nueva y la anterior. */
export interface RealtimeRowChange {
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
}

export interface StudentRealtimeScope {
  studentId: number;
  /** Matrículas del alumno. Vacío = todavía no se cargaron. */
  enrollmentIds: readonly number[];
}

/**
 * ¿El evento toca al alumno? Mira `student_id` y `enrollment_id` de la fila nueva y de la
 * anterior. Ante la duda devuelve `true` (recargar de más es inofensivo; no recargar deja la
 * pantalla desactualizada): un DELETE solo trae la clave primaria, y una fila con matrícula no se
 * puede descartar si las matrículas del alumno aún no se cargaron.
 */
export function isRealtimeEventForStudent(
  change: RealtimeRowChange,
  scope: StudentRealtimeScope,
): boolean {
  let couldDecide = false;

  for (const row of [change.new, change.old]) {
    if (!row) continue;

    const studentId = row['student_id'];
    if (typeof studentId === 'number') {
      if (studentId === scope.studentId) return true;
      couldDecide = true;
    }

    const enrollmentId = row['enrollment_id'];
    if (typeof enrollmentId === 'number') {
      if (scope.enrollmentIds.length === 0) return true;
      if (scope.enrollmentIds.includes(enrollmentId)) return true;
      couldDecide = true;
    }
  }

  return !couldDecide;
}
