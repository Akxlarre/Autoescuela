import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';

// Shared Components
import { IconComponent } from '../icon/icon.component';
import { KpiCardVariantComponent } from '../kpi-card/kpi-card-variant.component';
import { ActionKpiCardComponent } from '../kpi-card/action-kpi-card.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '../section-hero/section-hero.component';

// Directives
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';

// Services
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

// Models
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';
import type { VehicleTableRow, FlotaKpis, VehicleType, VehicleStatus } from '@core/models/ui/vehicle-table.model';

/**
 * FlotaListContentComponent — Dumb Component (Organismo)
 *
 * Tabla de vehículos reutilizable para Admin y Secretaría.
 * Implementa el patrón Bento Grid y Dual-Viewport (Tabla Desktop / Tarjetas Mobile).
 */
@Component({
  selector: 'app-flota-list-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    SelectModule,
    TagModule,
    TooltipModule,
    InputTextModule,
    IconComponent,
    KpiCardVariantComponent,
    ActionKpiCardComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    BentoGridLayoutDirective,
    AnimateInDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid aria-label="Panel de flota">

      <!-- HERO -->
      <div class="bento-banner" #heroRef>
        <app-section-hero
          title="Gestión de Flota"
          subtitle="Control de vehículos, disponibilidad y mantenimientos."
          [chips]="heroChips()"
          [actions]="heroActions()"
          (actionClick)="handleHeroAction($event)"
        />
      </div>

      <!-- KPIs -->
      <div class="bento-square">
        <app-kpi-card-variant
          label="Total Vehículos"
          [value]="kpis().total"
          icon="car"
          color="default"
          [accent]="true"
          [loading]="isLoading()"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Disponibles"
          [value]="kpis().available"
          icon="circle-check"
          color="success"
          [loading]="isLoading()"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="En Clase"
          [value]="kpis().inClass"
          icon="graduation-cap"
          color="default"
          [loading]="isLoading()"
        />
      </div>

      <!-- KPI Acción: Mantenimiento -->
      <div class="bento-square">
        <app-action-kpi-card
          label="En Taller"
          [value]="kpis().maintenance"
          icon="wrench"
          color="warning"
          [loading]="isLoading()"
          (click)="onStatusChange('maintenance')"
        >
          <div footer class="flex items-center gap-1 text-xs text-text-muted mt-2 group-hover:text-text-primary transition-colors">
            <span>Filtrar activos</span>
            <app-icon name="arrow-right" [size]="12" />
          </div>
        </app-action-kpi-card>
      </div>

      <!-- TABLA CARD (Dual-Viewport) -->
      <div class="bento-banner card p-0 overflow-hidden shadow-sm dual-viewport-container" appAnimateIn>

        <!-- Toolbar -->
        <div class="toolbar-wrapper">
          <div class="toolbar-filters">
            <div class="toolbar-search">
              <app-icon
                name="search"
                [size]="16"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10 pointer-events-none"
              />
              <input
                pInputText
                type="text"
                placeholder="Buscar por patente, marca o modelo..."
                class="w-full !pl-10 h-10 rounded-lg border-border-subtle hover:border-border-strong focus:border-brand bg-base"
                [(ngModel)]="searchTerm"
                (ngModelChange)="onSearchChange($event)"
              />
            </div>
            <div class="toolbar-dropdowns">
              <p-select
                [options]="typeOptions"
                [(ngModel)]="selectedType"
                placeholder="Tipo"
                styleClass="h-10 w-full"
                (ngModelChange)="onTypeChange($event)"
              />
              <p-select
                [options]="statusOptions"
                [(ngModel)]="selectedStatus"
                placeholder="Estado"
                styleClass="h-10 w-full toolbar-dropdown--full"
                (ngModelChange)="onStatusChange($event)"
              />
            </div>
          </div>
          <div class="toolbar-actions">
            <button
              pButton
              label="Actualizar"
              class="p-button-outlined p-button-sm h-10 px-4"
              [loading]="isLoading()"
              (click)="refreshRequested.emit()"
            >
              <app-icon name="refresh-cw" [size]="14" class="mr-2" />
            </button>
          </div>
        </div>

        <!-- ─────────────── LOADING ─────────────── -->
        @if (isLoading()) {
          <div class="viewport-content bg-surface">
            <!-- VISTA Desktop Skeleton -->
            <div class="desktop-view hide-on-squeeze p-4">
              <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                @for (w of ['15%','20%','15%','10%','10%','12%']; track w) {
                  <app-skeleton-block variant="text" [width]="w" height="11px" />
                }
              </div>
              @for (row of [1,2,3,4,5]; track row) {
                <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                  <app-skeleton-block variant="rect" width="70px" height="26px" />
                  <div class="flex flex-col gap-1.5 w-[20%]">
                    <app-skeleton-block variant="text" width="80%" height="12px" />
                    <app-skeleton-block variant="text" width="50%" height="10px" />
                  </div>
                  <app-skeleton-block variant="text" width="15%" height="12px" />
                  <app-skeleton-block variant="text" width="10%" height="12px" />
                  <app-skeleton-block variant="rect" width="80px" height="20px" />
                  <div class="flex gap-1 ml-auto">
                    @for (b of [1,2,3,4]; track b) {
                      <app-skeleton-block variant="circle" width="28px" height="28px" />
                    }
                  </div>
                </div>
              }
            </div>
            <!-- VISTA Mobile Skeleton -->
            <div class="mobile-view show-on-squeeze p-4 space-y-4">
              @for (card of [1,2]; track card) {
                <div class="bg-base border border-border-subtle rounded-xl p-4 space-y-4">
                  <div class="flex justify-between items-start">
                    <app-skeleton-block variant="rect" width="70px" height="26px" />
                    <app-skeleton-block variant="rect" width="60px" height="20px" />
                  </div>
                  <div class="space-y-2">
                    <app-skeleton-block variant="text" width="90%" height="14px" />
                    <app-skeleton-block variant="text" width="60%" height="12px" />
                  </div>
                </div>
              }
            </div>
          </div>
        } @else {
          <!-- ─────────────── CONTENIDO REAL ─────────────── -->
          <div class="viewport-content bg-surface">

            <!-- VISTA 1: TABLA Desktop -->
            <div class="desktop-view hide-on-squeeze">
              <p-table
                [value]="vehicles()"
                [rows]="10"
                [paginator]="true"
                responsiveLayout="scroll"
                styleClass="p-datatable-sm p-datatable-striped"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} vehículos"
              >
                <ng-template pTemplate="header">
                  <tr class="bg-subtle text-text-muted uppercase text-xs tracking-wider font-medium text-left">
                    <th class="pl-6 py-4">Patente</th>
                    <th>Vehículo</th>
                    <th>Instructor</th>
                    <th>KM</th>
                    <th>Estado</th>
                    <th class="pr-6 text-right">Acciones</th>
                  </tr>
                </ng-template>

                <ng-template pTemplate="body" let-v>
                  <tr class="hover:bg-subtle transition-colors border-b border-border-subtle">
                    <td class="pl-6 py-4">
                      <span class="font-mono font-bold bg-elevated px-2 py-1 rounded border border-border-subtle text-sm uppercase">
                        {{ v.licensePlate }}
                      </span>
                    </td>
                    <td>
                      <div class="flex flex-col">
                        <span class="font-bold text-sm text-text-primary">{{ v.brand }} {{ v.model }}</span>
                        <span class="text-[11px] text-text-muted">{{ v.year }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-elevated flex items-center justify-center border border-border-subtle text-text-secondary font-bold text-xs">
                          {{ v.instructorName ? v.instructorName.charAt(0) : '?' }}
                        </div>
                        <span class="text-xs text-text-secondary">{{ v.instructorName || 'Sin asignar' }}</span>
                      </div>
                    </td>
                    <td class="text-xs font-mono text-text-secondary">{{ v.currentKm | number }} km</td>
                    <td>
                      <p-tag
                        [severity]="statusSeverity(v.status)"
                        [value]="statusLabel(v.status)"
                        styleClass="text-[10px] font-bold px-2 py-0.5"
                      />
                    </td>
                    <td class="pr-6 text-right">
                      <div class="inline-flex items-center justify-end gap-0.5 p-0.5 rounded-lg hover:bg-elevated hover:shadow-sm border border-transparent transition-all">
                        <button pButton class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0" pTooltip="Agenda" (click)="viewAgenda.emit(v.id)">
                          <app-icon name="calendar" [size]="16" />
                        </button>
                        <button pButton class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0" pTooltip="Documentos" (click)="manageDocuments.emit(v.id)">
                          <app-icon name="file-text" [size]="16" />
                        </button>
                        <button pButton class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0" pTooltip="Editar" (click)="editVehicle.emit(v.id)">
                          <app-icon name="pencil" [size]="16" />
                        </button>
                        <a pButton class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center" [routerLink]="[basePath(), 'flota', v.id, 'mantenimientos']" pTooltip="Mantenimientos">
                          <app-icon name="wrench" [size]="16" />
                        </a>
                      </div>
                    </td>
                  </tr>
                </ng-template>

                <ng-template pTemplate="emptymessage">
                  <tr>
                    <td colspan="6" class="p-0">
                      <app-empty-state
                        icon="car"
                        message="No se encontraron vehículos"
                        subtitle="Intenta ajustar la búsqueda o los filtros."
                        actionLabel="Limpiar filtros"
                        (action)="resetFilters()"
                      />
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </div>

            <!-- VISTA 2: TARJETAS Mobile -->
            <div class="mobile-view show-on-squeeze p-4 space-y-4">
              @for (v of vehicles(); track v.id) {
                <div class="flex flex-col bg-base border border-border-subtle rounded-xl overflow-hidden shadow-sm hover:border-brand hover:-translate-y-0.5 transition-all">
                  <div class="p-4 border-b border-border-subtle flex items-start justify-between gap-3 bg-subtle">
                    <span class="font-mono font-bold bg-white px-2 py-1 rounded border border-border-subtle text-xs">
                      {{ v.licensePlate }}
                    </span>
                    <p-tag [value]="statusLabel(v.status)" [severity]="statusSeverity(v.status)" styleClass="text-[9px] px-1.5" />
                  </div>
                  <div class="p-4 space-y-3">
                    <p class="font-bold text-sm text-text-primary">{{ v.brand }} {{ v.model }} <span class="text-text-muted font-medium">({{ v.year }})</span></p>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                      <div class="flex flex-col">
                        <span class="text-text-muted mb-0.5">Instructor</span>
                        <span class="truncate">{{ v.instructorName || '—' }}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-text-muted mb-0.5">Kilometraje</span>
                        <span class="font-mono">{{ v.currentKm | number }} km</span>
                      </div>
                    </div>
                  </div>
                  <div class="p-2 border-t border-border-subtle flex justify-end gap-1">
                    <button pButton class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0" (click)="viewAgenda.emit(v.id)"><app-icon name="calendar" [size]="14" /></button>
                    <button pButton class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0" (click)="manageDocuments.emit(v.id)"><app-icon name="file-text" [size]="14" /></button>
                    <button pButton class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0" (click)="editVehicle.emit(v.id)"><app-icon name="pencil" [size]="14" /></button>
                    <a pButton class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center" [routerLink]="[basePath(), 'flota', v.id, 'mantenimientos']"><app-icon name="wrench" [size]="14" /></a>
                  </div>
                </div>
              } @empty {
                <app-empty-state icon="car" message="Sin resultados" (action)="resetFilters()" />
              }
            </div>

          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dual-viewport-container {
      container-type: inline-size;
      container-name: flotaContainer;
    }
    .show-on-squeeze { display: none; }
    @container flotaContainer (max-width: 850px) {
      .hide-on-squeeze { display: none !important; }
      .show-on-squeeze { display: block !important; }
    }

    .toolbar-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
      border-bottom: 1px solid var(--border-subtle);
      background-color: var(--surface);
    }
    .toolbar-filters {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
    }
    .toolbar-search { position: relative; width: 100%; }
    .toolbar-dropdowns { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
    ::ng-deep .toolbar-dropdown--full { grid-column: span 2; }
    .toolbar-actions { display: flex; width: 100%; }
    .toolbar-actions button { flex: 1; justify-content: center; }

    @container flotaContainer (min-width: 850px) {
      .toolbar-wrapper { flex-direction: row; align-items: center; justify-content: space-between; }
      .toolbar-filters { flex-direction: row; width: auto; flex: 1; }
      .toolbar-search { width: 18rem; }
      .toolbar-dropdowns { display: flex; width: auto; }
      ::ng-deep .toolbar-dropdowns p-select { min-width: 10rem; }
      ::ng-deep .toolbar-dropdown--full { grid-column: auto; }
      .toolbar-actions { width: auto; }
      .toolbar-actions button { flex: none; }
    }
  `],
})
export class FlotaListContentComponent {
  readonly vehicles = input<VehicleTableRow[]>([]);
  readonly kpis = input<FlotaKpis>({ total: 0, available: 0, inClass: 0, maintenance: 0 });
  readonly isLoading = input(false);
  readonly basePath = input<string>('/app/admin');

  readonly newVehicle = output<void>();
  readonly editVehicle = output<number>();
  readonly viewAgenda = output<number>();
  readonly viewMaintenances = output<number>();
  readonly printRouteSheet = output<number>();
  readonly printAllRouteSheets = output<void>();
  readonly manageDocuments = output<number>();
  readonly typeFilterChange = output<VehicleType | null>();
  readonly statusFilterChange = output<VehicleStatus | null>();
  readonly searchChange = output<string>();
  readonly refreshRequested = output<void>();

  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');
  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');

  searchTerm = '';
  selectedType: VehicleType | null = null;
  selectedStatus: VehicleStatus | null = null;

  readonly typeOptions = [
    { label: 'Todos los tipos', value: null },
    { label: 'Clase B', value: 'class_b' as VehicleType },
    { label: 'Profesional', value: 'professional' as VehicleType },
  ];
  readonly statusOptions = [
    { label: 'Todos los estados', value: null },
    { label: 'Disponible', value: 'available' as VehicleStatus },
    { label: 'En Clase', value: 'in_class' as VehicleStatus },
    { label: 'Mantenimiento', value: 'maintenance' as VehicleStatus },
    { label: 'Fuera de Servicio', value: 'out_of_service' as VehicleStatus },
  ];

  readonly heroChips = computed((): SectionHeroChip[] => [
    { label: `${this.kpis().total} vehículos`, icon: 'car', style: 'default' },
  ]);

  readonly heroActions = computed((): SectionHeroAction[] => [
    { id: 'print-all', label: 'Hojas de Ruta', icon: 'printer', primary: false },
    { id: 'new-vehicle', label: 'Nuevo Vehículo', icon: 'plus', primary: true },
  ]);

  ngAfterViewInit(): void {
    const hero = this.heroRef();
    const grid = this.bentoGrid();

    if (hero) this.gsap.animateHero(hero.nativeElement);
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  handleHeroAction(actionId: string): void {
    if (actionId === 'new-vehicle') this.newVehicle.emit();
    if (actionId === 'print-all') this.printAllRouteSheets.emit();
  }

  onSearchChange(v: string): void { this.searchChange.emit(v); }
  onTypeChange(v: VehicleType | null): void { this.typeFilterChange.emit(v); }
  onStatusChange(v: VehicleStatus | null): void {
    this.selectedStatus = v;
    this.statusFilterChange.emit(v);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedType = null;
    this.selectedStatus = null;
    this.searchChange.emit('');
    this.typeFilterChange.emit(null);
    this.statusFilterChange.emit(null);
  }

  statusLabel(status: string): string {
    return { available: 'Disponible', in_class: 'En Clase', maintenance: 'Taller', out_of_service: 'Baja' }[status] || status;
  }
  statusSeverity(status: string): 'success' | 'warn' | 'danger' | 'info' {
    return { available: 'success', in_class: 'info', maintenance: 'warn', out_of_service: 'danger' }[status] as any || 'info';
  }
}
