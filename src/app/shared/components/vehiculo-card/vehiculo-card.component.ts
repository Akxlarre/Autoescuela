import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';

import { IconComponent } from '../icon/icon.component';
import { BadgeComponent } from '../badge/badge.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import {
  vehicleDocWarningLabel,
  type VehicleDocWarningInfo,
} from '@core/utils/vehicle-document-status.utils';
import { VEHICLE_DOC_TYPES } from '@core/utils/vehicle-doc-types.util';
import type { BadgeVariant } from '@core/utils/alumno-status.utils';
import type { VehicleTableRow, VehicleStatus } from '@core/models/ui/vehicle-table.model';

const STATUS_LABEL: Record<VehicleStatus, string> = {
  available: 'Disponible',
  maintenance: 'Taller',
  out_of_service: 'Baja',
};

const STATUS_BADGE_VARIANT: Record<VehicleStatus, BadgeVariant> = {
  available: 'success',
  maintenance: 'warning',
  out_of_service: 'error',
};

/**
 * VehiculoCard — card de vehículo para la vista comprimida/móvil de Flota.
 *
 * Fix-161-b (rollout fix-158-b/159-b/160-b): la patente (fondo blanco opaco hardcodeado,
 * invisible en modo oscuro) ya se corrigió en fix-160-b antes de extraer este componente —
 * acá queda con `bg-elevated`. `app-badge` reemplaza `p-tag` para el estado del vehículo.
 */
@Component({
  selector: 'app-vehiculo-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    RouterModule,
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
        <div class="p-4 border-b border-border-subtle flex justify-between items-start">
          <app-skeleton-block variant="rect" width="70px" height="26px" />
          <app-skeleton-block variant="rect" width="60px" height="20px" />
        </div>
        <div class="p-4 flex flex-col gap-2">
          <app-skeleton-block variant="text" width="90%" height="14px" />
          <app-skeleton-block variant="text" width="60%" height="12px" />
        </div>
      </div>
    } @else {
      <div
        appCardHover
        class="card p-0 overflow-hidden flex flex-col"
        data-llm-description="Ficha resumen de un vehículo"
      >
        <div class="p-4 border-b border-border-subtle flex items-start justify-between gap-3">
          <span
            class="font-mono font-bold bg-elevated text-text-primary px-2 py-1 rounded border border-border-subtle text-xs"
          >
            {{ vehiculo().licensePlate }}
          </span>
          <div class="flex items-center gap-1.5">
            @if (docWarning(); as w) {
              <app-icon
                name="alert-triangle"
                [size]="15"
                [color]="hasExpiredDoc() ? 'var(--state-error)' : 'var(--state-warning)'"
                [pTooltip]="docWarningLabel()"
                tooltipPosition="top"
                [attr.aria-label]="docWarningLabel()"
              />
            }
            <app-badge [variant]="statusBadgeVariant()">{{ statusLabel() }}</app-badge>
          </div>
        </div>

        <div class="p-4 flex flex-col gap-3 text-sm">
          <p class="item-title">
            {{ vehiculo().brand }} {{ vehiculo().model }}
            <span class="text-text-muted font-medium">({{ vehiculo().year }})</span>
          </p>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <span class="micro-label">Instructor</span>
              <span
                class="font-medium text-text-secondary text-xs truncate"
                [pTooltip]="vehiculo().instructorName || '—'"
                tooltipPosition="top"
                >{{ vehiculo().instructorName || '—' }}</span
              >
            </div>
            <div class="flex flex-col gap-1">
              <span class="micro-label">Kilometraje</span>
              <span class="font-medium text-text-secondary text-xs font-mono"
                >{{ vehiculo().currentKm | number }} km</span
              >
            </div>
            @if (sedeLabel(); as sede) {
              <div class="flex flex-col gap-1">
                <span class="micro-label">Sede</span>
                <span class="font-medium text-text-secondary text-xs">{{ sede }}</span>
              </div>
            }
          </div>
        </div>

        <div
          class="p-2 bg-transparent border-t border-border-subtle flex items-center justify-end gap-0.5 mt-auto"
        >
          <button
            aria-label="Agenda"
            pButton
            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
            pTooltip="Agenda"
            (click)="viewAgenda.emit(vehiculo().id)"
            data-llm-action="ver-agenda-vehiculo-card"
          >
            <app-icon name="calendar" [size]="16" />
          </button>
          <button
            aria-label="Documentos"
            pButton
            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
            pTooltip="Documentos"
            (click)="manageDocuments.emit(vehiculo().id)"
            data-llm-action="gestionar-documentos-vehiculo-card"
          >
            <app-icon name="file-text" [size]="16" />
          </button>
          <button
            aria-label="Editar"
            pButton
            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
            pTooltip="Editar"
            (click)="editVehicle.emit(vehiculo().id)"
            data-llm-action="editar-vehiculo-card"
          >
            <app-icon name="pencil" [size]="16" />
          </button>
          <a
            pButton
            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
            pTooltip="Mantenimientos"
            [routerLink]="[basePath(), 'flota', vehiculo().id, 'mantenimientos']"
            data-llm-nav="mantenimientos-vehiculo-card"
          >
            <app-icon name="wrench" [size]="16" />
          </a>
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
export class VehiculoCardComponent {
  readonly vehiculo = input.required<VehicleTableRow>();
  readonly loading = input(false);
  readonly basePath = input<string>('/app/admin');
  readonly sedeLabel = input<string | null>(null);

  readonly viewAgenda = output<number>();
  readonly manageDocuments = output<number>();
  readonly editVehicle = output<number>();

  protected readonly statusLabel = computed(() => STATUS_LABEL[this.vehiculo().status]);
  protected readonly statusBadgeVariant = computed(
    () => STATUS_BADGE_VARIANT[this.vehiculo().status],
  );

  /** Documentos vencidos y por vencer, o null si están todos al día. Extraído de flota-list-content. */
  protected readonly docWarning = computed<VehicleDocWarningInfo | null>(() => {
    const expiredDocs: string[] = [];
    const expiringSoonDocs: string[] = [];
    for (const d of this.vehiculo().documents ?? []) {
      if (d.status === 'expired') expiredDocs.push(this.docTypeLabel(d.type));
      else if (d.status === 'expiring_soon') expiringSoonDocs.push(this.docTypeLabel(d.type));
    }
    return expiredDocs.length || expiringSoonDocs.length ? { expiredDocs, expiringSoonDocs } : null;
  });

  protected readonly hasExpiredDoc = computed(
    () => (this.docWarning()?.expiredDocs.length ?? 0) > 0,
  );

  protected readonly docWarningLabel = computed(() =>
    vehicleDocWarningLabel(this.vehiculo().licensePlate, this.docWarning()),
  );

  private docTypeLabel(type: string): string {
    return VEHICLE_DOC_TYPES.find((d) => d.value === type)?.label ?? type;
  }
}
