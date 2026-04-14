import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import {
  RANGOS_REPORTE,
  computeDateRange,
  type CategoriaGasto,
  type CategoriaIngreso,
  type DetalleDiario,
  type EvolucionMensual,
  type FiltrosReporte,
  type RangoReporte,
  type ReporteKpis,
} from '@core/models/ui/reportes-contables.model';

@Component({
  selector: 'app-reportes-contables-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent],
  styles: [
    `
      /* ── Filter bar ───────────────────────────────────────────────────── */
      .filter-label {
        display: block;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 4px;
      }

      .filter-control {
        height: 36px;
        padding: 0 var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        color: var(--text-primary);
        font-size: var(--text-sm);
        font-family: var(--font-body);
        outline: none;
        cursor: pointer;
        transition: var(--transition-input);

        &:focus {
          border-color: var(--color-primary);
          box-shadow: var(--shadow-focus);
        }
      }

      select.filter-control {
        min-width: 190px;
        padding-right: var(--space-6);
        appearance: auto;
      }

      input[type='date'].filter-control {
        min-width: 140px;
      }

      /* ── Botones Exportar ─────────────────────────────────────────────── */
      .btn-export {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: none;
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        font-family: var(--font-body);
        color: white;
        cursor: pointer;
        transition: var(--transition-btn);

        &.btn-export--excel {
          background: var(--state-success);

          &:hover {
            filter: brightness(0.92);
          }
        }

        &.btn-export--pdf {
          background: var(--state-error);

          &:hover {
            filter: brightness(0.92);
          }
        }
      }

      /* ── KPI Cards ────────────────────────────────────────────────────── */
      .kpi-icon-badge {
        width: 44px;
        height: 44px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &.badge--success {
          background: var(--state-success-bg);
          color: var(--state-success);
        }

        &.badge--error {
          background: var(--state-error-bg);
          color: var(--state-error);
        }

        &.badge--brand {
          background: var(--color-primary-muted);
          color: var(--color-primary);
        }
      }

      .kpi-subtitle {
        font-size: var(--text-xs);
        color: var(--text-muted);
        margin-top: 2px;
      }

      /* ── Summary Banner (pinned-dark) ─────────────────────────────────── */
      .summary-banner {
        border-radius: var(--radius-lg);
        padding: var(--space-5) var(--space-6);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-6);
        flex-wrap: wrap;
      }

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
    `,
  ],
  template: `
    <div class="w-full p-6 flex flex-col gap-6">
      <!-- ── Encabezado ────────────────────────────────────────────────────── -->
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            style="font-size: var(--text-2xl); font-weight: var(--font-semibold); color: var(--text-primary); line-height: var(--leading-tight)"
          >
            Reportes Contables
          </h1>
          <p
            style="font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-primary); margin-top: 2px"
          >
            RF-030 / RF-031 &ndash; Resumen financiero y Total Neto por rango de fechas
          </p>
        </div>

        @if (escuela()) {
          <span class="escuela-chip">
            <span class="cat-section-dot dot--success" style="width: 8px; height: 8px"></span>
            {{ escuela() }}
          </span>
        }
      </div>

      <!-- ── Barra de filtros ───────────────────────────────────────────────── -->
      <div class="card p-4">
        <div class="flex items-end gap-4 flex-wrap">
          <!-- Rango -->
          <div>
            <label class="filter-label">Rango</label>
            <select
              class="filter-control"
              [value]="localRango()"
              (change)="onRangoChange($any($event.target).value)"
              data-llm-description="selector de rango de fechas para el reporte contable"
            >
              @for (opt of rangos; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </div>

          <!-- Desde -->
          <div>
            <label class="filter-label">Desde</label>
            <input
              type="date"
              class="filter-control"
              [value]="localDesde()"
              [disabled]="localRango() !== 'personalizado'"
              (change)="localDesde.set($any($event.target).value)"
              data-llm-description="fecha de inicio del rango del reporte"
            />
          </div>

          <!-- Hasta -->
          <div>
            <label class="filter-label">Hasta</label>
            <input
              type="date"
              class="filter-control"
              [value]="localHasta()"
              [disabled]="localRango() !== 'personalizado'"
              (change)="localHasta.set($any($event.target).value)"
              data-llm-description="fecha de fin del rango del reporte"
            />
          </div>

          <!-- Aplicar -->
          <button
            class="btn-primary flex items-center gap-2"
            style="height: 36px; padding: 0 var(--space-4)"
            (click)="onAplicar()"
            data-llm-action="apply-report-filters"
          >
            <app-icon name="search" [size]="14" />
            Aplicar
          </button>

          <!-- Exportar -->
          <div class="flex gap-2 ml-auto">
            <button
              class="btn-export btn-export--excel"
              (click)="exportarExcel.emit()"
              data-llm-action="export-report-excel"
            >
              <app-icon name="file-spreadsheet" [size]="14" />
              Excel
            </button>
            <button
              class="btn-export btn-export--pdf"
              (click)="exportarPDF.emit()"
              data-llm-action="export-report-pdf"
            >
              <app-icon name="file-text" [size]="14" />
              PDF
            </button>
          </div>
        </div>
      </div>

      <!-- ── KPI Cards ──────────────────────────────────────────────────────── -->
      @if (isLoading()) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="card p-5 flex flex-col gap-3">
              <app-skeleton-block variant="rect" width="44px" height="44px" />
              <app-skeleton-block variant="text" width="60%" height="14px" />
              <app-skeleton-block variant="text" width="80%" height="32px" />
              <app-skeleton-block variant="text" width="50%" height="12px" />
            </div>
          }
        </div>
      } @else if (kpis()) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Total Ingresos -->
          <div
            class="card p-5"
            style="background: var(--state-success-bg); border-color: var(--state-success-border)"
          >
            <div class="flex items-start gap-3">
              <div class="kpi-icon-badge badge--success">
                <app-icon name="trending-up" [size]="20" />
              </div>
              <div class="flex flex-col gap-1 min-w-0">
                <span class="kpi-label">Total Ingresos</span>
                <span class="kpi-value" style="color: var(--state-success)">
                  {{ clp(kpis()!.totalIngresos) }}
                </span>
                <span class="kpi-subtitle">
                  {{ kpis()!.operacionesIngresos }} operaciones en período
                </span>
              </div>
            </div>
          </div>

          <!-- Total Gastos -->
          <div
            class="card p-5"
            style="background: var(--state-error-bg); border-color: var(--state-error-border)"
          >
            <div class="flex items-start gap-3">
              <div class="kpi-icon-badge badge--error">
                <app-icon name="trending-down" [size]="20" />
              </div>
              <div class="flex flex-col gap-1 min-w-0">
                <span class="kpi-label">Total Gastos</span>
                <span class="kpi-value" style="color: var(--state-error)">
                  {{ clp(kpis()!.totalGastos) }}
                </span>
                <span class="kpi-subtitle">
                  {{ kpis()!.operacionesGastos }} egresos en período
                </span>
              </div>
            </div>
          </div>

          <!-- Total Neto -->
          <div
            class="card p-5"
            style="background: var(--color-primary-tint); border-color: var(--accent-border)"
          >
            <div class="flex items-start gap-3">
              <div class="kpi-icon-badge badge--brand">
                <app-icon name="coins" [size]="20" />
              </div>
              <div class="flex flex-col gap-1 min-w-0">
                <span class="kpi-label">Total Neto (RF-031)</span>
                <span class="kpi-value" style="color: var(--color-primary)">
                  {{ clp(kpis()!.totalNeto) }}
                </span>
                <span class="kpi-subtitle">Ingresos Totales &ndash; Gastos Totales</span>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ── Banner resumen (dark pinned) ───────────────────────────────────── -->
      @if (!isLoading() && kpis()) {
        <div class="card summary-banner" data-mode="dark">
          <div class="flex flex-col gap-1">
            <p
              style="font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-primary)"
            >
              Período seleccionado: {{ formatDate(filtros().desde) }} &ndash;
              {{ formatDate(filtros().hasta) }}
            </p>
            <p style="font-size: var(--text-xs); color: var(--text-muted)">
              Reporte contable mensual con resumen por sección
            </p>
          </div>

          <div class="flex flex-col items-end gap-1">
            @if (escuela()) {
              <p style="font-size: var(--text-xs); color: var(--text-muted)">
                Escuela: {{ escuela() }}
              </p>
            }
            <p style="font-size: var(--text-xs); color: var(--text-muted)">Margen de ganancia</p>
            <p
              style="font-size: var(--text-2xl); font-weight: var(--font-bold); color: var(--state-success); line-height: 1"
            >
              {{ pct(kpis()!.margenGanancia) }}
            </p>
          </div>
        </div>
      }

      <!-- ── Categorías (Ingresos + Gastos) ────────────────────────────────── -->
      @if (!isLoading()) {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Ingresos por Categoría -->
          <div class="card p-5 flex flex-col gap-4">
            <div class="flex items-center gap-2">
              <span class="cat-section-dot dot--success"></span>
              <h2
                style="font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary)"
              >
                Ingresos por Categoría
              </h2>
            </div>

            <div class="flex flex-col gap-4">
              @for (cat of ingresosCategoria(); track cat.nombre) {
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between gap-2">
                    <span
                      style="font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-primary)"
                    >
                      {{ cat.nombre }}
                    </span>
                    <span
                      style="font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--state-success); white-space: nowrap"
                    >
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
                    <span style="font-size: var(--text-xs); color: var(--text-muted)">
                      {{ cat.operaciones }} operaciones
                    </span>
                    <span style="font-size: var(--text-xs); color: var(--text-muted)">
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
                  <span
                    style="font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary)"
                  >
                    Total Ingresos
                  </span>
                  <span
                    style="font-size: var(--text-sm); font-weight: var(--font-bold); color: var(--state-success)"
                  >
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
              <h2
                style="font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary)"
              >
                Gastos por Categoría
              </h2>
            </div>

            <div class="flex flex-col gap-4">
              @for (cat of gastosCategoria(); track cat.nombre) {
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between gap-2">
                    <span
                      style="font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-primary)"
                    >
                      {{ cat.nombre }}
                    </span>
                    <span
                      style="font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--state-error); white-space: nowrap"
                    >
                      {{ clp(cat.monto) }}
                    </span>
                  </div>
                  <div class="cat-bar-track">
                    <div
                      class="cat-bar-fill"
                      [style.width.%]="cat.porcentaje"
                      style="background: var(--state-error)"
                    ></div>
                  </div>
                  <div class="flex justify-between">
                    <span style="font-size: var(--text-xs); color: var(--text-muted)">
                      {{ cat.registros }} registros
                    </span>
                    <span style="font-size: var(--text-xs); color: var(--text-muted)">
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
                  <span
                    style="font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary)"
                  >
                    Total Gastos
                  </span>
                  <span
                    style="font-size: var(--text-sm); font-weight: var(--font-bold); color: var(--state-error)"
                  >
                    {{ clp(totalGastos()) }}
                  </span>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- ── Evolución Mensual ───────────────────────────────────────────────── -->
      @if (!isLoading() && evolucionMensual().length) {
        <div class="card p-5">
          <h2
            style="font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary); margin-bottom: var(--space-4)"
          >
            Evolución Mensual
          </h2>
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
                    <td class="report-td" style="font-weight: var(--font-medium)">
                      {{ row.mes }}
                    </td>
                    <td class="report-td align-right" style="color: var(--state-success)">
                      {{ clp(row.ingresos) }}
                    </td>
                    <td class="report-td align-right" style="color: var(--state-error)">
                      {{ clp(row.gastos) }}
                    </td>
                    <td
                      class="report-td align-right"
                      style="color: var(--color-primary); font-weight: var(--font-semibold)"
                    >
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
        </div>
      }

      <!-- ── Detalle Diario ─────────────────────────────────────────────────── -->
      @if (!isLoading() && detalleDiario().length) {
        <div class="card p-5">
          <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2
              style="font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary)"
            >
              Detalle Diario
            </h2>
            <span
              style="font-size: var(--text-sm); color: var(--color-primary); font-weight: var(--font-medium)"
            >
              {{ diasConMovimientos() }} días con movimientos
            </span>
          </div>

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
                    <td class="report-td" style="font-size: var(--text-sm)">
                      {{ row.fecha }}
                    </td>
                    <td class="report-td align-right" style="color: var(--state-error)">
                      {{ row.operaciones }}
                    </td>
                    <td class="report-td align-right" style="color: var(--state-success)">
                      +{{ clp(row.ingresos) }}
                    </td>
                    <td class="report-td align-right" style="color: var(--state-error)">
                      -{{ clp(row.gastos) }}
                    </td>
                    <td
                      class="report-td align-right"
                      style="color: var(--color-primary); font-weight: var(--font-semibold)"
                    >
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
                  <td class="report-td" style="font-weight: var(--font-bold)">TOTAL</td>
                  <td
                    class="report-td align-right"
                    style="color: var(--state-error); font-weight: var(--font-bold)"
                  >
                    {{ totalesDiario().operaciones }}
                  </td>
                  <td
                    class="report-td align-right"
                    style="color: var(--state-success); font-weight: var(--font-bold)"
                  >
                    +{{ clp(totalesDiario().ingresos) }}
                  </td>
                  <td
                    class="report-td align-right"
                    style="color: var(--state-error); font-weight: var(--font-bold)"
                  >
                    -{{ clp(totalesDiario().gastos) }}
                  </td>
                  <td
                    class="report-td align-right"
                    style="color: var(--color-primary); font-weight: var(--font-bold)"
                  >
                    {{ clp(totalesDiario().neto) }}
                  </td>
                  <td class="report-td"></td>
                </tr>
              </tfoot>
            </table>
          </div>
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
  readonly filtros = input.required<FiltrosReporte>();

  // ── Outputs ────────────────────────────────────────────────────────────────
  readonly aplicarFiltros = output<FiltrosReporte>();
  readonly exportarExcel = output<void>();
  readonly exportarPDF = output<void>();
  /** Emite la fecha (YYYY-MM-DD) cuando el usuario hace clic en "Ver detalle". */
  readonly verDetalle = output<string>();

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

  // ── Handlers ─────────────────────────────────────────────────────────────
  protected onRangoChange(rango: RangoReporte): void {
    this.localRango.set(rango);
    if (rango !== 'personalizado') {
      const [desde, hasta] = computeDateRange(rango);
      this.localDesde.set(desde);
      this.localHasta.set(hasta);
    }
  }

  protected onAplicar(): void {
    this.aplicarFiltros.emit({
      rango: this.localRango(),
      desde: this.localDesde(),
      hasta: this.localHasta(),
    });
  }
}
