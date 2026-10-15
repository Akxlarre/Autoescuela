import type { EstadoPagoClase } from '@core/models/ui/estado-pago-clase.model';

/**
 * Primera clase práctica que exige el segundo pago (requisito del cliente, spec 0010-i).
 * Espejo del trigger `block_class_b_without_second_payment` (`class_number >= 7`).
 */
export const PRIMERA_CLASE_CON_SEGUNDO_PAGO = 7;

/**
 * Decide si una clase práctica se puede iniciar frente a la deuda de la matrícula.
 * Misma regla que el trigger de la BD: la UI solo la anticipa, la BD es la que bloquea.
 *
 * @param classNumber número de la clase (null = slot sin alumno)
 * @param saldo `enrollments.pending_balance` (solo baja con pagos `paid`)
 * @param habilitada existe una habilitación sin pago `kind = 'clases'` para la matrícula
 */
export function resolverEstadoPagoClase(
  classNumber: number | null,
  saldo: number | null,
  habilitada: boolean,
): EstadoPagoClase {
  const deuda = Math.max(saldo ?? 0, 0);
  if (classNumber === null || classNumber < PRIMERA_CLASE_CON_SEGUNDO_PAGO || deuda === 0) {
    return { estado: 'libre', saldo: deuda };
  }
  return { estado: habilitada ? 'habilitada_sin_pago' : 'bloqueada', saldo: deuda };
}
