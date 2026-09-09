import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { EvolucionMensual } from '@core/models/ui/reportes-contables.model';

/**
 * Barra vertical agrupada ingresos/gastos por mes (fix-242-m).
 *
 * Reemplaza la tabla de Evolución Mensual: la tabla de N filas repetía los KPI
 * cuando el rango era un solo mes y obligaba al dueño a comparar meses a ojo.
 * Dumb puro — recibe `datos` ya calculados por el Facade (serie fija de últimos
 * N meses). Llena el alto disponible del contenedor.
 */
interface BarMes {
  label: string;
  ingresos: number;
  gastos: number;
  neto: number;
  /** Alto relativo 0–100 respecto al mayor valor de toda la serie. */
  ingresosPct: number;
  gastosPct: number;
  netoNegativo: boolean;
  /** El mes no tuvo ningún ingreso ni gasto (spec 0015-m) → nota "sin movimientos". */
  sinMovimientos: boolean;
}

@Component({
  selector: 'app-evolucion-mensual-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        min-height: 260px;
      }

      /* Barras verticales — SOLO lg+. En móvil se usa .hrows (barras horizontales,
         una fila por mes, scroll vertical de la página) porque 12 columnas verticales
         con sus montos arriba no caben en un teléfono (fix-246-m). */
      .chart-scroll {
        flex: 1;
        min-height: 0;
        width: 100%;
        overflow-x: auto;
        display: none;
      }

      /* ── Barras horizontales (móvil / tablet) ── */
      .hrows {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        flex: 1;
        min-height: 0;
        width: 100%;
        padding-top: var(--space-2);
      }

      .hrow {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .hrow-label {
        flex: 0 0 40px;
        font-size: var(--text-xs);
        color: var(--text-muted);
        text-transform: capitalize;
        white-space: nowrap;
      }

      .hrow-track {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .hrow-track--empty {
        border-bottom: 1px dashed var(--border-default);
        opacity: 0.55;
      }

      .hbar {
        height: 6px;
        border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        min-width: 2px;
        transition: width 0.4s var(--ease-out);
      }

      .hbar--ingresos {
        background: var(--state-success);
      }

      .hbar--gastos {
        background: var(--state-error);
      }

      .hrow-value {
        flex: 0 0 auto;
        min-width: 52px;
        text-align: right;
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        white-space: nowrap;
      }

      .hrow-value--neg {
        color: var(--state-error);
      }

      .hrow-value--muted {
        color: var(--text-muted);
        font-weight: var(--font-normal, 400);
        font-style: italic;
      }

      .chart-grid {
        display: flex;
        align-items: stretch;
        justify-content: space-evenly;
        gap: var(--space-3);
        flex: 1;
        min-width: min-content;
        padding-top: var(--space-6);
      }

      .mes-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-2);
        /* spec 0015-m: hasta 12 columnas — se comprimen para caber; si aun asi no
           entran, chart-scroll (overflow-x auto) da scroll horizontal interno.
           min-width 60px = ancho minimo para que "movimientos" quepa en una linea. */
        flex: 1 1 64px;
        min-width: 60px;
        max-width: 120px;
        height: 100%;
      }

      .mes-neto {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        font-variant-numeric: tabular-nums;
        color: var(--text-primary);
      }

      .mes-neto--negativo {
        color: var(--state-error);
      }

      .bars {
        display: flex;
        align-items: flex-end;
        gap: var(--space-1);
        flex: 1;
        min-height: 120px;
        width: 100%;
        justify-content: center;
      }

      .bar {
        width: 32px;
        max-width: 40%;
        border-radius: var(--radius-sm) var(--radius-sm) 0 0;
        min-height: 3px;
        transition: height 0.5s var(--ease-out);
      }

      .bar--ingresos {
        background: var(--state-success);
      }

      .bar--gastos {
        background: var(--state-error);
      }

      .mes-label {
        font-size: var(--text-xs);
        color: var(--text-muted);
        text-transform: capitalize;
        white-space: nowrap;
      }

      /* spec 0015-m: nota del mes sin ingresos ni gastos — arriba de las barras,
         ocupando el slot que normalmente tiene el neto. Envuelve dentro de la
         columna (no se derrama sobre las vecinas) cuando el rango es de 12 meses
         y las columnas se comprimen. */
      .mes-sin-mov {
        font-size: 9px;
        line-height: 1.15;
        color: var(--text-muted);
        font-style: italic;
        text-align: center;
        white-space: normal;
        overflow-wrap: break-word;
        max-width: 100%;
      }

      /* Área de barras de un mes sin movimientos: sin stubs de color, solo una
         línea base tenue punteada, para que se distinga a simple vista de un mes
         con monto chico (que sí dibuja barras). */
      .bars--empty {
        border-bottom: 1px dashed var(--border-default);
        opacity: 0.55;
      }

      .legend {
        display: flex;
        gap: var(--space-4);
        margin-top: var(--space-4);
        flex-shrink: 0;
      }

      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-xs);
        color: var(--text-muted);
      }

      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: var(--radius-full);
      }

      /* En lg+ manda el layout de barras verticales; en < lg, el de filas
         horizontales. Va al final para ganar por orden de fuente a las reglas base
         de display (fix-246-m). */
      @media (min-width: 1024px) {
        .chart-scroll {
          display: flex;
        }
        .hrows {
          display: none;
        }
      }
    `,
  ],
  template: `
    <!-- Móvil / tablet: una fila por mes, scroll vertical de la página (fix-246-m) -->
    <div class="hrows">
      @for (mes of barras(); track mes.label) {
        <div class="hrow">
          <span class="hrow-label">{{ shortLabel(mes.label) }}</span>
          @if (mes.sinMovimientos) {
            <div class="hrow-track hrow-track--empty"></div>
            <span class="hrow-value hrow-value--muted" [title]="mes.label + ' · Sin movimientos'">
              Sin mov.
            </span>
          } @else {
            <div class="hrow-track">
              <div
                class="hbar hbar--ingresos"
                [style.width.%]="mes.ingresosPct"
                [title]="mes.label + ' · Ingresos ' + clp(mes.ingresos)"
              ></div>
              <div
                class="hbar hbar--gastos"
                [style.width.%]="mes.gastosPct"
                [title]="mes.label + ' · Gastos ' + clp(mes.gastos)"
              ></div>
            </div>
            <span
              class="hrow-value"
              [class.hrow-value--neg]="mes.netoNegativo"
              [title]="'Neto ' + mes.label"
            >
              {{ compact(mes.neto) }}
            </span>
          }
        </div>
      }
    </div>

    <!-- Desktop (lg+): barras verticales -->
    <div class="chart-scroll">
      <div class="chart-grid">
        @for (mes of barras(); track mes.label) {
          <div class="mes-col">
            @if (mes.sinMovimientos) {
              <!-- spec 0015-m: mes dentro del rango pero sin ingresos ni gastos. La nota va
                   ARRIBA de las barras y NO se dibujan stubs — así no se confunde con un mes
                   de monto chico (que sí muestra barras). -->
              <span class="mes-sin-mov" [title]="mes.label + ' · Sin movimientos'">
                Sin movimientos
              </span>
              <div class="bars bars--empty"></div>
            } @else {
              <span
                class="mes-neto"
                [class.mes-neto--negativo]="mes.netoNegativo"
                [title]="'Neto ' + mes.label"
              >
                {{ compact(mes.neto) }}
              </span>
              <div class="bars">
                <div
                  class="bar bar--ingresos"
                  [style.height.%]="mes.ingresosPct"
                  [title]="mes.label + ' · Ingresos ' + clp(mes.ingresos)"
                ></div>
                <div
                  class="bar bar--gastos"
                  [style.height.%]="mes.gastosPct"
                  [title]="mes.label + ' · Gastos ' + clp(mes.gastos)"
                ></div>
              </div>
            }
            <span class="mes-label">{{ shortLabel(mes.label) }}</span>
          </div>
        }
      </div>
    </div>

    <div class="legend">
      <span class="legend-item">
        <span class="legend-dot" style="background: var(--state-success)"></span>
        Ingresos
      </span>
      <span class="legend-item">
        <span class="legend-dot" style="background: var(--state-error)"></span>
        Gastos
      </span>
    </div>
  `,
})
export class EvolucionMensualChartComponent {
  readonly datos = input<EvolucionMensual[]>([]);

  protected readonly barras = computed<BarMes[]>(() => {
    const rows = this.datos();
    const max = rows.reduce((m, r) => Math.max(m, r.ingresos, r.gastos), 0);
    return rows.map((r) => ({
      label: r.mes,
      ingresos: r.ingresos,
      gastos: r.gastos,
      neto: r.neto,
      ingresosPct: max > 0 ? Math.round((r.ingresos / max) * 100) : 0,
      gastosPct: max > 0 ? Math.round((r.gastos / max) * 100) : 0,
      netoNegativo: r.neto < 0,
      sinMovimientos: r.sinMovimientos,
    }));
  });

  /** "Enero 2026" → "ene 26" para el eje. */
  protected shortLabel(mes: string): string {
    const [nombre, anio] = mes.split(' ');
    const corto = nombre ? nombre.slice(0, 3) : mes;
    return anio ? `${corto} ${anio.slice(2)}` : corto;
  }

  protected clp(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /** Formato compacto para las etiquetas: $1,2M / $340K / $0. */
  protected compact(amount: number): string {
    const abs = Math.abs(amount);
    const signo = amount < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${signo}$${(abs / 1_000_000).toFixed(1).replace('.0', '')}M`;
    if (abs >= 1_000) return `${signo}$${Math.round(abs / 1_000)}K`;
    return `${signo}$${abs}`;
  }
}
