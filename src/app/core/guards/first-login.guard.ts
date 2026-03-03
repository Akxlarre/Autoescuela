import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '../facades/auth.facade';

/**
 * Guard para la ruta /force-password-change.
 * Solo permite acceso si:
 *   1. El usuario está autenticado (tiene sesión)
 *   2. Es su primer login (firstLogin === true)
 * Si ya cambió la contraseña, redirige a /app.
 * Si no está autenticado, redirige a /login.
 */
export const firstLoginGuard: CanActivateFn = async () => {
    const auth = inject(AuthFacade);
    const router = inject(Router);

    await auth.whenReady;

    const user = auth.currentUser();

    if (!user) {
        return router.createUrlTree(['/login']);
    }

    if (user.firstLogin) {
        return true;
    }

    // Ya cambió la contraseña → va a su portal
    return router.createUrlTree(['/app']);
};
