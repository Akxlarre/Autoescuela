import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DetalleCuadraturaModalComponent } from '@shared/components/detalle-cuadratura-modal/detalle-cuadratura-modal.component';
import type { HistorialCierre } from '@core/models/ui/historial-cuadraturas.model';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface CalendarDay {
  day: number | null;
  dateStr: string | null;
  cierre: HistorialCierre | null;
  isToday: boolean;
}

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

const DIAS_SEMANA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

// ─── Helper formato CLP ───────────────────────────────────────────────────────

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-historial-cuadraturas-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, DetalleCuadraturaModalComponent],
  styles: `
    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
      background: var(--border-color);
    }
    .cal-cell {
      min-height: 120px;
      padding: 0.5rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: var(--bg-surface);
    }
    .cal-cell--empty {
      background: var(--bg-surface-elevated);
    }
    .cal-cell--clickable {
      cursor: pointer;
      transition: background 150ms ease;
    }
    .cal-cell--clickable:hover {
      background: color-mix(in srgb, var(--ds-brand) 4%, var(--bg-surface));
    }
    .cal-header-days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
      background: var(--border-color);
    }
    .cal-header-cell {
      padding: 0.625rem 0;
      text-align: center;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
      background: var(--bg-surface-elevated);
    }
    .badge-cuadrado {
      display: block;
      width: 100%;
      text-align: center;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 0;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-success) 15%, transparent);
      color: var(--color-success);
    }
    .badge-descuadre {
      display: block;
      width: 100%;
      text-align: center;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 0;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-error) 12%, transparent);
      color: var(--color-error);
    }
    .day-circle {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--ds-brand);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.68rem;
      font-weight: 800;
      flex-shrink: 0;
    }
  `,
  template: `
    <!-- ── Cabecera ─────────────────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-5">
      <div>
        <h1 class="text-2xl font-semibold text-primary">Historial de Cuadraturas</h1>
        <p class="text-sm text-muted mt-0.5">Registro de cierres de caja mensuales</p>
      </div>

      <div class="flex items-center gap-3 flex-wrap">
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
            data-llm-action="historial-mes-anterior"
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
            data-llm-action="historial-mes-siguiente"
          >
            <app-icon name="chevron-right" [size]="16" />
          </button>
        </div>

        <button
          class="btn-primary text-sm px-4 py-2 cursor-pointer"
          style="border-radius: var(--radius-lg, 10px)"
          (click)="volverAHoy.emit()"
          data-llm-action="historial-volver-hoy"
          aria-label="Volver al mes actual"
        >
          Volver a Hoy
        </button>

        <button
          class="flex items-center gap-2 text-sm font-medium px-4 py-2 cursor-pointer transition-colors"
          style="background: var(--bg-surface); border: 1px solid var(--border-muted); color: var(--text-primary); border-radius: var(--radius-lg, 10px)"
          (click)="exportarCSV.emit()"
          data-llm-action="exportar-historial-csv"
          aria-label="Exportar historial a CSV"
        >
          <app-icon name="download" [size]="15" />
          Exportar CSV
        </button>
      </div>
    </div>

    <!-- ── Calendario ─────────────────────────────────────────────────────────── -->
    <div
      class="overflow-hidden"
      style="border: 1px solid var(--border-color); border-radius: var(--radius-lg, 10px)"
    >
      <!-- Cabecera de días (LUN–DOM) -->
      <div class="cal-header-days">
        @for (dia of diasSemana; track dia) {
          <div class="cal-header-cell">{{ dia }}</div>
        }
      </div>

      <!-- Grid de celdas -->
      @if (isLoading()) {
        <div class="cal-grid">
          @for (i of skeletonCells; track i) {
            <div class="cal-cell cal-cell--empty">
              <app-skeleton-block variant="text" width="40%" height="13px" />
            </div>
          }
        </div>
      } @else {
        <div class="cal-grid">
          @for (celda of calendarDays(); track $index) {
            <div
              class="cal-cell"
              [class.cal-cell--empty]="!celda.day"
              [class.cal-cell--clickable]="!!celda.cierre"
              [attr.role]="celda.cierre ? 'button' : null"
              [attr.aria-label]="
                celda.cierre ? 'Ver detalle del cierre del día ' + celda.day : null
              "
              [attr.tabindex]="celda.cierre ? 0 : null"
              (click)="celda.cierre && abrirDetalle(celda.cierre)"
              (keydown.enter)="celda.cierre && abrirDetalle(celda.cierre)"
            >
              @if (celda.day) {
                <!-- Fila superior: número + candado -->
                <div class="flex items-start justify-between">
                  @if (celda.isToday) {
                    <span class="day-circle" aria-label="Hoy">{{ celda.day }}</span>
                  } @else {
                    <span class="text-sm font-medium" style="color: var(--text-secondary)">
                      {{ celda.day }}
                    </span>
                  }
                  @if (celda.cierre) {
                    <app-icon name="lock" [size]="11" color="var(--text-muted)" />
                  }
                </div>

                <!-- Centro: badge + diferencia -->
                @if (celda.cierre; as cierre) {
                  <div class="flex flex-col gap-1 my-1">
                    @if (cierre.estadoDiferencia === 'balanced') {
                      <span class="badge-cuadrado">Cuadrado</span>
                    } @else {
                      <span class="badge-descuadre">Descuadre</span>
                    }
                    <p
                      class="text-xs font-semibold text-center"
                      [style.color]="
                        cierre.estadoDiferencia === 'shortage'
                          ? 'var(--color-error)'
                          : cierre.estadoDiferencia === 'surplus'
                            ? 'var(--color-warning)'
                            : 'var(--color-success)'
                      "
                    >
                      {{ formatDiferencia(cierre.diferencia) }}
                    </p>
                  </div>

                  <!-- Fila inferior: cajero -->
                  <div class="flex items-center gap-1">
                    <app-icon name="user" [size]="10" color="var(--text-muted)" />
                    <span
                      class="text-xs truncate"
                      style="color: var(--text-muted); max-width: calc(100% - 16px)"
                      >{{ cierre.cajero }}</span
                    >
                  </div>
                } @else if (celda.isToday) {
                  <p
                    class="text-xs font-semibold text-center my-auto"
                    style="color: var(--ds-brand)"
                  >
                    En curso
                  </p>
                  <!-- Espaciador inferior -->
                  <span></span>
                } @else {
                  <span></span><span></span>
                }
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- ── Modal de detalle ───────────────────────────────────────────────────── -->
    <app-detalle-cuadratura-modal [cierre]="cierreSeleccionado()" (closed)="cerrarDetalle()" />
  `,
})
export class HistorialCuadraturasContentComponent {
  // ── Inputs ────────────────────────────────────────────────────────────────
  cierres = input<HistorialCierre[]>([]);
  isLoading = input(false);
  mesActual = input<number>(new Date().getMonth() + 1);
  anioActual = input<number>(new Date().getFullYear());

  // ── Outputs ───────────────────────────────────────────────────────────────
  mesAnterior = output<void>();
  mesSiguiente = output<void>();
  volverAHoy = output<void>();
  exportarCSV = output<void>();

  // ── Estado UI interno (no es estado de dominio — es solo UI) ──────────────
  protected readonly cierreSeleccionado = signal<HistorialCierre | null>(null);

  // ── Constantes ────────────────────────────────────────────────────────────
  protected readonly diasSemana = DIAS_SEMANA;
  protected readonly skeletonCells = Array.from({ length: 35 });

  // ── Computed ──────────────────────────────────────────────────────────────

  protected readonly mesLabel = computed(
    () => `${MESES[this.mesActual() - 1]} ${this.anioActual()}`,
  );

  protected readonly calendarDays = computed<CalendarDay[]>(() => {
    const mes = this.mesActual();
    const anio = this.anioActual();
    const cierresMap = new Map(this.cierres().map((c) => [c.fecha, c]));

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const firstDay = new Date(anio, mes - 1, 1);
    const daysInMonth = new Date(anio, mes, 0).getDate();
    // Lunes = índice 0 en la grilla europea
    const offset = (firstDay.getDay() + 6) % 7;

    const days: CalendarDay[] = [];

    for (let i = 0; i < offset; i++) {
      days.push({ day: null, dateStr: null, cierre: null, isToday: false });
    }

    const yyyy = String(anio);
    const mm = String(mes).padStart(2, '0');
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yyyy}-${mm}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        dateStr,
        cierre: cierresMap.get(dateStr) ?? null,
        isToday: dateStr === todayStr,
      });
    }

    // Completar última fila
    const remainder = days.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        days.push({ day: null, dateStr: null, cierre: null, isToday: false });
      }
    }

    return days;
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  protected abrirDetalle(cierre: HistorialCierre): void {
    this.cierreSeleccionado.set(cierre);
  }

  protected cerrarDetalle(): void {
    this.cierreSeleccionado.set(null);
  }

  protected formatDiferencia(diff: number): string {
    const formatted = formatCLP(diff);
    if (diff > 0) return `+ ${formatted}`;
    if (diff < 0) return `- ${formatted}`;
    return formatted;
  }
}
