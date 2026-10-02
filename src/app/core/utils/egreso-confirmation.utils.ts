import { formatCLP } from '@core/utils/date.utils';

/**
 * Texto de la confirmación de "Marcar como Ex-Alumno". Se puede egresar con deuda, pero la
 * confirmación lo advierte con el monto (hotfix-125-m). Devuelve HTML: el modal de confirmación
 * lo renderiza como tal.
 */
export function buildMarcarExAlumnoMessage(nombre: string, saldoPendiente: number): string {
  const base = `${nombre} pasará a la lista de Ex-Alumnos y dejará de aparecer en Alumnos. Esta acción no se puede deshacer desde la interfaz.`;
  if (saldoPendiente <= 0) return base;

  return `<strong>Tiene un saldo pendiente de ${formatCLP(saldoPendiente)}.</strong> Seguirá figurando con deuda en Ex-Alumnos.<br /><br />${base}`;
}
