/**
 * Opción "todos" de los selectores de filtro (spec 0022-m). Functional Core.
 *
 * Sin esta opción, "Todos los estados" es solo el placeholder del selector: después de elegir
 * un valor no hay forma de volver atrás desde el mismo selector.
 */

/**
 * Antepone la opción "todos" a las opciones de un filtro.
 *
 * `value` debe ser el valor por defecto del signal del filtro (`null` o `''`, según la pantalla):
 * así elegir "todos" deja el filtro exactamente en su estado inicial y el botón
 * "Limpiar filtros" no lo cuenta como activo.
 */
export function withAllOption<V, D = null>(
  options: readonly { label: string; value: V }[],
  label: string,
  value: D = null as D,
): { label: string; value: V | D }[] {
  return [{ label, value }, ...options];
}
