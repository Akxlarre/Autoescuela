import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { PagoInstructorModalComponent } from '@shared/components/pago-instructor-modal/pago-instructor-modal.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';
import type {
  LiquidacionRow,
  LiquidacionesKpis,
  PagoInstructorPayload,
} from '@core/models/ui/liquidaciones.model';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-liquidaciones-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, PagoInstructorModalComponent, SectionHeroComponent, KpiCardVariantComponent],
  styles: [
    `
      .liq-kpi-card {
        border-radius: var(--radius-lg, 12px);
        border: 1px solid var(--border-color);
        background: var(--bg-surface);
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        position: relative;
        overflow: hidden;
      }
      .liq-kpi-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        border-radius: var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0;
      }
      .liq-kpi-card.accent-brand::before {
        background: var(--ds-brand);
      }
      .liq-kpi-card.accent-error::before {
        background: var(--state-);
      }
      .liq-kpi-card.accent-success::before {
        background: var(--state-);
      }

      .liq-table th {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-secondary);
        padding: 10px 16px;
        white-space: nowrap;
      }
      .liq-table th:first-child {
        padding-left: 24px;
      }
      .liq-table td {
        padding: 14px 16px;
        border-top: 1px solid var(--border-color);
        vertical-align: middle;
      }
      .liq-table td:first-child {
        padding-left: 24px;
      }
      .liq-table tfoot td {
        padding: 12px 16px;
        border-top: 2px solid var(--border-color);
        background: var(--bg-surface-elevated);
        font-weight: 700;
      }
      .liq-table tr:hover td {
        background: color-mix(in srgb, var(--ds-brand) 3%, var(--bg-surface));
      }
      .liq-table tfoot tr:hover td {
        background: var(--bg-surface-elevated);
      }

      .anticipo-box {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, var(--state-) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--state-) 25%, transparent);
        border-radius: 6px;
        padding: 3px 10px;
        font-size: 12px;
        font-weight: 600;
        color: var(--state-);
        font-variant-numeric: tabular-nums;
      }

      .progress-track {
        height: 6px;
        border-radius: 99px;
        background: color-mix(in srgb, var(--state-) 15%, var(--bg-surface-elevated));
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        border-radius: 99px;
        background: var(--state-);
        transition: width 0.4s ease;
      }

      .btn-pagar {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 14px;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, var(--state-) 35%, transparent);
        background: color-mix(in srgb, var(--state-) 10%, var(--bg-surface));
        color: var(--state-);
        cursor: pointer;
        transition: background 0.15s;
        white-space: nowrap;
      }
      .btn-pagar:hover {
        background: color-mix(in srgb, var(--state-success) 18%, var(--bg-surface));
      }

      .btn-pagado {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        font-weight: 500;
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid var(--border-muted);
        background: var(--bg-surface-elevated);
        color: var(--text-secondary);
        cursor: default;
        white-space: nowrap;
      }

      .btn-deshacer {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 500;
        padding: 5px 10px;
        border-radius: 7px;
        border: 1px solid var(--border-muted);
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        transition:
          color 0.15s,
          background 0.15s;
        white-space: nowrap;
      }
      .btn-deshacer:hover {
        color: var(--state-);
        border-color: color-mix(in srgb, var(--state-) 30%, transparent);
        background: color-mix(in srgb, var(--state-) 6%, transparent);
      }

      .card-mobile-liq {
        background: var(--bg-surface);
        border: 1px solid var(--border-muted);
        border-radius: 12px;
        padding: 16px;
        transition: transform 0.2s ease, background 0.2s ease;
      }
      .card-mobile-liq:active {
        transform: scale(0.98);
      }

      .badge-liq {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 6px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
    `,
  ],
  template: `
    <!-- ── Cabecera de página ─────────────────────────────────────────────────── -->
    <app-section-hero
      title="Liquidaciones de Instructores"
      subtitle="Nómina mensual y registro de pagos"
      [actions]="heroActions"
      class="block mb-6"
    />

    <!-- ── KPIs: Densidad Inteligente (2 col en móvil, 3 en desktop) ── -->
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5 w-full">
      <!-- KPI 1: Total Nómina -->
      <app-kpi-card-variant
        class="col-span-1"
        [value]="kpis().totalNomina"
        label="Total Nómina"
        icon="banknote"
        color="default"
        [accent]="true"
        prefix="$ "
        subValue="Suma bruta del periodo"
        [loading]="isLoading()"
      />

      <!-- KPI 2: Anticipos -->
      <app-kpi-card-variant
        class="col-span-1"
        [value]="kpis().totalAnticipos"
        label="Anticipos a Descontar"
        icon="trending-down"
        color="error"
        [accent]="true"
        [prefix]="kpis().totalAnticipos > 0 ? '-$ ' : '$ '"
        subValue="Total de adelantos entregados"
        [loading]="isLoading()"
      />

      <!-- KPI 3: Estado Pagos -->
      <div class="col-span-2 lg:col-span-1 liq-kpi-card accent-success shadow-sm">
        @if (isLoading()) {
          <app-skeleton-block variant="text" width="100%" height="6px" />
          <app-skeleton-block variant="text" width="60%" height="28px" />
          <app-skeleton-block variant="text" width="80%" height="12px" />
        } @else {
          <!-- Barra de progreso -->
          <div class="progress-track">
            <div class="progress-fill" [style.width.%]="progresoPagos()"></div>
          </div>
          <div class="flex items-center justify-between mt-1">
            <p class="text-xs font-semibold text-secondary uppercase tracking-wider">
              Estado de Pagos
            </p>
            <div
              class="flex items-center justify-center"
              style="width:34px;height:34px;border-radius:9px;background:color-mix(in srgb,var(--state-) 12%,transparent)"
            >
              <app-icon name="check-circle" [size]="17" color="var(--state-)" />
            </div>
          </div>
          <p class="kpi-value text-[1.4rem] lg:text-[1.6rem] text-state-success font-bold" style="color:var(--state-)">
            {{ kpis().totalPagados }}<span class="text-secondary opacity-50 mx-1">/</span>{{ kpis().totalInstructores }}
          </p>
          <p class="text-[10px] lg:text-xs text-muted">Instructores Pagados</p>
          <div class="hidden sm:flex items-center gap-4 text-xs mt-1">
            <span style="color:var(--state-)" class="flex items-center gap-1 font-medium">
              <span style="width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block"></span>
              {{ kpis().totalInstructores - kpis().totalPagados }} Pend.
            </span>
          </div>
        }
      </div>
    </div>

    <!-- ── Filtros y Mes ───────────────────────────────────────────────────────── -->
    <div
      class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 px-4 py-3 shadow-sm"
      style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:var(--radius-lg,10px)"
    >
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
        <!-- Navegación de mes -->
        <div
          class="flex items-center shrink-0"
          style="background:var(--bg-surface-elevated); border:1px solid var(--border-muted); border-radius:8px; overflow:hidden"
        >
          <button
            class="px-3 py-2 transition-colors cursor-pointer hover:opacity-75"
            style="color:var(--text-secondary); border-right:1px solid var(--border-muted)"
            (click)="mesAnterior.emit()"
            aria-label="Mes anterior"
          >
            <app-icon name="chevron-left" [size]="16" />
          </button>
          <span
            class="text-sm font-semibold px-4 text-primary"
            style="min-width: 140px; text-align: center"
          >
            {{ mesLabel() }}
          </span>
          <button
            class="px-3 py-2 transition-colors cursor-pointer hover:opacity-75"
            style="color:var(--text-secondary); border-left:1px solid var(--border-muted)"
            (click)="mesSiguiente.emit()"
            aria-label="Mes siguiente"
          >
            <app-icon name="chevron-right" [size]="16" />
          </button>
        </div>

        <!-- Buscador -->
        <div
          class="flex items-center gap-2 px-3 py-2 rounded-lg sm:min-w-[200px]"
          style="background:var(--bg-surface-elevated);border:1px solid var(--border-muted);"
        >
          <app-icon name="search" [size]="14" color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Buscar instructor..."
            class="flex-1 text-sm bg-transparent text-primary outline-none placeholder:text-muted"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            data-llm-description="Search filter for instructor liquidations by name or RUT"
            aria-label="Buscar instructor"
          />
          @if (query()) {
            <button
              class="cursor-pointer"
              style="color:var(--text-muted)"
              (click)="query.set('')"
              aria-label="Limpiar"
            >
              <app-icon name="x" [size]="12" />
            </button>
          }
        </div>
      </div>

      <!-- Contadores de estado -->
      <div class="flex items-center gap-4 justify-end shrink-0">
        <span
          class="flex items-center gap-1.5 text-xs font-semibold"
          style="color:var(--state-warning)"
        >
          <span style="width:8px;height:8px;border-radius:50%;background:currentColor"></span>
          {{ contadores().pendientes }} Pendientes
        </span>
        <span class="flex items-center gap-1.5 text-xs font-semibold" style="color:var(--ds-brand)">
          <span style="width:8px;height:8px;border-radius:50%;background:currentColor"></span>
          {{ contadores().pagados }} Pagados
        </span>
      </div>
    </div>

    <!-- ── Tabla Dual-View ────────────────────────────────────────────────── -->
    <div
      style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:var(--radius-lg,10px);overflow:hidden;container-type:inline-size;"
      class="shadow-sm"
    >
      <!-- VISTA ESCRITORIO -->
      <div class="hidden md:block overflow-x-auto w-full">
        <table
          class="w-full liq-table"
          role="table"
          aria-label="Tabla de liquidaciones de instructores"
        >
          <thead>
            <tr style="background:var(--bg-surface-elevated)">
              <th class="text-left">Instructor</th>
              <th class="text-right">Horas Realizadas</th>
              <th class="text-right">Base (Ganado)</th>
              <th class="text-right">Anticipos (Descuento)</th>
              <th class="text-right">Total a Pagar</th>
              <th class="text-center" style="width:180px">Acciones</th>
            </tr>
          </thead>

          <tbody>
            @if (isLoading()) {
              @for (i of skeletonRows; track i) {
                <tr>
                  <td>
                    <div class="flex items-center gap-3">
                      <app-skeleton-block variant="circle" width="38px" height="38px" />
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="130px" height="13px" />
                        <app-skeleton-block variant="text" width="80px" height="11px" />
                      </div>
                    </div>
                  </td>
                  @for (j of [1, 2, 3, 4, 5]; track j) {
                    <td><app-skeleton-block variant="text" width="75%" height="13px" /></td>
                  }
                </tr>
              }
            } @else if (filtradas().length === 0) {
              <tr>
                <td colspan="6" class="py-12 text-center text-sm text-muted" style="border:none">
                  @if (query()) {
                    No se encontraron instructores para "{{ query() }}".
                  } @else {
                    No hay instructores registrados para este período.
                  }
                </td>
              </tr>
            } @else {
              @for (row of filtradas(); track row.instructorId) {
                <tr>
                  <!-- Instructor -->
                  <td>
                    <div class="flex items-center gap-3">
                      <div
                        class="shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm"
                        style="width:38px;height:38px;border-radius:50%;background:{{
                          row.avatarColor
                        }}"
                        aria-hidden="true"
                      >
                        {{ row.initials }}
                      </div>
                      <div>
                        <p class="text-sm font-semibold text-primary leading-tight">
                          {{ row.nombre }}
                        </p>
                        <p class="text-xs text-muted mt-0.5">{{ row.rut }}</p>
                      </div>
                    </div>
                  </td>

                  <!-- Horas -->
                  <td class="text-right tabular-nums">
                    <span class="text-sm font-semibold" style="color:var(--ds-brand)">{{
                      row.totalHours
                    }}</span>
                    <span class="text-xs text-muted ml-1">hrs</span>
                  </td>

                  <!-- Base ganado -->
                  <td class="text-right tabular-nums">
                    <span class="text-sm font-semibold" style="color:var(--state-success)">
                      {{ formatCLP(row.totalBaseAmount) }}
                    </span>
                  </td>

                  <!-- Anticipos -->
                  <td class="text-right">
                    @if (row.totalAdvances > 0) {
                      <div class="flex flex-col items-end gap-1">
                        <span class="anticipo-box">{{ formatCLP(row.totalAdvances) }}</span>
                        <span
                          class="text-xs font-medium tabular-nums"
                          style="color:var(--state-error)"
                        >
                          - {{ formatCLP(row.totalAdvances) }}
                        </span>
                      </div>
                    } @else {
                      <span class="text-sm text-muted">—</span>
                    }
                  </td>

                  <!-- Total a pagar -->
                  <td class="text-right tabular-nums">
                    <span class="text-sm font-bold text-primary">{{
                      formatCLP(row.finalPaymentAmount)
                    }}</span>
                  </td>

                  <!-- Acciones -->
                  <td class="text-center">
                    @if (row.status === 'paid') {
                      <div class="flex items-center justify-center gap-2">
                        <span class="btn-pagado">
                          <app-icon name="check-circle" [size]="13" color="var(--state-)" />
                          Pagado
                        </span>
                        <button
                          class="btn-deshacer shadow-sm"
                          (click)="onDeshacer(row)"
                          [attr.aria-label]="'Deshacer pago de ' + row.nombre"
                          data-llm-action="deshacer-pago-instructor"
                        >
                          <app-icon name="rotate-ccw" [size]="11" />
                          Deshacer
                        </button>
                      </div>
                    } @else {
                      <button
                        class="btn-pagar shadow-sm"
                        (click)="abrirModal(row)"
                        [attr.aria-label]="'Registrar pago para ' + row.nombre"
                        data-llm-action="pagar-instructor"
                      >
                        <app-icon name="banknote" [size]="13" />
                        Pagar
                      </button>
                    }
                  </td>
                </tr>
              }
            }
          </tbody>

          <!-- Fila de totales escritorio -->
          @if (!isLoading() && filtradas().length > 0) {
            <tfoot>
              <tr>
                <td class="text-xs font-bold text-secondary uppercase tracking-wide">
                  TOTALES — {{ filtradas().length }} instructores
                </td>
                <td class="text-right tabular-nums">
                  <span class="text-sm font-bold" style="color:var(--ds-brand)">{{
                    totales().horas
                  }}</span>
                  <span class="text-xs text-muted ml-1">hrs</span>
                </td>
                <td class="text-right tabular-nums">
                  <span class="text-sm font-bold" style="color:var(--state-success)">
                    {{ formatCLP(totales().base) }}
                  </span>
                </td>
                <td class="text-right">
                  @if (totales().anticipos > 0) {
                    <span class="anticipo-box">{{ formatCLP(totales().anticipos) }}</span>
                  } @else {
                    <span class="text-sm text-muted">—</span>
                  }
                </td>
                <td class="text-right tabular-nums">
                  <span class="text-base font-bold text-primary">{{
                    formatCLP(totales().total)
                  }}</span>
                </td>
                <td></td>
              </tr>
            </tfoot>
          }
        </table>
      </div>

      <!-- VISTA MÓVIL (Cards) -->
      <div class="md:hidden flex flex-col gap-4 p-4" style="background:var(--bg-surface-elevated)">
        @if (isLoading()) {
          @for (i of skeletonRows; track i) {
            <div class="p-5 rounded-xl border border-border-muted" style="background:var(--bg-surface)">
              <div class="flex items-center gap-3 mb-4">
                <app-skeleton-block variant="circle" width="38px" height="38px" />
                <div class="flex flex-col gap-2 flex-1">
                  <app-skeleton-block variant="text" width="60%" height="14px" />
                  <app-skeleton-block variant="text" width="40%" height="12px" />
                </div>
              </div>
              <app-skeleton-block variant="text" width="100%" height="40px" />
            </div>
          }
        } @else if (filtradas().length === 0) {
          <div class="py-10 text-center text-sm text-muted">
            @if (query()) {
              No se encontraron instructores para "{{ query() }}".
            } @else {
               No hay instructores registrados para este período.
            }
          </div>
        } @else {
          @for (row of filtradas(); track row.instructorId) {
            <div class="card-mobile-liq shadow-sm">
              <!-- Header Card (Instructor info) -->
              <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-3">
                  <div
                    class="shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm"
                    style="width:42px;height:42px;border-radius:50%;background:{{ row.avatarColor }}"
                    aria-hidden="true"
                  >
                    {{ row.initials }}
                  </div>
                  <div>
                    <h3 class="text-[15px] font-bold text-primary leading-tight">{{ row.nombre }}</h3>
                    <p class="text-[12px] text-muted mt-0.5">{{ row.rut }}</p>
                  </div>
                </div>
                
                @if (row.status === 'paid') {
                  <span class="badge-liq" style="background:color-mix(in srgb,var(--state-success) 12%,transparent);color:var(--state-success)">
                    <app-icon name="check-circle" [size]="12" /> Pagado
                  </span>
                } @else {
                  <span class="badge-liq" style="background:color-mix(in srgb,var(--state-warning) 12%,transparent);color:var(--state-warning)">
                    Pendiente
                  </span>
                }
              </div>

              <!-- Content Card (Metrics) -->
              <div class="grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg" style="background:var(--bg-surface-elevated)">
                <div class="flex flex-col gap-1">
                  <span class="text-[10px] uppercase font-bold text-muted">Base (Ganado)</span>
                  <span class="text-[13px] font-bold" style="color:var(--state-success)">
                    {{ formatCLP(row.totalBaseAmount) }}
                  </span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[10px] uppercase font-bold text-muted">Horas Registradas</span>
                  <div class="text-[13px] font-bold text-primary tabular-nums">
                    {{ row.totalHours }} <span class="font-normal text-muted">hrs</span>
                  </div>
                </div>
                <div class="flex flex-col gap-1 col-span-2 border-t pt-2 mt-1" style="border-color:var(--border-muted)">
                  <div class="flex justify-between items-center w-full">
                    <span class="text-[10px] uppercase font-bold text-muted">Anticipos Emitidos</span>
                    <span class="text-[13px] font-bold tabular-nums" style="color:var(--state-error)">
                      {{ row.totalAdvances > 0 ? '-' + formatCLP(row.totalAdvances) : '—' }}
                    </span>
                  </div>
                </div>
                <div class="flex flex-col gap-1 col-span-2 border-t pt-2" style="border-color:var(--border-muted)">
                  <div class="flex justify-between items-center w-full">
                    <span class="text-[11px] uppercase font-black text-primary">A Pagar</span>
                    <span class="text-[18px] font-black tracking-tight" style="color:var(--ds-brand)">
                      {{ formatCLP(row.finalPaymentAmount) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Actions Card -->
              <div class="flex flex-col sm:flex-row justify-end gap-2 mt-2">
                @if (row.status === 'paid') {
                  <button
                    class="btn-deshacer w-full sm:w-auto justify-center py-2.5 shadow-sm"
                    (click)="onDeshacer(row)"
                  >
                    <app-icon name="rotate-ccw" [size]="14" />
                    Deshacer Pago
                  </button>
                } @else {
                  <button
                    class="btn-pagar w-full sm:w-auto justify-center py-2.5 text-[14px] shadow-sm"
                    (click)="abrirModal(row)"
                  >
                    <app-icon name="banknote" [size]="15" />
                    Registrar Pago
                  </button>
                }
              </div>
            </div>
          }
          
          <!-- Mobile Totals Summary -->
          <div class="mt-4 p-4 rounded-xl border-2" style="border-color:color-mix(in srgb,var(--ds-brand) 30%,transparent); background:color-mix(in srgb,var(--ds-brand) 5%,transparent)">
            <h4 class="text-[11px] uppercase font-black tracking-widest text-primary mb-3">Resumen de Totales</h4>
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs text-muted font-medium">Bases Registradas</span>
              <span class="text-sm font-bold tabular-nums" style="color:var(--state-success)">{{ formatCLP(totales().base) }}</span>
            </div>
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs text-muted font-medium">Anticipos a Descontar</span>
              <span class="text-sm font-bold tabular-nums" style="color:var(--state-error)">- {{ formatCLP(totales().anticipos) }}</span>
            </div>
            <div class="flex justify-between items-center pt-2 mt-2 border-t" style="border-color:color-mix(in srgb,var(--ds-brand) 20%,transparent)">
              <span class="text-xs font-black uppercase text-primary">Total Final</span>
              <span class="text-[18px] font-black tabular-nums tracking-tight" style="color:var(--ds-brand)">{{ formatCLP(totales().total) }}</span>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- ── Modal de pago ─────────────────────────────────────────────────────── -->
    <app-pago-instructor-modal
      [row]="rowSeleccionada()"
      (confirmed)="onConfirmed($event)"
      (closed)="rowSeleccionada.set(null)"
    />
  `,
})
export class LiquidacionesContentComponent {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  liquidaciones = input<LiquidacionRow[]>([]);
  isLoading = input(false);
  isSaving = input(false);
  kpis = input<LiquidacionesKpis>({
    totalNomina: 0,
    totalAnticipos: 0,
    totalPagados: 0,
    totalInstructores: 0,
  });
  mesActual = input<number>(new Date().getMonth() + 1);
  anioActual = input<number>(new Date().getFullYear());

  // ── Outputs ─────────────────────────────────────────────────────────────────
  mesAnterior = output<void>();
  mesSiguiente = output<void>();
  pagar = output<{ row: LiquidacionRow; payload: PagoInstructorPayload }>();
  deshacer = output<LiquidacionRow>();

  // ── Estado UI interno ───────────────────────────────────────────────────────
  protected readonly query = signal('');
  protected readonly rowSeleccionada = signal<LiquidacionRow | null>(null);

  // ── Constantes ───────────────────────────────────────────────────────────────
  protected readonly skeletonRows = Array.from({ length: 5 });
  
  protected readonly heroActions: SectionHeroAction[] = [
    {
      id: 'export',
      label: 'Exportar Nómina',
      icon: 'download',
      primary: false
    }
  ];

  // ── Computed ─────────────────────────────────────────────────────────────────

  protected readonly mesLabel = computed(
    () => `${MESES[this.mesActual() - 1]} ${this.anioActual()}`,
  );

  protected readonly filtradas = computed<LiquidacionRow[]>(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return this.liquidaciones();
    return this.liquidaciones().filter(
      (r) => r.nombre.toLowerCase().includes(q) || r.rut.toLowerCase().includes(q),
    );
  });

  protected readonly contadores = computed(() => {
    const rows = this.liquidaciones();
    return {
      pendientes: rows.filter((r) => r.status === 'pending').length,
      pagados: rows.filter((r) => r.status === 'paid').length,
    };
  });

  protected readonly progresoPagos = computed(() => {
    const total = this.kpis().totalInstructores;
    return total > 0 ? (this.kpis().totalPagados / total) * 100 : 0;
  });

  protected readonly totales = computed(() => {
    const rows = this.filtradas();
    return {
      horas: rows.reduce((s, r) => s + r.totalHours, 0),
      base: rows.reduce((s, r) => s + r.totalBaseAmount, 0),
      anticipos: rows.reduce((s, r) => s + r.totalAdvances, 0),
      total: rows.reduce((s, r) => s + r.finalPaymentAmount, 0),
    };
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  protected formatCLP(value: number): string {
    return formatCLP(value);
  }

  protected abrirModal(row: LiquidacionRow): void {
    this.rowSeleccionada.set(row);
  }

  protected onConfirmed(payload: PagoInstructorPayload): void {
    const row = this.rowSeleccionada();
    if (!row) return;
    this.rowSeleccionada.set(null);
    this.pagar.emit({ row, payload });
  }

  protected onDeshacer(row: LiquidacionRow): void {
    this.deshacer.emit(row);
  }
}
