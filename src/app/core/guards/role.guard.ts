import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '../facades/auth.facade';

/**
 * Guard funcional que verifica si el usuario autenticado tiene el rol requerido
 * para acceder a una ruta. Si no lo tiene, lo redirige al layout de la app
 * que a su vez lo redirige a su propio portal.
 */
export function hasRoleGuard(allowedRoles: string[]): CanActivateFn {
    return async () => {
        const auth = inject(AuthFacade);
        const router = inject(Router);

        await auth.whenReady;

        const user = auth.currentUser();

        if (!user) {
            return router.createUrlTree(['/login']);
        }

        // El portal especial para forzar el cambio de contraseña:
        // Si el usuario tiene firstLogin, solo permitimos acceso a /app/force-password-change
        // El router de esa ruta NO usa hasRoleGuard, usa su propio o nada.
        // Esto previene que usuarios no inicializados accedan.
        if (user.firstLogin) {
            return router.createUrlTree(['/force-password-change']);
        }

        if (allowedRoles.includes(user.role)) {
            return true;
        }

        // Role redirect fallback si no tiene permiso.
        return router.createUrlTree(['/app']);
    };
}
