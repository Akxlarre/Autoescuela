/**
 * Sede (caja) en la que queda un egreso de combustible.
 *
 * - Regla general: la caja de quien lo registra — la sede de la secretaria o la que el admin
 *   tiene elegida —, sea cual sea la sede del vehículo (fix-082-i; antes solo los vehículos
 *   "Ambas", hotfix-084-b). Quien paga la carga es esa caja.
 * - Admin en "Todas las sedes": la sede del vehículo, para que el egreso nunca quede sin sede
 *   (fix-243-m).
 * - Vehículo legacy sin sede, o sin vehículo → la sede elegida en el formulario o la activa.
 *
 * `activeBranchId` es la sede impuesta a la secretaria o la del selector del admin
 * (`resolveBranchScope`), `null` = "Todas las sedes".
 */
export function resolveFuelExpenseBranch(
  vehicle: { branchId: number | null } | null,
  formBranchId: number | null,
  activeBranchId: number | null,
): number | null {
  if (vehicle?.branchId != null) return activeBranchId ?? vehicle.branchId;
  return formBranchId ?? activeBranchId;
}
