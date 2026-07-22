import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { AdminPreInscritosFacade } from '@core/facades/admin-pre-inscritos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AdminPreInscritoDrawerComponent } from '../../admin/alumnos/pre-inscritos/admin-pre-inscrito-drawer.component';
import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';
import type { PreInscritoTableRow } from '@core/models/ui/pre-inscrito-table.model';

@Component({
  selector: 'app-secretaria-alumnos-pre-inscritos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    TableModule,
    TagModule,
    TooltipModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #pageRef>
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Pre-inscritos Clase Profesional"
        subtitle="Gestión de pre-inscripciones online pendientes de revisión"
        icon="users"
        [backRoute]="embedded() ? null : '/app/secretaria/clase-profesional/alumnos'"
        [backClickable]="embedded()"
        backLabel="Alumnos Profesional"
        (backClicked)="closeRequested.emit()"
        [actions]="[]"
        [kpis]="heroKpis()"
      />

      <!-- Filtros: flex-wrap + min-w-0 en cada control para que ninguno fuerce
           desborde horizontal cuando el drawer angosta este contenedor. -->
      <div class="bento-banner card flex flex-wrap items-center gap-3 min-w-0" appCardHover>
        <input
          type="text"
          class="border border-border rounded-lg px-3 py-2 text-sm text-text-primary bg-surface w-full sm:w-64 min-w-0 focus:outline-none focus:ring-2"
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
          placeholder="Todos los estados"
          [ngModel]="filterStatus()"
          (ngModelChange)="filterStatus.set($event)"
          styleClass="w-full sm:w-48 min-w-0"
          data-llm-description="filter pre-inscribed students by status"
        />
        <p-select
          [options]="licenciaOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Todas las clases"
          [ngModel]="filterLicencia()"
          (ngModelChange)="filterLicencia.set($event)"
          styleClass="w-full sm:w-36 min-w-0"
          data-llm-description="filter pre-inscribed students by license class"
        />

        @if (searchQuery() || filterStatus() || filterLicencia()) {
          <button
            type="button"
            class="text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            (click)="resetFiltros()"
          >
            <app-icon name="x" [size]="14" />
            Limpiar
          </button>
        }

        <span class="ml-auto text-sm text-text-secondary shrink-0">
          {{ filtered().length }} resultado{{ filtered().length !== 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Tabla / Tarjetas (Dual-Viewport, mismo patrón que app-alumnos-list-content):
           al comprimirse el contenedor (drawer abierto), la tabla completa se
           oculta y se muestra una vista de tarjetas compacta — nunca desborda
           ni corta columnas. -->
      <div class="bento-banner card p-0 overflow-hidden dual-viewport-container" appCardHover>
        @if (facade.isLoading()) {
          <div class="p-6 space-y-3">
            @for (i of skeletonRows; track i) {
              <app-skeleton-block variant="text" width="100%" height="44px" />
            }
          </div>
        } @else if (filtered().length === 0) {
          <div class="flex flex-col items-center justify-center py-16 gap-3">
            <app-icon name="users" [size]="40" color="var(--color-text-muted)" />
            <p class="text-text-secondary text-sm">
              No hay pre-inscritos con los filtros aplicados
            </p>
          </div>
        } @else {
          <!-- VISTA 1: TABLA CLÁSICA (Oculta cuando se comprime) -->
          <div class="desktop-view hide-on-squeeze overflow-x-auto">
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
                      <p class="text-sm font-medium text-text-primary">{{ row.nombreCompleto }}</p>
                      <p class="text-xs text-text-secondary">{{ row.email }}</p>
                    </div>
                  </td>
                  <td class="text-sm font-mono text-text-secondary">{{ row.rut }}</td>
                  <td>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-brand"
                    >
                      {{ row.licencia }}
                    </span>
                  </td>
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
                      <span class="inline-flex items-center gap-1 text-xs text-text-secondary">
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
                  <td class="text-sm text-text-secondary">{{ row.fechaPreInscripcion }}</td>
                  <td>
                    @if (row.isVencido) {
                      <span class="text-xs text-danger font-medium">Vencido</span>
                    } @else if (row.diasParaVencer !== null && row.diasParaVencer <= 5) {
                      <span class="text-xs text-warning font-medium">
                        {{ row.diasParaVencer }}d
                      </span>
                    } @else {
                      <span class="text-xs text-text-secondary">{{ row.fechaVencimiento }}</span>
                    }
                  </td>
                  <td>
                    <button
                      type="button"
                      class="p-1.5 rounded-lg hover:bg-elevated transition-colors cursor-pointer"
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
          </div>

          <!-- VISTA 2: TARJETAS COMPACTAS (Visible cuando se comprime) —
               solo lo esencial: Nombre, RUT y estado (badge compacto). -->
          <div class="mobile-view show-on-squeeze p-4 space-y-2">
            @for (row of filtered(); track row.id) {
              <div
                class="flex items-center justify-between gap-3 p-3 rounded-lg border border-border-subtle bg-base hover:bg-subtle transition-colors cursor-pointer"
                data-llm-action="open-pre-inscrito-detail"
                (click)="openDrawer(row)"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-text-primary truncate">
                    {{ row.nombreCompleto }}
                  </p>
                  <p class="text-xs font-mono text-text-secondary truncate">{{ row.rut }}</p>
                </div>
                <p-tag
                  [value]="row.statusLabel"
                  [severity]="row.statusSeverity"
                  [rounded]="true"
                  styleClass="text-2xs shrink-0"
                />
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* Container Queries para Dual-Viewport Render — idéntico al patrón ya
         usado en app-alumnos-list-content / app-alumnos-profesional-list-content. */
      .dual-viewport-container {
        container-type: inline-size;
        container-name: listContainer;
      }

      .show-on-squeeze {
        display: none;
      }

      @container listContainer (max-width: 900px) {
        .hide-on-squeeze {
          display: none !important;
        }
        .show-on-squeeze {
          display: block !important;
        }
      }
    `,
  ],
})
export class SecretariaAlumnosPreInscritosComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly facade = inject(AdminPreInscritosFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);

  /** Vista embebida — ver AdminPreInscritosComponent.embedded para el detalle. */
  readonly embedded = input(false);
  readonly closeRequested = output<void>();

  private readonly pageRef = viewChild<ElementRef<HTMLElement>>('pageRef');

  protected readonly searchQuery = signal('');
  protected readonly filterStatus = signal('');
  protected readonly filterLicencia = signal('');

  readonly statusOptions = [
    { label: 'Sin evaluar', value: 'pending_review' },
    { label: 'Aptos', value: 'approved' },
    { label: 'Rechazados', value: 'rejected' },
    { label: 'Matriculados', value: 'enrolled' },
    { label: 'Vencidos', value: 'expired' },
  ];

  readonly licenciaOptions = [
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

  readonly heroKpis = computed((): SectionHeroKpi[] => [
    { id: 'total', label: 'Total Pre-inscritos', value: this.facade.total(), icon: 'users' },
    {
      id: 'pendientes',
      label: 'Sin Evaluar Test',
      value: this.facade.pendientesTest(),
      icon: 'clock',
      color: 'warning',
    },
    {
      id: 'aprobados',
      label: 'Aptos (Pendiente Matrícula)',
      value: this.facade.aprobados(),
      icon: 'check-circle',
      color: 'success',
    },
  ]);

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
    void this.facade.initialize();
  }

  ngAfterViewInit(): void {
    const el = this.pageRef()?.nativeElement;
    if (el) this.gsap.animateBentoGrid(el);
  }

  ngOnDestroy(): void {
    // Embebido: el padre (SecretariaAlumnosProfesionalComponent) sigue montado
    // y ya gestiona professionalOnly.
    if (!this.embedded()) {
      this.branchFacade.setProfessionalOnly(false);
    }
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
