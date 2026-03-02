import { EnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from '@core/interceptors/auth.interceptor';

/**
 * Provee el módulo CoreAuth: HttpClient con interceptor de autenticación.
 * Registra authInterceptor automáticamente (token en headers, refresh en 401).
 *
 * Úsalo en app.config.ts como reemplazo de provideHttpClient():
 * ```ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideCoreAuth(),
 *   ]
 * };
 * ```
 *
 * Si ya tienes provideHttpClient() en app.config.ts, elimínalo y usa solo este.
 */
export function provideCoreAuth(): EnvironmentProviders {
  return provideHttpClient(
    withInterceptors([authInterceptor])
  );
}
