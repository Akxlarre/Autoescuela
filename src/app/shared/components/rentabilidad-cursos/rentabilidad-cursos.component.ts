import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { RentabilidadCurso } from '@core/models/ui/reportes-contables.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ShortCurrencyPipe } from '@shared/pipes/short-currency.pipe';
import { BadgeComponent } from '@shared/components/badge/badge.component';

/**
 * Tabla "Rentabilidad Estimada por Tipo de Curso" (Reportes Contables).
 * Dumb puro: recibe las filas ya calculadas por `ReportesContablesFacade`
 * (`computeRentabilidadCursos`) y el label del período activo. Los "Gastos
 * Directos" son una ESTIMACIÓN por prorrateo, no un dato exacto (fix-237-m).
 */
@Component({
  selector: 'app-rentabilidad-cursos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, IconComponent, ShortCurrencyPipe],
  styles: `
    .rows-divider > * + * {
      border-top: 1px solid var(--border-muted);
    }
  `,
  template: `
    <!-- ── Cabecera ─────────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <app-icon name="bar-chart-2" [size]="18" color="var(--text-primary)" />
        <h2 class="text-text-primary font-semibold">Rentabilidad Estimada por Tipo de Curso</h2>
      </div>
      @if (periodoLabel()) {
        <span class="text-sm font-medium text-brand">
          {{ periodoLabel() }}
        </span>
      }
    </div>

    @if (datos().length === 0) {
      <!-- ── Estado vacío ──────────────────────────────────────────────────── -->
      <div class="flex-1 flex flex-col items-center justify-center text-center gap-2 py-10">
        <app-icon name="bar-chart-2" [size]="28" color="var(--text-muted)" />
        <p class="text-sm font-medium text-text-primary">Sin movimientos en este período</p>
        <p class="text-xs text-text-muted">
          No hay ingresos por tipo de curso en el rango de fechas seleccionado.
        </p>
      </div>
    } @else {
      <!-- ── Tabla ───────────────────────────────────────────────────────────── -->
      <div>
        <!-- Encabezado de columnas -->
        <div
          class="micro-label hidden lg:grid gap-4 px-6 py-2 border-b bg-surface border-border-muted"
          style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr"
        >
          <span>Tipo de Curso</span>
          <span class="text-right">Ingresos</span>
          <span class="text-right">Gastos Directos</span>
          <span class="text-right">Margen Neto</span>
          <span class="text-right">Rentabilidad</span>
          <span class="text-center">Visual</span>
        </div>

        <!-- Filas de datos -->
        <div class="rows-divider">
          @for (item of datos(); track item.tipoCurso) {
            <div
              class="p-4 lg:px-6 lg:py-4 flex flex-col lg:grid gap-3 lg:gap-4 lg:items-center hover:bg-[color-mix(in_srgb,var(--bg-surface)_60%,transparent)] transition-colors"
              style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr"
            >
              <!-- Tipo de Curso -->
              <span class="item-title">
                {{ item.tipoCurso }}
              </span>

              <!-- Finanzas (Ingresos, Gastos, Margen) -->
              <div
                class="grid grid-cols-3 gap-2 lg:contents mt-2 lg:mt-0 p-3 lg:p-0 rounded-lg lg:rounded-none bg-surface/60"
              >
                <div class="flex flex-col lg:block text-center lg:text-right">
                  <span class="text-2xs uppercase font-bold lg:hidden mb-1 text-text-muted"
                    >Ingresos</span
                  >
                  <span class="item-title lg:font-normal">
                    {{ item.ingresos | shortCurrency }}
                  </span>
                </div>
                <div class="flex flex-col lg:block text-center lg:text-right">
                  <span class="text-2xs uppercase font-bold lg:hidden mb-1 text-text-muted"
                    >Gastos</span
                  >
                  <span class="text-sm font-medium text-error">
                    -{{ item.gastosDirectos | shortCurrency }}
                  </span>
                </div>
                <div class="flex flex-col lg:block text-center lg:text-right">
                  <span class="text-2xs uppercase font-bold lg:hidden mb-1 text-text-muted"
                    >Margen</span
                  >
                  <span class="text-sm font-semibold text-success">
                    {{ item.margenNeto | shortCurrency }}
                  </span>
                </div>
              </div>

              <!-- Rentabilidad + Visual -->
              <div
                class="flex items-center justify-between lg:contents mt-2 lg:mt-0 pt-3 lg:pt-0 border-t lg:border-none border-border-muted"
              >
                <!-- Rentabilidad badge -->
                <div class="flex items-center gap-2 lg:justify-end">
                  <span class="text-2xs lg:hidden uppercase font-bold text-text-muted"
                    >Rentabilidad</span
                  >
                  <app-badge variant="success"> {{ item.rentabilidadPorcentaje }}% </app-badge>
                </div>

                <!-- Visual: barra de progreso -->
                <div
                  class="flex items-center justify-end lg:justify-center flex-1 lg:flex-none ml-4 lg:ml-0"
                >
                  <div
                    class="h-2 rounded-full overflow-hidden w-full lg:w-full bg-border-muted"
                    style="max-width: 120px"
                  >
                    <div
                      class="h-full rounded-full"
                      [style.width.%]="clampPct(item.rentabilidadPorcentaje)"
                      [style.background]="item.colorVisual"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Fila de TOTAL -->
        <div
          class="flex flex-col lg:grid gap-3 lg:gap-4 px-4 py-4 border-t-2 border-border-muted bg-surface"
          style="border-radius: 0 0 6px 6px"
        >
          <div
            class="flex flex-col lg:grid gap-3"
            style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;"
          >
            <div class="flex items-center justify-between lg:block">
              <span class="text-sm font-bold uppercase tracking-wider text-text-primary"
                >Total Mensual</span
              >
              <app-badge variant="success">
                {{ totales().rentabilidadPorcentaje }}% Rentabilidad
              </app-badge>
            </div>

            <div
              class="grid grid-cols-3 gap-2 lg:contents mt-2 lg:mt-0 p-3 lg:p-0 rounded-lg lg:rounded-none bg-surface/60"
            >
              <div class="flex flex-col lg:block text-center lg:text-right">
                <span class="text-2xs uppercase font-bold lg:hidden mb-1 text-text-muted"
                  >Ingresos</span
                >
                <span class="item-title text-center lg:text-right">
                  {{ totales().ingresos | shortCurrency }}
                </span>
              </div>

              <div class="flex flex-col lg:block text-center lg:text-right">
                <span class="text-2xs uppercase font-bold lg:hidden mb-1 text-text-muted"
                  >Gastos</span
                >
                <span class="text-sm font-bold text-center lg:text-right text-error">
                  -{{ totales().gastosDirectos | shortCurrency }}
                </span>
              </div>

              <div class="flex flex-col lg:block text-center lg:text-right">
                <span class="text-2xs uppercase font-bold lg:hidden mb-1 text-text-muted"
                  >Margen</span
                >
                <span class="text-sm font-bold text-center lg:text-right text-success">
                  {{ totales().margenNeto | shortCurrency }}
                </span>
              </div>
            </div>

            <div class="hidden lg:flex justify-end">
              <app-badge variant="success"> {{ totales().rentabilidadPorcentaje }}% </app-badge>
            </div>

            <div class="hidden lg:block"></div>
          </div>
        </div>
      </div>

      <!-- ── Nota al pie ────────────────────────────────────────────────────────── -->
      <div
        class="mt-4 px-4 py-3 rounded-lg text-xs text-text-muted border border-border-muted bg-text-muted/8"
      >
        <strong>Nota:</strong> Estimación. Los gastos directos se prorratean desde bencina,
        reparaciones (según nº de clases prácticas de cada tipo) y materiales (según ingresos). No
        incluyen gastos fijos (arriendo, sueldos, servicios) ni pagos a instructores.
      </div>
    }
  `,
})
export class RentabilidadCursosComponent {
  /** Filas ya calculadas por el Facade (`computeRentabilidadCursos`). */
  readonly datos = input<RentabilidadCurso[]>([]);
  /** Label del período activo, ej: "Enero 2026" o "01/01/2026 – 31/01/2026". */
  readonly periodoLabel = input<string>('');

  // ── Computed: fila de totales ──────────────────────────────────────────────
  protected readonly totales = computed(() => {
    const datos = this.datos();
    const ingresos = datos.reduce((sum, d) => sum + d.ingresos, 0);
    const gastosDirectos = datos.reduce((sum, d) => sum + d.gastosDirectos, 0);
    const margenNeto = ingresos - gastosDirectos;
    const rentabilidadPorcentaje = ingresos > 0 ? Math.round((margenNeto / ingresos) * 100) : 0;
    return { ingresos, gastosDirectos, margenNeto, rentabilidadPorcentaje };
  });

  /** La barra visual se satura entre 0 y 100 (el % real puede ser negativo). */
  protected clampPct(pct: number): number {
    return Math.max(0, Math.min(100, pct));
  }
}
