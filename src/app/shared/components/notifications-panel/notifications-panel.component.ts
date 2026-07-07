import { Component, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';

import type {
  Notification,
  NotificationPanelEntry,
  NotificationReferenceType,
  NotificationType,
} from '@core/models/ui/notification.model';
import { IconComponent } from '@shared/components/icon/icon.component';

type GroupEntry = Extract<NotificationPanelEntry, { kind: 'group' }>;

/**
 * NotificationsPanelComponent — panel dropdown de notificaciones.
 *
 * Dumb component: solo input() y output(). Sin inyección de servicios ni Facades.
 * La animación de entrada (animatePanelIn) y la del icono de campana (animateBell)
 * son responsabilidad del TopbarComponent (Smart) que usa [appAnimateIn] en el host.
 *
 * Renderiza `NotificationPanelEntry[]` (Spec 0024): entradas individuales o grupos
 * colapsados de 3+ no leídas del mismo tipo/día (AC8), expandibles a las individuales
 * usando `notifications` (lista completa) para resolver el detalle de cada `id` agrupado.
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
        <span class="text-sm font-semibold text-text-primary">Notificaciones</span>
        @if (unreadCount() > 0) {
          <button
            class="text-xs text-text-muted hover:text-text-primary cursor-pointer transition-colors"
            data-llm-action="mark-all-notifications-read"
            (click)="markAllRead.emit()"
          >
            Marcar todo como leído
          </button>
        }
      </div>

      <!-- Lista -->
      <ul class="notif-panel__list" role="list" aria-label="Lista de notificaciones">
        @for (entry of entries(); track trackEntry(entry)) {
          @if (entry.kind === 'single') {
            <li
              class="notif-panel__item"
              [class.is-unread]="!entry.notification.read"
              role="listitem"
              tabindex="0"
              (click)="onItemClick(entry.notification)"
              (keydown.enter)="onItemClick(entry.notification)"
              (keydown.space)="$event.preventDefault(); onItemClick(entry.notification)"
              [attr.aria-label]="
                entry.notification.title + (!entry.notification.read ? ' — sin leer' : '')
              "
            >
              <span
                class="notif-panel__icon"
                [class]="'type-' + (entry.notification.type ?? 'info')"
                aria-hidden="true"
              >
                <app-icon [name]="iconForNotification(entry.notification)" [size]="15" />
              </span>

              <div class="notif-panel__body">
                <p class="notif-panel__title">{{ entry.notification.title }}</p>
                <p class="notif-panel__msg">{{ entry.notification.message }}</p>
                <time
                  class="notif-panel__time"
                  [attr.datetime]="entry.notification.createdAt.toISOString()"
                  >{{ timeAgo(entry.notification.createdAt) }}</time
                >
              </div>

              @if (!entry.notification.read) {
                <span class="notif-panel__dot" aria-hidden="true"></span>
              }
            </li>
          } @else {
            <li class="notif-panel__group" role="listitem">
              <div
                class="notif-panel__item notif-panel__item--group"
                tabindex="0"
                data-llm-action="expand-notification-group"
                [attr.aria-expanded]="isExpanded(entry)"
                [attr.aria-label]="entry.title"
                (click)="toggleGroup(entry)"
                (keydown.enter)="toggleGroup(entry)"
                (keydown.space)="$event.preventDefault(); toggleGroup(entry)"
              >
                <span class="notif-panel__icon" [class]="'type-' + entry.type" aria-hidden="true">
                  <app-icon [name]="iconForGroup(entry)" [size]="15" />
                </span>

                <div class="notif-panel__body">
                  <p class="notif-panel__title">{{ entry.title }}</p>
                  <time class="notif-panel__time" [attr.datetime]="entry.latestAt.toISOString()">{{
                    timeAgo(entry.latestAt)
                  }}</time>
                </div>

                <button
                  type="button"
                  class="notif-panel__group-read"
                  aria-label="Marcar grupo como leído"
                  data-llm-action="mark-group-read"
                  (click)="markGroupRead(entry, $event)"
                >
                  <app-icon name="check" [size]="13" />
                </button>

                <span class="notif-panel__group-chevron" aria-hidden="true">
                  <app-icon
                    [name]="isExpanded(entry) ? 'chevron-up' : 'chevron-down'"
                    [size]="14"
                  />
                </span>
              </div>

              @if (isExpanded(entry)) {
                <ul class="notif-panel__group-list" role="list">
                  @for (n of membersOf(entry); track n.id) {
                    <li
                      class="notif-panel__item notif-panel__item--nested"
                      [class.is-unread]="!n.read"
                      role="listitem"
                      tabindex="0"
                      (click)="onItemClick(n)"
                      (keydown.enter)="onItemClick(n)"
                      (keydown.space)="$event.preventDefault(); onItemClick(n)"
                      [attr.aria-label]="n.title + (!n.read ? ' — sin leer' : '')"
                    >
                      <div class="notif-panel__body">
                        <p class="notif-panel__title">{{ n.title }}</p>
                        <p class="notif-panel__msg">{{ n.message }}</p>
                        <time
                          class="notif-panel__time"
                          [attr.datetime]="n.createdAt.toISOString()"
                          >{{ timeAgo(n.createdAt) }}</time
                        >
                      </div>
                      @if (!n.read) {
                        <span class="notif-panel__dot" aria-hidden="true"></span>
                      }
                    </li>
                  }
                </ul>
              }
            </li>
          }
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
  readonly entries = input.required<NotificationPanelEntry[]>();
  readonly notifications = input.required<Notification[]>();
  readonly unreadCount = input(0);

  readonly markRead = output<string>();
  readonly markReadMany = output<string[]>();
  readonly markAllRead = output<void>();
  readonly notifClicked = output<Notification>();

  private readonly expandedGroups = signal<ReadonlySet<string>>(new Set());

  private readonly notificationsById = computed(() => {
    const map = new Map<string, Notification>();
    for (const n of this.notifications()) map.set(n.id, n);
    return map;
  });

  trackEntry(entry: NotificationPanelEntry): string {
    return entry.kind === 'single' ? entry.notification.id : entry.ids.join(',');
  }

  isExpanded(entry: GroupEntry): boolean {
    return this.expandedGroups().has(entry.ids.join(','));
  }

  toggleGroup(entry: GroupEntry): void {
    const key = entry.ids.join(',');
    this.expandedGroups.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  membersOf(entry: GroupEntry): Notification[] {
    const byId = this.notificationsById();
    return entry.ids.map((id) => byId.get(id)).filter((n): n is Notification => n !== undefined);
  }

  onItemClick(n: Notification): void {
    this.markRead.emit(n.id);
    this.notifClicked.emit(n);
  }

  markGroupRead(entry: GroupEntry, event: Event): void {
    event.stopPropagation();
    this.markReadMany.emit(entry.ids);
  }

  iconForNotification(n: Notification): string {
    return this.iconFor(n.referenceType, n.type);
  }

  iconForGroup(entry: GroupEntry): string {
    return this.iconFor(entry.referenceType, entry.type);
  }

  timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Ahora';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
    return `Hace ${Math.floor(seconds / 86400)} d`;
  }

  private iconFor(
    referenceType?: NotificationReferenceType | null,
    type?: NotificationType,
  ): string {
    switch (referenceType) {
      case 'enrollment':
        return 'user-plus';
      case 'certificate':
        return 'award';
      case 'preinscription':
        return 'clipboard-check';
      case 'class_b':
        return 'car';
      case 'professional_session':
        return 'graduation-cap';
      case 'document':
      case 'document_expiry':
        return 'file-text';
      case 'payment':
        return 'credit-card';
      default:
        return this.iconForSeverity(type);
    }
  }

  private iconForSeverity(type?: NotificationType): string {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'warning':
        return 'alert-triangle';
      case 'error':
        return 'circle-alert';
      default:
        return 'info';
    }
  }
}
