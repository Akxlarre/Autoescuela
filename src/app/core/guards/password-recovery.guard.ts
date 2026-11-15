import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import {
  authLinkErrorFromUrl,
  authLinkErrorSessionNotice,
} from '@core/utils/auth-link-error.utils';
import { landsInApp } from './guest.guard';

/** Dos frases que hay que alcanzar a leer: el enlace no sirvió y con qué cuenta se sigue. */
const SESSION_NOTICE_LIFE_MS = 9000;

/**
 * Guard de /recuperar-contrasena (fix-181-b).
 * Solo deja pasar si la sesión viene de un link de recuperación (evento PASSWORD_RECOVERY).
 * Sin ella:
 * - acceso directo, sin error en la URL (F5) → /login, sin aviso;
 * - Supabase volvió con un error (link vencido o ya usado, F6) → /login?enlace=vencido|invalido,
 *   donde el login lo explica;
 * - el mismo error con otra sesión abierta (F9): supabase-js la conserva y /login la rebotaría a
 *   /app perdiendo el aviso, así que se va directo a /app con un toast que dice qué cuenta sigue.
 */
export const passwordRecoveryGuard: CanActivateFn = async () => {
  const auth = inject(AuthFacade);
  const router = inject(Router);
  const toast = inject(ToastService);
  const { location } = inject(DOCUMENT);
  await auth.whenReady;
  if (auth.passwordRecovery()) return true;

  // La URL todavía es la del link: la navegación inicial no terminó y supabase-js no borra el error.
  const linkError = authLinkErrorFromUrl(location.hash, location.search);
  if (!linkError) return router.createUrlTree(['/login']);

  const user = auth.currentUser();
  if (landsInApp(user)) {
    const { summary, detail } = authLinkErrorSessionNotice(linkError, user?.email);
    toast.warning(summary, detail, SESSION_NOTICE_LIFE_MS);
    return router.createUrlTree(['/app']);
  }
  return router.createUrlTree(['/login'], { queryParams: { enlace: linkError } });
};
