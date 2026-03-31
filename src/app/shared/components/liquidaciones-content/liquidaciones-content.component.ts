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
  template: `
    <!-- ── Cabecera ─────────────────────────────────────────────────────────── -->
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
          class="text-sm font-semibold px-4 text-primary"
          style="min-width: 140px; text-align: center"
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

    <!-- ── KPIs ─────────────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 gap-4 mb-6" style="grid-template-columns: repeat(4, 1fr)">
      <!-- Total Nómina -->
      <div class="card card-accent">
        @if (isLoading()) {
          <app-skeleton-block variant="text" width="60%" height="12px" />
          <app-skeleton-block variant="text" width="80%" height="24px" class="mt-2" />
        } @else {
          <p class="kpi-label">Total Nómina</p>
          <p class="kpi-value" style="font-size: 1.35rem">
            {{ formatCLP(kpis().totalNomina) }}
          </p>
        }
      </div>

      <!-- Total Anticipos -->
      <div class="card">
        @if (isLoading()) {
          <app-skeleton-block variant="text" width="60%" height="12px" />
          <app-skeleton-block variant="text" width="80%" height="24px" class="mt-2" />
        } @else {
          <p class="kpi-label">Anticipos</p>
          <p class="kpi-value" style="font-size: 1.35rem; color: var(--color-error)">
            {{ formatCLP(kpis().totalAnticipos) }}
          </p>
        }
      </div>

      <!-- Pagados -->
      <div class="card">
        @if (isLoading()) {
          <app-skeleton-block variant="text" width="60%" height="12px" />
          <app-skeleton-block variant="text" width="80%" height="24px" class="mt-2" />
        } @else {
          <p class="kpi-label">Pagados</p>
          <p class="kpi-value" style="font-size: 1.35rem; color: var(--color-success)">
            {{ kpis().totalPagados }} / {{ kpis().totalInstructores }}
          </p>
        }
      </div>

      <!-- Pendientes -->
      <div class="card">
        @if (isLoading()) {
          <app-skeleton-block variant="text" width="60%" height="12px" />
          <app-skeleton-block variant="text" width="80%" height="24px" class="mt-2" />
        } @else {
          <p class="kpi-label">Pendientes</p>
          <p class="kpi-value" style="font-size: 1.35rem; color: var(--color-warning)">
            {{ kpis().totalInstructores - kpis().totalPagados }}
          </p>
        }
      </div>
    </div>

    <!-- ── Buscador ──────────────────────────────────────────────────────────── -->
    <div class="mb-4">
      <div
        class="flex items-center gap-2 px-3 py-2 rounded-lg"
        style="background: var(--bg-surface); border: 1px solid var(--border-muted); max-width: 340px"
      >
        <app-icon name="search" [size]="15" color="var(--text-muted)" />
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
            style="color: var(--text-muted)"
            (click)="query.set('')"
            aria-label="Limpiar búsqueda"
          >
            <app-icon name="x" [size]="13" />
          </button>
        }
      </div>
    </div>

    <!-- ── Tabla ─────────────────────────────────────────────────────────────── -->
    <div
      class="overflow-hidden"
      style="border: 1px solid var(--border-color); border-radius: var(--radius-lg, 10px)"
    >
      <div class="overflow-x-auto">
        <table
          class="w-full text-sm"
          role="table"
          aria-label="Tabla de liquidaciones de instructores"
        >
          <thead>
            <tr
              style="background: var(--bg-surface-elevated); border-bottom: 1px solid var(--border-color)"
            >
              <th class="px-4 py-3 text-left text-xs font-semibold text-secondary">Instructor</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-secondary">Horas</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-secondary">Base Ganado</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-secondary">Anticipos</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-secondary">
                Total a Pagar
              </th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-secondary">Estado</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-secondary">Acción</th>
            </tr>
          </thead>
          <tbody>
            @if (isLoading()) {
              @for (i of skeletonRows; track i) {
                <tr style="border-bottom: 1px solid var(--border-color)">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <app-skeleton-block variant="circle" width="36px" height="36px" />
                      <div class="flex flex-col gap-1">
                        <app-skeleton-block variant="text" width="120px" height="13px" />
                        <app-skeleton-block variant="text" width="80px" height="11px" />
                      </div>
                    </div>
                  </td>
                  @for (j of [1, 2, 3, 4, 5, 6]; track j) {
                    <td class="px-4 py-3">
                      <app-skeleton-block variant="text" width="70%" height="13px" />
                    </td>
                  }
                </tr>
              }
            } @else if (filtradas().length === 0) {
              <tr>
                <td colspan="7" class="px-4 py-10 text-center text-sm text-muted">
                  @if (query()) {
                    No se encontraron instructores que coincidan con "{{ query() }}".
                  } @else {
                    No hay instructores registrados para este período.
                  }
                </td>
              </tr>
            } @else {
              @for (row of filtradas(); track row.instructorId; let even = $even) {
                <tr
                  [style.background]="even ? 'var(--bg-surface)' : 'var(--bg-surface-elevated)'"
                  style="border-bottom: 1px solid var(--border-color)"
                >
                  <!-- Instructor (avatar + nombre + rut) -->
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <div
                        class="flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                        style="
                          width: 36px;
                          height: 36px;
                          border-radius: 50%;
                          background: {{ row.avatarColor }};
                        "
                        aria-hidden="true"
                      >
                        {{ row.initials }}
                      </div>
                      <div>
                        <p class="font-semibold text-primary text-sm">{{ row.nombre }}</p>
                        <p class="text-xs text-muted">{{ row.rut }}</p>
                      </div>
                    </div>
                  </td>

                  <!-- Horas -->
                  <td class="px-4 py-3 text-center text-primary font-semibold tabular-nums">
                    {{ row.totalHours }}
                    <span class="text-xs text-muted font-normal">hrs</span>
                  </td>

                  <!-- Base ganado -->
                  <td class="px-4 py-3 text-right text-primary tabular-nums">
                    {{ formatCLP(row.totalBaseAmount) }}
                  </td>

                  <!-- Anticipos -->
                  <td
                    class="px-4 py-3 text-right tabular-nums font-medium"
                    [style.color]="
                      row.totalAdvances > 0 ? 'var(--color-error)' : 'var(--text-muted)'
                    "
                  >
                    @if (row.totalAdvances > 0) {
                      - {{ formatCLP(row.totalAdvances) }}
                    } @else {
                      —
                    }
                  </td>

                  <!-- Total a pagar -->
                  <td
                    class="px-4 py-3 text-right font-bold tabular-nums"
                    style="color: var(--ds-brand)"
                  >
                    {{ formatCLP(row.finalPaymentAmount) }}
                  </td>

                  <!-- Estado -->
                  <td class="px-4 py-3 text-center">
                    @if (row.status === 'paid') {
                      <span
                        class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style="
                          background: color-mix(in srgb, var(--color-success) 15%, transparent);
                          color: var(--color-success);
                        "
                      >
                        <app-icon name="check-circle" [size]="12" />
                        Pagado
                      </span>
                    } @else {
                      <span
                        class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style="
                          background: color-mix(in srgb, var(--color-warning) 15%, transparent);
                          color: var(--color-warning);
                        "
                      >
                        <app-icon name="clock" [size]="12" />
                        Pendiente
                      </span>
                    }
                  </td>

                  <!-- Acción -->
                  <td class="px-4 py-3 text-center">
                    @if (row.status === 'paid') {
                      <button
                        class="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                        style="
                          background: var(--bg-surface-elevated);
                          border: 1px solid var(--border-muted);
                          color: var(--text-muted);
                        "
                        (click)="abrirDetallePago(row)"
                        [attr.aria-label]="'Ver detalle del pago de ' + row.nombre"
                        data-llm-action="ver-detalle-pago-instructor"
                      >
                        <app-icon name="eye" [size]="13" />
                        Ver detalle
                      </button>
                    } @else {
                      <button
                        class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                        style="
                          background: color-mix(in srgb, var(--color-success) 12%, var(--bg-surface));
                          border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
                          color: var(--color-success);
                        "
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
        </table>
      </div>
    </div>

    <!-- ── Detalle de pago (tooltip-like) ───────────────────────────────────── -->
    @if (rowDetalle()) {
      <div
        class="fixed inset-0 z-40 flex items-center justify-center p-4"
        style="background: rgba(0,0,0,0.3)"
        (click)="rowDetalle.set(null)"
        aria-hidden="true"
      >
        <div
          class="flex flex-col gap-3 p-5 rounded-xl"
          style="
            background: var(--bg-surface);
            border: 1px solid var(--border-muted);
            box-shadow: 0 16px 48px rgba(0,0,0,0.2);
            min-width: 280px;
            max-width: 360px;
          "
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-label="Detalle del pago registrado"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
              <app-icon name="check-circle" [size]="15" color="var(--color-success)" />
              Pago registrado
            </h3>
            <button
              class="cursor-pointer"
              style="color: var(--text-muted)"
              (click)="rowDetalle.set(null)"
              aria-label="Cerrar detalle"
            >
              <app-icon name="x" [size]="14" />
            </button>
          </div>
          <div class="flex flex-col gap-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Monto pagado</span>
              <span class="font-semibold text-primary">{{
                formatCLP(rowDetalle()!.finalPaymentAmount)
              }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Método</span>
              <span class="font-medium text-primary">
                {{ rowDetalle()!.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia' }}
              </span>
            </div>
            @if (rowDetalle()!.transferCode) {
              <div class="flex justify-between">
                <span class="text-muted">Código</span>
                <span class="font-mono text-xs text-primary">{{ rowDetalle()!.transferCode }}</span>
              </div>
            }
            @if (rowDetalle()!.paymentDate) {
              <div class="flex justify-between">
                <span class="text-muted">Fecha</span>
                <span class="text-primary">{{ formatDate(rowDetalle()!.paymentDate!) }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    }

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

  // ── Estado UI interno ───────────────────────────────────────────────────────
  protected readonly query = signal('');
  protected readonly rowSeleccionada = signal<LiquidacionRow | null>(null);
  protected readonly rowDetalle = signal<LiquidacionRow | null>(null);

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

  // ── Handlers ─────────────────────────────────────────────────────────────────

  protected formatCLP(value: number): string {
    return formatCLP(value);
  }

  protected formatDate(dateStr: string): string {
    const [yyyy, mm, dd] = dateStr.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  protected abrirModal(row: LiquidacionRow): void {
    this.rowSeleccionada.set(row);
  }

  protected abrirDetallePago(row: LiquidacionRow): void {
    this.rowDetalle.set(row);
  }

  protected onConfirmed(payload: PagoInstructorPayload): void {
    const row = this.rowSeleccionada();
    if (!row) return;
    this.rowSeleccionada.set(null);
    this.pagar.emit({ row, payload });
  }
}
