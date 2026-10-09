/**
 * Reglas de UI para el selector "Sede principal" + "Ambas sedes" (spec 0004-m).
 * Solo admin puede tocar el scope de sede de un instructor/vehículo — la secretaria
 * nunca elige su propia sede (implícita) ni puede marcar/editar "Ambas".
 */

/**
 * La secretaria sin grant nunca elige la sede (implícita a la suya). Con el grant multisede sí
 * elige entre sus sedes (fix-215-b, D04/D05 de ASG-i-034). "Ambas" sigue siendo solo de admin.
 */
export function isSedeDisabled(role: string, canAccessBothBranches = false): boolean {
  return role !== 'admin' && !canAccessBothBranches;
}

/** Crear: secretaria no ve el toggle "Ambas" (AC2). Editar: lo ve, solo lectura (AC3). */
export function isBothBranchesVisible(role: string, mode: 'crear' | 'editar'): boolean {
  return role === 'admin' || mode === 'editar';
}

export function isBothBranchesDisabled(role: string): boolean {
  return role !== 'admin';
}
