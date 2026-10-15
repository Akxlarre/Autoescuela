/**
 * Quién puede ver y operar un vehículo de Flota (spec 0051-b). Fuente única en la app; la BD exige
 * lo mismo con `auth_can_manage_vehicle()` (migración 20261012150000).
 *
 * | Quién                              | Ve                | Opera                              |
 * |------------------------------------|-------------------|------------------------------------|
 * | admin                              | todo              | todo                               |
 * | secretaria con grant multi-sede    | todo              | todo                               |
 * | secretaria sin grant               | su sede + "Ambas" | solo su sede y que no sea "Ambas"  |
 * | otro rol                           | nada              | nada                               |
 */

export interface VehicleActor {
  role?: string | null;
  branchId?: number | null;
  canAccessBothBranches?: boolean | null;
}

export interface VehicleScope {
  branchId: number | null;
  bothBranches: boolean;
}

function isStaffWithFullAccess(user: VehicleActor): boolean {
  return user.role === 'admin' || (user.role === 'secretaria' && !!user.canAccessBothBranches);
}

/** ¿Puede crear/editar la ficha, cargar documentos y registrar mantenimientos de este vehículo? */
export function canManageVehicle(
  user: VehicleActor | null | undefined,
  vehicle: VehicleScope,
): boolean {
  if (!user) return false;
  if (isStaffWithFullAccess(user)) return true;
  if (user.role !== 'secretaria' || user.branchId == null) return false;
  return vehicle.branchId === user.branchId && !vehicle.bothBranches;
}

/** ¿Este vehículo aparece en su Flota? */
export function canViewVehicle(
  user: VehicleActor | null | undefined,
  vehicle: VehicleScope,
): boolean {
  if (!user) return false;
  if (isStaffWithFullAccess(user)) return true;
  if (user.role !== 'secretaria' || user.branchId == null) return false;
  return vehicle.bothBranches || vehicle.branchId === user.branchId;
}
