import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import type { AnnouncementRow } from '@core/models/ui/announcement.model';

/**
 * Historial de comunicados enviados (spec 0041-b, AC7).
 *
 * Dumb: recibe las filas ya resueltas y solo las presenta. Es la respuesta a "¿qué se le
 * comunicó a los alumnos y cuándo?", que hoy no se puede contestar porque la
 * comunicación masiva vive en una lista de difusión de WhatsApp.
 */
@Component({
  selector: 'app-announcements-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IconComponent, BadgeComponent, SkeletonBlockComponent, EmptyStateComponent],
  host: { class: 'flex flex-col min-h-0' },
  template: `
    @if (loading()) {
      <div class="flex flex-col gap-3 p-4">
        @for (i of skeletonRows; track i) {
          <div class="flex flex-col gap-1.5">
            <app-skeleton-block variant="text" width="55%" height="15px" />
            <app-skeleton-block variant="text" width="35%" height="12px" />
          </div>
        }
      </div>
    } @else if (announcements().length === 0) {
      <!-- Centrado en el alto disponible: dentro de un .bento-fill la celda mide el
           resto del viewport, no la altura natural de una card. -->
      <div class="flex-1 flex items-center justify-center p-4">
        <app-empty-state
          icon="megaphone"
          message="Todavía no enviaste comunicados"
          subtitle="Los comunicados que envíes a los alumnos van a quedar registrados acá."
        />
      </div>
    } @else {
      <ul class="flex-1 overflow-y-auto divide-y divide-border-subtle">
        @for (a of announcements(); track a.id) {
          <li
            class="flex flex-col gap-1.5 px-4 py-3 cursor-pointer transition-colors hover:bg-subtle"
            [attr.data-llm-nav]="'announcement-' + a.id"
            (click)="announcementClicked.emit(a.id)"
            (keydown.enter)="announcementClicked.emit(a.id)"
            tabindex="0"
            role="button"
          >
            <div class="flex items-start justify-between gap-3">
              <p class="item-title truncate">{{ a.subject }}</p>
              <app-badge class="shrink-0" [variant]="a.kind === 'promocional' ? 'info' : 'neutral'">
                {{ a.kind === 'promocional' ? 'Promocional' : 'Operativo' }}
              </app-badge>
            </div>

            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <span class="flex items-center gap-1">
                <app-icon name="users" [size]="12" />
                {{ a.recipients_total }} destinatario(s)
              </span>

              @if (a.email_failed_count > 0) {
                <span class="flex items-center gap-1 text-error">
                  <app-icon name="alert-circle" [size]="12" color="var(--state-error)" />
                  {{ a.email_failed_count }} sin entregar
                </span>
              }

              <span class="flex items-center gap-1">
                <app-icon name="map-pin" [size]="12" />
                {{ a.branchLabel }}
              </span>

              <span class="flex items-center gap-1">
                <app-icon name="user" [size]="12" />
                {{ a.sentByName }}
              </span>

              @if (a.sentAt) {
                <span>{{ a.sentAt | date: 'dd/MM/yyyy HH:mm' }}</span>
              } @else {
                <app-badge variant="warning">Envío incompleto</app-badge>
              }
            </div>
          </li>
        }
      </ul>
    }
  `,
})
export class AnnouncementsContentComponent {
  readonly announcements = input.required<AnnouncementRow[]>();
  readonly loading = input(false);

  readonly announcementClicked = output<number>();

  protected readonly skeletonRows = [0, 1, 2, 3];
}
