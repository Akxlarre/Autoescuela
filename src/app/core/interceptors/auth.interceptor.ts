import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

/**
 * Interceptor funcional de autenticación (Angular v15+).
 * - Añade Authorization: Bearer <token> a las peticiones HTTP.
 * - En 401: intenta refreshSession y reintenta con el nuevo token.
 *
 * Registrar en app.config.ts vía provideCoreAuth().
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const supabase = inject(SupabaseService);
  const session = supabase.session(); // Lectura síncrona del Signal

  const addToken = (request: typeof req, token: string) =>
    request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  // Si tenemos sesión en el signal, usamos el token
  const authenticatedRequest = session?.access_token 
    ? next(addToken(req, session.access_token)) 
    : next(req);

  return authenticatedRequest.pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        // En caso de 401 (token expirado no detectado), intentamos refresh explícito
        return from(supabase.refreshSession()).pipe(
          switchMap(({ data: { session: newSession } }) =>
            newSession?.access_token
              ? next(addToken(req, newSession.access_token))
              : throwError(() => err)
          ),
          catchError(() => throwError(() => err))
        );
      }
      return throwError(() => err);
    })
  );
};
