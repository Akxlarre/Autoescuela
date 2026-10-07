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
import { isBlockedInPilot } from '@core/config/pilot-phase.config';
import { sliceByBudget } from '@core/utils/layout-tier.utils';
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
              (ngModelChange)="resetPagination()"
            />
          </div>

          <p-select
            [options]="claseOptions"
            [(ngModel)]="selectedClase"
            (ngModelChange)="resetPagination()"
            optionLabel="label"
            optionValue="value"
            placeholder="Todas las clases"
            class="h-9"
            data-llm-description="Filter professional students by license class"
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
        } @else if (showLoadError()) {
          <!-- fix-338-m: la carga falló y no hay nada que mostrar; no es una lista vacía.
               Centrado en el alto disponible de la celda bento-fill. -->
          <div class="flex-1 flex items-center justify-center bg-surface" role="alert">
            <app-empty-state
              icon="circle-alert"
              [message]="error() ?? ''"
              subtitle="No se pudo obtener la lista. Revisa tu conexión e inténtalo de nuevo."
              actionLabel="Reintentar"
              actionIcon="refresh-cw"
              (action)="retryLoad()"
            />
          </div>
        } @else {
          <!-- Contenido principal interactivo -->
          <div
            class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full"
            appAnimateIn
          >
            <!-- VISTA 1: LA TABLA CLÁSICA (Oculta cuando se comprime) -->
            <!-- table-compact (fix-302-m): misma tabla compacta que la Base de Alumnos B. -->
            <div
              class="desktop-view table-compact hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full"
            >
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
                        [class.table-compact-main]="first"
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
                    <td class="table-compact-main pl-6 py-4">
                      <div class="flex items-center gap-3">
                        <div
                          class="table-compact-avatar w-9 h-9 shrink-0 rounded-full bg-elevated flex items-center justify-center border border-border-subtle text-text-secondary font-bold text-xs uppercase"
                        >
                          {{ alumno.nombre[0] }}{{ alumno.apellido[0] }}
                        </div>
                        <!-- fix-302-m: el nombre que no cabe se recorta y se lee completo al pasar
                             el mouse. -->
                        <div class="flex flex-col min-w-0">
                          <span
                            class="item-title truncate"
                            [title]="alumno.apellido + ' ' + alumno.nombre"
                            >{{ alumno.apellido }} {{ alumno.nombre }}</span
                          >
                          <span class="text-xs text-text-muted truncate">{{ alumno.rut }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="text-xs text-text-muted font-mono whitespace-nowrap">
                      {{ alumno.nroMatricula }}
                    </td>
                    <td>
                      <!-- fix-330-m (D11): la promoción, con la categoría debajo -->
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span
                          class="text-xs px-2 py-0.5 rounded-full border border-border-subtle text-text-secondary bg-brand-muted whitespace-nowrap"
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
                      @if (alumno.licenseClass) {
                        <span class="text-2xs text-text-muted" data-llm-info="categoria-licencia">
                          {{ alumno.licenseClass }}
                        </span>
                      }
                    </td>
                    @if (academicoVisible) {
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
                          styleClass="text-xs font-bold px-2 py-0.5 whitespace-nowrap"
                        ></p-tag>
                      </td>
                    }
                    <td>
                      <p-tag
                        [value]="alumno.estado"
                        [severity]="getStatusSeverity(alumno.estado)"
                        styleClass="text-xs font-bold px-2 py-0.5 whitespace-nowrap"
                      ></p-tag>
                    </td>
                    <td class="text-xs font-medium text-text-secondary whitespace-nowrap">
                      {{ alumno.saldo | currency: 'CLP' : 'symbol' : '1.0-0' }}
                    </td>
                    <td class="pr-6 text-right">
                      <div class="inline-flex items-center justify-end gap-0.5">
                        @if (trashView()) {
                          <button
                            aria-label="Restaurar alumno"
                            pButton
                            class="table-compact-action p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-success"
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
                            class="table-compact-action p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center"
                            pTooltip="Ver ficha"
                            [routerLink]="[basePath() + '/alumnos/' + alumno.id]"
                            [queryParams]="fichaQueryParams(alumno)"
                          >
                            <app-icon name="eye" [size]="16" />
                          </button>
                          <button
                            aria-label="Archivar alumno"
                            pButton
                            class="table-compact-action p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-error"
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
                <!-- track por matrícula: un alumno con 2 matrículas Profesional sale 2 veces (fix-331-m) -->
                @for (alumno of visibleCards(); track alumno.enrollmentId) {
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

                <!-- Cargar más: la vista de tarjetas muestra de a 6, igual que la Base B (fix-354-m) -->
                @if (remainingCards() > 0) {
                  <div class="col-span-full pt-1">
                    <button
                      type="button"
                      class="btn-ghost w-full flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer"
                      (click)="loadMoreCards()"
                      data-llm-action="load-more-professional-students"
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
  /** Error de carga del Facade (fix-338-m). */
  readonly error = input<string | null>(null);
  /** La carga falló y no hay nada que mostrar: no es una lista vacía (patrón de hotfix-113-m). */
  readonly showLoadError = computed(() => !!this.error() && this.alumnos().length === 0);
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

  /**
   * fix-335-m: la ficha abre la matrícula de la fila. Sin esto abría la más reciente de la
   * persona — la Clase B, si tenía una posterior — y "volver" llevaba a la Base B.
   */
  protected fichaQueryParams(alumno: Pick<AlumnoProfesionalTableRow, 'enrollmentId'>) {
    return { enrollment: alumno.enrollmentId };
  }

  // ── Orden por columna (spec 0023-m) ─────────────────────────────────────
  /** Orden elegido; null = orden por defecto (como llega del Facade). */
  readonly sort = signal<AlumnoProfesionalListSort | null>(null);
  /**
   * Asistencia y módulos salen de Asistencia/Evaluaciones Profesional, bloqueados por el recorte
   * del piloto: siempre "Sin datos" y 0/7. Mientras lo estén se ocultan (fix-332-m, D12).
   */
  protected readonly academicoVisible = !isBlockedInPilot('clase-profesional-recorte');

  protected readonly sortColumns = this.academicoVisible
    ? ALUMNO_PROFESIONAL_SORT_OPTIONS
    : ALUMNO_PROFESIONAL_SORT_OPTIONS.filter(
        (c) => c.value !== 'modulos' && c.value !== 'asistencia',
      );
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

  /** Un orden nuevo se mira desde el principio: primera página y primeras tarjetas. */
  private applySort(sort: AlumnoProfesionalListSort | null): void {
    this.sort.set(sort);
    this.tableFirst.set(0);
    this.resetCards();
  }

  // ── Vista de tarjetas: de a 6 con "Cargar más" (fix-354-m) ──────────────
  /**
   * Pintar todas las matrículas dejaba una celda de ~22.000 px y la animación de entrada la
   * montaba sobre el hero. Mismo paso que la Base B.
   */
  private static readonly CARDS_STEP = 6;
  private readonly mobileShown = signal(AlumnosProfesionalListContentComponent.CARDS_STEP);

  visibleCards(): AlumnoProfesionalTableRow[] {
    return sliceByBudget(this.sortedAlumnos(), this.mobileShown());
  }

  remainingCards(): number {
    return Math.max(0, this.filteredAlumnos().length - this.mobileShown());
  }

  loadMoreCards(): void {
    this.mobileShown.update((n) => n + AlumnosProfesionalListContentComponent.CARDS_STEP);
  }

  private resetCards(): void {
    this.mobileShown.set(AlumnosProfesionalListContentComponent.CARDS_STEP);
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
  // Sin filtro de estado (fix-329-m, D2): la Base Profesional solo trae matrículas activas;
  // "Inactivo" y "Retirado" no pueden existir en Clase Profesional.

  /** Muestra "Limpiar filtros": algún selector fuera de "todos" o texto en el buscador. */
  hasActiveFilters(): boolean {
    return this.searchTerm !== '' || this.selectedClase !== '';
  }

  // ── Derivados ─────────────────────────────────────────────────────────────
  readonly heroSubtitle = computed(() =>
    this.trashView()
      ? 'Papelera — Alumnos profesionales archivados'
      : 'Listado de alumnos de Clase Profesional',
  );

  // fix-331-m (D10): una fila por matrícula (un alumno con A2 y A4 sale dos veces), así que el
  // conteo es de matrículas.
  readonly heroChips = computed((): SectionHeroChip[] => [
    { label: `${this.alumnos().length} matrículas`, icon: 'graduation-cap', style: 'default' },
  ]);

  readonly heroActions = computed((): SectionHeroAction[] => {
    const isTrash = this.trashView();
    return [
      // fix-328-m (D1): Pre-inscritos está bloqueado en el piloto (fix-256-m); el botón lo
      // embebía igual dentro de esta pantalla, saltándose el guard de su ruta.
      ...(isBlockedInPilot('clase-profesional-recorte')
        ? []
        : [{ id: 'preinscritos', label: 'Pre-inscritos', icon: 'users', primary: false }]),
      { id: 'papelera', label: 'Papelera', icon: 'trash-2', primary: false, danger: isTrash },
    ];
  });

  readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'total',
      label: 'Matrículas',
      value: this.alumnos().length,
      icon: 'graduation-cap',
      color: 'default',
    },
    {
      id: 'activos',
      label: 'Activas',
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
    // "En riesgo" cuenta el semáforo de asistencia: sin Asistencia Profesional no tiene datos.
    ...(this.academicoVisible
      ? [
          {
            id: 'riesgo',
            label: 'En riesgo',
            value: this.enRiesgo(),
            icon: 'alert-triangle',
            color: 'error' as const,
          },
        ]
      : []),
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
      return matchSearch && matchClase;
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
      default:
        return 'warn';
    }
  }

  /**
   * fix-283-m: al cambiar búsqueda o un selector el resultado se mira desde la página 1 (con
   * [first] la tabla no vuelve sola).
   */
  resetPagination(): void {
    this.tableFirst.set(0);
    this.resetCards();
  }

  /** Vuelve filtros y buscador a su valor inicial. El orden elegido se conserva (spec 0023-m). */
  /** "Reintentar" del estado de error de carga (fix-338-m). */
  protected retryLoad(): void {
    this.refreshRequested.emit();
  }

  resetFilters(): void {
    this.tableFirst.set(0);
    this.resetCards();
    this.searchTerm = '';
    this.selectedClase = '';
  }

  handleHeroAction(actionId: string): void {
    switch (actionId) {
      case 'preinscritos':
        this.preInscritosRequested.emit();
        break;
      case 'papelera':
        this.resetCards();
        this.trashViewToggled.emit();
        break;
      default:
        break;
    }
  }
}
