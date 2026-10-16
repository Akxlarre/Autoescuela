/**
 * Sede (caja) en la que queda un egreso de combustible.
 *
 * - Vehículo de una sede → esa sede (fix-243-m).
 * - Vehículo "Ambas" → la caja de quien lo registra: la sede de la secretaria o la que el admin
 *   tiene elegida (decisión del owner, hotfix-084-b). Con el admin en "Todas las sedes", su sede
 *   principal.
 * - Vehículo legacy sin sede, o sin vehículo → la sede elegida en el formulario o la activa.
 *
 * `activeBranchId` es la sede impuesta a la secretaria o la del selector del admin
 * (`resolveBranchScope`), `null` = "Todas las sedes".
 */
export function resolveFuelExpenseBranch(
  vehicle: { branchId: number | null; bothBranches: boolean } | null,
  formBranchId: number | null,
  activeBranchId: number | null,
): number | null {
  if (vehicle?.bothBranches && activeBranchId !== null) return activeBranchId;
  return vehicle?.branchId ?? formBranchId ?? activeBranchId;
}
