# CoreAuth — Módulo de Autenticación y RBAC

## Propósito

Abstracciones centrales para autenticación y control de acceso basado en roles (RBAC).

## Componentes

| Artefacto | Descripción |
|-----------|-------------|
| `AuthService` | Login, Logout, estado de sesión (Signals: `currentUser`, `isAuthenticated`) |
| `authGuard` | Guard para rutas protegidas |
| `AuthInterceptor` | Añade `Authorization: Bearer <token>` a HttpClient; en 401 intenta refresh y retry |

## Uso

### Configuración (app.config.ts)

```typescript
import { provideCoreAuth } from '@core/auth';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

providers: [
  provideCoreAuth(),
  provideHttpClient(withInterceptorsFromDi()),
  // ...
]
```

## Flujo de Refresh Token

1. Petición HTTP → Interceptor añade token
2. Respuesta 401 → Interceptor llama `SupabaseService.refreshSession()`
3. Si refresh OK → Retry con nuevo token
4. Si refresh falla → Propaga error 401
