// supabase/functions/_shared/reenrollment.ts
//
// Núcleo funcional de la regla de re-matrícula para el flujo PÚBLICO (fix-020).
// Espejo de `src/app/core/utils/reenrollment.utils.ts` — Deno no puede importar
// código de Angular, así que la regla se replica aquí. Mantener ambas en sync.
//
// Diferencia de POLÍTICA respecto al flujo interno: en público no hay un humano
// que confirme una re-matrícula. Por decisión de negocio, una matrícula histórica
// (completed/cancelled) en el MISMO curso NO se auto-permite online: se deriva a la
// autoescuela. Por eso aquí tanto `block` como `confirm` impiden continuar; solo
// cambia el mensaje (ver `reenrollmentBlockMessage`).
//
//   deno test supabase/functions/_shared/reenrollment.test.ts

/** Estados "en curso": existe una matrícula viva en el mismo curso. */
export const BLOCKING_STATUSES = ['draft', 'active', 'pending_payment'];

/** Estados "históricos": la matrícula terminó (egresó o se canceló). */
export const HISTORICAL_STATUSES = ['completed', 'cancelled'];

export type ReenrollmentVerdict = 'block' | 'confirm' | 'allow';

/**
 * Decide el veredicto de re-matrícula a partir de los estados de las matrículas
 * existentes del alumno EN EL MISMO curso:
 *  - `block`   → hay una matrícula viva (o un estado desconocido → conservador).
 *  - `confirm` → solo histórico (completed/cancelled).
 *  - `allow`   → sin matrícula previa.
 */
export function evaluateReenrollment(
  existingStatuses: (string | null | undefined)[],
): ReenrollmentVerdict {
  const statuses = existingStatuses.filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  );

  if (statuses.length === 0) return 'allow';

  const isHistorical = (s: string): boolean => HISTORICAL_STATUSES.includes(s);

  // 'block' gana: una matrícula viva (o estado desconocido) impide continuar.
  if (statuses.some((s) => !isHistorical(s))) return 'block';

  return 'confirm';
}

/**
 * Mensaje para el alumno público según el veredicto. `null` cuando `allow`
 * (puede continuar). El veredicto `confirm` deriva a la autoescuela (no online).
 */
export function reenrollmentBlockMessage(
  verdict: ReenrollmentVerdict,
  licenseLabel: string,
): string | null {
  if (verdict === 'block') {
    return (
      `Ya existe una matrícula en curso en ${licenseLabel} para el RUT ingresado. ` +
      `Si crees que esto es un error o necesitas ayuda, comunícate directamente con la autoescuela.`
    );
  }
  if (verdict === 'confirm') {
    return (
      `Ya tienes una matrícula completada en ${licenseLabel}. ` +
      `Para volver a inscribirte debes hacerlo de forma presencial en la autoescuela — ` +
      `acércate a nuestra sede y te ayudaremos a gestionar tu re-matrícula.`
    );
  }
  return null;
}
