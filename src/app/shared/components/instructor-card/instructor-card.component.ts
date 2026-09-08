import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';

import { IconComponent } from '../icon/icon.component';
import { BadgeComponent } from '../badge/badge.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { avatarPalette } from '@core/utils/avatar-palette';
import type { BadgeVariant } from '@core/utils/alumno-status.utils';
import type { InstructorTableRow, LicenseStatus } from '@core/models/ui/instructor-table.model';

const LICENSE_BADGE_VARIANT: Record<LicenseStatus, BadgeVariant> = {
  valid: 'success',
  expiring_soon: 'warning',
  expired: 'error',
};

/**
 * InstructorCard — card de instructor para la vista comprimida/móvil de Instructores.
 *
 * Fix-161-b (continuación del rollout fix-158-b/159-b): reemplaza el `.license-badge` con
 * estilo inline (`style="font-size: 10px; padding: 2px 8px;"` literal en el template) por
 * `app-badge` — mismo mapeo de color que el CSS ad-hoc que reemplaza
 * (`valid`→success, `expiring_soon`→warning, `expired`→error), pero vía token en vez de
 * `color-mix()` a mano en cada archivo. `.card` en vez de `bg-base border ... rounded-xl`.
 *
 * `sedeLabel` llega ya resuelto por input (no por `BranchFacade`): este componente es Dumb
 * puro y la resolución de sede vive en el Smart Component, que sí puede inyectar el Facade.
 */
@Component({
  selector: 'app-instructor-card',
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
          <div class="flex items-center justify-between gap-3">
            <app-skeleton-block variant="text" width="60%" height="14px" />
            <app-skeleton-block variant="rect" width="60px" height="20px" />
          </div>
          <app-skeleton-block variant="text" width="45%" height="11px" />
        </div>
        <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="45%" height="10px" />
              <app-skeleton-block variant="text" width="75%" height="12px" />
            </div>
          }
        </div>
      </div>
    } @else {
      <div
        appCardHover
        class="card p-0 overflow-hidden flex flex-col"
        data-llm-description="Ficha resumen de un instructor"
      >
        <div class="p-4 border-b border-border-subtle flex flex-col gap-2">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm uppercase"
              [style.background]="palette().bg"
              [style.color]="palette().text"
            >
              {{ instructor().initials }}
            </div>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="item-title truncate">{{ instructor().nombre }}</span>
              <span
                class="text-xs text-text-muted truncate"
                [pTooltip]="instructor().email"
                tooltipPosition="top"
                >{{ instructor().email }}</span
              >
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <app-badge [variant]="licenseBadgeVariant()">{{
              instructor().licenseStatusLabel
            }}</app-badge>
          </div>
        </div>

        <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
          <div class="flex flex-col gap-1">
            <span class="micro-label">RUT</span>
            <span class="font-medium text-text-secondary font-mono text-xs">{{
              instructor().rut
            }}</span>
          </div>
          @if (sedeLabel(); as sede) {
            <div class="flex flex-col gap-1">
              <span class="micro-label">Sede</span>
              <span class="font-medium text-text-secondary text-xs">{{ sede }}</span>
            </div>
          }
          <div class="flex flex-col gap-1">
            <span class="micro-label">Vehículo</span>
            <span class="font-medium text-text-secondary text-xs truncate">{{
              instructor().vehiclePlate || 'Sin asignar'
            }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="micro-label">Estado</span>
            <span
              class="font-medium text-xs"
              [class.text-success]="instructor().estado === 'activo'"
              [class.text-text-muted]="instructor().estado !== 'activo'"
            >
              {{ instructor().estado === 'activo' ? 'Activo' : 'Inactivo' }}
            </span>
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
            (click)="verRequested.emit(instructor())"
            data-llm-action="view-instructor-card"
          >
            <app-icon name="eye" [size]="16" />
          </button>
          <button
            aria-label="Editar instructor"
            pButton
            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
            pTooltip="Editar instructor"
            (click)="editarRequested.emit(instructor())"
            data-llm-action="edit-instructor-card"
          >
            <app-icon name="edit" [size]="16" />
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class InstructorCardComponent {
  readonly instructor = input.required<InstructorTableRow>();
  readonly loading = input(false);
  readonly sedeLabel = input<string | null>(null);

  readonly verRequested = output<InstructorTableRow>();
  readonly editarRequested = output<InstructorTableRow>();

  protected readonly palette = computed(() => avatarPalette(this.instructor().nombre));
  protected readonly licenseBadgeVariant = computed(
    () => LICENSE_BADGE_VARIANT[this.instructor().licenseStatus],
  );
}
