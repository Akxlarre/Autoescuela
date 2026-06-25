import type { UserRole } from '@core/models/ui/user.model';

/**
 * Branch id centinela que no existe en BD. Fuerza 0 filas cuando una secretaria
 * está mal configurada (sin `branchId`), evitando que `null` se interprete como
 * "todas las sedes". Ver fix-027 y spec 0017 (multi-sede).
 */
export const NO_BRANCH_SCOPE = -1;

/**
 * Núcleo funcional del aislamiento por sede (fix-027).
 *
 * Resuelve el `branch_id` a usar como filtro de query según el rol:
 * - **admin**: respeta el selector de sede (`selectedBranchId`); `null` = todas las sedes.
 * - **secretaria** (y cualquier no-admin): anclada a su `branchId`. Si no tiene sede
 *   asignada (misconfig), devuelve `NO_BRANCH_SCOPE` para no exponer todas las sedes.
 *
 * Data-in / data-out: sin dependencias de Angular, testeable al instante.
 *
 * `canAccessBothBranches` (RF-013 / spec 0017): grant que hace que una secretaria se comporte
 * como un admin para el scope de sede (respeta el selector, incluido `null` = todas las sedes).
 * Sin grant, queda anclada a su `branchId` (fix-027).
 */
export function resolveBranchScope(
  role: UserRole | undefined,
  userBranchId: number | null | undefined,
  selectedBranchId: number | null,
  canAccessBothBranches = false,
): number | null {
  // admin, o secretaria con grant → respeta el selector (incl. null = todas las sedes)
  if (role === 'admin' || canAccessBothBranches) return selectedBranchId;
  return userBranchId ?? NO_BRANCH_SCOPE;
}
