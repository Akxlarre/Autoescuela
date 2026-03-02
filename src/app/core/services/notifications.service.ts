import { Injectable, signal, computed } from '@angular/core';
import type { Notification, NotificationType } from '@core/models/notification.model';

export type NotificationFilter = 'all' | 'unread' | NotificationType;

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  // TODO: Reemplazar estos datos de ejemplo con la fuente real del proyecto
  private _notifications = signal<Notification[]>([
    {
      id: '1',
      title: 'Bienvenido',
      message: 'El entorno está listo. Reemplaza estas notificaciones con datos reales.',
      type: 'info',
      read: false,
      createdAt: new Date(Date.now() - 300000),
    },
    {
      id: '2',
      title: 'Operación completada',
      message: 'La acción se procesó correctamente.',
      type: 'success',
      read: false,
      createdAt: new Date(Date.now() - 3600000),
    },
    {
      id: '3',
      title: 'Atención requerida',
      message: 'Revisa la configuración de tu perfil para continuar.',
      type: 'warning',
      read: true,
      createdAt: new Date(Date.now() - 86400000),
    },
  ]);

  private _filter = signal<NotificationFilter>('all');

  readonly notifications = this._notifications.asReadonly();
  readonly filter = this._filter.asReadonly();
  readonly unreadCount = computed(() =>
    this._notifications().filter((n) => !n.read).length
  );

  private sortedNotifications = computed(() =>
    [...this._notifications()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
  );

  readonly filteredNotifications = computed(() => {
    const list = this.sortedNotifications();
    const f = this._filter();
    if (f === 'all') return list;
    if (f === 'unread') return list.filter((n) => !n.read);
    return list.filter((n) => (n.type ?? 'info') === f);
  });

  readonly panelNotifications = computed(() =>
    this.filteredNotifications().slice(0, 15)
  );

  setFilter(filter: NotificationFilter): void {
    this._filter.set(filter);
  }

  markAsRead(id: string): void {
    this._notifications.update((list) =>
      list.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  markAllAsRead(): void {
    this._notifications.update((list) =>
      list.map((n) => ({ ...n, read: true }))
    );
  }
}
