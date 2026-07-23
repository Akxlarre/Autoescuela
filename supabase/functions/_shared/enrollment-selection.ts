// supabase/functions/_shared/enrollment-selection.ts
//
// Núcleo funcional para decidir qué matrícula mostrar/cobrar cuando un alumno
// tiene más de una activa/completada (fix-058, H-039). Antes se tomaba
// siempre la más reciente por `created_at`, lo que dejaba sin forma de pagar
// a un alumno con una matrícula más antigua con saldo pendiente (ej. Clase B)
// y otra más nueva ya saldada (ej. Profesional).
//
//   deno test supabase/functions/_shared/enrollment-selection.test.ts

export interface EnrollmentBalanceLike {
  pending_balance: number | string | null;
}

/**
 * Elige la matrícula a mostrar/cobrar entre las activas/completadas de un alumno.
 * Asume que `enrollments` ya viene ordenado por `created_at` descendente (la más
 * reciente primero), igual que la query de `student-payment`.
 *
 * - Prioriza la primera con saldo pendiente > 0 (recorriendo en el orden recibido).
 * - Si ninguna tiene saldo pendiente, cae a la primera del array (la más reciente).
 * - Si el array está vacío, retorna `null`.
 */
export function pickEnrollmentToShow<T extends EnrollmentBalanceLike>(enrollments: T[]): T | null {
  const withBalance = enrollments.find((e) => Number(e.pending_balance) > 0);
  return withBalance ?? enrollments[0] ?? null;
}
