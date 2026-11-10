# Sistema de Notificaciones y Alertas (3 Capas)

paths:
  - "src/app/core/facades/notifications*"
  - "src/app/core/facades/dashboard-alerts*"
  - "src/app/core/services/ui/toast*"
  - "src/app/core/models/*/notification*"

## Arquitectura

| Capa | Servicio | Propósito | Persistencia |
|------|----------|-----------|--------------|
| 1 — Toasts | `ToastService` | Feedback efímero (3-6s) | No |
| 2 — Notificaciones | `NotificationsFacade` | Historial persistente + Realtime | Sí (tabla `notifications`) |
| 3 — Alertas | `DashboardAlertsFacade` | Estado vivo computado desde BD | No (queries on-demand) |

## Cuándo usar cada capa

- **Toast** → Confirmar acciones del usuario ("Guardado", "Error al subir"), feedback inmediato
- **Notificación** → Eventos de negocio que el usuario debe ver aunque no esté mirando (nueva matrícula, pago recibido, documento por vencer)
- **Alerta** → Condiciones activas del sistema que requieren acción (documentos vencidos, pagos pendientes)

## Prohibiciones

- **NUNCA** inyectar `NotificationsFacade` en componentes Dumb (`shared/`). Solo en Smart o Layout.
- **NUNCA** crear notificaciones desde la UI directamente. Usar `NotificationsFacade.createNotification()`.
- **NUNCA** mezclar alertas con notificaciones. Son conceptos distintos: alertas son estado vivo, notificaciones son historial.
- **NUNCA** usar `MessageService` de PrimeNG directamente. Siempre pasar por `ToastService`.

## Realtime

`NotificationsFacade` se suscribe al canal `user-notifications` con filtro `recipient_id=eq.{dbId}`.
- Se inicializa en `AppShellComponent` via `initialize()`
- Se dispone al logout via `dispose()`
- Es idempotente: llamar `initialize()` múltiples veces es seguro
