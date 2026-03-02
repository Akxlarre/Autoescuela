import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';

/**
 * KpiCardSkeletonComponent — Skeleton colocated de KpiCardComponent.
 *
 * Refleja la estructura del KPI card para evitar layout shift durante la carga.
 * Úsalo en la misma celda bento mientras esperas los datos del Facade.
 *
 * @example
 * @if (facade.loading()) {
 *   <app-kpi-card-skeleton />
 * } @else {
 *   <app-kpi-card [value]="facade.totalUsers()" label="Usuarios activos" [appAnimateIn] />
 * }
 */
@Component({
  selector: 'app-kpi-card-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonBlockComponent],
  styles: [
    `
      .card {
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: var(--card-radius);
        box-shadow: var(--card-shadow);
      }
    `,
  ],
  template: `
    <div
      class="card card-tinted flex flex-col gap-2 h-full"
      aria-busy="true"
      aria-label="Cargando métrica"
    >
      <!-- header: label (izq) + chip de ícono (der) -->
      <div class="flex items-start justify-between gap-3">
        <app-skeleton-block variant="text" width="55%" height="12px" />
        <app-skeleton-block variant="rect" width="36px" height="36px" />
      </div>

      <!-- kpi-value placeholder -->
      <app-skeleton-block width="70%" height="44px" />

      <!-- trend pill placeholder -->
      <div class="flex items-center gap-2 mt-auto">
        <app-skeleton-block variant="rect" width="64px" height="22px" />
        <app-skeleton-block variant="text" width="80px" height="12px" />
      </div>
    </div>
  `,
})
export class KpiCardSkeletonComponent {}
