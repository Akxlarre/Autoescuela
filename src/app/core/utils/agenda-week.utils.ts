/**
 * Suma `days` días a una fecha ISO ('YYYY-MM-DD') y devuelve el resultado en
 * el mismo formato. Mediodía fijo al parsear para evitar corrimientos por
 * DST/zona horaria. Función pura.
 */
export function addDaysToIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * True si `dateIso` supera la fecha límite de visualización configurada
 * (`maxVisibleDateIso`) — usado para deshabilitar celdas/días individuales
 * dentro de una semana "límite" (parte dentro del rango, parte fuera).
 * Comparación de strings ISO 'YYYY-MM-DD' (ordenan igual que fechas).
 */
export function isDateBeyondLimit(
  dateIso: string | null | undefined,
  maxVisibleDateIso: string | null,
): boolean {
  if (!maxVisibleDateIso || !dateIso) return false;
  return dateIso > maxVisibleDateIso;
}

/**
 * True si la PRÓXIMA semana (weekStart + 7 días) ya arrancaría más allá de
 * la fecha límite — es decir, sería una semana enteramente "fantasma" (cero
 * días válidos). Deshabilita "Semana siguiente" en ese caso exacto: permite
 * llegar a la última semana con al menos un día válido, nunca a una semana
 * completamente fuera de rango. Función pura, sin depender de servicios.
 */
export function isNextWeekBeyondLimit(
  weekStart: string | null | undefined,
  maxVisibleDateIso: string | null,
): boolean {
  if (!maxVisibleDateIso || !weekStart) return false;
  return addDaysToIso(weekStart, 7) > maxVisibleDateIso;
}
