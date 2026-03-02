import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { SupabaseService } from '@core/services/supabase.service';

/**
 * Interceptor funcional de autenticación (Angular v15+).
 * - Añade Authorization: Bearer <token> a las peticiones HTTP.
 * - En 401: intenta refreshSession y reintenta con el nuevo token.
 *
 * Registrar en app.config.ts vía provideCoreAuth().
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const supabase = inject(SupabaseService);

  const addToken = (request: typeof req, token: string) =>
    request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  return from(supabase.getSession()).pipe(
    switchMap(({ data: { session } }) =>
      session?.access_token
        ? next(addToken(req, session.access_token))
        : next(req)
    ),
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        return from(supabase.refreshSession()).pipe(
          switchMap(({ data: { session } }) =>
            session?.access_token
              ? next(addToken(req, session.access_token))
              : throwError(() => err)
          ),
          catchError(() => throwError(() => err))
        );
      }
      return throwError(() => err);
    })
  );
};
