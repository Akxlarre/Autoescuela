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

/**
 * true si el horario [slotStart, slotEnd) se cruza con alguna de las clases que empiezan en
 * `clasesInicio` (fix-299-m). A cada clase se le supone la misma duración que el horario: la
 * grilla y las clases prácticas usan el mismo bloque.
 */
export function slotChocaConClases(
  slotStart: string,
  slotEnd: string,
  clasesInicio: readonly string[],
): boolean {
  const inicio = new Date(slotStart).getTime();
  const fin = new Date(slotEnd).getTime();
  if (isNaN(inicio) || isNaN(fin)) return false;
  const duracion = fin - inicio;
  return clasesInicio.some((c) => {
    const clase = new Date(c).getTime();
    return !isNaN(clase) && clase < fin && inicio < clase + duracion;
  });
}
