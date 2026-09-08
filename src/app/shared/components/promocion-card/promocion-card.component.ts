import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';

import { IconComponent } from '../icon/icon.component';
import { BadgeComponent } from '../badge/badge.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { getCourseColor } from '@core/utils/course-colors';
import type { BadgeVariant } from '@core/utils/alumno-status.utils';
import type { PromocionTableRow, PromocionStatus } from '@core/models/ui/promocion-table.model';

const STATUS_BADGE_VARIANT: Record<PromocionStatus, BadgeVariant> = {
  planned: 'warning',
  in_progress: 'success',
  finished: 'info',
  cancelled: 'error',
};

/**
 * PromocionCard — card de promoción profesional para la vista comprimida/móvil.
 *
 * Fix-161-b (rollout fix-158-b/159-b): reemplaza `.promo-card` (clase propia ad-hoc, no
 * `.card`) + `p-tag` por `.card` + `app-badge`. `course-badge` se mantiene aparte — color
 * dinámico por curso vía `getCourseColor()`, no un severity fijo.
 */
@Component({
  selector: 'app-promocion-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    TooltipModule,
    ButtonModule,
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    CardHoverDirective,
  ],
  template: `
    @if (loading()) {
      <div class="card p-0 overflow-hidden flex flex-col">
        <div class="p-4 border-b border-border-subtle flex flex-col gap-2">
          <div class="flex items-center gap-3">
            <app-skeleton-block variant="circle" width="40px" height="40px" />
            <div class="flex flex-col gap-1.5 flex-1">
              <app-skeleton-block variant="text" width="70%" height="13px" />
              <app-skeleton-block variant="text" width="40%" height="11px" />
            </div>
          </div>
        </div>
        <div class="p-4 flex flex-col gap-3">
          <app-skeleton-block variant="text" width="90%" height="11px" />
          <div class="flex flex-wrap gap-2">
            <app-skeleton-block variant="rect" width="30px" height="18px" />
            <app-skeleton-block variant="rect" width="30px" height="18px" />
          </div>
        </div>
      </div>
    } @else {
      <div
        appCardHover
        class="card p-0 overflow-hidden flex flex-col"
        data-llm-description="Ficha resumen de una promoción"
      >
        <div class="p-4 border-b border-border-subtle flex flex-col gap-2">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="shrink-0 w-10 h-10 rounded-full bg-brand-tint text-brand flex items-center justify-center"
            >
              <app-icon name="calendar" [size]="18" />
            </div>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="item-title truncate">{{ promocion().name }}</span>
              <span class="text-xs font-mono text-text-muted">{{ promocion().code }}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <app-badge [variant]="statusBadgeVariant()">{{ promocion().statusLabel }}</app-badge>
          </div>
        </div>

        <div class="p-4 flex flex-col gap-3 text-sm">
          <div class="flex items-center gap-4 flex-wrap">
            <span class="flex items-center gap-1.5 text-xs text-text-muted">
              <app-icon name="calendar" [size]="12" />
              {{ promocion().startDate | date: 'dd/MM/yyyy' }} →
              {{ promocion().endDate | date: 'dd/MM/yyyy' }}
            </span>
            <span class="flex items-center gap-1.5 text-xs text-text-secondary">
              <app-icon name="users" [size]="12" />
              {{ promocion().totalEnrolled }} / {{ promocion().maxStudents }} alumnos
            </span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="micro-label">Cursos</span>
            <div class="flex flex-wrap gap-1.5">
              @for (curso of promocion().cursos; track curso.id) {
                <span
                  class="course-badge"
                  [style.background]="getCourseColor(curso.courseCode)"
                  [pTooltip]="
                    curso.courseName +
                    ': ' +
                    curso.enrolledStudents +
                    '/' +
                    curso.maxStudents +
                    ' alumnos'
                  "
                >
                  {{ curso.courseCode }}
                </span>
              }
            </div>
          </div>
        </div>

        <div
          class="p-2 bg-transparent border-t border-border-subtle flex items-center justify-end gap-0.5 mt-auto"
        >
          <button
            aria-label="Ver detalle"
            pButton
            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
            pTooltip="Ver detalle"
            (click)="verRequested.emit(promocion())"
            data-llm-action="view-promocion-card"
          >
            <app-icon name="eye" [size]="16" />
          </button>
          <button
            aria-label="Editar promoción"
            pButton
            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
            pTooltip="Editar promoción"
            (click)="editarRequested.emit(promocion())"
            data-llm-action="edit-promocion-card"
          >
            <app-icon name="edit" [size]="16" />
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .course-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 22px;
      padding: 0 6px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
    }
  `,
})
export class PromocionCardComponent {
  readonly promocion = input.required<PromocionTableRow>();
  readonly loading = input(false);

  readonly verRequested = output<PromocionTableRow>();
  readonly editarRequested = output<PromocionTableRow>();

  protected readonly statusBadgeVariant = computed(
    () => STATUS_BADGE_VARIANT[this.promocion().status],
  );

  protected getCourseColor(code: string): string {
    return getCourseColor(code);
  }
}
