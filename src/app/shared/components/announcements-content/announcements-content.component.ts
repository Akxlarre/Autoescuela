import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import type { AnnouncementRow, AnnouncementStatus } from '@core/models/ui/announcement.model';

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
          <!-- El estado se lee por la barra lateral de color y por la línea propia de
               abajo, no buscándolo entre los metadatos (AC7). -->
          <li
            class="flex items-start gap-3 border-l-2 px-4 py-3 cursor-pointer transition-colors hover:bg-subtle"
            [class.border-l-brand]="a.status === 'programado'"
            [class.border-l-transparent]="a.status === 'enviado'"
            [class.border-l-border-default]="a.status === 'cancelado'"
            [attr.data-llm-nav]="'announcement-' + a.id"
            (click)="announcementClicked.emit(a.id)"
            (keydown.enter)="announcementClicked.emit(a.id)"
            tabindex="0"
            role="button"
          >
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-start justify-between gap-3">
                <p class="item-title truncate" [class.text-text-muted]="a.status === 'cancelado'">
                  {{ a.subject }}
                </p>
                <app-badge
                  class="shrink-0"
                  [variant]="a.kind === 'promocional' ? 'info' : 'neutral'"
                >
                  {{ a.kind === 'promocional' ? 'Promocional' : 'Operativo' }}
                </app-badge>
              </div>

              <!-- Línea de estado: es lo primero que hay que poder leer de una fila. -->
              <p
                class="flex flex-wrap items-center gap-x-1.5 text-xs font-semibold"
                [class.text-brand]="a.status === 'programado'"
                [class.text-warning]="a.status === 'enviando'"
                [class.text-text-muted]="a.status !== 'programado' && a.status !== 'enviando'"
              >
                <app-icon [name]="statusIcon(a.status)" [size]="12" />
                <!-- El separador va DENTRO de este span, no al principio del siguiente:
                     con la lista angosta (drawer abierto) la línea se parte en dos y un
                     punto medio abriendo el renglón se lee como un bullet perdido. -->
                <span>
                  @switch (a.status) {
                    @case ('programado') {
                      Programado · sale el {{ a.scheduledFor | date: 'dd/MM HH:mm' }}
                    }
                    @case ('enviando') {
                      Enviando ahora
                    }
                    @case ('cancelado') {
                      Cancelado
                    }
                    @default {
                      Enviado el {{ a.sentAt | date: 'dd/MM HH:mm' }}
                    }
                  }
                  ·
                </span>
                <span class="font-normal text-text-muted">{{ recipientsLabel(a) }}</span>
              </p>

              <!-- Metadatos secundarios: sede y emisor no compiten con el estado. -->
              <p class="flex flex-wrap items-center gap-x-3 text-xs text-text-muted">
                <span>{{ a.branchLabel }}</span>
                <span>{{ a.sentByName }}</span>
                @if (a.email_failed_count > 0) {
                  <span class="text-error">{{ a.email_failed_count }} sin entregar</span>
                }
              </p>
            </div>

            @if (a.canCancel) {
              <!-- Botón de verdad y separado de los metadatos: cancelar impide un envío,
                   no puede ser un link perdido entre texto gris (AC8). -->
              <button
                type="button"
                class="shrink-0 cursor-pointer rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-2xs font-semibold text-error transition-colors hover:bg-error-subtle"
                data-llm-action="cancelar-comunicado-programado"
                (click)="onCancel($event, a.id)"
              >
                Cancelar
              </button>
            }
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
  readonly cancelRequested = output<number>();

  protected readonly skeletonRows = [0, 1, 2, 3];

  protected statusIcon(status: AnnouncementStatus): string {
    switch (status) {
      case 'programado':
        return 'calendar-clock';
      case 'enviando':
        return 'send';
      case 'cancelado':
        return 'ban';
      default:
        return 'check-circle';
    }
  }

  /**
   * Un comunicado `programado` tiene `recipients_total = 0` porque el segmento se resuelve
   * recién al enviar (spec 0041-b, AC-E4). Decir "0 destinatario(s)" es técnicamente cierto
   * y se lee como "no le va a llegar a nadie", así que ese caso se nombra por lo que es.
   */
  protected recipientsLabel(a: AnnouncementRow): string {
    if (a.status === 'programado') return 'destinatarios al momento del envío';
    if (a.status === 'cancelado') return 'no se envió';
    return a.recipients_total === 1 ? '1 destinatario' : `${a.recipients_total} destinatarios`;
  }

  /** Sin `stopPropagation` el clic también abriría el detalle del comunicado. */
  protected onCancel(event: Event, id: number): void {
    event.stopPropagation();
    this.cancelRequested.emit(id);
  }
}
