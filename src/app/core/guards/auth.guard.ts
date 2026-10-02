import { inject, isDevMode } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthFacade);
  const router = inject(Router);
  await auth.whenReady;

  // Cuenta desactivada por el admin (fix-180-b): se corta la sesión aunque el token siga vigente.
  // Va antes del atajo de desarrollo para que tampoco se pueda entrar con ella en dev.
  if (auth.currentUser()?.isActive === false) {
    auth.logout({ redirect: false });
    return router.createUrlTree(['/login']);
  }

  // En modo desarrollo se omite la verificación de sesión para acceso rápido.
  // isDevMode() es false en producción (ng build --configuration=production).
  if (isDevMode()) return true;

  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};
