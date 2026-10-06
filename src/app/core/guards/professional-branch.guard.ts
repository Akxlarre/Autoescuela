import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { canAccessProfessional } from '@core/utils/professional-access.utils';

/**
 * Guard funcional (fix-029): protege las rutas de Clase Profesional ante el acceso por URL directa
 * de una secretaria SIN grant cuya sede no ofrece programa profesional (terminaría en vista vacía).
 *
 * Admin y secretaria CON grant tienen selector de sede y la página aplica `setProfessionalOnly`,
 * así que el guard los deja pasar — pero recién con la lista real de sedes cargada, para que la
 * página encuentre la sede Profesional al montarse (fix-334-m). Solo redirige a la secretaria sin grant anclada
 * a una sede sin `has_professional`. Reutiliza el núcleo `canAccessProfessional` (mismo gating que
 * el sidebar) → una sola fuente de verdad.
 */
export const professionalBranchGuard: CanActivateFn = async () => {
  const auth = inject(AuthFacade);
  const branchFacade = inject(BranchFacade);
  const router = inject(Router);

  await auth.whenReady;
  const user = auth.currentUser();
  if (!user) return router.createUrlTree(['/login']);

  // fix-334-m: con la lista real de sedes. Tras un F5 `branches()` es un stub de una sede
  // sacado de localStorage, sin `hasProfessional`, y la página no encontraría su sede.
  await branchFacade.ensureBranchesLoaded();

  // Quien tiene selector (admin / secretaria con grant) entra: `setProfessionalOnly` gobierna la sede.
  const tieneSelector =
    user.role === 'admin' || (user.role === 'secretaria' && !!user.canAccessBothBranches);
  if (tieneSelector) return true;

  // Secretaria sin grant: evaluar su sede fija.

  const allowed = canAccessProfessional(
    user.role,
    user.branchId,
    branchFacade.selectedBranchId(),
    branchFacade.branches(),
    user.canAccessBothBranches,
  );

  return allowed ? true : router.createUrlTree(['/app']);
};
