import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

import type { Notification, NotificationType } from '@core/models/notification.model';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * NotificationsPanelComponent — panel dropdown de notificaciones.
 *
 * Dumb component: solo input() y output(). Sin inyección de servicios ni Facades.
 * La animación de entrada (animatePanelIn) y la del icono de campana (animateBell)
 * son responsabilidad del TopbarComponent (Smart) que usa [appAnimateIn] en el host.
 *
 * Posicionamiento: position absolute desde el wrapper del topbar.
 */
@Component({
  selector: 'app-notifications-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div
      class="notif-panel card"
      role="dialog"
      aria-label="Panel de notificaciones"
      aria-modal="false"
    >
      <!-- Header -->
      <div class="notif-panel__header">
        <span class="text-sm font-semibold text-primary">Notificaciones</span>
        @if (unreadCount() > 0) {
          <button
            class="text-xs text-muted hover:text-primary cursor-pointer transition-colors"
            data-llm-action="mark-all-notifications-read"
            (click)="markAllRead.emit()"
          >
            Marcar todo como leído
          </button>
        }
      </div>

      <!-- Lista -->
      <ul class="notif-panel__list" role="list" aria-label="Lista de notificaciones">
        @for (n of notifications(); track n.id) {
          <li
            class="notif-panel__item"
            [class.is-unread]="!n.read"
            role="listitem"
            tabindex="0"
            (click)="markRead.emit(n.id)"
            (keydown.enter)="markRead.emit(n.id)"
            (keydown.space)="$event.preventDefault(); markRead.emit(n.id)"
            [attr.aria-label]="n.title + (!n.read ? ' — sin leer' : '')"
          >
            <span
              class="notif-panel__icon"
              [class]="'type-' + (n.type ?? 'info')"
              aria-hidden="true"
            >
              <app-icon [name]="iconFor(n.type)" [size]="15" />
            </span>

            <div class="notif-panel__body">
              <p class="notif-panel__title">{{ n.title }}</p>
              <p class="notif-panel__msg">{{ n.message }}</p>
              <time class="notif-panel__time" [attr.datetime]="n.createdAt.toISOString()">{{
                timeAgo(n.createdAt)
              }}</time>
            </div>

            @if (!n.read) {
              <span class="notif-panel__dot" aria-hidden="true"></span>
            }
          </li>
        } @empty {
          <li class="notif-panel__empty" role="listitem">
            <app-icon name="bell-off" [size]="22" />
            <span>Sin notificaciones</span>
          </li>
        }
      </ul>
    </div>
  `,
  styleUrl: './notifications-panel.component.scss',
})
export class NotificationsPanelComponent {
  readonly notifications = input.required<Notification[]>();
  readonly unreadCount = input(0);

  readonly markRead = output<string>();
  readonly markAllRead = output<void>();

  iconFor(type?: NotificationType): string {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'warning':
        return 'alert-triangle';
      case 'error':
        return 'alert-circle';
      default:
        return 'info';
    }
  }

  timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Ahora';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
    return `Hace ${Math.floor(seconds / 86400)} d`;
  }
}
