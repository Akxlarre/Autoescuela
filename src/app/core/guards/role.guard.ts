import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '../facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { loginQueryParams } from '@core/utils/return-url.utils';

/**
 * Guard funcional que verifica si el usuario autenticado tiene el rol requerido
 * para acceder a una ruta. Si no lo tiene, lo redirige al layout de la app
 * que a su vez lo redirige a su propio portal.
 */
export function hasRoleGuard(allowedRoles: string[]): CanActivateFn {
  return async (_route, state) => {
    const auth = inject(AuthFacade);
    const router = inject(Router);
    const toast = inject(ToastService); // antes del await: inject() necesita el contexto

    await auth.whenReady;

    const user = auth.currentUser();

    if (!user) {
      // hotfix-096-b (A18): después del login se vuelve a la pantalla pedida.
      return router.createUrlTree(['/login'], { queryParams: loginQueryParams(state?.url) });
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

    // Sin permiso: a su propio portal, pero avisando (fix-184-b). Antes la redirección era
    // silenciosa y abrir un link de otro rol parecía un error de la app.
    toast.warning('No tienes acceso a esa sección');
    return router.createUrlTree(['/app']);
  };
}
