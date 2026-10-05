import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';

/**
 * Guard de /recuperar-contrasena (fix-181-b).
 * Solo deja pasar si la sesión viene de un link de recuperación (evento PASSWORD_RECOVERY).
 * Sin él —link vencido, acceso directo— manda a /login, donde está el modo "recuperar" para pedir
 * un link nuevo.
 */
export const passwordRecoveryGuard: CanActivateFn = async () => {
  const auth = inject(AuthFacade);
  const router = inject(Router);
  await auth.whenReady;

  if (auth.passwordRecovery()) return true;
  return router.createUrlTree(['/login']);
};
