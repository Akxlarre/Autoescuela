# NotificationsService

## Propósito

Estado de notificaciones del usuario. Listado con filtros (all, unread, por tipo), marcar como leídas, contador de no leídas. Actualmente usa datos mock.

## API pública

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `notifications` | `Signal<Notification[]>` | Lista completa |
| `filter` | `Signal<NotificationFilter>` | Filtro activo |
| `unreadCount` | `ComputedSignal<number>` | Cantidad de no leídas |
| `filteredNotifications` | `ComputedSignal<Notification[]>` | Lista filtrada y ordenada |
| `panelNotifications` | `ComputedSignal<Notification[]>` | Primeras 15 para el panel |
| `setFilter(filter)` | `void` | Cambia el filtro |
| `markAsRead(id)` | `void` | Marca una como leída |
| `markAllAsRead()` | `void` | Marca todas como leídas |

### NotificationFilter

`'all' | 'unread' | NotificationType` (error, success, info, warning)

## Cuándo usarlo

- Panel de notificaciones en el topbar
- Badge con contador de no leídas
- Lista de notificaciones con filtros

## Cuándo no usarlo

- Para toasts/alertas efímeras → PrimeNG MessageService o similar
- Para mensajes de validación → formularios

## Dependencias

- `Notification`, `NotificationType` de `@core/models/notification.model`
