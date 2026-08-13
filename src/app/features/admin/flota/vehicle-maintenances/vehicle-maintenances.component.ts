import { TooltipModule } from 'primeng/tooltip';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  afterNextRender,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

// Directives & Services
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

// Shared
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';

// Facades & Services
import { FlotaDetalleFacade } from '@core/facades/flota-detalle.facade';
import { FlotaFacade } from '@core/facades/flota.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

// Models
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';

// Drawer Content
import { MaintenanceFormDrawerComponent } from '../maintenance-form-drawer/maintenance-form-drawer.component';
import { RouteSheetDrawerComponent } from '../route-sheet-drawer/route-sheet-drawer.component';

/**
 * VehicleMaintenancesComponent — Smart Page (subruta: /flota/:id/mantenimientos)
 * Usa Bento Grid canónico: SectionHero + KpiCardVariantComponent + tabla historial.
 * Incluye botón de Hoja de Ruta imprimible.
 */
@Component({
  selector: 'app-vehicle-maintenances',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
    CommonModule,
    RouterModule,
    TableModule,
    ButtonModule,
    TagModule,
    // Layout
    BentoGridLayoutDirective,
    AnimateInDirective,
    CardHoverDirective,
    // Shared
    IconComponent,
    SectionHeroComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
  ],
  template: `
    <div
      class="bento-grid"
      [class.bento-grid--fill-screen-kpi]="hasScheduledMaintenances()"
      [class.bento-grid--fill-screen]="!hasScheduledMaintenances()"
      [class.force-compact]="layoutDrawer.isOpen()"
      appBentoGridLayout
      #bentoGrid
      aria-label="Mantenimientos del Vehículo"
    >
      <!-- Hero con breadcrumb + acciones -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        [title]="heroTitle()"
        [subtitle]="heroSubtitle()"
        [chips]="heroChips()"
        [actions]="heroActions()"
        [kpis]="maintenanceKpis()"
        backRoute="/app/admin/flota"
        backLabel="Flota"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- Documentos/Próximas Fechas (Bento Squares) — ANTES de la tabla para calzar
           con --fill-screen-kpi (fila auto de KPIs). Si no hay ninguna, el root cae a
           --fill-screen (sin fila 2) para que la tabla siga cayendo en la fila fill. -->
      @if (hasScheduledMaintenances()) {
        @for (s of facade.scheduledMaintenances(); track s.type) {
          <div class="bento-square">
            <div
              class="card h-full flex flex-col gap-2 border-l-4"
              appCardHover
              [class]="scheduledBorderColor(s.status)"
            >
              <div class="flex items-center justify-between">
                <span class="text-2xs font-black uppercase tracking-wider text-text-muted">{{
                  s.type
                }}</span>
                <p-tag
                  [value]="scheduledStatusLabel(s.status)"
                  [severity]="scheduledSeverity(s.status)"
                  styleClass="text-2xs font-bold px-1.5"
                />
              </div>
              <p class="text-lg font-bold text-text-primary mt-1">{{ s.dueDate ?? 'Sin fecha' }}</p>
              <div class="flex items-center gap-1.5 mt-auto">
                <app-icon name="calendar-clock" [size]="12" class="text-text-muted" />
                <span class="text-xs text-text-muted font-medium">Control preventivo</span>
              </div>
            </div>
          </div>
        }
      }

      <!-- Tabla Historial (Bento Banner, celda protagonista) -->
      <div
        class="bento-banner bento-fill card p-0 overflow-hidden shadow-sm dual-viewport-container flex flex-col h-full"
        appAnimateIn
        appCardHover
      >
        <!-- Header de sección -->
        <div
          class="shrink-0 px-6 py-4 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2"
        >
          <h2 class="text-base font-bold text-text-primary">Historial Cronológico</h2>
          @if (!facade.isLoading()) {
            <span class="micro-label"> {{ facade.maintenances().length }} registros </span>
          }
        </div>

        <!-- Tabla -->
        @if (facade.isLoading()) {
          <div class="flex-1 min-h-0 overflow-y-auto p-6 space-y-2">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div class="flex items-center gap-4 py-2">
                <app-skeleton-block variant="text" width="80px" height="12px" />
                <app-skeleton-block variant="text" width="20%" height="12px" />
                <app-skeleton-block variant="text" width="12%" height="12px" />
                <app-skeleton-block variant="text" width="12%" height="12px" />
                <app-skeleton-block variant="text" width="15%" height="12px" />
                <app-skeleton-block variant="rect" width="70px" height="18px" />
              </div>
            }
          </div>
        } @else {
          <!-- VISTA Desktop: tabla -->
          <div class="desktop-view hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full">
            <p-table
              [value]="facade.maintenances()"
              styleClass="p-datatable-sm p-datatable-striped h-full flex flex-col"
              [rows]="10"
              [paginator]="true"
              [scrollable]="true"
              scrollHeight="flex"
              [showCurrentPageReport]="true"
              currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
            >
              <ng-template pTemplate="header">
                <tr class="text-left">
                  <th class="micro-label pl-6 py-4">Fecha</th>
                  <th class="micro-label">Tipo</th>
                  <th class="micro-label">Kilometraje</th>
                  <th class="micro-label">Costo</th>
                  <th class="micro-label">Taller</th>
                  <th class="micro-label">Estado</th>
                  <th class="micro-label pr-6 text-right">Acc.</th>
                </tr>
              </ng-template>

              <ng-template pTemplate="body" let-m>
                <tr class="list-item-hover transition-colors border-b border-border-subtle">
                  <td class="pl-6 py-4 text-sm font-medium text-text-secondary">{{ m.date }}</td>
                  <td>
                    <span class="item-title">{{ m.type }}</span>
                    @if (m.description) {
                      <p
                        class="text-2xs text-text-muted truncate max-w-50"
                        [pTooltip]="m.description"
                        tooltipPosition="top"
                      >
                        {{ m.description }}
                      </p>
                    }
                  </td>
                  <td class="font-mono text-xs text-text-secondary">
                    {{ m.km !== null ? (m.km | number) + ' km' : '—' }}
                  </td>
                  <td class="item-title">
                    {{ m.cost !== null ? '$' + (m.cost | number) : '—' }}
                  </td>
                  <td class="text-xs text-text-muted italic">{{ m.workshop ?? '—' }}</td>
                  <td>
                    <p-tag
                      [value]="m.status === 'completed' ? 'Completado' : 'Programado'"
                      [severity]="m.status === 'completed' ? 'success' : 'warn'"
                      styleClass="rounded-full text-2xs px-2 font-bold uppercase"
                    />
                  </td>
                  <td class="pr-6 text-right">
                    <button
                      pButton
                      class="p-button-text p-button-sm p-button-rounded h-8 w-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                      aria-label="Editar mantención"
                      data-llm-action="edit-maintenance"
                      (click)="openMaintenanceForm(m.id)"
                    >
                      <app-icon name="pencil" [size]="14" />
                    </button>
                  </td>
                </tr>
              </ng-template>

              <ng-template pTemplate="emptymessage">
                <tr>
                  <td colspan="7" class="p-0">
                    <app-empty-state
                      icon="wrench"
                      message="Historial vacío"
                      subtitle="No hay registros de mantenimiento para este vehículo aún."
                      actionLabel="Registrar Mantenimiento"
                      (action)="openMaintenanceForm()"
                    />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>

          <!-- VISTA Mobile: cards -->
          <div class="mobile-view show-on-squeeze flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            @if (facade.maintenances().length === 0) {
              <app-empty-state
                icon="wrench"
                message="Historial vacío"
                subtitle="No hay registros de mantenimiento para este vehículo aún."
                actionLabel="Registrar Mantenimiento"
                (action)="openMaintenanceForm()"
              />
            } @else {
              @for (m of facade.maintenances(); track m.id) {
                <div class="rounded-xl border overflow-hidden border-border-muted bg-surface">
                  <div class="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="item-title truncate">{{ m.type }}</p>
                      <p class="text-xs mt-0.5 text-text-muted">{{ m.date }}</p>
                    </div>
                    <p-tag
                      [value]="m.status === 'completed' ? 'Completado' : 'Programado'"
                      [severity]="m.status === 'completed' ? 'success' : 'warn'"
                      styleClass="shrink-0 rounded-full text-2xs px-2 font-bold uppercase"
                    />
                  </div>
                  @if (m.description) {
                    <p class="px-4 pb-3 text-xs text-text-muted">{{ m.description }}</p>
                  }
                  <div
                    class="grid grid-cols-3 divide-x divide-border-muted px-0 border-t border-b border-border-muted"
                  >
                    <div class="py-3 px-3 flex flex-col gap-0.5">
                      <span class="micro-label">Km</span>
                      <span class="text-xs font-mono text-text-secondary">
                        {{ m.km !== null ? (m.km | number) : '—' }}
                      </span>
                    </div>
                    <div class="py-3 px-3 flex flex-col gap-0.5">
                      <span class="micro-label">Costo</span>
                      <span class="item-title">
                        {{ m.cost !== null ? '$' + (m.cost | number) : '—' }}
                      </span>
                    </div>
                    <div class="py-3 px-3 flex flex-col gap-0.5 min-w-0">
                      <span class="micro-label">Taller</span>
                      <span class="text-xs text-text-muted italic truncate">{{
                        m.workshop ?? '—'
                      }}</span>
                    </div>
                  </div>
                  <div class="px-2 py-2 flex justify-end">
                    <button
                      pButton
                      class="p-button-text p-button-sm p-button-rounded h-8 w-8 p-0 flex items-center justify-center"
                      aria-label="Editar mantención"
                      data-llm-action="edit-maintenance"
                      (click)="openMaintenanceForm(m.id)"
                    >
                      <app-icon name="pencil" [size]="14" />
                    </button>
                  </div>
                </div>
              }
            }
          </div>
        }
      </div>

      <!-- Error state -->
      @if (!facade.isLoading() && facade.error()) {
        <div class="bento-banner">
          <app-empty-state
            icon="circle-alert"
            [message]="facade.error() || 'Error desconocido'"
            subtitle="Hubo un problema al cargar los datos del vehículo."
            actionLabel="Reintentar"
            (action)="reload()"
          />
        </div>
      }
    </div>
  `,
  styles: `
    :host ::ng-deep {
      .p-datatable .p-datatable-tbody > tr > td {
        padding: 0.5rem 1rem;
        border-bottom-color: var(--border-subtle);
      }
    }
    .dual-viewport-container {
      container-type: inline-size;
      container-name: maintenancesContainer;
    }
    .show-on-squeeze {
      display: none;
    }
    @container maintenancesContainer (max-width: 900px) {
      .hide-on-squeeze {
        display: none !important;
      }
      .show-on-squeeze {
        display: block !important;
      }
    }
  `,
})
export class VehicleMaintenancesComponent implements OnInit {
  protected readonly facade = inject(FlotaDetalleFacade);
  protected readonly flotaFacade = inject(FlotaFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly route = inject(ActivatedRoute);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');
  private vehicleId = 0;

  // ── Hero ──────────────────────────────────────────────────────────────────
  readonly heroTitle = computed(() => {
    const v = this.facade.vehicle();
    return v ? `${v.licensePlate}` : 'Mantenimientos';
  });

  readonly heroSubtitle = computed(() => {
    const v = this.facade.vehicle();
    return v
      ? `${v.vehicleLabel} · ${v.year} · ${v.currentKm?.toLocaleString() ?? '—'} km actuales`
      : 'Historial de mantenimiento del vehículo';
  });

  readonly heroChips = computed((): SectionHeroChip[] => {
    const k = this.facade.maintenanceKpis();
    return [
      { label: `${k.totalCount} servicios`, icon: 'wrench', style: 'default' },
      { label: `$${k.totalSpent.toLocaleString()} invertidos`, icon: 'banknote', style: 'default' },
    ];
  });

  readonly heroActions: () => SectionHeroAction[] = () => [
    { id: 'imprimir-hoja', label: 'Hoja de Ruta', icon: 'printer', primary: false },
    { id: 'registrar', label: 'Registrar Servicio', icon: 'plus', primary: true },
  ];

  // ── KPIs ──────────────────────────────────────────────────────────────────
  readonly maintenanceKpis = computed((): SectionHeroKpi[] => {
    const k = this.facade.maintenanceKpis();
    return [
      { id: 'total', label: 'Total Mantenciones', value: k.totalCount, icon: 'clipboard-list' },
      {
        id: 'gasto',
        label: 'Inversión Total',
        value: k.totalSpent,
        icon: 'banknote',
        color: 'warning' as const,
        prefix: '$',
      },
      {
        id: 'promedio',
        label: 'Costo p/Mes',
        value: k.avgMonthly,
        icon: 'trending-up',
        prefix: '$',
      },
      {
        id: 'km',
        label: 'KM Recorridos',
        value: k.kmTraveled,
        icon: 'gauge',
        color: 'success' as const,
        suffix: ' km',
      },
    ];
  });

  /**
   * Decide el modificador del root bento-grid: con fila de KPIs (`--fill-screen-kpi`)
   * solo si hay al menos 1 mantención programada, o sin ella (`--fill-screen`) si no —
   * sin esto, con 0 ítems el auto-placement de CSS Grid ubicaría la tabla en la fila
   * "auto" del medio en vez de la fila "fill", colapsándola a 0px (`.bento-fill` aplica
   * `contain:size` sin importar en qué fila cayó).
   */
  readonly hasScheduledMaintenances = computed(
    () => !this.facade.isLoading() && this.facade.scheduledMaintenances().length > 0,
  );

  constructor() {
    afterNextRender(() => {
      if (this.bentoGrid()) {
        setTimeout(() => this.gsap.animateBentoGrid(this.bentoGrid()!.nativeElement), 50);
      }
    });
  }

  ngOnInit(): void {
    this.vehicleId = Number(this.route.snapshot.paramMap.get('id'));
    if (!isNaN(this.vehicleId) && this.vehicleId > 0) {
      void this.facade.loadVehicleDetail(this.vehicleId);
      this.flotaFacade.selectVehicle(this.vehicleId);
    }
  }

  reload(): void {
    this.ngOnInit();
  }

  // ── Hero Action Handler ───────────────────────────────────────────────────
  handleHeroAction(id: string): void {
    if (id === 'registrar') {
      this.openMaintenanceForm();
    } else if (id === 'imprimir-hoja') {
      this.layoutDrawer.open(RouteSheetDrawerComponent, 'Hoja de Ruta', 'printer');
    }
  }

  openMaintenanceForm(maintId?: number): void {
    this.facade.selectMaintenance(maintId ?? null);
    this.layoutDrawer.open(
      MaintenanceFormDrawerComponent,
      maintId ? 'Editar Servicio' : 'Registrar Servicio',
      'wrench',
    );
  }

  scheduledBorderColor(status: string): string {
    const map: Record<string, string> = {
      ok: 'border-l-success',
      soon: 'border-l-warn',
      overdue: 'border-l-danger',
    };
    return map[status] ?? 'border-l-border-subtle';
  }

  scheduledStatusLabel(status: string): string {
    return { ok: 'Vigente', soon: 'Próximo', overdue: 'Vencido' }[status] ?? status;
  }

  scheduledSeverity(status: string): 'success' | 'warn' | 'danger' | 'info' {
    const map: Record<string, 'success' | 'warn' | 'danger' | 'info'> = {
      ok: 'success',
      soon: 'warn',
      overdue: 'danger',
    };
    return map[status] ?? 'info';
  }
}
