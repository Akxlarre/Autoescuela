/**
 * La ficha ofrece "Registrar pago" solo si la matrícula tiene saldo pendiente (fix-278-m): el
 * formulario de pago rechaza cualquier monto mayor al saldo, así que sin saldo no hay nada que
 * registrar.
 */
export function canRegistrarPago(saldoPendiente: number | null | undefined): boolean {
  return (saldoPendiente ?? 0) > 0;
}
