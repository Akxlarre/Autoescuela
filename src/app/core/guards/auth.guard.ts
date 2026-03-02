import { inject, isDevMode } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '@core/services/auth.facade';

export const authGuard: CanActivateFn = async () => {
  // En modo desarrollo se omite la verificación de sesión para acceso rápido.
  // isDevMode() es false en producción (ng build --configuration=production).
  if (isDevMode()) return true;

  const auth = inject(AuthFacade);
  const router = inject(Router);
  await auth.whenReady;
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};
