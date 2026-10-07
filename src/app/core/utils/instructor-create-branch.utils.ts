import type { UserRole } from '@core/models/ui/user.model';
import { canChooseBranch } from '@core/utils/branch-scope.utils';

export interface InstructorCreateBranch {
  /** Muestra el campo Sede (admin o secretaria multi-sede). */
  canPick: boolean;
  /** Sede inicial del formulario; `null` = sin elegir todavía. */
  branchId: number | null;
  /** Secretaria anclada a su sede pero sin sede asignada: no puede crear. */
  missingOwnBranch: boolean;
}

/**
 * Sede del alta de instructor (fix-201-b, S3 de ASG-i-034). Antes salía solo del selector del
 * topbar: la secretaria sin grant (que no lo tiene) nunca podía crear, o usaba la sede que otro
 * usuario dejó guardada en el navegador. Quien elige sede la usa como valor inicial; la secretaria
 * anclada usa siempre la suya.
 */
export function resolveInstructorCreateBranch(
  role: UserRole | undefined,
  userBranchId: number | null | undefined,
  canAccessBothBranches: boolean,
  topbarBranchId: number | null,
): InstructorCreateBranch {
  if (canChooseBranch(role, canAccessBothBranches)) {
    return { canPick: true, branchId: topbarBranchId, missingOwnBranch: false };
  }
  const own = userBranchId ?? null;
  return { canPick: false, branchId: own, missingOwnBranch: own === null };
}
