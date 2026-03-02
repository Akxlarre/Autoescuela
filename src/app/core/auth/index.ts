/**
 * CoreAuth — Módulo de autenticación y RBAC
 *
 * Abstracciones:
 * - AuthFacade: Login, Logout, Refresh Token, estado de sesión (Signals)
 * - authGuard: Guard para rutas protegidas
 * - AuthInterceptor: Añade token a HttpClient, refresh en 401
 * - HasRoleDirective: *appHasRole para ocultar UI por rol
 *
 * Uso en app.config.ts:
 *   import { provideCoreAuth } from '@core/auth';
 *   providers: [provideCoreAuth(), ...]
 */
export { AuthFacade } from "@core/services/auth.facade";
export { authGuard } from "@core/guards/auth.guard";
export { HasRoleDirective } from "@core/directives/has-role.directive";
export { authInterceptor } from "@core/interceptors/auth.interceptor";
export { provideCoreAuth } from "./provide-core-auth";
