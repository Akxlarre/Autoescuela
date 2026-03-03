import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '../facades/auth.facade';

/**
 * Redirige al dashboard correspondiente según el rol del usuario,
 * o a force-password-change si es su primer login.
 */
export const roleRedirectGuard: CanActivateFn = async () => {
    const auth = inject(AuthFacade);
    const router = inject(Router);

    await auth.whenReady;

    const user = auth.currentUser();

    if (!user) {
        return router.createUrlTree(['/login']);
    }

    if (user.firstLogin) {
        return router.createUrlTree(['/force-password-change']);
    }

    // Si tiene un rol válido pero es "unknown" o no mapea, falla a fallback
    // Forzamos el logout para evitar que la sesión de supabase se quede colgada
    if (!user.role || user.role === 'unknown') {
        auth.logout();
        return router.createUrlTree(['/login']);
    }

    return router.createUrlTree([`/app/${user.role}/dashboard`]);
};
