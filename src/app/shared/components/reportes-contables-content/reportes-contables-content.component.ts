import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';
import { RentabilidadCursosComponent } from '@shared/components/rentabilidad-cursos/rentabilidad-cursos.component';
import { EvolucionMensualChartComponent } from '@shared/components/evolucion-mensual-chart/evolucion-mensual-chart.component';
import type { RentabilidadCurso } from '@core/models/ui/reportes-contables.model';
import { TabsComponent, type TabOption } from '@shared/components/tabs/tabs.component';
import {
  RANGOS_EVOLUCION,
  RANGOS_REPORTE,
  computeDateRange,
  type CategoriaGasto,
  type CategoriaIngreso,
  type EvolucionMensual,
  type FiltrosReporte,
  type GastoFijoRow,
  type RangoEvolucion,
  type RangoReporte,
  type ReporteKpis,
} from '@core/models/ui/reportes-contables.model';
import { computeEvolucionRange } from '@core/utils/reportes-contables.utils';
import { BadgeComponent } from '@shared/components/badge/badge.component';

/**
 * Sección activa dentro del panel único de tabs. Categorías es el default
 * (fix-242-m: pasó de fila fija con scroll propio a tab). Detalle Diario se
 * eliminó — el grano diario es responsabilidad de Cuadratura Diaria.
 */
type ReporteTab = 'categorias' | 'evolucion' | 'rentabilidad' | 'gastos-fijos';

@Component({
  selector: 'app-reportes-contables-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    IconComponent,
    SectionHeroComponent,
    FormsModule,
    SelectModule,
    DateInputComponent,
    EmptyStateComponent,
    BentoGridLayoutDirective,
    RentabilidadCursosComponent,
    EvolucionMensualChartComponent,
    TabsComponent,
    SkeletonBlockComponent,
  ],
  styles: [
    `
      /* ── Category bars ────────────────────────────────────────────────── */
      .cat-section-dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: var(--radius-full);
        flex-shrink: 0;

        &.dot--success {
          background: var(--state-success);
        }

        &.dot--error {
          background: var(--state-error);
        }
      }

      .cat-bar-track {
        width: 100%;
        height: 6px;
        border-radius: var(--radius-full);
        background: var(--bg-subtle);
        overflow: hidden;
        margin-top: var(--space-2);
      }

      .cat-bar-fill {
        height: 100%;
        border-radius: var(--radius-full);
        transition: width 0.6s var(--ease-out);
      }

      /* ── Tables ───────────────────────────────────────────────────────── */
      .report-table {
        width: 100%;
        border-collapse: collapse;
      }

      .report-th {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        text-align: left;
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--border-subtle);
        white-space: nowrap;
      }

      .report-th.align-right,
      .report-td.align-right {
        text-align: right;
      }

      .report-td {
        padding: var(--space-4) var(--space-4);
        border-bottom: 1px solid var(--border-subtle);
        font-size: var(--text-sm);
        color: var(--text-primary);
      }

      .report-tfoot .report-td {
        font-weight: var(--font-semibold);
        border-top: 2px solid var(--border-default);
        border-bottom: none;
      }

      /* ── Escuela chip ─────────────────────────────────────────────────── */
      .escuela-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) var(--space-3);
        border-radius: var(--radius-full);
        border: 1px solid var(--border-default);
        background: var(--bg-surface);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--text-secondary);
        white-space: nowrap;
      }

      /* ── Export dropdown ────────────────────────────────────────────────── */
      .export-menu {
        min-width: 200px;
        background: var(--bg-surface);
        border: 1px solid var(--border-muted);
        border-radius: var(--radius-lg);
        box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
        overflow: hidden;
      }

      .export-menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 14px;
        font-size: 13px;
        color: var(--text-primary);
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        transition: background var(--duration-fast);

        &:hover {
          background: var(--bg-elevated);
        }
      }
    `,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoGridLayout #bentoGrid>
      <!-- ── Hero (sin cambios): título + KPIs. Su propia fila del grid. ── -->
      <div class="bento-banner relative overflow-visible">
        <app-section-hero
          density="slim"
          [loading]="isLoading()"
          [loadingKpiCount]="3"
          title="Reportes Contables"
          subtitle="Resumen financiero y total neto por rango de fechas"
          icon="bar-chart-2"
          [kpis]="heroKpis()"
          [actions]="heroActions()"
          [chips]="heroChips()"
          (actionClick)="onHeroAction($event)"
        />
        @if (exportMenuOpen()) {
          <div class="fixed inset-0 z-10" (click)="exportMenuOpen.set(false)"></div>
          <div class="export-menu absolute top-14 right-4 z-20">
            <button
              type="button"
              class="export-menu-item"
              (click)="requestExport('excel')"
              data-llm-action="export-reportes-contables-excel"
            >
              <app-icon name="table-2" [size]="16" />
              Exportar como Excel
            </button>
            <button
              type="button"
              class="export-menu-item"
              (click)="requestExport('pdf')"
              data-llm-action="export-reportes-contables-pdf"
            >
              <app-icon name="file-text" [size]="16" />
              Exportar como PDF
            </button>
          </div>
        }
      </div>

      <!-- ── Panel único (fix-242-m): filtros/tabs como cabecera fija y el
           contenido de la tab activa scrolleando debajo. Todo en UNA celda
           .bento-fill (el hero queda arriba, aparte). ── -->
      @if (!isLoading() || kpis()) {
        <!-- fix-245-m: los clamps de alto/overflow van SOLO en lg+ (mismo breakpoint que el
             SCSS de .bento-fill). En < lg el panel crece con su contenido y scrollea la
             página (app-like no aplica en móvil). -->
        <div class="bento-banner bento-fill card p-0 lg:overflow-hidden flex flex-col lg:h-full">
          <!-- Cabecera del panel (no scrollea): filtros + tabs.
               fix-246-m: apilada hasta lg y cada hijo contenido a su ancho para no
               desbordar el panel en móvil. -->
          <div
            class="shrink-0 relative flex flex-col lg:flex-row lg:items-center gap-4 flex-wrap p-4 border-b"
            style="border-color: var(--border-subtle)"
          >
            <p-select
              [ngModel]="selectValue()"
              (ngModelChange)="onSelectChange($event)"
              [options]="selectOptions()"
              optionLabel="label"
              optionValue="value"
              styleClass="h-9 w-full sm:w-auto sm:min-w-48"
              placeholder="Rango de fechas"
              [attr.data-llm-description]="
                isEvolucionTab()
                  ? 'selector de ventana de meses del gráfico de Evolución Mensual'
                  : 'selector de rango de fechas para el reporte contable'
              "
            />

            @if (!isEvolucionTab() && localRango() === 'personalizado') {
              <app-date-input
                [value]="localDesde()"
                (valueChange)="onCustomDateChange('desde', $event)"
                placeholder="Desde"
                data-llm-description="fecha de inicio del rango del reporte"
              />

              <app-date-input
                [value]="localHasta()"
                (valueChange)="onCustomDateChange('hasta', $event)"
                placeholder="Hasta"
                data-llm-description="fecha de fin del rango del reporte"
              />
            }

            <app-tabs
              class="w-full min-w-0 lg:w-auto lg:flex-none"
              [tabs]="tabOptions()"
              [activeId]="activeTab()"
              variant="segmented"
              [wrap]="true"
              (activeIdChange)="setActiveTab($event)"
            />

            @if (!isLoading() && kpis()) {
              <!-- hotfix-102-m: en lg+ va anclado a la esquina sup. derecha (espacio libre a
                   la altura del selector); en móvil sigue en el flujo, full-width. -->
              <div
                class="flex items-center gap-2 flex-wrap w-full lg:w-auto lg:absolute lg:right-4 lg:top-4"
              >
                <app-icon name="calendar" [size]="13" color="var(--text-muted)" />
                <span class="text-xs text-text-muted font-medium">
                  {{ rangoDatesLabel() }}
                </span>
                @if (!isEvolucionTab()) {
                  <app-badge variant="success">
                    {{ pct(kpis()!.margenGanancia) }} margen
                  </app-badge>
                }
              </div>
            }
          </div>

          <!-- Contenido de la tab activa (scrollea internamente en lg+; en móvil crece y
               scrollea la página) -->
          <div class="lg:flex-1 lg:min-h-0 flex flex-col p-4">
            @switch (activeTab()) {
              @case ('categorias') {
                <!-- ── Ingresos + Gastos por Categoría ─────────────────────────────────
                     fix-242-m: en lg+ cada tarjeta llena el alto del panel (lista
                     scrolleable arriba, Total anclado abajo, empty state centrado) para
                     que no quede hueco cuando hay pocas categorías. En móvil scroll
                     nativo con alto natural. ── -->
                <div class="lg:flex-1 lg:min-h-0 lg:overflow-visible">
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-full">
                    <div class="card p-5 flex flex-col gap-4 lg:h-full lg:min-h-0">
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="cat-section-dot dot--success"></span>
                        <h2 class="font-semibold text-text-primary">Ingresos por Categoría</h2>
                      </div>

                      <div class="flex flex-col gap-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                        @for (cat of ingresosCategoria(); track cat.nombre) {
                          <div class="flex flex-col gap-1">
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-sm font-medium text-text-primary">
                                {{ cat.nombre }}
                              </span>
                              <span class="text-sm font-semibold text-success whitespace-nowrap">
                                {{ clp(cat.monto) }}
                              </span>
                            </div>
                            <div class="cat-bar-track">
                              <div
                                class="cat-bar-fill"
                                [style.width.%]="cat.porcentaje"
                                [style.background]="cat.barColor"
                              ></div>
                            </div>
                            <div class="flex justify-between">
                              <span class="text-xs text-text-muted">
                                {{ cat.operaciones }} operaciones
                              </span>
                              <span class="text-xs text-text-muted">
                                {{ pct(cat.porcentaje) }}
                              </span>
                            </div>
                          </div>
                        } @empty {
                          <div class="flex-1 flex items-center justify-center py-8">
                            <app-empty-state message="Sin ingresos en este período" />
                          </div>
                        }
                      </div>

                      @if (ingresosCategoria().length) {
                        <div
                          class="flex justify-between pt-3 shrink-0"
                          style="border-top: 1px solid var(--border-subtle)"
                        >
                          <span class="item-title"> Total Ingresos </span>
                          <span class="text-sm font-bold text-success">
                            {{ clp(totalIngresos()) }}
                          </span>
                        </div>
                      }
                    </div>

                    <div class="card p-5 flex flex-col gap-4 lg:h-full lg:min-h-0">
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="cat-section-dot dot--error"></span>
                        <h2 class="font-semibold text-text-primary">Gastos por Categoría</h2>
                      </div>

                      <div class="flex flex-col gap-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                        @for (cat of gastosCategoria(); track cat.nombre) {
                          <div class="flex flex-col gap-1">
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-sm font-medium text-text-primary">
                                {{ cat.nombre }}
                              </span>
                              <span class="text-sm font-semibold text-error whitespace-nowrap">
                                {{ clp(cat.monto) }}
                              </span>
                            </div>
                            <div class="cat-bar-track">
                              <div
                                class="cat-bar-fill bg-error"
                                [style.width.%]="cat.porcentaje"
                              ></div>
                            </div>
                            <div class="flex justify-between">
                              <span class="text-xs text-text-muted">
                                {{ cat.registros }} registros
                              </span>
                              <span class="text-xs text-text-muted">
                                {{ pct(cat.porcentaje) }}
                              </span>
                            </div>
                          </div>
                        } @empty {
                          <div class="flex-1 flex items-center justify-center py-8">
                            <app-empty-state message="Sin gastos en este período" />
                          </div>
                        }
                      </div>

                      @if (gastosCategoria().length) {
                        <div
                          class="flex justify-between pt-3 shrink-0"
                          style="border-top: 1px solid var(--border-subtle)"
                        >
                          <span class="item-title"> Total Gastos </span>
                          <span class="text-sm font-bold text-error">
                            {{ clp(totalGastos()) }}
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              }
              @case ('evolucion') {
                <!-- ── Evolución Mensual — ventana propia elegida en el selector del
                     header (spec 0015-m; antes fija de 6 meses, fix-242-m). El gráfico
                     llena el alto del panel; meses vacíos se muestran en 0. ── -->
                <div class="lg:flex-1 lg:min-h-0 flex flex-col">
                  <div class="flex items-baseline justify-between gap-2 shrink-0 mb-4">
                    <h2 class="font-semibold text-text-primary">Evolución Mensual</h2>
                    <span class="text-xs text-text-muted">{{ evolucionRangoLabel() }}</span>
                  </div>
                  @if (evolucionMensual().length) {
                    <app-evolucion-mensual-chart
                      class="lg:flex-1 lg:min-h-0"
                      [datos]="evolucionMensual()"
                    />
                  } @else {
                    <div class="flex-1 flex items-center justify-center">
                      <app-empty-state message="Sin movimientos para graficar" />
                    </div>
                  }
                </div>
              }
              @case ('rentabilidad') {
                <div class="lg:flex-1 lg:min-h-0 flex flex-col">
                  <app-rentabilidad-cursos
                    class="lg:flex-1 lg:min-h-0"
                    [datos]="rentabilidadCursos()"
                    [periodoLabel]="periodoLabel()"
                  />
                </div>
              }
              @case ('gastos-fijos') {
                <!-- ── Gastos Fijos del Período — solo admin (fix-010-i, H-014):
                   fixed_expenses es RLS admin-only. El tab ya está filtrado por isAdmin()
                   en tabOptions(); el @if acá es defensa en profundidad. ── -->
                @if (isAdmin()) {
                  <div class="lg:flex-1 lg:min-h-0 flex flex-col">
                    <div
                      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b shrink-0"
                      style="border-color: var(--border-muted)"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-error/10"
                        >
                          <app-icon name="lock" [size]="16" color="var(--state-error)" />
                        </div>
                        <div>
                          <h2 class="text-sm font-bold" style="color: var(--text-primary)">
                            Gastos Fijos del Período
                          </h2>
                          <p class="text-xs" style="color: var(--text-muted)">
                            Arriendo, sueldos, servicios y otros
                          </p>
                        </div>
                      </div>
                      <button
                        class="btn-primary flex items-center gap-2 text-xs px-4 py-2 rounded-xl shrink-0 active:scale-[0.98] transition-transform"
                        data-llm-action="abrir-registrar-gasto-fijo"
                        (click)="registrarGastoClick.emit()"
                      >
                        <app-icon name="plus" [size]="14" />
                        Registrar Gasto Fijo
                      </button>
                    </div>

                    @if (gastosFijos().length === 0) {
                      <div
                        class="flex-1 flex flex-col items-center justify-center text-center gap-2 px-6 py-10"
                      >
                        <app-icon name="receipt" [size]="28" color="var(--text-muted)" />
                        <p class="text-sm font-medium" style="color: var(--text-primary)">
                          Sin gastos fijos en este período
                        </p>
                        <p class="text-xs" style="color: var(--text-muted)">
                          Registra arriendo, sueldos u otros gastos estructurales para calcular el
                          neto real.
                        </p>
                      </div>
                    } @else {
                      <div class="lg:flex-1 lg:min-h-0 overflow-x-auto lg:overflow-auto">
                        <table class="report-table">
                          <thead>
                            <tr>
                              <th class="report-th">Fecha</th>
                              <th class="report-th">Categoría</th>
                              <th class="report-th">Descripción</th>
                              <th class="report-th align-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (gasto of gastosFijos(); track gasto.id) {
                              <tr>
                                <td class="report-td text-xs" style="color: var(--text-muted)">
                                  {{ formatDate(gasto.date) }}
                                </td>
                                <td class="report-td">
                                  <app-badge variant="error">{{ gasto.categoryLabel }}</app-badge>
                                </td>
                                <td class="report-td text-sm" style="color: var(--text-secondary)">
                                  {{ gasto.description }}
                                </td>
                                <td
                                  class="report-td align-right text-sm font-semibold"
                                  style="color: var(--state-error)"
                                >
                                  {{ clp(gasto.amount) }}
                                </td>
                              </tr>
                            }
                          </tbody>
                          <tfoot class="report-tfoot">
                            <tr>
                              <td
                                class="report-td font-bold"
                                colspan="3"
                                style="color: var(--text-primary)"
                              >
                                Total Gastos Fijos
                              </td>
                              <td
                                class="report-td align-right font-black"
                                style="color: var(--state-error)"
                              >
                                {{ clp(totalGastosFijos()) }}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    }
                  </div>
                }
              }
            }
          </div>
        </div>
      } @else {
        <!-- hotfix-103-m: skeleton del panel en la primera carga (antes sólo cargaba el
             skeleton del hero y el resto quedaba en blanco). Mismo patrón single-component. -->
        <div
          class="bento-banner bento-fill card p-0 lg:overflow-hidden flex flex-col lg:h-full"
          aria-hidden="true"
        >
          <!-- Cabecera: selector arriba, barra de pestañas full-width abajo, chip a la
               derecha — mismo layout que el panel real. -->
          <div
            class="shrink-0 relative flex flex-col gap-4 p-4 border-b"
            style="border-color: var(--border-subtle)"
          >
            <div class="flex items-center gap-4">
              <app-skeleton-block width="180px" height="36px" borderRadius="8px" />
              <app-skeleton-block
                class="hidden lg:block lg:ml-auto"
                width="210px"
                height="24px"
                borderRadius="9999px"
              />
            </div>
            <app-skeleton-block width="100%" height="42px" borderRadius="10px" />
          </div>

          <div class="flex-1 min-h-0 p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            @for (col of [1, 2]; track col) {
              <div class="card p-5 flex flex-col gap-5">
                <app-skeleton-block width="45%" height="20px" />
                @for (row of [1, 2, 3, 4]; track row) {
                  <div class="flex flex-col gap-2">
                    <div class="flex justify-between gap-4">
                      <app-skeleton-block width="42%" height="14px" />
                      <app-skeleton-block width="22%" height="14px" />
                    </div>
                    <app-skeleton-block width="100%" height="8px" borderRadius="4px" />
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ReportesContablesContentComponent implements AfterViewInit {
  // ── Inputs ─────────────────────────────────────────────────────────────────
  readonly kpis = input<ReporteKpis | null>(null);
  readonly ingresosCategoria = input<CategoriaIngreso[]>([]);
  readonly gastosCategoria = input<CategoriaGasto[]>([]);
  readonly evolucionMensual = input<EvolucionMensual[]>([]);
  readonly escuela = input<string>('');
  readonly isLoading = input<boolean>(false);
  readonly isExporting = input<boolean>(false);
  readonly gastosFijos = input<GastoFijoRow[]>([]);
  readonly rentabilidadCursos = input<RentabilidadCurso[]>([]);
  /** fix-010-i (H-014): "Gastos Fijos del Período" es admin-only (RLS de fixed_expenses). */
  readonly isAdmin = input<boolean>(false);
  readonly filtros = input.required<FiltrosReporte>();
  /** spec 0015-m: opción de rango vigente de la pestaña Evolución (eje independiente de `filtros`). */
  readonly rangoEvolucion = input<RangoEvolucion>('ultimos_6_meses');

  // ── Outputs ────────────────────────────────────────────────────────────────
  readonly aplicarFiltros = output<FiltrosReporte>();
  /** spec 0015-m: cambio de ventana de la pestaña Evolución (NO recarga el reporte general). */
  readonly aplicarRangoEvolucion = output<RangoEvolucion>();
  readonly exportRequested = output<'excel' | 'pdf'>();
  readonly registrarGastoClick = output<void>();

  // ── Hero ──────────────────────────────────────────────────────────────────
  protected readonly exportMenuOpen = signal(false);

  protected readonly heroActions = computed<SectionHeroAction[]>(() => [
    {
      id: 'exportar',
      label: this.isExporting() ? 'Exportando...' : 'Exportar',
      icon: this.isExporting() ? 'loader-circle' : 'download',
      loading: this.isExporting(),
      disabled: this.isExporting(),
      primary: false,
    },
  ]);

  protected readonly heroChips = computed<SectionHeroChip[]>(() => {
    const e = this.escuela();
    return e ? [{ label: e, icon: 'building-2', style: 'success' }] : [];
  });

  protected readonly heroKpis = computed<SectionHeroKpi[]>(() => {
    const data = this.kpis();
    if (!data) return [];

    return [
      {
        id: 'ingresos',
        label: 'Total Ingresos',
        value: this.clp(data.totalIngresos),
        icon: 'trending-up',
        color: 'success',
      },
      {
        id: 'gastos',
        label: 'Total Gastos',
        value: this.clp(data.totalGastos),
        icon: 'trending-down',
        color: 'error',
      },
      {
        id: 'neto',
        label: 'Total Neto',
        value: this.clp(data.totalNeto),
        icon: 'coins',
        color: 'default',
        subValue: 'Ingresos Totales – Gastos Totales',
      },
    ];
  });

  protected onHeroAction(id: string): void {
    if (id === 'exportar' && !this.isExporting()) {
      this.exportMenuOpen.set(!this.exportMenuOpen());
    }
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  // fix-242-m: Categorías pasó de fila fija a tab por defecto; Detalle Diario
  // se eliminó. Gastos Fijos se filtra por isAdmin() (fixed_expenses RLS admin-only).
  protected readonly tabOptions = computed<TabOption[]>(() => {
    const base: TabOption[] = [
      { id: 'categorias', label: 'Categorías' },
      { id: 'evolucion', label: 'Evolución Mensual' },
      { id: 'rentabilidad', label: 'Rentabilidad' },
    ];
    if (this.isAdmin()) {
      base.push({ id: 'gastos-fijos', label: 'Gastos Fijos' });
    }
    return base;
  });

  protected readonly activeTab = signal<ReporteTab>('categorias');

  protected setActiveTab(tabId: string): void {
    this.activeTab.set(tabId as ReporteTab);
  }

  // ── Estado local del formulario de filtros ────────────────────────────────
  protected readonly rangos = RANGOS_REPORTE;
  protected readonly rangosEvolucion = RANGOS_EVOLUCION;

  protected localRango = linkedSignal<RangoReporte>(() => this.filtros().rango);
  protected localDesde = linkedSignal(() => this.filtros().desde);
  protected localHasta = linkedSignal(() => this.filtros().hasta);
  /** spec 0015-m: eje de rango propio de la pestaña Evolución. */
  protected localRangoEvolucion = linkedSignal<RangoEvolucion>(() => this.rangoEvolucion());

  // ── Selector del header: opciones y valor dependen de la pestaña activa (spec 0015-m) ──
  protected readonly isEvolucionTab = computed(() => this.activeTab() === 'evolucion');

  protected readonly selectOptions = computed(() =>
    this.isEvolucionTab() ? this.rangosEvolucion : this.rangos,
  );

  protected readonly selectValue = computed<RangoReporte | RangoEvolucion>(() =>
    this.isEvolucionTab() ? this.localRangoEvolucion() : this.localRango(),
  );

  /** Rutea el cambio del selector al eje correcto según la pestaña. */
  protected onSelectChange(value: RangoReporte | RangoEvolucion): void {
    if (this.isEvolucionTab()) {
      const rango = value as RangoEvolucion;
      this.localRangoEvolucion.set(rango);
      this.aplicarRangoEvolucion.emit(rango);
    } else {
      this.onRangoChange(value as RangoReporte);
    }
  }

  /** Etiqueta de la ventana de meses vigente en la pestaña Evolución (chip + título). */
  protected readonly evolucionRangoLabel = computed(() => {
    switch (this.localRangoEvolucion()) {
      case 'ultimos_6_meses':
        return 'últimos 6 meses';
      case 'ultimos_12_meses':
        return 'últimos 12 meses';
      case 'anio_actual':
        return `año ${new Date().getFullYear()}`;
      case 'anio_anterior':
        return `año ${new Date().getFullYear() - 1}`;
    }
  });

  /** Rango de fechas del chip del header: la ventana de Evolución en su pestaña, el filtro general en el resto. */
  protected readonly rangoDatesLabel = computed(() => {
    if (this.isEvolucionTab()) {
      const { desde, hasta } = computeEvolucionRange(this.localRangoEvolucion());
      return `${this.formatDate(desde)} – ${this.formatDate(hasta)}`;
    }
    return `${this.formatDate(this.filtros().desde)} – ${this.formatDate(this.filtros().hasta)}`;
  });

  // ── Totales computados ────────────────────────────────────────────────────
  protected readonly totalIngresos = computed(() =>
    this.ingresosCategoria().reduce((s, c) => s + c.monto, 0),
  );

  protected readonly totalGastos = computed(() =>
    this.gastosCategoria().reduce((s, c) => s + c.monto, 0),
  );

  protected readonly totalGastosFijos = computed(() =>
    this.gastosFijos().reduce((s, g) => s + g.amount, 0),
  );

  // ── Helpers de formato ────────────────────────────────────────────────────
  protected clp(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  protected pct(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  /** Convierte YYYY-MM-DD → DD/MM/YYYY para mostrar en el banner. */
  protected formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  /**
   * Label del período activo para la pestaña Rentabilidad (fix-237-m).
   * Deriva del `filtros()` real, no de la fecha de hoy: si el rango cae dentro de
   * un mismo mes → "Mes Año"; si abarca varios → "DD/MM/YYYY – DD/MM/YYYY".
   */
  protected readonly periodoLabel = computed(() => {
    const { desde, hasta } = this.filtros();
    if (!desde || !hasta) return '';
    const [dy, dm] = desde.split('-');
    const [hy, hm] = hasta.split('-');
    if (dy === hy && dm === hm) {
      const mes = new Date(Number(dy), Number(dm) - 1, 1).toLocaleDateString('es-CL', {
        month: 'long',
      });
      return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${dy}`;
    }
    return `${this.formatDate(desde)} – ${this.formatDate(hasta)}`;
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  protected requestExport(format: 'excel' | 'pdf'): void {
    this.exportMenuOpen.set(false);
    this.exportRequested.emit(format);
  }

  /**
   * fix-237-m: sin botón "Aplicar". Un rango preset recarga al instante; el rango
   * "Personalizado" recarga solo cuando Desde y Hasta están ambas puestas y
   * `desde <= hasta` (ver `onCustomDateChange`).
   */
  protected onRangoChange(rango: RangoReporte): void {
    this.localRango.set(rango);
    if (rango !== 'personalizado') {
      const [desde, hasta] = computeDateRange(rango);
      this.localDesde.set(desde);
      this.localHasta.set(hasta);
      this.emitirFiltros();
    }
  }

  protected onCustomDateChange(campo: 'desde' | 'hasta', value: string): void {
    if (campo === 'desde') this.localDesde.set(value);
    else this.localHasta.set(value);

    const desde = this.localDesde();
    const hasta = this.localHasta();
    if (desde && hasta && desde <= hasta) {
      this.emitirFiltros();
    }
  }

  private emitirFiltros(): void {
    this.aplicarFiltros.emit({
      rango: this.localRango(),
      desde: this.localDesde(),
      hasta: this.localHasta(),
    });
  }

  // ── Animación Gsap ──────────────────────────────────────────────────────────
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');

  /**
   * El stagger corre una sola vez en la carga inicial (mismo criterio que
   * `fix-027-i`). Cambiar de tab NO vuelve a animar el panel.
   */
  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }
}
