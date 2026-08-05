/**
 * Sesiones de `class_b_sessions` consideradas válidas para mostrar en UI (Dashboard,
 * Asistencia B). Excluye 'reserved' (hold provisional creado en el Paso 2 del wizard de
 * matrícula, antes de la confirmación final) y 'cancelled'.
 */
export const VALID_CLASS_B_SESSION_STATUSES = [
  'scheduled',
  'in_progress',
  'completed',
  'no_show',
] as const;
