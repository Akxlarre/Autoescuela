# Índice de Facades (Facades Index)

Este índice mantiene el registro de todas las Fachadas (Facades) del sistema.
Los Facades son el **único punto de entrada** permitido para que la UI interactúe con el dominio (base de datos) y su estado global.

## 📁 Facades Activos (`core/facades/` o `core/services/`)

| Facade | Archivo | Responsabilidad (Dominio) |
|---|---|---|
| `AuthFacade` | `auth.facade.ts` | Maneja el estado de la sesión del usuario actual, login, logout y persistencia con Supabase Auth. |
| `DashboardFacade` | `dashboard.facade.ts` | Orquesta la carga de las métricas principales (KPIs), actividad reciente y alertas para la pantalla de inicio. |

> **Nota para los Agentes**:
> - NO inyectes repositorios o `SupabaseService` en la UI. Inyecta el Facade correspondiente.
> - Si creas un Facade nuevo, DEBES registrarlo en esta tabla.
> - Todo archivo aquí debe terminar en `.facade.ts`.
