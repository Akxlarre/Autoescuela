# Índice de Modelos (Models Index)

Este índice mantiene el registro de los modelos del sistema, divididos rigurosamente entre DTOs de base de datos y modelos de Interfaz de Usuario (UI).

## 📁 DTO — Data Transfer Objects (`core/models/dto/`)
Interfaces que mapean 1:1 las tablas y vistas de Supabase. Son estructuras de datos puros, sin comportamiento ni lógica de negocio.

| Modelo | Archivo | Descripción |
|---|---|---|
| `User` | `user.model.ts` | Entidad base de Supabase Auth (AppUser), contiene el id, email y el rol del usuario (ADMIN, RECEPCION, etc.) |

## 📁 Interfaz de Usuario (`core/models/ui/`)
Estructuras de datos puramente visuales, consumidas por los componentes para su renderización.

| Modelo | Archivo | Descripción |
|---|---|---|
| `Notification` | `notification.model.ts` | Estructura para los banners/toasts del sistema (tipo, mensaje, icono) |
| `KpiItem` | `dashboard.model.ts` | Estructura visual para las tarjetas de indicadores principales (kpi-card) |
| `ActivityItem` | `dashboard.model.ts` | Elemento de la lista de actividad reciente del dashboard |
| `QuickActionItem` | `dashboard.model.ts` | Definición de configuración para los botones de acceso rápido |
| `SystemStatusItem` | `dashboard.model.ts` | Datos para el panel de estado de servicios del sistema |

> **Nota para los Agentes**: Al crear una interfaz nueva que defina la estructura de una tabla, ponla en `dto/`. Si es un formato de datos para que un componente se dibuje, ponla en `ui/`. Actualiza esta tabla al agregar un modelo.
