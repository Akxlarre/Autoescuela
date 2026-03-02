# Auth Interceptor

## Propósito

Interceptor funcional (`HttpInterceptorFn`, Angular 15+) que gestiona la autenticación en peticiones HTTP.

- Añade `Authorization: Bearer <token>` automáticamente a cada request realizado con `HttpClient`.
- Si el servidor responde con **401**, refresca la sesión con Supabase y reintenta la petición con el nuevo token.

## ¿Por qué existe?

El `auth.interceptor` existe porque si el día de mañana conectas una **API externa** o usas **Supabase Edge Functions** vía `HttpClient`, necesitas el Bearer token inyectado automáticamente. Sin él, tendrías que añadir manualmente el header `Authorization` en cada llamada.

## ¿Por qué es el único interceptor?

En un stack con Supabase, la mayoría de las llamadas a datos van por el **Supabase JS SDK** (`supabase.client.from(...)`), que **no pasa por Angular `HttpClient`** y por lo tanto **no pasa por interceptors**. Crear interceptors adicionales (error global, loading, retry) sería sobre-ingeniería para un template, ya que solo afectarían a la minoría de requests que usan `HttpClient`.

```
Supabase SDK  →  NO pasa por HttpClient  →  NO pasa por interceptors
HttpClient    →  SÍ pasa por interceptors →  auth.interceptor lo cubre
```

## Registro

Se activa mediante `provideCoreAuth()` en `app.config.ts`:

```typescript
import { provideCoreAuth } from '@core/auth/provide-core-auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideCoreAuth(), // registra HttpClient + authInterceptor
  ]
};
```

## Dependencias

- `SupabaseService` — obtiene sesión actual y refresca tokens.
