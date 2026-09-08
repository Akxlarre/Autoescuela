import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';

import { IconComponent } from '../icon/icon.component';
import { BadgeComponent } from '../badge/badge.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { getSpecColor } from '@core/utils/professional-specializations';
import type { RelatorTableRow } from '@core/models/ui/relator-table.model';

/**
 * RelatorCard — card de relator para la vista comprimida/móvil de Relatores.
 *
 * Fix-161-b (rollout fix-158-b/159-b): unifica el pill de estado a `app-badge` (antes
 * `p-tag`). El pill de especialidad (`spec-badge`) se mantiene aparte a propósito — su
 * color es dinámico por especialidad vía `getSpecColor()`, no un severity fijo de 5
 * variantes; forzarlo a `app-badge` perdería esa codificación de color por materia.
 */
@Component({
  selector: 'app-relator-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
            <app-skeleton-block variant="circle" width="36px" height="36px" />
            <div class="flex flex-col gap-1.5 flex-1">
              <app-skeleton-block variant="text" width="70%" height="13px" />
              <app-skeleton-block variant="text" width="45%" height="10px" />
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
        data-llm-description="Ficha resumen de un relator"
      >
        <div class="p-4 border-b border-border-subtle flex flex-col gap-2">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="shrink-0 w-9 h-9 rounded-full bg-brand-tint text-brand flex items-center justify-center text-xs font-bold"
            >
              {{ relator().initials }}
            </div>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="item-title truncate">{{ relator().nombre }}</span>
              <span class="text-xs text-text-muted truncate">{{ relator().rut }}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <app-badge [variant]="estadoBadgeVariant()">
              {{ relator().estado === 'activo' ? 'Activo' : 'Inactivo' }}
            </app-badge>
          </div>
        </div>

        <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
          <div class="flex flex-col gap-1">
            <span class="micro-label">Especialidades</span>
            <div class="flex flex-wrap gap-1.5">
              @for (spec of relator().specializations; track spec) {
                <span class="spec-badge" [style.background]="getSpecColor(spec)">{{ spec }}</span>
              } @empty {
                <span class="text-text-muted text-xs">—</span>
              }
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="micro-label">WhatsApp</span>
            <span class="font-medium text-text-secondary text-xs">{{
              relator().phone || '—'
            }}</span>
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
            (click)="verRequested.emit(relator())"
            data-llm-action="view-relator-card"
          >
            <app-icon name="eye" [size]="16" />
          </button>
          <button
            aria-label="Editar relator"
            pButton
            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
            pTooltip="Editar relator"
            (click)="editarRequested.emit(relator())"
            data-llm-action="edit-relator-card"
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

    .spec-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 26px;
      height: 20px;
      padding: 0 6px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      color: #fff;
    }
  `,
})
export class RelatorCardComponent {
  readonly relator = input.required<RelatorTableRow>();
  readonly loading = input(false);

  readonly verRequested = output<RelatorTableRow>();
  readonly editarRequested = output<RelatorTableRow>();

  protected readonly estadoBadgeVariant = computed(() =>
    this.relator().estado === 'activo' ? 'success' : 'neutral',
  );

  protected getSpecColor(spec: string): string {
    return getSpecColor(spec);
  }
}
