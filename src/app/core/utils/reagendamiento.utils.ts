/**
 * true si la razón de un reagendamiento está completa para poder guardar (fix-279-m): elegida de
 * la lista y, si es "otro", con el detalle escrito. Cuando no se requiere (agendar una clase que
 * nunca tuvo sesión) siempre está completa.
 */
export function isRazonReagendamientoCompleta(
  requerida: boolean,
  razon: string | null,
  razonOtro: string,
): boolean {
  if (!requerida) return true;
  if (!razon) return false;
  return razon !== 'otro' || razonOtro.trim().length > 0;
}
