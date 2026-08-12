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

/**
 * Decide si el usuario puede *desbloquear* Clase Profesional conmutando de sede (fix-156):
 * admin siempre puede, secretaria solo con el grant multi-sede (RF-013). Una secretaria sin
 * grant está anclada a su sede fija — si esa sede no tiene profesional, jamás podrá conmutar.
 */
export function canUnlockProfessional(
  role: UserRole | undefined,
  canAccessBothBranches = false,
): boolean {
  return role === 'admin' || (role === 'secretaria' && canAccessBothBranches);
}

const PROFESSIONAL_GROUP_NAME = 'Academia Profesional';

/**
 * Filtra el grupo "Academia Profesional" de una lista de grupos de navegación cuando el
 * usuario no puede acceder a él ni desbloquearlo conmutando de sede (fix-156). Evita mostrar
 * un candado permanente sin acción posible detrás.
 */
export function visibleNavGroups<T extends { group: string }>(
  groups: readonly T[],
  hasProfessional: boolean,
  canUnlock: boolean,
): T[] {
  if (hasProfessional || canUnlock) return [...groups];
  return groups.filter((g) => g.group !== PROFESSIONAL_GROUP_NAME);
}
