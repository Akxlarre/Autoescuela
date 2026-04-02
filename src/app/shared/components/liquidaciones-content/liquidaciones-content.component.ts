import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { PagoInstructorModalComponent } from '@shared/components/pago-instructor-modal/pago-instructor-modal.component';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, PagoInstructorModalComponent],
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
        background: var(--color-error);
      }
      .liq-kpi-card.accent-success::before {
        background: var(--color-success);
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
        background: color-mix(in srgb, var(--color-error) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-error) 25%, transparent);
        border-radius: 6px;
        padding: 3px 10px;
        font-size: 12px;
        font-weight: 600;
        color: var(--color-error);
        font-variant-numeric: tabular-nums;
      }

      .progress-track {
        height: 6px;
        border-radius: 99px;
        background: color-mix(in srgb, var(--color-success) 15%, var(--bg-surface-elevated));
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        border-radius: 99px;
        background: var(--color-success);
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
        border: 1px solid color-mix(in srgb, var(--color-success) 35%, transparent);
        background: color-mix(in srgb, var(--color-success) 10%, var(--bg-surface));
        color: var(--color-success);
        cursor: pointer;
        transition: background 0.15s;
        white-space: nowrap;
      }
      .btn-pagar:hover {
        background: color-mix(in srgb, var(--color-success) 18%, var(--bg-surface));
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
        color: var(--color-error);
        border-color: color-mix(in srgb, var(--color-error) 30%, transparent);
        background: color-mix(in srgb, var(--color-error) 6%, transparent);
      }
    `,
  ],
  template: `
    <!-- ── Cabecera de página ─────────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-primary">Liquidaciones de Instructores</h1>
        <p class="text-sm text-muted mt-0.5">Nómina mensual y registro de pagos</p>
      </div>

      <!-- Navegación de mes -->
      <div
        class="flex items-center"
        style="background: var(--bg-surface); border: 1px solid var(--border-muted); border-radius: var(--radius-lg, 10px); overflow: hidden"
      >
        <button
          class="px-3 py-2 transition-colors cursor-pointer"
          style="color: var(--text-secondary); border-right: 1px solid var(--border-muted)"
          (click)="mesAnterior.emit()"
          aria-label="Mes anterior"
          data-llm-action="liquidaciones-mes-anterior"
        >
          <app-icon name="chevron-left" [size]="16" />
        </button>
        <span
          class="text-sm font-semibold px-5 text-primary"
          style="min-width: 145px; text-align: center"
        >
          {{ mesLabel() }}
        </span>
        <button
          class="px-3 py-2 transition-colors cursor-pointer"
          style="color: var(--text-secondary); border-left: 1px solid var(--border-muted)"
          (click)="mesSiguiente.emit()"
          aria-label="Mes siguiente"
          data-llm-action="liquidaciones-mes-siguiente"
        >
          <app-icon name="chevron-right" [size]="16" />
        </button>
      </div>
    </div>

    <!-- ── KPIs ──────────────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5 w-full">
      <!-- KPI 1: Total Nómina -->
      <div class="liq-kpi-card accent-brand">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-secondary uppercase tracking-wider">Total Nómina</p>
          <div
            class="flex items-center justify-center"
            style="width:34px;height:34px;border-radius:9px;background:color-mix(in srgb,var(--ds-brand) 12%,transparent)"
          >
            <app-icon name="banknote" [size]="17" color="var(--ds-brand)" />
          </div>
        </div>
        @if (isLoading()) {
          <app-skeleton-block variant="text" width="70%" height="28px" />
          <app-skeleton-block variant="text" width="55%" height="12px" />
        } @else {
          <p class="kpi-value" style="font-size:1.6rem;color:var(--ds-brand)">
            {{ formatCLP(kpis().totalNomina) }}
          </p>
          <p class="text-xs text-muted">Suma bruta del periodo</p>
        }
      </div>

      <!-- KPI 2: Anticipos -->
      <div class="liq-kpi-card accent-error">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-secondary uppercase tracking-wider">
            Anticipos a Descontar
          </p>
          <div
            class="flex items-center justify-center"
            style="width:34px;height:34px;border-radius:9px;background:color-mix(in srgb,var(--color-error) 12%,transparent)"
          >
            <app-icon name="trending-down" [size]="17" color="var(--color-error)" />
          </div>
        </div>
        @if (isLoading()) {
          <app-skeleton-block variant="text" width="70%" height="28px" />
          <app-skeleton-block variant="text" width="55%" height="12px" />
        } @else {
          <p class="kpi-value" style="font-size:1.6rem;color:var(--color-error)">
            @if (kpis().totalAnticipos > 0) {
              -
            }
            {{ formatCLP(kpis().totalAnticipos) }}
          </p>
          <p class="text-xs text-muted">Total de adelantos entregados</p>
        }
      </div>

      <!-- KPI 3: Estado Pagos -->
      <div class="liq-kpi-card accent-success">
        @if (isLoading()) {
          <app-skeleton-block variant="text" width="100%" height="6px" />
          <app-skeleton-block variant="text" width="60%" height="28px" />
          <app-skeleton-block variant="text" width="80%" height="12px" />
        } @else {
          <!-- Barra de progreso -->
          <div class="progress-track">
            <div class="progress-fill" [style.width.%]="progresoPagos()"></div>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-secondary uppercase tracking-wider">
              Estado de Pagos
            </p>
            <div
              class="flex items-center justify-center"
              style="width:34px;height:34px;border-radius:9px;background:color-mix(in srgb,var(--color-success) 12%,transparent)"
            >
              <app-icon name="check-circle" [size]="17" color="var(--color-success)" />
            </div>
          </div>
          <p class="kpi-value" style="font-size:1.6rem;color:var(--color-success)">
            {{ kpis().totalPagados }} / {{ kpis().totalInstructores }}
            <span class="text-sm font-normal text-secondary ml-1">Pagados</span>
          </p>
          <div class="flex items-center gap-4 text-xs">
            <span style="color:var(--color-warning)" class="flex items-center gap-1 font-medium">
              <span
                style="width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block"
              ></span>
              {{ kpis().totalInstructores - kpis().totalPagados }} Pendientes
            </span>
            <span style="color:var(--color-success)" class="flex items-center gap-1 font-medium">
              <span
                style="width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block"
              ></span>
              {{ kpis().totalPagados }} Pagados
            </span>
          </div>
        }
      </div>
    </div>

    <!-- ── Filtros ─────────────────────────────────────────────────────────────── -->
    <div
      class="flex flex-wrap items-center gap-3 mb-4 px-4 py-3"
      style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:var(--radius-lg,10px)"
    >
      <!-- Buscador -->
      <div
        class="flex items-center gap-2 px-3 py-2 rounded-lg flex-1"
        style="background:var(--bg-surface-elevated);border:1px solid var(--border-muted);min-width:200px;max-width:340px"
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

      <!-- Contadores de estado -->
      <div class="flex items-center gap-4 ml-auto">
        <span
          class="flex items-center gap-1.5 text-xs font-semibold"
          style="color:var(--color-warning)"
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

    <!-- ── Tabla ─────────────────────────────────────────────────────────────── -->
    <div
      style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:var(--radius-lg,10px);overflow:hidden"
    >
      <div class="overflow-x-auto">
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
                        class="shrink-0 flex items-center justify-center text-white text-xs font-bold"
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
                    <span class="text-sm font-semibold" style="color:var(--color-success)">
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
                          style="color:var(--color-error)"
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
                          <app-icon name="check-circle" [size]="13" color="var(--color-success)" />
                          Pagado
                        </span>
                        <button
                          class="btn-deshacer"
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
                        class="btn-pagar"
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

          <!-- Fila de totales -->
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
                  <span class="text-sm font-bold" style="color:var(--color-success)">
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
