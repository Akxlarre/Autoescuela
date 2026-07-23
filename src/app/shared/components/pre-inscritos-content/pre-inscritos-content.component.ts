import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { PaginatorModule } from 'primeng/paginator';

import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';

import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

import type { PreInscritoTableRow } from '@core/models/ui/pre-inscrito-table.model';
import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';

interface FilterOption {
  readonly label: string;
  readonly value: string;
}

/** Filas por página según el tier (por contenedor, no por viewport). */
const PAGE_SIZE_DESKTOP = 12;
const PAGE_SIZE_MOBILE = 6;

/**
 * PreInscritosContentComponent — Dumb (OnPush).
 *
 * Vista unificada de Pre-inscritos Clase Profesional (spec 0032):
 * consolida el buscador + los filtros + la tabla en UN solo card, reemplazando
 * los dos Smart Components casi idénticos de Admin y Secretaria.
 *
 * App-like fill-screen (specs 0028-0031): en desktop la página ocupa 100vh y el
 * contenido scrollea internamente (host root = .bento-grid--fill-screen, card = .bento-fill).
 *
 * Responsive + no sobrecargar (ampliación 0032): en desktop se renderiza una TABLA;
 * en móvil/tablet (tier por CONTENEDOR) se renderizan CARDS canónicas. En ambos casos
 * se pagina (12 desktop / 6 móvil) para no volcar todo el listado al DOM.
 *
 * Solo inputs/outputs. El Smart Component coordina AdminPreInscritosFacade y abre
 * el drawer de detalle al recibir (rowSelected).
 */
@Component({
  selector: 'app-pre-inscritos-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TableModule,
    TagModule,
    TooltipModule,
    SelectModule,
    PaginatorModule,
    IconComponent,
    BadgeComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div
      class="bento-grid bento-grid--fill-screen"
      appBentoGridLayout
      #bentoGrid
      aria-label="Panel de pre-inscritos Clase Profesional"
    >
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        [title]="title()"
        [subtitle]="subtitle()"
        icon="users"
        [backRoute]="embedded() ? null : backRoute()"
        [backClickable]="embedded()"
        [backLabel]="backLabel()"
        (backClicked)="closeRequested.emit()"
        [actions]="[]"
        [kpis]="heroKpis()"
      />

      <!-- Card unico: buscador + filtros + tabla/cards + paginador (celda fill) -->
      <!-- appCardHover = hover canon (lift + glow). Sin overflow-hidden aqui: el
           alto lo fija contain:size de .bento-fill y el scroll lo dueñan los hijos,
           asi el glow no se recorta (fix-045). -->
      <div class="bento-banner card p-0 bento-fill flex flex-col min-h-0" appCardHover>
        <!-- Toolbar de filtros -->
        <div class="flex flex-wrap items-center gap-3 p-4 border-b border-border-default shrink-0">
          <div class="relative flex-1 min-w-52 max-w-xs">
            <app-icon
              name="search"
              [size]="15"
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
            />
            <input
              type="text"
              placeholder="Buscar por nombre o RUT..."
              class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-border-default bg-surface text-text-primary outline-none transition-colors"
              data-llm-description="search input for pre-inscribed students by name or RUT"
              [value]="searchQuery()"
              (input)="onSearch($any($event.target).value)"
            />
          </div>

          <p-select
            [options]="statusOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los estados"
            [ngModel]="filterStatus()"
            (ngModelChange)="onStatus($event)"
            styleClass="w-full sm:w-48"
            appendTo="body"
            data-llm-description="filter pre-inscribed students by status"
          />
          <p-select
            [options]="licenciaOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Todas las clases"
            [ngModel]="filterLicencia()"
            (ngModelChange)="onLicencia($event)"
            styleClass="w-full sm:w-36"
            appendTo="body"
            data-llm-description="filter pre-inscribed students by license class"
          />

          @if (searchQuery() || filterStatus() || filterLicencia()) {
            <button
              type="button"
              class="text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer"
              data-llm-action="clear-pre-inscritos-filters"
              (click)="resetFiltros()"
            >
              <app-icon name="x" [size]="14" />
              Limpiar
            </button>
          }

          <span class="ml-auto text-sm text-text-secondary">
            {{ filtered().length }} resultado{{ filtered().length !== 1 ? 's' : '' }}
          </span>
        </div>

        <!-- Region scrolleable (interno en desktop; natural en movil) -->
        <div class="flex-1 min-h-0 overflow-auto">
          @if (isLoading()) {
            <div class="p-4 space-y-3">
              @for (i of skeletonRows; track i) {
                <app-skeleton-block variant="rect" width="100%" height="44px" />
              }
            </div>
          } @else if (filtered().length === 0) {
            <app-empty-state
              icon="users"
              message="No hay pre-inscritos con los filtros aplicados"
              subtitle="Ajusta la busqueda o los filtros para ver mas resultados."
              actionLabel="Limpiar filtros"
              actionIcon="refresh-cw"
              (action)="resetFiltros()"
            />
          } @else if (isDesktopLayout()) {
            <!-- ── Desktop: tabla ─────────────────────────────────────────── -->
            <p-table
              [value]="pagedRows()"
              [paginator]="false"
              styleClass="p-datatable-sm"
              [rowHover]="true"
            >
              <ng-template pTemplate="header">
                <tr>
                  <th>Alumno</th>
                  <th>RUT</th>
                  <th>Clase</th>
                  @if (showSede()) {
                    <th>Sede</th>
                  }
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
                  (click)="rowSelected.emit(row)"
                >
                  <td>
                    <div>
                      <p class="text-sm font-medium text-text-primary">{{ row.nombreCompleto }}</p>
                      <p class="text-xs text-text-secondary">{{ row.email }}</p>
                    </div>
                  </td>
                  <td class="text-sm font-mono text-text-secondary">{{ row.rut }}</td>
                  <td>
                    <app-badge variant="brand">{{ row.licencia }}</app-badge>
                  </td>
                  @if (showSede()) {
                    <td class="text-sm text-text-secondary">{{ row.sucursal }}</td>
                  }
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
                      <span class="text-sm text-danger font-medium">Vencido</span>
                    } @else if (row.diasParaVencer !== null && row.diasParaVencer <= 5) {
                      <span class="text-sm text-warning font-medium"
                        >{{ row.diasParaVencer }}d</span
                      >
                    } @else {
                      <span class="text-sm text-text-secondary">{{ row.fechaVencimiento }}</span>
                    }
                  </td>
                  <td>
                    <button
                      type="button"
                      class="p-1.5 rounded-lg hover:bg-elevated transition-colors cursor-pointer"
                      pTooltip="Ver detalle"
                      tooltipPosition="left"
                      data-llm-action="view-pre-inscrito"
                      (click)="$event.stopPropagation(); rowSelected.emit(row)"
                    >
                      <app-icon name="eye" [size]="16" color="var(--color-text-secondary)" />
                    </button>
                  </td>
                </tr>
              </ng-template>
            </p-table>
          } @else {
            <!-- ── Movil/tablet: cards canonicas ──────────────────────────── -->
            <div class="p-4 space-y-3">
              @for (row of pagedRows(); track row.id) {
                <div
                  class="bg-base border border-border-subtle rounded-xl p-4 shadow-sm cursor-pointer"
                  data-llm-action="open-pre-inscrito-detail"
                  (click)="rowSelected.emit(row)"
                >
                  <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <div
                        class="shrink-0 w-10 h-10 rounded-full bg-surface flex items-center justify-center border border-border-default text-text-primary font-black text-sm uppercase"
                      >
                        {{ row.nombre[0] }}{{ row.apellido[0] }}
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-bold text-sm text-text-primary truncate">
                          {{ row.nombreCompleto }}
                        </span>
                        <span class="text-xs text-text-muted truncate">{{ row.email }}</span>
                      </div>
                    </div>
                    <p-tag
                      [value]="row.statusLabel"
                      [severity]="row.statusSeverity"
                      [rounded]="true"
                      styleClass="shrink-0"
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                    <div class="flex flex-col">
                      <span class="text-2xs text-text-muted mb-0.5">RUT</span>
                      <span class="font-mono text-xs text-text-secondary">{{ row.rut }}</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-2xs text-text-muted mb-0.5">Clase</span>
                      <div>
                        <app-badge variant="brand">{{ row.licencia }}</app-badge>
                      </div>
                    </div>
                    @if (showSede()) {
                      <div class="flex flex-col">
                        <span class="text-2xs text-text-muted mb-0.5">Sede</span>
                        <span class="text-xs text-text-secondary">{{ row.sucursal }}</span>
                      </div>
                    }
                    <div class="flex flex-col">
                      <span class="text-2xs text-text-muted mb-0.5">Test Psic.</span>
                      @if (row.psychResult === 'fit') {
                        <span
                          class="inline-flex items-center gap-1 text-xs font-medium text-success"
                        >
                          <app-icon name="check-circle" [size]="14" />
                          Apto
                        </span>
                      } @else if (row.psychResult === 'unfit') {
                        <span
                          class="inline-flex items-center gap-1 text-xs font-medium text-danger"
                        >
                          <app-icon name="x-circle" [size]="14" />
                          No Apto
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1 text-xs text-text-secondary">
                          <app-icon name="clock" [size]="14" />
                          Pendiente
                        </span>
                      }
                    </div>
                    <div class="flex flex-col">
                      <span class="text-2xs text-text-muted mb-0.5">Vence</span>
                      @if (row.isVencido) {
                        <span class="text-xs text-danger font-medium">Vencido</span>
                      } @else if (row.diasParaVencer !== null && row.diasParaVencer <= 5) {
                        <span class="text-xs text-warning font-medium">
                          {{ row.diasParaVencer }}d ({{ row.fechaVencimiento }})
                        </span>
                      } @else {
                        <span class="text-xs text-text-secondary">{{ row.fechaVencimiento }}</span>
                      }
                    </div>
                  </div>

                  <div
                    class="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between"
                  >
                    <span class="text-2xs text-text-muted">
                      Pre-inscrito: {{ row.fechaPreInscripcion }}
                    </span>
                    <button
                      type="button"
                      class="p-1.5 rounded-lg hover:bg-elevated transition-colors cursor-pointer"
                      pTooltip="Ver detalle"
                      data-llm-action="view-pre-inscrito"
                      (click)="$event.stopPropagation(); rowSelected.emit(row)"
                    >
                      <app-icon name="eye" [size]="16" color="var(--color-text-secondary)" />
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Paginador PrimeNG (mismo look que Base Alumnos B); pagina tabla Y cards -->
        @if (!isLoading() && filtered().length > 0) {
          <div class="shrink-0 border-t border-border-default">
            <p-paginator
              [rows]="pageSize()"
              [totalRecords]="filtered().length"
              [first]="safePage() * pageSize()"
              [showCurrentPageReport]="true"
              currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} pre-inscritos"
              (onPageChange)="onPageChange($event)"
            />
          </div>
        }
      </div>
    </div>
  `,
})
export class PreInscritosContentComponent implements AfterViewInit {
  // ── Inputs ────────────────────────────────────────────────────────────────
  readonly preInscritos = input.required<PreInscritoTableRow[]>();
  readonly isLoading = input(false);
  readonly heroKpis = input<SectionHeroKpi[]>([]);
  /** Presupuesto de densidad del Smart: null = desktop (tabla), N = móvil/tablet (cards). */
  readonly maxVisible = input<number | null>(null);
  readonly showSede = input(false);
  readonly title = input('Pre-inscritos Clase Profesional');
  readonly subtitle = input('Gestion de pre-inscripciones online pendientes de revision');
  readonly backRoute = input('');
  readonly backLabel = input('Alumnos Profesional');
  /**
   * Vista embebida: cuando es `true`, el Smart padre renderiza este
   * componente como vista condicional en lugar de navegar a una ruta propia
   * (la URL no cambia). El botón "volver" del hero pasa de `backRoute`
   * (routerLink) a `backClickable` + `closeRequested`.
   */
  readonly embedded = input(false);

  // ── Outputs ───────────────────────────────────────────────────────────────
  readonly rowSelected = output<PreInscritoTableRow>();
  readonly closeRequested = output<void>();

  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  // ── Estado local de filtros + paginación ──────────────────────────────────
  protected readonly searchQuery = signal('');
  protected readonly filterStatus = signal('');
  protected readonly filterLicencia = signal('');
  protected readonly currentPage = signal(0);

  protected readonly skeletonRows = Array(6).fill(0);

  readonly statusOptions: FilterOption[] = [
    { label: 'Sin evaluar', value: 'pending_review' },
    { label: 'Aptos', value: 'approved' },
    { label: 'Rechazados', value: 'rejected' },
    { label: 'Matriculados', value: 'enrolled' },
    { label: 'Vencidos', value: 'expired' },
  ];

  readonly licenciaOptions: FilterOption[] = [
    { label: 'A2', value: 'A2' },
    { label: 'A3', value: 'A3' },
    { label: 'A4', value: 'A4' },
    { label: 'A5', value: 'A5' },
  ];

  // ── Derivados ─────────────────────────────────────────────────────────────
  /** El switch tabla/cards se decide por CONTENEDOR, no por viewport (specs 0030/0031). */
  readonly isDesktopLayout = computed(() => this.maxVisible() === null);

  readonly pageSize = computed(() =>
    this.isDesktopLayout() ? PAGE_SIZE_DESKTOP : PAGE_SIZE_MOBILE,
  );

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const st = this.filterStatus();
    const lic = this.filterLicencia();

    return this.preInscritos().filter((p) => {
      if (q && !p.nombreCompleto.toLowerCase().includes(q) && !p.rut.toLowerCase().includes(q)) {
        return false;
      }
      if (st && p.status !== st) return false;
      if (lic && p.licencia !== lic) return false;
      return true;
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize())),
  );

  /** Página efectiva acotada al total (evita quedar fuera de rango tras filtrar o cambiar de tier). */
  readonly safePage = computed(() => Math.min(this.currentPage(), this.totalPages() - 1));

  /** Solo las filas de la página actual llegan al DOM (no sobrecargar). */
  readonly pagedRows = computed(() => {
    const start = this.safePage() * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  // ── Handlers de filtros (resetean la página) ──────────────────────────────
  protected onSearch(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(0);
  }

  protected onStatus(value: string): void {
    this.filterStatus.set(value ?? '');
    this.currentPage.set(0);
  }

  protected onLicencia(value: string): void {
    this.filterLicencia.set(value ?? '');
    this.currentPage.set(0);
  }

  protected resetFiltros(): void {
    this.searchQuery.set('');
    this.filterStatus.set('');
    this.filterLicencia.set('');
    this.currentPage.set(0);
  }

  // ── Paginación (evento del <p-paginator> de PrimeNG) ───────────────────────
  protected onPageChange(event: { page?: number }): void {
    this.currentPage.set(event.page ?? 0);
  }
}
