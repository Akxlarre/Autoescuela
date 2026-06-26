import type { UserRole } from '@core/models/ui/user.model';
import { resolveBranchScope, NO_BRANCH_SCOPE } from '@core/utils/branch-scope.utils';

/** Subconjunto de `BranchOption` que necesita el gating profesional. */
export interface BranchProfessionalFlag {
  id: number;
  hasProfessional?: boolean;
}

/**
 * Decide si el módulo de Clase Profesional es accesible según la **sede efectiva** del usuario
 * (fix-028). Reutiliza `resolveBranchScope` (grant RF-013 / spec 0017) para resolver esa sede:
 *
 * - **admin** o **secretaria con grant** → respeta el selector del topbar;
 *   `null` ("Todas las sedes") ⇒ accesible (ve todo).
 * - **secretaria sin grant** → su sede fija (`userBranchId`); misconfig (`NO_BRANCH_SCOPE`) ⇒ no.
 *
 * Una sede concreta es accesible solo si tiene `hasProfessional = true`.
 *
 * Data-in / data-out: sin dependencias de Angular, testeable al instante.
 */
export function canAccessProfessional(
  role: UserRole | undefined,
  userBranchId: number | null | undefined,
  selectedBranchId: number | null,
  branches: readonly BranchProfessionalFlag[],
  canAccessBothBranches = false,
): boolean {
  const scope = resolveBranchScope(role, userBranchId, selectedBranchId, canAccessBothBranches);
  if (scope === null) return true; // "Todas las sedes" → ve todo
  if (scope === NO_BRANCH_SCOPE) return false; // secretaria mal configurada
  return branches.find((b) => b.id === scope)?.hasProfessional ?? false;
}
