import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  inject,
  signal,
  viewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { matchesSearchTokens } from '@core/utils/search-filter.utils';
import { withAllOption } from '@core/utils/filter-options.utils';
import { SortHeaderComponent } from '@shared/components/sort-header/sort-header.component';
import { SortControlComponent } from '@shared/components/sort-control/sort-control.component';
import {
  ExportMenuComponent,
  type ExportFormat,
} from '@shared/components/export-menu/export-menu.component';
import type { EgresadosExportRequest } from '@shared/components/ex-alumnos-content/ex-alumnos-content.component';
import {
  egresadoSortOptions,
  sortEgresados,
  type EgresadoListSort,
  type EgresadoSortField,
} from '@core/utils/egresados-sort.utils';
import { ariaSortOf, nextSort, toggleSortDirection } from '@core/utils/table-sort.utils';
import { ClearFiltersButtonComponent } from '@shared/components/clear-filters-button/clear-filters-button.component';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';

import { IconComponent } from '../icon/icon.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '../section-hero/section-hero.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { sliceByBudget } from '@core/utils/layout-tier.utils';
import { getInitialsFromDisplayName } from '@core/models/ui/user.model';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { PeriodSelectorComponent } from '@shared/components/period-selector/period-selector.component';
import {
  DEFAULT_PERIOD_WINDOW,
  applyPeriodWindow,
  type PeriodWindow,
} from '@core/utils/period-window.utils';
import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { EgresadoCardComponent } from '@shared/components/egresado-card/egresado-card.component';

/**
 * Dumb presentacional para Ex-Alumnos Profesional (spec 0016).
 * Recibe la lista ya filtrada a `license_group='professional'` desde el Smart.
 * Mismo patrón visual que app-alumnos-list-content (fix-084): toolbar + p-table
 * con paginador + tarjetas mobile con "Cargar más".
 */
@Component({
  selector: 'app-ex-alumnos-profesional-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    RouterLink,
    FormsModule,
    SelectModule,
    TagModule,
    TooltipModule,
    TableModule,
    ButtonModule,
    IconComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    PeriodSelectorComponent,
    EmptyStateComponent,
    EgresadoCardComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
    ClearFiltersButtonComponent,
    SortHeaderComponent,
    SortControlComponent,
    ExportMenuComponent,
  ],
  template: `
    <div
      class="bento-grid bento-grid--fill-screen"
      appBentoGridLayout
      #bentoGrid
      aria-label="Ex-Alumnos Profesional"
    >
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Ex-Alumnos Profesional"
        subtitle="Archivo histórico de egresados de Clase Profesional"
        icon="graduation-cap"
        [backRoute]="backRoute()"
        backLabel="Alumnos Profesional"
        [kpis]="heroKpis()"
        [actions]="[]"
      />

      <div
        class="bento-banner bento-fill card p-0 overflow-hidden shadow-sm dual-viewport-container flex flex-col w-full h-full"
        appCardHover
      >
        <!-- Toolbar -->
        <div class="flex flex-wrap items-center gap-3 p-4 border-b border-border-default">
          <div class="relative flex-1 min-w-52 max-w-xs">
            <app-icon
              name="search"
              [size]="15"
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
            />
            <input
              type="text"
              placeholder="Buscar por nombre, RUT o Nº Matrícula..."
              class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-border-default bg-surface text-text-primary outline-none transition-colors"
              data-llm-description="Search professional graduates by name, RUT or enrollment number"
              [(ngModel)]="searchTerm"
              (ngModelChange)="resetPagination()"
            />
          </div>
          <p-select
            [options]="claseOptions()"
            [(ngModel)]="selectedClase"
            (ngModelChange)="resetPagination()"
            optionLabel="label"
            optionValue="value"
            placeholder="Todas las clases"
            class="h-9"
            data-llm-description="Filter professional graduates by license class"
          />
          <!-- fix-147-b: acá NO hay filtro de año que unificar (a diferencia de Clase B);
               el filtro de clase es una faceta independiente, así que el selector se suma. -->
          <app-period-selector
            [window]="periodWindow"
            (windowChange)="periodWindow = $event; resetPagination()"
            [years]="availableYears()"
            [searchActive]="searchTerm.trim().length > 0"
            ariaLabel="Período de egreso"
          />
          <app-clear-filters-button
            llmSubject="professional-graduates"
            [active]="hasActiveFilters()"
            (clear)="resetFilters()"
          />
          <!-- spec 0023-m: "Ordenar por" solo en la vista de tarjetas, que no tiene títulos. -->
          <app-sort-control
            class="show-on-squeeze"
            llmSubject="professional-graduates"
            [options]="sortColumns"
            [sort]="sort()"
            (fieldChange)="setSortField($any($event))"
            (directionToggle)="toggleSortDir()"
          />
          <!-- spec 0023-m: mismo menú que Ex-Alumnos B; exporta las filas que se ven. -->
          <app-export-menu
            class="ml-auto"
            llmSubject="professional-graduates"
            [exporting]="isExporting()"
            [disabled]="filtered().length === 0"
            (exportRequested)="requestExport($event)"
          />
        </div>

        @if (isLoading()) {
          <div class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full">
            <div
              class="desktop-view hide-on-squeeze p-4 space-y-0 flex flex-col flex-1 min-h-0 h-full w-full"
            >
              <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                @for (i of skeletonRows; track i) {
                  <app-skeleton-block variant="text" width="12%" height="11px" />
                }
              </div>
              @for (i of skeletonRows; track i) {
                <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                  <div class="flex items-center gap-3 w-[18%]">
                    <app-skeleton-block variant="circle" width="36px" height="36px" />
                    <app-skeleton-block variant="text" width="70%" height="12px" />
                  </div>
                  <app-skeleton-block variant="rect" width="80px" height="24px" />
                </div>
              }
            </div>
            <div class="mobile-view show-on-squeeze p-4 space-y-2">
              @for (i of skeletonRows; track i) {
                <app-skeleton-block variant="rect" width="100%" height="120px" />
              }
            </div>
          </div>
        } @else {
          <div class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full">
            <!-- VISTA 1: TABLA (Oculta cuando se comprime) -->
            <div class="desktop-view hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full">
              <p-table
                [value]="sortedEgresados()"
                [rows]="10"
                [paginator]="true"
                [first]="tableFirst()"
                (onPage)="tableFirst.set($event.first)"
                [scrollable]="true"
                scrollHeight="flex"
                responsiveLayout="scroll"
                styleClass="p-datatable-sm p-datatable-striped h-full flex flex-col"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} egresados"
              >
                <ng-template pTemplate="header">
                  <tr class="micro-label text-left">
                    <!-- spec 0023-m: cada título ordena la lista completa (no solo la página). -->
                    @for (col of sortColumns; track col.value; let first = $first) {
                      <th
                        [class.pl-6]="first"
                        [class.py-4]="first"
                        [attr.aria-sort]="ariaSort(col.value)"
                      >
                        <app-sort-header
                          llmSubject="professional-graduates"
                          [label]="col.label"
                          [field]="col.value"
                          [sort]="sort()"
                          (sortClick)="toggleSort(col.value)"
                        />
                      </th>
                    }
                    <th class="pr-6 text-right">Acciones</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-egresado>
                  <tr class="list-item-hover transition-colors border-b border-border-subtle">
                    <td class="pl-6 py-4">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-9 h-9 rounded-full bg-elevated flex items-center justify-center border border-border-subtle text-text-secondary font-bold text-xs uppercase"
                        >
                          {{ initials(egresado.nombre) }}
                        </div>
                        <div class="flex flex-col">
                          <span class="item-title">{{ egresado.nombre }}</span>
                          <span class="text-xs text-text-muted">{{ egresado.correo }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="text-xs font-medium text-text-secondary font-mono">
                      {{ egresado.rut }}
                    </td>
                    <td class="text-xs text-text-muted font-mono">
                      {{ egresado.nroExpediente ?? '—' }}
                    </td>
                    <td>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span
                          class="text-xs px-2 py-0.5 rounded-full border border-border-subtle text-text-secondary bg-brand-muted"
                          >{{ egresado.licencia }}</span
                        >
                        @if (egresado.convalidatedLicense) {
                          <p-tag
                            [value]="'Convalida ' + egresado.convalidatedLicense"
                            severity="info"
                            styleClass="text-2xs font-bold px-1.5 py-0.5"
                          ></p-tag>
                        }
                      </div>
                    </td>
                    <td class="text-xs text-text-secondary">
                      <div class="flex flex-col">
                        <span class="font-bold text-text-primary">{{ egresado.anio ?? '—' }}</span>
                        <span class="text-text-muted italic">{{ egresado.sede }}</span>
                      </div>
                    </td>
                    <td>
                      @if (egresado.saldoPendiente > 0) {
                        <p-tag
                          [value]="
                            'Debe ' +
                            (egresado.saldoPendiente | currency: 'CLP' : 'symbol' : '1.0-0')
                          "
                          severity="warn"
                          styleClass="text-xs font-bold px-2 py-0.5"
                        ></p-tag>
                      } @else {
                        <p-tag
                          value="Al día"
                          severity="success"
                          styleClass="text-xs font-bold px-2 py-0.5"
                        ></p-tag>
                      }
                    </td>
                    <td class="pr-6 text-right">
                      <div
                        class="inline-flex items-center justify-end gap-0.5 p-0.5 rounded-lg hover:bg-elevated hover:shadow-sm border border-transparent transition-all"
                      >
                        <button
                          aria-label="Ver ficha"
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                          pTooltip="Ver ficha"
                          [routerLink]="[basePath() + '/alumnos', egresado.studentId]"
                          [queryParams]="{ from: 'ex-alumnos' }"
                          data-llm-action="view-student-detail"
                        >
                          <app-icon name="eye" [size]="16" />
                        </button>
                        <button
                          aria-label="Re-matricular"
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform text-brand"
                          pTooltip="Re-matricular"
                          (click)="reEnroll.emit(egresado)"
                          data-llm-action="re-enroll-student"
                        >
                          <app-icon name="user-plus" [size]="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr>
                    <td colspan="7" class="p-0">
                      <app-empty-state
                        icon="graduation-cap"
                        message="No hay ex-alumnos profesionales"
                        subtitle="Ajusta la búsqueda o el filtro de clase."
                        actionLabel="Limpiar filtros"
                        actionIcon="refresh-cw"
                        (action)="resetFilters()"
                      />
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </div>

            <!-- VISTA 2: TARJETAS (Visible cuando se comprime) -->
            <div class="mobile-view show-on-squeeze p-4 md:p-6 bg-surface">
              <div class="bento-grid">
                @for (egresado of visibleCards(); track egresado.id) {
                  <div class="bento-wide" data-col-span="4">
                    <app-egresado-card
                      [egresado]="egresado"
                      [basePath]="basePath()"
                      nroLabel="Nº Mat."
                      [viewQueryParams]="{ from: 'ex-alumnos' }"
                      (reEnrollRequested)="reEnroll.emit($event)"
                    />
                  </div>
                } @empty {
                  <div class="col-span-full py-8">
                    <app-empty-state
                      icon="graduation-cap"
                      message="No hay ex-alumnos profesionales"
                      subtitle="Ajusta la búsqueda o el filtro de clase."
                      actionLabel="Limpiar filtros"
                      actionIcon="refresh-cw"
                      (action)="resetFilters()"
                    />
                  </div>
                }

                @if (remainingCards() > 0) {
                  <div class="col-span-full pt-1">
                    <button
                      type="button"
                      class="btn-ghost w-full flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer"
                      (click)="loadMoreCards()"
                      data-llm-action="load-more-egresados"
                    >
                      <app-icon name="chevron-down" [size]="16" />
                      Cargar más ({{ remainingCards() }} restantes)
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
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
})
export class ExAlumnosProfesionalContentComponent implements AfterViewInit {
  readonly egresados = input.required<EgresadoTableRow[]>();
  readonly isLoading = input(false);
  /**
   * Ruta del botón "volver" y prefijo de "Ver detalle". Sin default a propósito: un default
   * con segmento de rol se le aplicaba en silencio al otro rol (fix-202-m).
   */
  readonly backRoute = input.required<string>();
  /** Prefijo de ruta para "Ver detalle" — misma ficha que Base Alumnos (admin vs secretaria). */
  readonly basePath = input.required<string>();
  /** Emite el egresado a re-matricular; el Smart muestra confirmación y navega al wizard (fix-020). */
  readonly reEnroll = output<EgresadoTableRow>();
  /** Hay una exportación en curso (signal isExporting del Facade). */
  readonly isExporting = input(false);
  /** El Smart genera el archivo con las filas recibidas (spec 0023-m). */
  readonly exportRequested = output<EgresadosExportRequest>();

  // ── Orden por columna (spec 0023-m) ─────────────────────────────────────
  /** Orden elegido; null = orden por defecto (como llega del Facade). */
  readonly sort = signal<EgresadoListSort | null>(null);
  protected readonly sortColumns = egresadoSortOptions('Nº Mat.');
  /** Índice de la primera fila de la página visible de la tabla. */
  protected readonly tableFirst = signal(0);

  /** La lista filtrada, en el orden elegido. Alimenta la tabla, las tarjetas y la exportación. */
  sortedEgresados(): EgresadoTableRow[] {
    return sortEgresados(this.filtered(), this.sort());
  }

  /** Clic en el título de una columna: ascendente → descendente → orden por defecto. */
  toggleSort(field: EgresadoSortField): void {
    this.applySort(nextSort(this.sort(), field));
  }

  /** Control "Ordenar por" de la vista de tarjetas. Limpiarlo vuelve al orden por defecto. */
  setSortField(field: EgresadoSortField | null): void {
    if (field === this.sort()?.field) return;
    this.applySort(field ? { field, direction: 'asc' } : null);
  }

  toggleSortDir(): void {
    this.applySort(toggleSortDirection(this.sort()));
  }

  protected ariaSort(field: EgresadoSortField): 'ascending' | 'descending' | 'none' {
    return ariaSortOf(this.sort(), field);
  }

  /** Un orden nuevo se mira desde el principio: primera página y primeras tarjetas. */
  private applySort(sort: EgresadoListSort | null): void {
    this.sort.set(sort);
    this.tableFirst.set(0);
    this.mobileShown = ExAlumnosProfesionalContentComponent.CARDS_STEP;
  }

  /** Exporta lo que se ve: la lista filtrada, completa y en el orden elegido. */
  requestExport(format: ExportFormat): void {
    this.exportRequested.emit({ format, rows: this.sortedEgresados() });
  }

  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  protected readonly skeletonRows = Array(6).fill(0);
  searchTerm = '';
  selectedClase = '';
  /** Ventana de período del historial (fix-147-b). */
  periodWindow: PeriodWindow = DEFAULT_PERIOD_WINDOW;

  /** Densidad incremental de la vista tarjetas (mismo patrón que app-alumnos-list-content). */
  private static readonly CARDS_STEP = 6;
  protected mobileShown = ExAlumnosProfesionalContentComponent.CARDS_STEP;

  /** Abre con la opción "todos", con el mismo '' por defecto que `selectedClase` (spec 0022-m). */
  readonly claseOptions = computed(() =>
    withAllOption(
      [...new Set(this.egresados().map((e) => e.licencia))]
        .sort()
        .map((l) => ({ label: l, value: l })),
      'Todas las clases',
      '',
    ),
  );

  /** Muestra "Limpiar filtros": búsqueda, clase o un período distinto del inicial. */
  hasActiveFilters(): boolean {
    return (
      this.searchTerm !== '' ||
      this.selectedClase !== '' ||
      this.periodWindow !== DEFAULT_PERIOD_WINDOW
    );
  }

  readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'total',
      label: 'Egresados Profesional',
      value: this.egresados().length,
      icon: 'graduation-cap',
    },
    {
      id: 'deuda',
      label: 'Con deuda',
      value: this.egresados().filter((e) => e.saldoPendiente > 0).length,
      icon: 'circle-alert',
      color: 'warning',
    },
  ]);

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  filtered(): EgresadoTableRow[] {
    const term = this.searchTerm.toLowerCase().trim();

    // El período se aplica antes, y solo cuando no hay búsqueda: buscar tiene que encontrar al
    // egresado sin importar cuándo egresó (fix-147-b / ASG-b-087).
    const enPeriodo = applyPeriodWindow(this.egresados(), {
      window: this.periodWindow,
      hasActiveSearch: term.length > 0,
      dateOf: (e: EgresadoTableRow) => e.fechaEgreso,
    });

    return enPeriodo.filter((e) => {
      const matchSearch = matchesSearchTokens([e.nombre, e.rut, e.nroExpediente], term);
      const matchClase = !this.selectedClase || e.licencia === this.selectedClase;
      return matchSearch && matchClase;
    });
  }

  /** Años presentes en el dataset, para las opciones del selector de período. */
  readonly availableYears = computed<string[]>(() => {
    const years = this.egresados()
      .map((e) => e.anio)
      .filter((y): y is number => y !== null);
    return [...new Set(years)].sort((a, b) => b - a).map(String);
  });

  visibleCards(): EgresadoTableRow[] {
    return sliceByBudget(this.sortedEgresados(), this.mobileShown);
  }

  remainingCards(): number {
    return Math.max(0, this.filtered().length - this.mobileShown);
  }

  loadMoreCards(): void {
    this.mobileShown += ExAlumnosProfesionalContentComponent.CARDS_STEP;
  }

  /**
   * fix-283-m: al cambiar búsqueda, clase o período el resultado se mira desde el principio
   * (con [first] la tabla no vuelve sola a la página 1) y las tarjetas vuelven a 6.
   */
  resetPagination(): void {
    this.tableFirst.set(0);
    this.mobileShown = ExAlumnosProfesionalContentComponent.CARDS_STEP;
  }

  initials(nombre: string): string {
    return getInitialsFromDisplayName(nombre);
  }

  /** Vuelve filtros, buscador y período a su valor inicial. El orden se conserva (spec 0023-m). */
  resetFilters(): void {
    this.tableFirst.set(0);
    this.searchTerm = '';
    this.selectedClase = '';
    // Igual que Ex-Alumnos B: el período vuelve a su valor inicial, no a "todo el historial".
    this.periodWindow = DEFAULT_PERIOD_WINDOW;
    this.mobileShown = ExAlumnosProfesionalContentComponent.CARDS_STEP;
  }
}
