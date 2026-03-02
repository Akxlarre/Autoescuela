import { inject } from "@angular/core";
import { Router, type CanActivateFn } from "@angular/router";
import { AuthFacade } from "@core/services/auth.facade";

/**
 * Guard para rutas públicas (login, register).
 * Si el usuario ya está autenticado, redirige a /app.
 */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthFacade);
  const router = inject(Router);
  await auth.whenReady;
  if (auth.isAuthenticated()) return router.createUrlTree(["/app"]);
  return true;
};
