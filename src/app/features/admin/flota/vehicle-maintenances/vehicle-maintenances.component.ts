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
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

// Shared
import { IconComponent } from '@shared/components/icon/icon.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';

// Facades & Services
import { FlotaDetalleFacade } from '@core/facades/flota-detalle.facade';
import { FlotaFacade } from '@core/facades/flota.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

// Models
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';

// Drawer Content
import { MaintenanceFormDrawerComponent } from '../maintenance-form-drawer/maintenance-form-drawer.component';

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
    CommonModule,
    RouterModule,
    TableModule,
    ButtonModule,
    TagModule,
    // Layout
    BentoGridLayoutDirective,
    AnimateInDirective,
    // Shared
    IconComponent,
    KpiCardVariantComponent,
    SectionHeroComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid aria-label="Mantenimientos del Vehículo">

      <!-- Hero con breadcrumb + acciones -->
      <app-section-hero
        [title]="heroTitle()"
        [subtitle]="heroSubtitle()"
        [chips]="heroChips()"
        [actions]="heroActions()"
        (actionClick)="handleHeroAction($event)"
      >
        <!-- Breadcrumb slot -->
        <nav slot="breadcrumb" class="flex items-center gap-1.5 text-xs text-text-muted mb-1">
          <a routerLink="/app/admin/flota" class="hover:text-text-primary transition-colors flex items-center gap-1">
            <app-icon name="car" [size]="12" />
            Flota
          </a>
          <app-icon name="chevron-right" [size]="12" />
          <span class="text-text-secondary font-medium">Mantenimientos</span>
        </nav>
      </app-section-hero>

      <!-- KPIs Bento -->
      @for (kpi of maintenanceKpis(); track kpi.id) {
        <div class="bento-square">
          <app-kpi-card-variant
            [label]="kpi.label"
            [value]="kpi.value"
            [icon]="kpi.icon"
            [color]="kpi.color"
            [prefix]="kpi.prefix ?? ''"
            [suffix]="kpi.suffix ?? ''"
            [accent]="kpi.accent ?? false"
            [loading]="facade.isLoading()"
          />
        </div>
      }

      <!-- Tabla Historial (Bento Banner) -->
      <div class="bento-banner card p-0 overflow-hidden shadow-sm" appAnimateIn>

        <!-- Header de sección -->
        <div class="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <h2 class="text-base font-bold text-text-primary">Historial Cronológico</h2>
          <div class="flex items-center gap-2">
            @if (!facade.isLoading()) {
              <span class="text-xs font-bold text-text-muted uppercase tracking-widest">
                {{ facade.maintenances().length }} registros
              </span>
            }
            <button
              pButton
              label="Registrar Servicio"
              class="p-button-sm h-9 rounded-xl px-4 font-bold"
              (click)="openMaintenanceForm()"
            >
              <app-icon name="plus" [size]="14" class="mr-2" />
            </button>
          </div>
        </div>

        <!-- Tabla -->
        @if (facade.isLoading()) {
          <div class="p-6 space-y-2">
            @for (i of [1,2,3,4,5]; track i) {
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
          <p-table
            [value]="facade.maintenances()"
            styleClass="p-datatable-sm p-datatable-striped"
            [rows]="10"
            [paginator]="true"
            [showCurrentPageReport]="true"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
          >
            <ng-template pTemplate="header">
              <tr class="text-left">
                <th class="pl-6 py-4 text-xs uppercase tracking-wider text-text-muted font-medium bg-subtle">Fecha</th>
                <th class="text-xs uppercase tracking-wider text-text-muted font-medium bg-subtle">Tipo</th>
                <th class="text-xs uppercase tracking-wider text-text-muted font-medium bg-subtle">Kilometraje</th>
                <th class="text-xs uppercase tracking-wider text-text-muted font-medium bg-subtle">Costo</th>
                <th class="text-xs uppercase tracking-wider text-text-muted font-medium bg-subtle">Taller</th>
                <th class="text-xs uppercase tracking-wider text-text-muted font-medium bg-subtle">Estado</th>
                <th class="pr-6 text-right text-xs uppercase tracking-wider text-text-muted font-medium bg-subtle">Acc.</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-m>
              <tr class="group hover:bg-subtle transition-colors border-b border-border-subtle">
                <td class="pl-6 py-4 text-sm font-medium text-text-secondary">{{ m.date }}</td>
                <td>
                  <span class="font-bold text-sm text-text-primary">{{ m.type }}</span>
                  @if (m.description) {
                    <p class="text-[11px] text-text-muted truncate max-w-[200px]">{{ m.description }}</p>
                  }
                </td>
                <td class="font-mono text-xs text-text-secondary">
                  {{ m.km !== null ? (m.km | number) + ' km' : '—' }}
                </td>
                <td class="font-bold text-sm text-text-primary">
                  {{ m.cost !== null ? ('$' + (m.cost | number)) : '—' }}
                </td>
                <td class="text-xs text-text-muted italic">{{ m.workshop ?? '—' }}</td>
                <td>
                  <p-tag
                    [value]="m.status === 'completed' ? 'Completado' : 'Programado'"
                    [severity]="m.status === 'completed' ? 'success' : 'warn'"
                    styleClass="rounded-full text-[10px] px-2 font-bold uppercase"
                  />
                </td>
                <td class="pr-6 text-right">
                  <button
                    pButton
                    class="p-button-text p-button-sm p-button-rounded h-8 w-8 p-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95"
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
        }
      </div>

      <!-- Documentos/Próximas Fechas (Bento Squares) -->
      @if (!facade.isLoading() && facade.scheduledMaintenances().length > 0) {
        @for (s of facade.scheduledMaintenances(); track s.type) {
          <div class="bento-square">
            <div class="card h-full flex flex-col gap-2 border-l-4" [class]="scheduledBorderColor(s.status)">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-black uppercase tracking-wider text-text-muted">{{ s.type }}</span>
                <p-tag
                  [value]="scheduledStatusLabel(s.status)"
                  [severity]="scheduledSeverity(s.status)"
                  styleClass="text-[9px] font-bold px-1.5"
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

      <!-- Error state -->
      @if (!facade.isLoading() && facade.error()) {
        <div class="bento-banner">
          <app-empty-state
            icon="alert-circle"
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
  `,
})
export class VehicleMaintenancesComponent implements OnInit {
  protected readonly facade = inject(FlotaDetalleFacade);
  protected readonly flotaFacade = inject(FlotaFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
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
    return v ? `${v.vehicleLabel} · ${v.year} · ${v.currentKm?.toLocaleString() ?? '—'} km actuales` : 'Historial de mantenimiento del vehículo';
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
  readonly maintenanceKpis = computed(() => {
    const k = this.facade.maintenanceKpis();
    return [
      { id: 'total', label: 'Total Mantenciones', value: k.totalCount, icon: 'clipboard-list', color: 'default' as const, accent: true },
      { id: 'gasto', label: 'Inversión Total', value: k.totalSpent, icon: 'banknote', color: 'warning' as const, prefix: '$' },
      { id: 'promedio', label: 'Costo p/Mes', value: k.avgMonthly, icon: 'trending-up', color: 'default' as const, prefix: '$' },
      { id: 'km', label: 'KM Recorridos', value: k.kmTraveled, icon: 'gauge', color: 'success' as const, suffix: ' km' },
    ];
  });

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
      window.open(`/app/admin/flota/hoja-de-ruta/${this.vehicleId}`, '_blank');
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
