import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { RegistrarGastoFijoDrawerComponent } from '@shared/components/registrar-gasto-fijo-drawer/registrar-gasto-fijo-drawer.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';
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
  type RegistrarGastoFijoPayload,
  type ReporteKpis,
} from '@core/models/ui/reportes-contables.model';

@Component({
  selector: 'app-reportes-contables-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    SectionHeroComponent,
    KpiCardVariantComponent,
    RegistrarGastoFijoDrawerComponent,
    FormsModule,
    SelectModule,
    DateInputComponent,
  ],
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
    <!-- ── Hero (banner con degradado azul/morado) ───────────────────────── -->
    <div class="bento-banner relative overflow-visible">
      <app-section-hero
        title="Reportes Contables"
        subtitle="Resumen financiero y total neto por rango de fechas"
        icon="bar-chart-2"
        [actions]="heroActions()"
        [chips]="heroChips()"
        (actionClick)="onHeroAction($event)"
        class="block mb-5"
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

    <!-- ── Contenido ─────────────────────────────────────────────────────── -->
    <div class="px-4 sm:px-6 pb-6 flex flex-col gap-5">
      <!-- ── Barra de filtros ─────────────────────────────────────────────── -->
      <div
        class="flex flex-col sm:flex-row sm:items-end gap-4 px-4 py-3 shadow-sm flex-wrap bg-surface"
        style="border:1px solid var(--border-color); border-radius:var(--radius-lg,10px)"
      >
        <!-- Rango -->
        <div>
          <label class="filter-label">Rango</label>
          <p-select
            [ngModel]="localRango()"
            (ngModelChange)="onRangoChange($event)"
            [options]="rangos"
            optionLabel="label"
            optionValue="value"
            styleClass="w-full"
            data-llm-description="selector de rango de fechas para el reporte contable"
          />
        </div>

        <!-- Desde -->
        <div>
          <app-date-input
            label="Desde"
            [value]="localDesde()"
            [disabled]="localRango() !== 'personalizado'"
            (valueChange)="localDesde.set($event)"
            data-llm-description="fecha de inicio del rango del reporte"
          />
        </div>

        <!-- Hasta -->
        <div>
          <app-date-input
            label="Hasta"
            [value]="localHasta()"
            [disabled]="localRango() !== 'personalizado'"
            (valueChange)="localHasta.set($event)"
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

        <!-- Período activo (info contextual) -->
        @if (!isLoading() && kpis()) {
          <div class="flex items-center gap-2 ml-auto">
            <app-icon name="calendar" [size]="13" color="var(--text-muted)" />
            <span class="text-xs text-text-muted font-medium">
              {{ formatDate(filtros().desde) }} – {{ formatDate(filtros().hasta) }}
            </span>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-success-subtle text-success"
              style="border:1px solid var(--state-success-border)"
            >
              {{ pct(kpis()!.margenGanancia) }} margen
            </span>
          </div>
        }
      </div>

      <!-- ── KPI Cards (tarjetas blancas, estilo Liquidaciones) ──────────── -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <app-kpi-card-variant
          [value]="kpis()?.totalIngresos ?? 0"
          label="Total Ingresos"
          icon="trending-up"
          color="success"
          [accent]="true"
          prefix="$ "
          [subValue]="(kpis()?.operacionesIngresos ?? 0) + ' operaciones en período'"
          [loading]="isLoading()"
        />
        <app-kpi-card-variant
          [value]="kpis()?.totalGastos ?? 0"
          label="Total Gastos"
          icon="trending-down"
          color="error"
          [accent]="true"
          prefix="$ "
          [subValue]="(kpis()?.operacionesGastos ?? 0) + ' egresos en período'"
          [loading]="isLoading()"
        />
        <app-kpi-card-variant
          [value]="kpis()?.totalNeto ?? 0"
          label="Total Neto"
          icon="coins"
          color="default"
          [accent]="true"
          prefix="$ "
          subValue="Ingresos Totales – Gastos Totales"
          [loading]="isLoading()"
        />
      </div>

      <!-- ── Categorías (Ingresos + Gastos) ────────────────────────────────── -->
      @if (!isLoading()) {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Ingresos por Categoría -->
          <div class="card p-5 flex flex-col gap-4">
            <div class="flex items-center gap-2">
              <span class="cat-section-dot dot--success"></span>
              <h2 class="text-base font-semibold text-text-primary">Ingresos por Categoría</h2>
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
                    <span class="text-xs text-text-muted"> {{ cat.operaciones }} operaciones </span>
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
                  <span class="text-sm font-semibold text-text-primary"> Total Ingresos </span>
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
              <h2 class="text-base font-semibold text-text-primary">Gastos por Categoría</h2>
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
                  <span class="text-sm font-semibold text-text-primary"> Total Gastos </span>
                  <span class="text-sm font-bold text-error">
                    {{ clp(totalGastos()) }}
                  </span>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- ── Gastos Fijos del Período ─────────────────────────────────────────── -->
      @if (!isLoading()) {
        <div class="card p-0 flex flex-col overflow-hidden shadow-sm">
          <div
            class="flex items-center justify-between px-6 py-4 border-b"
            style="border-color: var(--border-muted)"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style="background: color-mix(in srgb, var(--state-error) 10%, transparent)"
              >
                <app-icon name="lock" [size]="16" color="var(--state-error)" />
              </div>
              <div>
                <h2 class="text-sm font-bold" style="color: var(--text-primary)">
                  Gastos Fijos del Período
                </h2>
                <p class="text-xs" style="color: var(--text-muted)">
                  Arriendo, sueldos, servicios y otros — solo visible para admin
                </p>
              </div>
            </div>
            <button
              class="btn-primary flex items-center gap-2 text-xs px-4 py-2 rounded-xl shrink-0 active:scale-[0.98] transition-transform"
              data-llm-action="abrir-registrar-gasto-fijo"
              (click)="drawerVisible.set(true)"
            >
              <app-icon name="plus" [size]="14" />
              Registrar Gasto Fijo
            </button>
          </div>

          @if (gastosFijos().length === 0) {
            <div class="px-6 py-10 flex flex-col items-center justify-center text-center gap-2">
              <app-icon name="receipt" [size]="28" color="var(--text-muted)" />
              <p class="text-sm font-medium" style="color: var(--text-primary)">
                Sin gastos fijos en este período
              </p>
              <p class="text-xs" style="color: var(--text-muted)">
                Registra arriendo, sueldos u otros gastos estructurales para calcular el neto real.
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
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style="background: color-mix(in srgb, var(--state-error) 10%, transparent); color: var(--state-error)"
                        >
                          {{ gasto.categoryLabel }}
                        </span>
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
                    <td class="report-td font-bold" colspan="3" style="color: var(--text-primary)">
                      Total Gastos Fijos
                    </td>
                    <td class="report-td align-right font-black" style="color: var(--state-error)">
                      {{ clp(totalGastosFijos()) }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }
        </div>
      }

      <!-- ── Evolución Mensual ───────────────────────────────────────────────── -->
      @if (!isLoading() && evolucionMensual().length) {
        <div class="card p-5">
          <h2
            class="text-base font-semibold text-text-primary"
            style="margin-bottom: var(--space-4)"
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
        </div>
      }

      <!-- ── Detalle Diario ─────────────────────────────────────────────────── -->
      @if (!isLoading() && detalleDiario().length) {
        <div class="card p-5">
          <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 class="text-base font-semibold text-text-primary">Detalle Diario</h2>
            <span class="text-sm text-brand font-medium">
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
                    <td class="report-td text-sm">
                      {{ row.fecha }}
                    </td>
                    <td class="report-td align-right text-error">
                      {{ row.operaciones }}
                    </td>
                    <td class="report-td align-right text-success">+{{ clp(row.ingresos) }}</td>
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
        </div>
      }
    </div>

    <!-- ── Drawer: Registrar Gasto Fijo ──────────────────────────────────────── -->
    <app-registrar-gasto-fijo-drawer
      [visible]="drawerVisible()"
      [isSaving]="isRegistrando()"
      (guardar)="onGuardarGastoFijo($event)"
      (cerrar)="drawerVisible.set(false)"
    />
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
  readonly isRegistrando = input<boolean>(false);
  readonly gastosFijos = input<GastoFijoRow[]>([]);
  readonly filtros = input.required<FiltrosReporte>();

  // ── Outputs ────────────────────────────────────────────────────────────────
  readonly aplicarFiltros = output<FiltrosReporte>();
  readonly exportRequested = output<'excel' | 'pdf'>();
  readonly registrarGasto = output<RegistrarGastoFijoPayload>();
  /** Emite la fecha (YYYY-MM-DD) cuando el usuario hace clic en "Ver detalle". */
  readonly verDetalle = output<string>();

  // ── Hero ──────────────────────────────────────────────────────────────────
  protected readonly exportMenuOpen = signal(false);
  protected readonly drawerVisible = signal(false);

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

  protected onGuardarGastoFijo(payload: RegistrarGastoFijoPayload): void {
    this.registrarGasto.emit(payload);
    this.drawerVisible.set(false);
  }

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
