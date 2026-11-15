import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';
import { authLinkErrorFromUrl } from '@core/utils/auth-link-error.utils';

/**
 * Guard de /recuperar-contrasena (fix-181-b).
 * Solo deja pasar si la sesión viene de un link de recuperación (evento PASSWORD_RECOVERY).
 * Sin él manda a /login, donde está el modo "recuperar" para pedir un link nuevo:
 * - si Supabase volvió con un error en la URL (link vencido o ya usado, F6), con
 *   `?enlace=vencido|invalido` para que el login lo explique;
 * - si no (acceso directo, F5), sin aviso.
 */
export const passwordRecoveryGuard: CanActivateFn = async () => {
  const auth = inject(AuthFacade);
  const router = inject(Router);
  const { location } = inject(DOCUMENT);
  await auth.whenReady;
  if (auth.passwordRecovery()) return true;

  // La URL todavía es la del link: la navegación inicial no terminó y supabase-js no borra el error.
  const linkError = authLinkErrorFromUrl(location.hash, location.search);
  return linkError
    ? router.createUrlTree(['/login'], { queryParams: { enlace: linkError } })
    : router.createUrlTree(['/login']);
};
