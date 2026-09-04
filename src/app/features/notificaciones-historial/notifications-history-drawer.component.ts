import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { NotificationsFacade } from '@core/facades/notifications.facade';
import type {
  Notification,
  NotificationReferenceType,
  NotificationType,
} from '@core/models/ui/notification.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';

/**
 * NotificationsHistoryDrawerComponent — historial completo de notificaciones (AC4).
 *
 * Se abre sin padre vía `LayoutDrawerFacadeService.open()` (no puede recibir `input()`),
 * por lo que inyecta `NotificationsFacade` directamente — mismo patrón que el resto de los
 * drawers del proyecto (ej. `configurador-horarios-drawer`, `dms-upload-drawer`), todos bajo
 * `features/`. Reutiliza el layout de fila de `InstructorNotificacionesComponent` (icono
 * circular + título/mensaje/hora), adaptado al ancho de un drawer, distinguiendo eliminadas.
 */
@Component({
  selector: 'app-notifications-history-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent],
  template: `
    <div class="notif-history flex h-full flex-col">
      @if (facade.isHistorialLoading()) {
        <div class="flex flex-col gap-3 p-4">
          @for (i of skeletonRows; track i) {
            <app-skeleton-block variant="rect" height="56px" />
          }
        </div>
      } @else if (facade.historial().length === 0) {
        <div class="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
          <app-icon name="bell-off" [size]="32" class="opacity-50 text-text-muted" />
          <p class="text-sm text-text-muted">No tienes notificaciones en tu historial.</p>
        </div>
      } @else {
        <ul class="notif-history__list flex-1 overflow-y-auto flex flex-col gap-2" role="list">
          @for (n of facade.historial(); track n.id) {
            <li
              class="card p-3 notif-history__row notif-history__row--clickable"
              role="listitem"
              tabindex="0"
              [attr.aria-label]="n.title + (!n.read ? ' — sin leer' : '')"
              (click)="onRowClick(n)"
              (keydown.enter)="onRowClick(n)"
              (keydown.space)="$event.preventDefault(); onRowClick(n)"
            >
              <span
                class="notif-history__icon"
                [class]="'type-' + (n.type ?? 'info')"
                aria-hidden="true"
              >
                <app-icon [name]="iconFor(n)" [size]="16" />
              </span>

              <div class="notif-history__body">
                <p class="notif-history__title">{{ n.title }}</p>
                <p class="notif-history__msg">{{ n.message }}</p>
                <time class="notif-history__time" [attr.datetime]="n.createdAt.toISOString()">{{
                  formatDate(n.createdAt)
                }}</time>
              </div>

              @if (!n.read) {
                <span class="notif-history__dot" aria-hidden="true"></span>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styleUrl: './notifications-history-drawer.component.scss',
})
export class NotificationsHistoryDrawerComponent implements OnInit {
  protected readonly facade = inject(NotificationsFacade);

  readonly skeletonRows = [0, 1, 2, 3, 4];

  ngOnInit(): void {
    this.facade.loadHistorial();
  }

  /** Marca como leída al hacer clic, mismo comportamiento que el panel. */
  onRowClick(n: Notification): void {
    this.facade.markAsRead(n.id);
  }

  iconFor(n: Notification): string {
    return this.iconForReference(n.referenceType) ?? this.iconForSeverity(n.type);
  }

  formatDate(date: Date): string {
    return date.toLocaleString('es-CL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private iconForReference(referenceType?: NotificationReferenceType | null): string | null {
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
        return null;
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
