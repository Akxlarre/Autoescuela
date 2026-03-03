import { inject } from "@angular/core";
import { Router, type CanActivateFn } from "@angular/router";
import { AuthFacade } from "@core/facades/auth.facade";

/**
 * Guard para rutas públicas (login, register).
 * Si el usuario ya está autenticado y tiene un rol válido, redirige a /app.
 */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthFacade);
  const router = inject(Router);
  await auth.whenReady;

  const user = auth.currentUser();
  if (user && user.role && user.role !== 'unknown') {
    return router.createUrlTree(["/app"]);
  }

  return true;
};
