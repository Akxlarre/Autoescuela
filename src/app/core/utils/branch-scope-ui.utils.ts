/**
 * Reglas de UI para el selector "Sede principal" + "Ambas sedes" (spec 0004-m).
 * Solo admin puede tocar el scope de sede de un instructor/vehículo — la secretaria
 * nunca elige su propia sede (implícita) ni puede marcar/editar "Ambas".
 */

/** Secretaria nunca elige/cambia la sede — está siempre implícita a la suya. */
export function isSedeDisabled(role: string): boolean {
  return role !== 'admin';
}

/** Crear: secretaria no ve el toggle "Ambas" (AC2). Editar: lo ve, solo lectura (AC3). */
export function isBothBranchesVisible(role: string, mode: 'crear' | 'editar'): boolean {
  return role === 'admin' || mode === 'editar';
}

export function isBothBranchesDisabled(role: string): boolean {
  return role !== 'admin';
}
