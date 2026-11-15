import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';
import type { User } from '@core/models/ui/user.model';

/**
 * ¿Esta sesión entra a /app? Es la condición con que guestGuard saca de /login a quien ya
 * entró. La comparte passwordRecoveryGuard para saber si /login va a mostrar su aviso o lo va a
 * rebotar (fix-181-b, F9).
 */
export function landsInApp(user: Pick<User, 'role'> | null): boolean {
  return !!user && !!user.role && user.role !== 'unknown';
}

/**
 * Guard para rutas públicas (login, register).
 * Si el usuario ya está autenticado y tiene un rol válido, redirige a /app.
 */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthFacade);
  const router = inject(Router);
  await auth.whenReady;

  if (landsInApp(auth.currentUser())) {
    return router.createUrlTree(['/app']);
  }

  return true;
};
