/**
 * Estado de pago de una clase práctica Clase B frente al segundo pago (spec 0010-i).
 *
 * - `libre`: se puede iniciar (clase 1–6, o sin deuda).
 * - `bloqueada`: clase 7+ con deuda y sin habilitación — la BD rechaza el inicio.
 * - `habilitada_sin_pago`: clase 7+ con deuda, habilitada a mano con motivo.
 */
export type EstadoPagoClaseTipo = 'libre' | 'bloqueada' | 'habilitada_sin_pago';

export interface EstadoPagoClase {
  estado: EstadoPagoClaseTipo;
  /** Saldo pendiente de la matrícula en CLP (0 si no debe). */
  saldo: number;
}
