import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  inject,
  viewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { matchesSearchTokens } from '@core/utils/search-filter.utils';
import { withAllOption } from '@core/utils/filter-options.utils';
import { ClearFiltersButtonComponent } from '@shared/components/clear-filters-button/clear-filters-button.component';
import { SortHeaderComponent } from '@shared/components/sort-header/sort-header.component';
import { SortControlComponent } from '@shared/components/sort-control/sort-control.component';
import {
  ExportMenuComponent,
  type ExportFormat,
} from '@shared/components/export-menu/export-menu.component';
import {
  ALUMNO_PROFESIONAL_SORT_OPTIONS,
  sortAlumnosProfesional,
  type AlumnoProfesionalListSort,
  type AlumnoProfesionalSortField,
} from '@core/utils/alumnos-profesional-sort.utils';
import { ariaSortOf, nextSort, toggleSortDirection } from '@core/utils/table-sort.utils';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

// Shared
import { IconComponent } from '../icon/icon.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '../section-hero/section-hero.component';
import { AlumnoProfesionalCardComponent } from '../alumno-profesional-card/alumno-profesional-card.component';

// Directives
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';

// Services
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

// Models
import type {
  AlumnoProfesionalTableRow,
  SemaforoAsistencia,
} from '@core/models/ui/alumno-profesional-table-row.model';
import type { AlumnoStatus } from '@core/models/ui/alumno-table-row.model';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';

/** Pedido de exportación: el formato y las filas que la pantalla está mostrando (spec 0023-m). */
export interface AlumnosProfesionalExportRequest {
  format: ExportFormat;
  rows: AlumnoProfesionalTableRow[];
}

interface SemaforoInfo {
  label: string;
  severity: 'success' | 'warn' | 'danger' | 'secondary';
}

@Component({
  selector: 'app-alumnos-profesional-list-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    RouterModule,
    FormsModule,
    TableModule,
    ButtonModule,
    SelectModule,
    TagModule,
    TooltipModule,
    IconComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    AlumnoProfesionalCardComponent,
    BentoGridLayoutDirective,
    AnimateInDirective,
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
      aria-label="Panel de alumnos profesionales"
    >
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Alumnos Profesional"
        [subtitle]="heroSubtitle()"
        [chips]="heroChips()"
        [kpis]="heroKpis()"
        [actions]="heroActions()"
        [backClickable]="trashView()"
        backLabel="Alumnos Profesional"
        (backClicked)="trashViewToggled.emit()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- Filtros y Tabla (Dual-Viewport). El modo fill-screen desktop lo da
           .bento-fill (spec 0028); en móvil la card crece con su contenido —
           mismo patrón que app-alumnos-list-content (Clase B). -->
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
              data-llm-description="Search professional students by name, RUT or enrollment number"
              [(ngModel)]="searchTerm"
            />
          </div>

          <p-select
            [options]="claseOptions"
            [(ngModel)]="selectedClase"
            optionLabel="label"
            optionValue="value"
            placeholder="Todas las clases"
            class="h-9"
            data-llm-description="Filter professional students by license class"
          />
          <p-select
            [options]="estadoOptions"
            [(ngModel)]="selectedEstado"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los estados"
            class="h-9"
            data-llm-description="Filter professional students by enrollment status"
          />
          <app-clear-filters-button
            llmSubject="professional-students"
            [active]="hasActiveFilters()"
            (clear)="resetFilters()"
          />

          <!-- spec 0023-m: "Ordenar por" solo en la vista de tarjetas, que no tiene títulos. -->
          <app-sort-control
            class="show-on-squeeze"
            llmSubject="professional-students"
            [options]="sortColumns"
            [sort]="sort()"
            (fieldChange)="setSortField($any($event))"
            (directionToggle)="toggleSortDir()"
          />

          <span class="ml-auto text-sm text-text-muted">
            {{ filteredAlumnos().length }} resultado{{ filteredAlumnos().length !== 1 ? 's' : '' }}
          </span>
          <!-- spec 0023-m: mismo menú que la Base de Alumnos B; exporta las filas que se ven. -->
          <app-export-menu
            llmSubject="professional-students"
            [exporting]="isExporting()"
            [disabled]="filteredAlumnos().length === 0"
            (exportRequested)="requestExport($event)"
          />
        </div>

        @if (isLoading()) {
          <div
            class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full"
            appAnimateIn
          >
            <!-- VISTA 1: TABLA SKELETON (Oculta cuando se comprime) -->
            <div class="desktop-view hide-on-squeeze p-4 space-y-3 flex-1 min-h-0 h-full w-full">
              @for (i of skeletonRows; track $index) {
                <app-skeleton-block variant="rect" width="100%" height="44px" />
              }
            </div>

            <!-- VISTA 2: TARJETAS SKELETON (Visible cuando se comprime o móvil) -->
            <div class="mobile-view show-on-squeeze p-4 md:p-6 bg-surface">
              <div class="bento-grid">
                @for (card of skeletonRows; track $index) {
                  <div class="bento-wide" data-col-span="4">
                    <app-alumno-profesional-card [loading]="true" [alumno]="skeletonAlumno" />
                  </div>
                }
              </div>
            </div>
          </div>
        } @else {
          <!-- Contenido principal interactivo -->
          <div
            class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full"
            appAnimateIn
          >
            <!-- VISTA 1: LA TABLA CLÁSICA (Oculta cuando se comprime) -->
            <div class="desktop-view hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full">
              <p-table
                [value]="sortedAlumnos()"
                [rows]="10"
                [paginator]="filteredAlumnos().length > 10"
                [first]="tableFirst()"
                (onPage)="tableFirst.set($event.first)"
                [scrollable]="true"
                scrollHeight="flex"
                styleClass="p-datatable-sm p-datatable-striped h-full flex flex-col"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} alumnos"
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
                          llmSubject="professional-students"
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
                <ng-template pTemplate="body" let-alumno>
                  <tr class="list-item-hover transition-colors border-b border-border-subtle">
                    <td class="pl-6 py-4">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-9 h-9 rounded-full bg-elevated flex items-center justify-center border border-border-subtle text-text-secondary font-bold text-xs uppercase"
                        >
                          {{ alumno.nombre[0] }}{{ alumno.apellido[0] }}
                        </div>
                        <div class="flex flex-col">
                          <span class="item-title">{{ alumno.apellido }} {{ alumno.nombre }}</span>
                          <span class="text-xs text-text-muted">{{ alumno.rut }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="text-xs text-text-muted font-mono">{{ alumno.nroMatricula }}</td>
                    <td>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span
                          class="text-xs px-2 py-0.5 rounded-full border border-border-subtle text-text-secondary bg-brand-muted"
                        >
                          {{ alumno.promocion }}
                        </span>
                        @if (alumno.convalidatedLicense) {
                          <p-tag
                            [value]="'Convalida ' + alumno.convalidatedLicense"
                            severity="info"
                            styleClass="text-2xs font-bold px-1.5 py-0.5"
                            pTooltip="Este alumno convalida simultáneamente la licencia {{
                              alumno.convalidatedLicense
                            }}"
                          ></p-tag>
                        }
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center gap-2">
                        <div class="w-16 h-1.5 rounded-full bg-elevated overflow-hidden">
                          <div
                            class="h-full bg-brand rounded-full"
                            [style.width.%]="moduloPct(alumno)"
                          ></div>
                        </div>
                        <span class="text-xs text-text-secondary font-mono"
                          >{{ alumno.modulosAprobados }}/{{ alumno.modulosTotal }}</span
                        >
                      </div>
                    </td>
                    <td>
                      @let sem = getSemaforo(alumno.semaforo);
                      <p-tag
                        [value]="sem.label"
                        [severity]="sem.severity"
                        styleClass="text-xs font-bold px-2 py-0.5"
                      ></p-tag>
                    </td>
                    <td>
                      <p-tag
                        [value]="alumno.estado"
                        [severity]="getStatusSeverity(alumno.estado)"
                        styleClass="text-xs font-bold px-2 py-0.5"
                      ></p-tag>
                    </td>
                    <td class="text-xs font-medium text-text-secondary">
                      {{ alumno.saldo | currency: 'CLP' : 'symbol' : '1.0-0' }}
                    </td>
                    <td class="pr-6 text-right">
                      <div class="inline-flex items-center justify-end gap-0.5">
                        @if (trashView()) {
                          <button
                            aria-label="Restaurar alumno"
                            pButton
                            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-success"
                            pTooltip="Restaurar alumno"
                            (click)="restaurarRequested.emit(alumno.id)"
                            data-llm-action="restore-professional-student"
                          >
                            <app-icon name="rotate-ccw" [size]="16" />
                          </button>
                        } @else {
                          <button
                            aria-label="Ver ficha"
                            pButton
                            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center"
                            pTooltip="Ver ficha"
                            [routerLink]="[basePath() + '/alumnos/' + alumno.id]"
                          >
                            <app-icon name="eye" [size]="16" />
                          </button>
                          <button
                            aria-label="Archivar alumno"
                            pButton
                            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-error"
                            pTooltip="Archivar alumno"
                            (click)="archivarRequested.emit(alumno.id)"
                            data-llm-action="archive-professional-student"
                          >
                            <app-icon name="trash-2" [size]="16" />
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr>
                    <td colspan="8" class="p-0">
                      <app-empty-state
                        icon="graduation-cap"
                        message="No hay alumnos profesionales"
                        subtitle="Ajusta los filtros o registra nuevas matrículas profesionales."
                        actionLabel="Limpiar filtros"
                        actionIcon="refresh-cw"
                        (action)="resetFilters()"
                      />
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </div>

            <!-- VISTA 2: TARJETAS APILADAS (Visible cuando se comprime o en móvil) -->
            <div class="mobile-view show-on-squeeze p-4 md:p-6 bg-surface">
              <div class="bento-grid">
                @for (alumno of sortedAlumnos(); track alumno.id) {
                  <div class="bento-wide" data-col-span="4">
                    <app-alumno-profesional-card
                      [alumno]="alumno"
                      [trashView]="trashView()"
                      [basePath]="basePath()"
                      (restaurarRequested)="restaurarRequested.emit($event)"
                      (archivarRequested)="archivarRequested.emit($event)"
                    />
                  </div>
                } @empty {
                  <div class="col-span-full py-8">
                    <app-empty-state
                      icon="graduation-cap"
                      message="No hay alumnos profesionales"
                      subtitle="Ajusta los filtros o registra nuevas matrículas profesionales."
                      actionLabel="Limpiar filtros"
                      actionIcon="refresh-cw"
                      (action)="resetFilters()"
                    />
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* Container Queries para Dual-Viewport Render — idéntico a
         app-alumnos-list-content (Clase B) para que ambos listados se
         comporten de forma consistente al comprimirse o en móvil. */
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
export class AlumnosProfesionalListContentComponent implements AfterViewInit {
  // ── Inputs ──────────────────────────────────────────────────────────────
  readonly alumnos = input.required<AlumnoProfesionalTableRow[]>();
  readonly isLoading = input(false);
  readonly trashView = input(false);
  readonly basePath = input<string>('/app/admin');
  /** Hay una exportación en curso (signal isExporting del Facade). */
  readonly isExporting = input(false);

  // ── Outputs ─────────────────────────────────────────────────────────────
  readonly refreshRequested = output<void>();
  readonly preInscritosRequested = output<void>();
  readonly archivarRequested = output<string>();
  readonly restaurarRequested = output<string>();
  readonly trashViewToggled = output<void>();
  /** El Smart genera el archivo con las filas recibidas (spec 0023-m). */
  readonly exportRequested = output<AlumnosProfesionalExportRequest>();

  // ── Orden por columna (spec 0023-m) ─────────────────────────────────────
  /** Orden elegido; null = orden por defecto (como llega del Facade). */
  readonly sort = signal<AlumnoProfesionalListSort | null>(null);
  protected readonly sortColumns = ALUMNO_PROFESIONAL_SORT_OPTIONS;
  /** Índice de la primera fila de la página visible de la tabla. */
  protected readonly tableFirst = signal(0);

  /** La lista filtrada, en el orden elegido. Alimenta la tabla, las tarjetas y la exportación. */
  sortedAlumnos(): AlumnoProfesionalTableRow[] {
    return sortAlumnosProfesional(this.filteredAlumnos(), this.sort());
  }

  /** Clic en el título de una columna: ascendente → descendente → orden por defecto. */
  toggleSort(field: AlumnoProfesionalSortField): void {
    this.applySort(nextSort(this.sort(), field));
  }

  /** Control "Ordenar por" de la vista de tarjetas. Limpiarlo vuelve al orden por defecto. */
  setSortField(field: AlumnoProfesionalSortField | null): void {
    if (field === this.sort()?.field) return;
    this.applySort(field ? { field, direction: 'asc' } : null);
  }

  toggleSortDir(): void {
    this.applySort(toggleSortDirection(this.sort()));
  }

  protected ariaSort(field: AlumnoProfesionalSortField): 'ascending' | 'descending' | 'none' {
    return ariaSortOf(this.sort(), field);
  }

  /** Un orden nuevo se mira desde la primera página. */
  private applySort(sort: AlumnoProfesionalListSort | null): void {
    this.sort.set(sort);
    this.tableFirst.set(0);
  }

  /** Exporta lo que se ve: la lista filtrada (o la Papelera), completa y en el orden elegido. */
  requestExport(format: ExportFormat): void {
    this.exportRequested.emit({ format, rows: this.sortedAlumnos() });
  }

  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  protected readonly skeletonRows = Array(6).fill(0);

  /** Placeholder para satisfacer `alumno` (input.required) en las cards skeleton. */
  protected readonly skeletonAlumno: AlumnoProfesionalTableRow = {
    id: '',
    nombre: '',
    apellido: '',
    rut: '',
    email: '',
    celular: '',
    nroMatricula: '',
    promocion: '',
    licenseClass: '',
    semaforo: null,
    modulosAprobados: 0,
    modulosTotal: 0,
    estado: 'Activo',
    saldo: 0,
    enrollmentId: 0,
  };

  searchTerm = '';
  selectedClase = '';
  selectedEstado = '';

  /** Cada filtro abre con su opción "todos", con el mismo '' por defecto (spec 0022-m). */
  readonly claseOptions = withAllOption(
    [
      { label: 'A2', value: 'A2' },
      { label: 'A3', value: 'A3' },
      { label: 'A4', value: 'A4' },
      { label: 'A5', value: 'A5' },
    ],
    'Todas las clases',
    '',
  );
  readonly estadoOptions = withAllOption(
    [
      { label: 'Activo', value: 'Activo' },
      { label: 'Inactivo', value: 'Inactivo' },
      { label: 'Retirado', value: 'Retirado' },
    ],
    'Todos los estados',
    '',
  );

  /** Muestra "Limpiar filtros": algún selector fuera de "todos" o texto en el buscador. */
  hasActiveFilters(): boolean {
    return this.searchTerm !== '' || this.selectedClase !== '' || this.selectedEstado !== '';
  }

  // ── Derivados ─────────────────────────────────────────────────────────────
  readonly heroSubtitle = computed(() =>
    this.trashView()
      ? 'Papelera — Alumnos profesionales archivados'
      : 'Listado de alumnos de Clase Profesional',
  );

  readonly heroChips = computed((): SectionHeroChip[] => [
    { label: `${this.alumnos().length} alumnos`, icon: 'graduation-cap', style: 'default' },
  ]);

  readonly heroActions = computed((): SectionHeroAction[] => {
    const isTrash = this.trashView();
    return [
      { id: 'preinscritos', label: 'Pre-inscritos', icon: 'users', primary: false },
      { id: 'papelera', label: 'Papelera', icon: 'trash-2', primary: false, danger: isTrash },
    ];
  });

  readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'total',
      label: 'Total',
      value: this.alumnos().length,
      icon: 'graduation-cap',
      color: 'default',
    },
    {
      id: 'activos',
      label: 'Activos',
      value: this.activos(),
      icon: 'user-check',
      color: 'success',
    },
    {
      id: 'deuda',
      label: 'Con deuda',
      value: this.conDeuda(),
      icon: 'circle-alert',
      color: 'warning',
    },
    {
      id: 'riesgo',
      label: 'En riesgo',
      value: this.enRiesgo(),
      icon: 'alert-triangle',
      color: 'error',
    },
  ]);

  readonly activos = computed(() => this.alumnos().filter((a) => a.estado === 'Activo').length);
  readonly conDeuda = computed(() => this.alumnos().filter((a) => a.saldo > 0).length);
  readonly enRiesgo = computed(() => this.alumnos().filter((a) => a.semaforo === 'red').length);

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  filteredAlumnos(): AlumnoProfesionalTableRow[] {
    const term = this.searchTerm.toLowerCase();
    return this.alumnos().filter((a) => {
      const matchSearch = matchesSearchTokens([a.nombre, a.apellido, a.rut, a.nroMatricula], term);
      const matchClase = !this.selectedClase || a.licenseClass === this.selectedClase;
      const matchEstado = !this.selectedEstado || a.estado === this.selectedEstado;
      return matchSearch && matchClase && matchEstado;
    });
  }

  moduloPct(a: AlumnoProfesionalTableRow): number {
    return a.modulosTotal > 0 ? Math.round((a.modulosAprobados / a.modulosTotal) * 100) : 0;
  }

  getSemaforo(flag: SemaforoAsistencia | null): SemaforoInfo {
    switch (flag) {
      case 'green':
        return { label: 'Al día', severity: 'success' };
      case 'yellow':
        return { label: 'En riesgo', severity: 'warn' };
      case 'red':
        return { label: 'Crítico', severity: 'danger' };
      default:
        return { label: 'Sin datos', severity: 'secondary' };
    }
  }

  getStatusSeverity(
    status: AlumnoStatus,
  ): 'success' | 'secondary' | 'info' | 'danger' | 'warn' | undefined {
    switch (status) {
      case 'Activo':
        return 'success';
      case 'Finalizado':
        return 'info';
      case 'Retirado':
        return 'danger';
      case 'Inactivo':
        return 'secondary';
      default:
        return 'warn';
    }
  }

  /** Vuelve filtros y buscador a su valor inicial. El orden elegido se conserva (spec 0023-m). */
  resetFilters(): void {
    this.tableFirst.set(0);
    this.searchTerm = '';
    this.selectedClase = '';
    this.selectedEstado = '';
  }

  handleHeroAction(actionId: string): void {
    switch (actionId) {
      case 'preinscritos':
        this.preInscritosRequested.emit();
        break;
      case 'papelera':
        this.trashViewToggled.emit();
        break;
      default:
        break;
    }
  }
}
