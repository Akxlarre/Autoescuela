import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RouterLink } from '@angular/router';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { PeriodSelectorComponent } from '@shared/components/period-selector/period-selector.component';
import {
  DEFAULT_PERIOD_WINDOW,
  applyPeriodWindow,
  type PeriodWindow,
} from '@core/utils/period-window.utils';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { sliceByBudget } from '@core/utils/layout-tier.utils';
import { getInitialsFromDisplayName } from '@core/models/ui/user.model';

/**
 * Tabla + buscador + selector de período + KPIs de Ex-Alumnos Clase B (spec 0007-i).
 *
 * Dumb puro: NO inyecta ExAlumnosFacade ni ningún otro Facade/Service (el Architect Guard
 * bloquea cualquier inject(...Facade) en shared/). Recibe egresados por input() y calcula
 * todo lo derivado (heroChips, heroKpis, filtrado, paginación) desde ahí. La acción de
 * "re-matricular" (confirmar + navegar + abrir wizard, y en admin, seleccionar sede) NO
 * vive acá: el Dumb solo emite reEnrollRequested con el egresado y el Smart Component
 * (dueño de Router/ConfirmModalService/LayoutDrawerFacadeService/BranchFacade) la resuelve.
 *
 * Absorbido desde admin-ex-alumnos.component.ts / secretaria-ex-alumnos.component.ts
 * (93% código idéntico entre los dos, ver plan.md de 0007-i).
 */
@Component({
  selector: 'app-ex-alumnos-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    FormsModule,
    SelectModule,
    PeriodSelectorComponent,
    TagModule,
    TooltipModule,
    TableModule,
    ButtonModule,
    RouterLink,
    IconComponent,
    SkeletonBlockComponent,
    EmptyStateComponent,
    SectionHeroComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoGridLayout>
      <!-- ── Hero ── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Ex-Alumnos B"
        subtitle="Archivo histórico de egresados de Clase B"
        icon="graduation-cap"
        [actions]="heroActions"
        [chips]="heroChips()"
        [kpis]="heroKpis()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- Archivo Histórico — mismo patrón visual que app-alumnos-list-content:
           toolbar (buscador + selects) + p-table con paginador + tarjetas mobile. -->
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
              placeholder="Buscar por nombre, RUT o Nº Expediente..."
              class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-border-default bg-surface text-text-primary outline-none transition-colors"
              data-llm-description="Search graduates by name, RUT or file number"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
            />
          </div>
          <!-- fix-147-b: este selector REEMPLAZA al filtro de año suelto que había acá.
             Eran dos controles de tiempo compitiendo: con la ventana por defecto activa,
             elegir un año viejo devolvía 0 filas y parecía roto. Ahora elegir un año ES
             elegir una ventana, así que no pueden contradecirse. -->
          <app-period-selector
            [window]="periodWindow()"
            (windowChange)="periodWindow.set($event)"
            [years]="availableYears()"
            [searchActive]="hasActiveSearch()"
            ariaLabel="Período de egreso"
          />
        </div>

        <!-- Tabla -->
        @if (isLoading()) {
          <div class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full">
            <div
              class="desktop-view hide-on-squeeze p-4 space-y-0 flex flex-col flex-1 min-h-0 h-full w-full"
            >
              <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                <app-skeleton-block variant="text" width="22%" height="11px" />
                <app-skeleton-block variant="text" width="10%" height="11px" />
                <app-skeleton-block variant="text" width="8%" height="11px" />
                <app-skeleton-block variant="text" width="8%" height="11px" />
                <app-skeleton-block variant="text" width="12%" height="11px" />
                <app-skeleton-block variant="text" width="10%" height="11px" />
              </div>
              @for (row of [1, 2, 3, 4, 5, 6]; track row) {
                <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                  <div class="flex items-center gap-3 w-[22%]">
                    <app-skeleton-block variant="circle" width="36px" height="36px" />
                    <div class="flex flex-col gap-1.5 flex-1">
                      <app-skeleton-block variant="text" width="75%" height="12px" />
                      <app-skeleton-block variant="text" width="55%" height="10px" />
                    </div>
                  </div>
                  <app-skeleton-block variant="text" width="10%" height="12px" />
                  <app-skeleton-block variant="text" width="8%" height="12px" />
                  <app-skeleton-block variant="rect" width="60px" height="24px" />
                  <app-skeleton-block variant="text" width="12%" height="12px" />
                  <app-skeleton-block variant="rect" width="80px" height="24px" />
                  <div class="flex items-center gap-1 ml-auto">
                    <app-skeleton-block variant="circle" width="28px" height="28px" />
                    <app-skeleton-block variant="circle" width="28px" height="28px" />
                  </div>
                </div>
              }
            </div>
            <div class="mobile-view show-on-squeeze p-4 space-y-2">
              @for (card of [1, 2, 3, 4]; track card) {
                <app-skeleton-block variant="rect" width="100%" height="120px" />
              }
            </div>
          </div>
        } @else {
          <div class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full">
            <!-- VISTA 1: TABLA (Oculta cuando se comprime) -->
            <div class="desktop-view hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full">
              <p-table
                [value]="filteredEgresados()"
                [rows]="10"
                [paginator]="true"
                [scrollable]="true"
                scrollHeight="flex"
                responsiveLayout="scroll"
                styleClass="p-datatable-sm p-datatable-striped h-full flex flex-col"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} egresados"
              >
                <ng-template pTemplate="header">
                  <tr class="micro-label text-left">
                    <th class="pl-6 py-4">Alumno</th>
                    <th>RUT</th>
                    <th>Nº Exp.</th>
                    <th>Licencia</th>
                    <th>Año / Sede</th>
                    <th>Estado cuenta</th>
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
                      <span class="inas-badge" [attr.data-licencia]="egresado.licencia">{{
                        egresado.licencia
                      }}</span>
                    </td>
                    <td class="text-xs text-text-secondary">
                      <div class="flex flex-col">
                        <span class="font-bold text-text-primary">{{ egresado.anio }}</span>
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
                          (click)="requestReEnroll(egresado)"
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
                        icon="search"
                        message="No se encontraron egresados"
                        subtitle="Intenta ajustar los criterios de búsqueda o filtros."
                        actionLabel="Limpiar filtros"
                        actionIcon="refresh-cw"
                        (action)="clearFilters()"
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
                  <div
                    class="flex flex-col bg-base border border-border-subtle rounded-xl overflow-hidden shadow-sm bento-wide"
                    appCardHover
                    data-col-span="4"
                  >
                    <!-- Header -->
                    <div
                      class="p-4 border-b border-border-subtle flex items-start justify-between gap-3"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          class="shrink-0 w-10 h-10 rounded-full bg-surface shadow-sm flex items-center justify-center border border-border-default text-text-primary font-black text-sm uppercase"
                        >
                          {{ initials(egresado.nombre) }}
                        </div>
                        <div class="flex flex-col min-w-0">
                          <span
                            class="item-title truncate"
                            [pTooltip]="egresado.nombre"
                            tooltipPosition="top"
                            >{{ egresado.nombre }}</span
                          >
                          <span
                            class="text-xs text-text-muted truncate"
                            [pTooltip]="egresado.correo"
                            tooltipPosition="top"
                            >{{ egresado.correo }}</span
                          >
                        </div>
                      </div>
                      <span class="inas-badge shrink-0" [attr.data-licencia]="egresado.licencia">{{
                        egresado.licencia
                      }}</span>
                    </div>

                    <!-- Body -->
                    <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4 text-sm bg-surface">
                      <div class="flex flex-col">
                        <span class="text-2xs text-text-muted mb-0.5">RUT</span>
                        <span class="font-medium text-text-secondary font-mono text-xs">{{
                          egresado.rut
                        }}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-2xs text-text-muted mb-0.5">Nº Exp.</span>
                        <span class="font-medium text-text-secondary font-mono text-xs">{{
                          egresado.nroExpediente ?? '—'
                        }}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-2xs text-text-muted mb-0.5">Año / Sede</span>
                        <span class="font-medium text-text-secondary text-xs"
                          >{{ egresado.anio }} · {{ egresado.sede }}</span
                        >
                      </div>
                      <div class="flex flex-col">
                        <span class="text-2xs text-text-muted mb-0.5">Estado cuenta</span>
                        @if (egresado.saldoPendiente > 0) {
                          <p-tag
                            [value]="
                              'Debe ' +
                              (egresado.saldoPendiente | currency: 'CLP' : 'symbol' : '1.0-0')
                            "
                            severity="warn"
                            styleClass="text-2xs font-bold px-1.5 py-0.5 w-fit"
                          ></p-tag>
                        } @else {
                          <p-tag
                            value="Al día"
                            severity="success"
                            styleClass="text-2xs font-bold px-1.5 py-0.5 w-fit"
                          ></p-tag>
                        }
                      </div>
                    </div>

                    <!-- Footer Actions -->
                    <div
                      class="p-2 bg-transparent border-t border-border-subtle flex items-center justify-end gap-0.5"
                    >
                      <button
                        aria-label="Ver ficha"
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
                        pTooltip="Ver ficha"
                        [routerLink]="[basePath() + '/alumnos', egresado.studentId]"
                        data-llm-action="view-student-detail-card"
                      >
                        <app-icon name="eye" [size]="16" />
                      </button>
                      <button
                        aria-label="Re-matricular"
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
                        pTooltip="Re-matricular"
                        (click)="requestReEnroll(egresado)"
                        data-llm-action="re-enroll-student-card"
                      >
                        <app-icon name="user-plus" [size]="16" />
                      </button>
                    </div>
                  </div>
                } @empty {
                  <div class="col-span-full py-8">
                    <app-empty-state
                      icon="search"
                      message="No se encontraron egresados"
                      subtitle="Intenta ajustar los criterios de búsqueda o filtros."
                      actionLabel="Limpiar filtros"
                      actionIcon="refresh-cw"
                      (action)="clearFilters()"
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

    .inas-badge {
      display: inline-flex;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      background: var(--bg-subtle);
      border: 1px solid var(--border-subtle);
    }
    .inas-badge[data-licencia*='B'] {
      color: var(--color-primary);
      background: var(--color-primary-tint);
      border-color: var(--color-primary);
    }
    .inas-badge[data-licencia*='A'] {
      color: var(--state-warning);
      background: var(--state-warning-bg);
      border-color: var(--state-warning-border);
    }
  `,
})
export class ExAlumnosContentComponent {
  readonly egresados = input.required<EgresadoTableRow[]>();
  readonly isLoading = input<boolean>(false);
  /** Precedente: alumnos-list-content, alumnos-profesional-list-content, flota-list-content. */
  readonly basePath = input<string>('/app/secretaria');

  /** El Smart Component confirma, navega y abre el wizard (y en admin, selecciona sede). */
  readonly reEnrollRequested = output<EgresadoTableRow>();
  readonly requestVerTasas = output<void>();
  readonly requestComentario = output<void>();

  // ── Hero Config — acciones sin lógica propia, solo re-emiten (el Smart abre el drawer) ──
  protected readonly heroActions: SectionHeroAction[] = [
    { id: 'tasas', label: 'Tasas de Aprobación', icon: 'trending-up', primary: false },
    { id: 'opiniones', label: 'Opiniones de Egresados', icon: 'message-square', primary: false },
  ];

  protected handleHeroAction(actionId: string): void {
    switch (actionId) {
      case 'tasas':
        this.requestVerTasas.emit();
        break;
      case 'opiniones':
        this.requestComentario.emit();
        break;
      default:
        break;
    }
  }

  protected readonly heroChips = computed<SectionHeroChip[]>(() => [
    { label: 'Historial Consolidado', style: 'default', icon: 'archive' },
    { label: `${this.egresados().length} Egresados`, style: 'success', icon: 'circle-check' },
  ]);

  protected readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'total',
      label: 'Egresados Clase B',
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

  // ── Filtros locales ──────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');

  /**
   * Ventana de período (fix-147-b). Reemplaza al filtroAnio suelto: los años concretos son
   * ahora opciones de ESTE control, no un segundo filtro de tiempo que pueda contradecirlo.
   */
  protected readonly periodWindow = signal<PeriodWindow>(DEFAULT_PERIOD_WINDOW);

  protected readonly hasActiveSearch = computed(() => this.searchTerm().trim().length > 0);

  // ── Lista filtrada (cliente) ─────────────────────────────────────────────────
  protected readonly filteredEgresados = computed<EgresadoTableRow[]>(() => {
    // El período se aplica ANTES de la búsqueda y solo cuando no hay término activo:
    // buscar tiene que encontrar al egresado sin importar cuándo egresó (ASG-b-087).
    const enPeriodo = applyPeriodWindow(this.egresados(), {
      window: this.periodWindow(),
      hasActiveSearch: this.hasActiveSearch(),
      dateOf: (e: EgresadoTableRow) => e.fechaEgreso,
    });

    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return enPeriodo;

    return enPeriodo.filter(
      (e: EgresadoTableRow) =>
        e.nombre.toLowerCase().includes(term) ||
        e.rut.toLowerCase().includes(term) ||
        (e.nroExpediente?.toLowerCase().includes(term) ?? false),
    );
  });

  // ── Densidad incremental de la vista tarjetas (mismo patrón que app-alumnos-list-content) ──
  private static readonly CARDS_STEP = 6;
  protected readonly mobileShown = signal(ExAlumnosContentComponent.CARDS_STEP);
  protected readonly visibleCards = computed(() =>
    sliceByBudget(this.filteredEgresados(), this.mobileShown()),
  );
  protected readonly remainingCards = computed(() =>
    Math.max(0, this.filteredEgresados().length - this.mobileShown()),
  );

  protected loadMoreCards(): void {
    this.mobileShown.update((n) => n + ExAlumnosContentComponent.CARDS_STEP);
  }

  protected initials(nombre: string): string {
    return getInitialsFromDisplayName(nombre);
  }

  // fix-147-b: yearSelectOptions se eliminó — app-period-selector arma sus propias
  // opciones a partir de availableYears, que ahora se le pasa directo.
  protected readonly availableYears = computed<string[]>(() => {
    const years = this.egresados()
      .map((e: EgresadoTableRow) => e.anio)
      .filter((y): y is number => y !== null);
    return [...new Set(years)].sort((a: number, b: number) => Number(b) - Number(a)).map(String);
  });

  protected requestReEnroll(egresado: EgresadoTableRow): void {
    this.reEnrollRequested.emit(egresado);
  }

  protected clearFilters(): void {
    this.searchTerm.set('');
    // Vuelve al DEFAULT, no a "todo el historial": limpiar filtros devuelve la vista a su
    // estado inicial acotado, no la deja sin techo (fix-147-b).
    this.periodWindow.set(DEFAULT_PERIOD_WINDOW);
    this.mobileShown.set(ExAlumnosContentComponent.CARDS_STEP);
  }
}
