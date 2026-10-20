import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '../facades/auth.facade';
import { isMissingBranch } from '@core/utils/missing-branch.utils';

/**
 * Portal de secretaria: sin sede asignada (y sin grant multisede) no se puede operar — lo que
 * guarde falla por RLS o queda sin sede. Se la manda a `/sin-sede` (hotfix-099-b). Va en
 * `canActivate` y `canActivateChild` para cubrir también la navegación interna.
 */
export const branchAssignedGuard: CanActivateFn = async () => {
  const auth = inject(AuthFacade);
  const router = inject(Router);

  await auth.whenReady;

  const user = auth.currentUser();
  if (user && isMissingBranch(user.role, user.branchId, user.canAccessBothBranches)) {
    return router.createUrlTree(['/sin-sede']);
  }
  return true;
};
