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
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';
import { RentabilidadCursosComponent } from '@shared/components/rentabilidad-cursos/rentabilidad-cursos.component';
import type { RentabilidadCurso } from '@core/models/ui/reportes-contables.model';
import { TabsComponent, type TabOption } from '@shared/components/tabs/tabs.component';
import {
  RANGOS_REPORTE,
  computeDateRange,
  type CategoriaGasto,
  type CategoriaIngreso,
  type DetalleDiario,
  type EvolucionMensual,
  type FiltrosReporte,
  type GastoFijoRow,
  type RangoReporte,
  type ReporteKpis,
} from '@core/models/ui/reportes-contables.model';
import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { BadgeComponent } from '@shared/components/badge/badge.component';

/**
 * Sección activa dentro del panel único de tabs (spec 0003-i). "evolucion" es el default.
 * Hero/Filtros/Categorías/Gastos Fijos quedan fijos, fuera de este switch — no son tabs.
 */
type ReporteTab = 'evolucion' | 'detalle' | 'rentabilidad' | 'gastos-fijos';

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
    BentoGridLayoutDirective,
    RentabilidadCursosComponent,
    TabsComponent,
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

      /* ── Margen badge ─────────────────────────────────────────────────── */
      .margen-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 10px;
        border-radius: var(--radius-full);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        background: var(--state-success-bg);
        color: var(--state-success);
        border: 1px solid var(--state-success-border);
      }

      /* ── Ver detalle ──────────────────────────────────────────────────── */
      .btn-ver-detalle {
        background: none;
        border: none;
        color: var(--color-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        font-family: var(--font-body);
        cursor: pointer;
        padding: 0;

        &:hover {
          text-decoration: underline;
        }
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

      /* ── Categorías: fila propia con scroll interno (spec 0003-i) ─────────── */
      /* Ingresos+Gastos por categoría pueden medir más que el alto disponible en
         el shell fill-screen en algunos breakpoints. En vez de colapsar la fila
         del panel de tabs a 0px (bug encontrado en /verify), esta sección scrollea
         internamente y le cede alto mínimo garantizado al panel de tabs. Filtros
         quedó en su propia fila separada (feedback visual, 2026-08-25) — ya no
         comparte scroll con Categorías. Ver .bento-grid--fill-screen-4. */
      @container layoutmain (min-width: 1024px) {
        .reportes-categorias-scroll {
          min-height: 0;
          overflow-y: auto;
        }
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
    <div
      class="bento-grid bento-grid--fill-screen-4 bento-grid--rows-fit"
      appBentoGridLayout
      #bentoGrid
    >
      <!-- ── Hero (banner con degradado azul/morado) ───────────────────────── -->
      <div class="bento-banner relative overflow-visible">
        <app-section-hero
          density="slim"
          [loading]="isLoading()"
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

      <!-- ── Barra de filtros (fila propia, fija — spec 0003-i) ───────────────── -->
      <div class="bento-banner">
        <div class="card p-4 flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
          <!-- Rango -->
          <p-select
            [ngModel]="localRango()"
            (ngModelChange)="onRangoChange($event)"
            [options]="rangos"
            optionLabel="label"
            optionValue="value"
            styleClass="h-9 min-w-48"
            placeholder="Rango de fechas"
            data-llm-description="selector de rango de fechas para el reporte contable"
          />

          @if (localRango() === 'personalizado') {
            <!-- Desde/Hasta — el reporte se recarga solo cuando ambas están puestas
                 y desde <= hasta (sin botón "Aplicar", fix-237-m). -->
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

          <!-- ── Tabs (Evolución Mensual / Detalle Diario / Rentabilidad / Gastos Fijos
               —admin only—) — spec 0003-i. Hero, Filtros y Categorías quedan fijos fuera
               de este switch; Gastos Fijos SÍ es tab (a diferencia de la primera pasada). ── -->
          <app-tabs
            style="width: auto; flex: 0 0 auto"
            [tabs]="tabOptions()"
            [activeId]="activeTab()"
            variant="segmented"
            (activeIdChange)="setActiveTab($event)"
          />

          <!-- Período activo (info contextual) -->
          @if (!isLoading() && kpis()) {
            <div class="flex items-center gap-2 ml-auto">
              <app-icon name="calendar" [size]="13" color="var(--text-muted)" />
              <span class="text-xs text-text-muted font-medium">
                {{ formatDate(filtros().desde) }} – {{ formatDate(filtros().hasta) }}
              </span>
              <app-badge variant="success"> {{ pct(kpis()!.margenGanancia) }} margen </app-badge>
            </div>
          }
        </div>
      </div>

      <!-- ── Categorías (Ingresos + Gastos) — fila propia, scroll interno si no entra
           (spec 0003-i, feedback visual). SWR (fix-237-m): si ya hay reporte, se
           mantiene montado durante el refresco silencioso en vez de quedar en blanco. ── -->
      @if (!isLoading() || kpis()) {
        <div class="bento-banner reportes-categorias-scroll">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Ingresos por Categoría -->
            <div class="card p-5 flex flex-col gap-4">
              <div class="flex items-center gap-2">
                <span class="cat-section-dot dot--success"></span>
                <h2 class="font-semibold text-text-primary">Ingresos por Categoría</h2>
              </div>

              <div class="flex flex-col gap-4">
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
                }

                @if (ingresosCategoria().length) {
                  <div
                    class="flex justify-between pt-3"
                    style="border-top: 1px solid var(--border-subtle)"
                  >
                    <span class="item-title"> Total Ingresos </span>
                    <span class="text-sm font-bold text-success">
                      {{ clp(totalIngresos()) }}
                    </span>
                  </div>
                }
              </div>
            </div>

            <!-- Gastos por Categoría -->
            <div class="card p-5 flex flex-col gap-4">
              <div class="flex items-center gap-2">
                <span class="cat-section-dot dot--error"></span>
                <h2 class="font-semibold text-text-primary">Gastos por Categoría</h2>
              </div>

              <div class="flex flex-col gap-4">
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
                      <div class="cat-bar-fill bg-error" [style.width.%]="cat.porcentaje"></div>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-xs text-text-muted"> {{ cat.registros }} registros </span>
                      <span class="text-xs text-text-muted">
                        {{ pct(cat.porcentaje) }}
                      </span>
                    </div>
                  </div>
                }

                @if (gastosCategoria().length) {
                  <div
                    class="flex justify-between pt-3"
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
        </div>
      }

      <!-- ── Panel único de tabs (celda .bento-fill, sin importar la tab activa) — spec 0003-i:
           Evolución Mensual / Detalle Diario / Rentabilidad / Gastos Fijos (admin only).
           Mismo patrón que fix-027-i. SWR (fix-237-m): se mantiene montado con los datos
           previos durante el refresco silencioso por cambio de filtro. ── -->
      @if (!isLoading() || kpis()) {
        <div class="bento-banner bento-fill card p-5 overflow-hidden flex flex-col h-full">
          @switch (activeTab()) {
            @case ('evolucion') {
              <!-- ── Evolución Mensual ─────────────────────────────────────────────── -->
              <div class="flex-1 min-h-0 overflow-y-auto">
                <h2 class="font-semibold text-text-primary" style="margin-bottom: var(--space-4)">
                  Evolución Mensual
                </h2>
                @if (evolucionMensual().length) {
                  <div class="overflow-x-auto w-full">
                    <table class="report-table">
                      <thead>
                        <tr>
                          <th class="report-th">Mes</th>
                          <th class="report-th align-right">Ingresos</th>
                          <th class="report-th align-right">Gastos</th>
                          <th class="report-th align-right">Neto</th>
                          <th class="report-th align-right">Margen</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of evolucionMensual(); track row.mes) {
                          <tr>
                            <td class="report-td font-medium">
                              {{ row.mes }}
                            </td>
                            <td class="report-td align-right text-success">
                              {{ clp(row.ingresos) }}
                            </td>
                            <td class="report-td align-right text-error">
                              {{ clp(row.gastos) }}
                            </td>
                            <td class="report-td align-right text-brand font-semibold">
                              {{ clp(row.neto) }}
                            </td>
                            <td class="report-td align-right">
                              <span class="margen-badge">{{ pct(row.margen) }}</span>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            }
            @case ('detalle') {
              <!-- ── Detalle Diario ───────────────────────────────────────────────── -->
              <div class="flex-1 min-h-0 overflow-y-auto">
                <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 class="font-semibold text-text-primary">Detalle Diario</h2>
                  <span class="text-sm text-brand font-medium">
                    {{ diasConMovimientos() }} días con movimientos
                  </span>
                </div>

                @if (detalleDiario().length) {
                  <div class="overflow-x-auto w-full">
                    <table class="report-table">
                      <thead>
                        <tr>
                          <th class="report-th">Fecha</th>
                          <th class="report-th align-right">Operaciones</th>
                          <th class="report-th align-right">Ingresos</th>
                          <th class="report-th align-right">Gastos</th>
                          <th class="report-th align-right">Neto</th>
                          <th class="report-th align-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of detalleDiario(); track row.fecha) {
                          <tr>
                            <td class="report-td text-sm">
                              {{ row.fecha }}
                            </td>
                            <td class="report-td align-right text-error">
                              {{ row.operaciones }}
                            </td>
                            <td class="report-td align-right text-success">
                              +{{ clp(row.ingresos) }}
                            </td>
                            <td class="report-td align-right text-error">-{{ clp(row.gastos) }}</td>
                            <td class="report-td align-right text-brand font-semibold">
                              {{ clp(row.neto) }}
                            </td>
                            <td class="report-td align-right">
                              <button
                                class="btn-ver-detalle"
                                (click)="verDetalle.emit(row.fecha)"
                                data-llm-action="view-daily-detail"
                              >
                                Ver detalle
                              </button>
                            </td>
                          </tr>
                        }
                      </tbody>
                      <tfoot class="report-tfoot">
                        <tr>
                          <td class="report-td font-bold">TOTAL</td>
                          <td class="report-td align-right text-error font-bold">
                            {{ totalesDiario().operaciones }}
                          </td>
                          <td class="report-td align-right text-success font-bold">
                            +{{ clp(totalesDiario().ingresos) }}
                          </td>
                          <td class="report-td align-right text-error font-bold">
                            -{{ clp(totalesDiario().gastos) }}
                          </td>
                          <td class="report-td align-right text-brand font-bold">
                            {{ clp(totalesDiario().neto) }}
                          </td>
                          <td class="report-td"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                }
              </div>
            }
            @case ('rentabilidad') {
              <!-- ── Rentabilidad Estimada por Tipo de Curso ─────────────────────── -->
              <div class="flex-1 min-h-0 overflow-y-auto flex flex-col">
                <app-rentabilidad-cursos
                  [datos]="rentabilidadCursos()"
                  [periodoLabel]="periodoLabel()"
                />
              </div>
            }
            @case ('gastos-fijos') {
              <!-- ── Gastos Fijos del Período — solo admin (fix-010-i, H-014):
                   fixed_expenses es RLS admin-only. El tab ya está filtrado por isAdmin()
                   en tabOptions(), pero se repite el @if acá como defensa en profundidad
                   (mismo criterio que el resto del proyecto para datos admin-only). ── -->
              @if (isAdmin()) {
                <div class="flex-1 min-h-0 overflow-y-auto flex flex-col">
                  <div
                    class="flex items-center justify-between px-6 py-4 border-b"
                    style="border-color: var(--border-muted)"
                  >
                    <div class="flex items-center gap-3">
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
                      class="px-6 py-10 flex flex-col items-center justify-center text-center gap-2"
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
                    <div class="overflow-x-auto">
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
      }
    </div>
  `,
})
export class ReportesContablesContentComponent {
  // ── Inputs ─────────────────────────────────────────────────────────────────
  readonly kpis = input<ReporteKpis | null>(null);
  readonly ingresosCategoria = input<CategoriaIngreso[]>([]);
  readonly gastosCategoria = input<CategoriaGasto[]>([]);
  readonly evolucionMensual = input<EvolucionMensual[]>([]);
  readonly detalleDiario = input<DetalleDiario[]>([]);
  readonly diasConMovimientos = input<number>(0);
  readonly escuela = input<string>('');
  readonly isLoading = input<boolean>(false);
  readonly isExporting = input<boolean>(false);
  readonly gastosFijos = input<GastoFijoRow[]>([]);
  readonly rentabilidadCursos = input<RentabilidadCurso[]>([]);
  /** fix-010-i (H-014): "Gastos Fijos del Período" es admin-only (RLS de fixed_expenses). */
  readonly isAdmin = input<boolean>(false);
  readonly filtros = input.required<FiltrosReporte>();

  // ── Outputs ────────────────────────────────────────────────────────────────
  readonly aplicarFiltros = output<FiltrosReporte>();
  readonly exportRequested = output<'excel' | 'pdf'>();
  readonly registrarGastoClick = output<void>();
  /** Emite la fecha (YYYY-MM-DD) cuando el usuario hace clic en "Ver detalle". */
  readonly verDetalle = output<string>();

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
        subValue: `${data.operacionesIngresos} operaciones en período`,
      },
      {
        id: 'gastos',
        label: 'Total Gastos',
        value: this.clp(data.totalGastos),
        icon: 'trending-down',
        color: 'error',
        subValue: `${data.operacionesGastos} egresos en período`,
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

  // ── Tabs (Evolución Mensual / Detalle Diario / Rentabilidad / Gastos Fijos) —
  // spec 0003-i (feedback visual, 2026-08-25). Hero, Filtros y Categorías quedan
  // fijos, fuera de este sistema de tabs. Gastos Fijos SÍ es tab (a diferencia de
  // la primera pasada) — se filtra por isAdmin() porque fixed_expenses es RLS
  // admin-only (fix-010-i, H-014): secretaría no debe ver ni el botón del tab.
  protected readonly tabOptions = computed<TabOption[]>(() => {
    const base: TabOption[] = [
      { id: 'evolucion', label: 'Evolución Mensual' },
      { id: 'detalle', label: 'Detalle Diario' },
      { id: 'rentabilidad', label: 'Rentabilidad' },
    ];
    if (this.isAdmin()) {
      base.push({ id: 'gastos-fijos', label: 'Gastos Fijos' });
    }
    return base;
  });

  protected readonly activeTab = signal<ReporteTab>('evolucion');

  protected setActiveTab(tabId: string): void {
    this.activeTab.set(tabId as ReporteTab);
  }

  // ── Estado local del formulario de filtros ────────────────────────────────
  protected readonly rangos = RANGOS_REPORTE;

  protected localRango = linkedSignal<RangoReporte>(() => this.filtros().rango);
  protected localDesde = linkedSignal(() => this.filtros().desde);
  protected localHasta = linkedSignal(() => this.filtros().hasta);

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

  protected readonly totalesDiario = computed(() => {
    const rows = this.detalleDiario();
    return {
      operaciones: rows.reduce((s, r) => s + r.operaciones, 0),
      ingresos: rows.reduce((s, r) => s + r.ingresos, 0),
      gastos: rows.reduce((s, r) => s + r.gastos, 0),
      neto: rows.reduce((s, r) => s + r.neto, 0),
    };
  });

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
  protected onHeroAction(id: string): void {
    if (id === 'exportar' && !this.isExporting()) {
      this.exportMenuOpen.set(!this.exportMenuOpen());
    }
  }

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
   * Decisión (spec 0003-i, T4.1): el stagger corre una sola vez en la carga inicial,
   * igual que el piloto `fix-027-i-app-like-instructor-ficha-tabs`. Cambiar de tab
   * NO vuelve a animar el panel — es consistente con el resto del rollout app-like
   * y evita un flash de reveal cada vez que el usuario navega entre tabs.
   */
  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }
}
