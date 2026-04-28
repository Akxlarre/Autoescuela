import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  effect,
} from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AdminPreInscritosFacade } from '@core/facades/admin-pre-inscritos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { AdminPreInscritoDrawerComponent } from './admin-pre-inscrito-drawer.component';
import type { PreInscritoTableRow } from '@core/models/ui/pre-inscrito-table.model';

@Component({
  selector: 'app-admin-pre-inscritos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    TableModule,
    TagModule,
    TooltipModule,
    IconComponent,
    SkeletonBlockComponent,
    KpiCardVariantComponent,
    SectionHeroComponent,
  ],
  template: `
    <div class="space-y-6 p-4 md:p-6">
      <app-section-hero
        title="Pre-inscritos Clase Profesional"
        subtitle="Gestión de pre-inscripciones online pendientes de revisión"
        icon="users"
        backRoute="/app/admin/alumnos"
        backLabel="Alumnos"
        [actions]="[]"
      />

      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <app-kpi-card-variant
          label="TOTAL PRE-INSCRITOS"
          [value]="facade.total()"
          icon="users"
          [loading]="facade.isLoading()"
        />
        <app-kpi-card-variant
          label="SIN EVALUAR TEST"
          [value]="facade.pendientesTest()"
          icon="clock"
          color="warning"
          [loading]="facade.isLoading()"
        />
        <app-kpi-card-variant
          label="APTOS (PENDIENTE MATRÍCULA)"
          [value]="facade.aprobados()"
          icon="check-circle"
          color="success"
          [loading]="facade.isLoading()"
        />
      </div>

      <!-- Filtros -->
      <div class="card flex flex-wrap items-center gap-3">
        <input
          type="text"
          class="border border-border rounded-lg px-3 py-2 text-sm text-primary bg-surface w-full sm:w-64 focus:outline-none focus:ring-2"
          style="focus-ring-color: var(--ds-brand)"
          placeholder="Buscar por nombre o RUT…"
          data-llm-description="search input for pre-inscribed students by name or RUT"
          [value]="searchQuery()"
          (input)="searchQuery.set($any($event.target).value)"
        />

        <p-select
          [options]="statusOptions"
          optionLabel="label"
          optionValue="value"
          [ngModel]="filterStatus()"
          (ngModelChange)="filterStatus.set($event)"
          styleClass="w-full sm:w-48"
          data-llm-description="filter pre-inscribed students by status"
        />
        <p-select
          [options]="licenciaOptions"
          optionLabel="label"
          optionValue="value"
          [ngModel]="filterLicencia()"
          (ngModelChange)="filterLicencia.set($event)"
          styleClass="w-full sm:w-36"
          data-llm-description="filter pre-inscribed students by license class"
        />

        @if (searchQuery() || filterStatus() || filterLicencia()) {
          <button
            type="button"
            class="text-sm text-secondary hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
            (click)="resetFiltros()"
          >
            <app-icon name="x" [size]="14" />
            Limpiar
          </button>
        }

        <span class="ml-auto text-sm text-secondary">
          {{ filtered().length }} resultado{{ filtered().length !== 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Tabla -->
      <div class="card p-0 overflow-hidden">
        @if (facade.isLoading()) {
          <div class="p-6 space-y-3">
            @for (i of skeletonRows; track i) {
              <app-skeleton-block variant="text" width="100%" height="44px" />
            }
          </div>
        } @else if (filtered().length === 0) {
          <div class="flex flex-col items-center justify-center py-16 gap-3">
            <app-icon name="users" [size]="40" color="var(--color-text-muted)" />
            <p class="text-secondary text-sm">No hay pre-inscritos con los filtros aplicados</p>
          </div>
        } @else {
          <p-table
            [value]="filtered()"
            [paginator]="filtered().length > 10"
            [rows]="10"
            styleClass="p-datatable-sm"
            [rowHover]="true"
          >
            <ng-template pTemplate="header">
              <tr>
                <th>Alumno</th>
                <th>RUT</th>
                <th>Clase</th>
                <th>Sede</th>
                <th>Test Psic.</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Vence</th>
                <th></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-row>
              <tr
                class="cursor-pointer"
                data-llm-action="open-pre-inscrito-detail"
                (click)="openDrawer(row)"
              >
                <td>
                  <div>
                    <p class="text-sm font-medium text-primary">{{ row.nombreCompleto }}</p>
                    <p class="text-xs text-secondary">{{ row.email }}</p>
                  </div>
                </td>
                <td class="text-sm font-mono text-secondary">{{ row.rut }}</td>
                <td>
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                    style="background: var(--ds-brand)"
                  >
                    {{ row.licencia }}
                  </span>
                </td>
                <td class="text-sm text-secondary">{{ row.sucursal }}</td>
                <td>
                  @if (row.psychResult === 'fit') {
                    <span class="inline-flex items-center gap-1 text-xs font-medium text-success">
                      <app-icon name="check-circle" [size]="14" />
                      Apto
                    </span>
                  } @else if (row.psychResult === 'unfit') {
                    <span class="inline-flex items-center gap-1 text-xs font-medium text-danger">
                      <app-icon name="x-circle" [size]="14" />
                      No Apto
                    </span>
                  } @else {
                    <span class="inline-flex items-center gap-1 text-xs text-secondary">
                      <app-icon name="clock" [size]="14" />
                      Pendiente
                    </span>
                  }
                </td>
                <td>
                  <p-tag
                    [value]="row.statusLabel"
                    [severity]="row.statusSeverity"
                    [rounded]="true"
                  />
                </td>
                <td class="text-sm text-secondary">{{ row.fechaPreInscripcion }}</td>
                <td>
                  @if (row.isVencido) {
                    <span class="text-xs text-danger font-medium">Vencido</span>
                  } @else if (row.diasParaVencer !== null && row.diasParaVencer <= 5) {
                    <span class="text-xs text-warning font-medium">
                      {{ row.diasParaVencer }}d
                    </span>
                  } @else {
                    <span class="text-xs text-secondary">{{ row.fechaVencimiento }}</span>
                  }
                </td>
                <td>
                  <button
                    type="button"
                    class="p-1.5 rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer"
                    pTooltip="Ver detalle"
                    tooltipPosition="left"
                    data-llm-action="view-pre-inscrito"
                    (click)="$event.stopPropagation(); openDrawer(row)"
                  >
                    <app-icon name="eye" [size]="16" color="var(--color-text-secondary)" />
                  </button>
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </div>
    </div>
  `,
})
export class AdminPreInscritosComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(AdminPreInscritosFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly searchQuery = signal('');
  protected readonly filterStatus = signal('');
  protected readonly filterLicencia = signal('');

  readonly statusOptions = [
    { label: 'Todos los estados', value: '' },
    { label: 'Sin evaluar', value: 'pending_review' },
    { label: 'Aptos', value: 'approved' },
    { label: 'Rechazados', value: 'rejected' },
    { label: 'Matriculados', value: 'enrolled' },
    { label: 'Vencidos', value: 'expired' },
  ];

  readonly licenciaOptions = [
    { label: 'Todas las clases', value: '' },
    { label: 'A2', value: 'A2' },
    { label: 'A3', value: 'A3' },
    { label: 'A4', value: 'A4' },
    { label: 'A5', value: 'A5' },
  ];
  protected readonly skeletonRows = Array(6).fill(0);

  protected readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const st = this.filterStatus();
    const lic = this.filterLicencia();

    return this.facade.preInscritos().filter((p) => {
      if (q && !p.nombreCompleto.toLowerCase().includes(q) && !p.rut.toLowerCase().includes(q)) {
        return false;
      }
      if (st && p.status !== st) return false;
      if (lic && p.licencia !== lic) return false;
      return true;
    });
  });

  constructor() {
    // Re-carga al cambiar sede
    effect(() => {
      const _ = this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }

  ngOnInit(): void {
    void this.facade.initialize();
  }

  ngOnDestroy(): void {
    this.facade.select(null);
    this.facade.resetPromocionesCache();
  }

  protected openDrawer(row: PreInscritoTableRow): void {
    this.facade.select(row);
    this.facade.resetPromocionesCache();
    this.layoutDrawer.open(AdminPreInscritoDrawerComponent, row.nombreCompleto, 'eye');
  }

  protected resetFiltros(): void {
    this.searchQuery.set('');
    this.filterStatus.set('');
    this.filterLicencia.set('');
  }
}
