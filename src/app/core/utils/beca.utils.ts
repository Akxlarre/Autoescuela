/**
 * Una matrícula con beca completa (fix-057-i): el descuento cubre todo el curso, así que no hay
 * pagos registrados ni saldo pendiente. Los historiales de pago muestran "Becado 100 %" en vez de
 * "sin pagos". No se registra un pago de $0: ensuciaría la Caja y los reportes.
 */
export function esBecaCompleta(
  totalPagado: number,
  saldoPendiente: number,
  cantidadPagos = 0,
): boolean {
  return cantidadPagos === 0 && totalPagado === 0 && saldoPendiente === 0;
}
