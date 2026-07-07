import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { RentabilidadCurso } from '@core/models/ui/pagos.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { formatCLP } from '@core/utils/date.utils';
import { ShortCurrencyPipe } from '@shared/pipes/short-currency.pipe';

@Component({
  selector: 'app-rentabilidad-cursos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ShortCurrencyPipe],
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
        <h2 class="text-base font-semibold text-text-primary">
          Rentabilidad Estimada por Tipo de Curso (RF-040)
        </h2>
      </div>
      <span class="text-sm font-medium text-brand">
        {{ mesActual() }}
      </span>
    </div>

    <!-- ── Tabla ─────────────────────────────────────────────────────────────── -->
    <div>
      <!-- Encabezado de columnas -->
      <div
        class="hidden lg:grid gap-4 px-6 py-2 text-xs font-semibold tracking-wide uppercase border-b text-text-muted bg-surface border-border-muted"
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
        @for (item of datosRentabilidad(); track item.tipoCurso) {
          <div
            class="p-4 lg:px-6 lg:py-4 flex flex-col lg:grid gap-3 lg:gap-4 lg:items-center hover:bg-[color-mix(in_srgb,var(--bg-surface)_60%,transparent)] transition-colors"
            style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr"
          >
            <!-- Tipo de Curso -->
            <span class="text-sm font-semibold text-text-primary">
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
                <span class="text-sm font-semibold lg:font-normal text-text-primary">
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
                <span class="text-xs font-bold px-2.5 py-1 rounded-full text-success bg-success/15">
                  {{ item.rentabilidadPorcentaje }}%
                </span>
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
                    [style.width.%]="item.rentabilidadPorcentaje"
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
          class="flex flex-col lg:grid lg:contents gap-3"
          style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;"
        >
          <div class="flex items-center justify-between lg:block">
            <span class="text-sm font-bold uppercase tracking-wider text-text-primary"
              >Total Mensual</span
            >
            <span
              class="text-xs font-bold px-2.5 py-1 rounded-full lg:hidden text-success bg-success/15"
            >
              {{ totales().rentabilidadPorcentaje }}% Rentabilidad
            </span>
          </div>

          <div
            class="grid grid-cols-3 gap-2 lg:contents mt-2 lg:mt-0 p-3 lg:p-0 rounded-lg lg:rounded-none bg-surface/60"
          >
            <div class="flex flex-col lg:block text-center lg:text-right">
              <span class="text-2xs uppercase font-bold lg:hidden mb-1 text-text-muted"
                >Ingresos</span
              >
              <span class="text-sm font-bold text-center lg:text-right text-text-primary">
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
            <span class="text-xs font-bold px-2.5 py-1 rounded-full text-success bg-success/15">
              {{ totales().rentabilidadPorcentaje }}%
            </span>
          </div>

          <div class="hidden lg:block"></div>
        </div>
      </div>
    </div>

    <!-- ── Nota al pie ────────────────────────────────────────────────────────── -->
    <div
      class="mt-4 px-4 py-3 rounded-lg text-xs text-text-muted border border-border-muted bg-text-muted/8"
    >
      <strong>Nota:</strong> Los gastos directos incluyen bencina, horas instructor, materiales y
      mantención asignables al tipo de curso. No incluyen gastos fijos (arriendo, servicios,
      administración).
    </div>
  `,
})
export class RentabilidadCursosComponent {
  protected readonly formatCLP = formatCLP;

  // ── Mock data (RF-040) ─────────────────────────────────────────────────────
  protected readonly datosRentabilidad = signal<RentabilidadCurso[]>([
    {
      tipoCurso: 'Clase B',
      ingresos: 4_200_000,
      gastosDirectos: 1_680_000,
      margenNeto: 2_520_000,
      rentabilidadPorcentaje: 60,
      colorVisual: 'var(--color-primary)',
    },
    {
      tipoCurso: 'Clase Profesional',
      ingresos: 2_800_000,
      gastosDirectos: 1_260_000,
      margenNeto: 1_540_000,
      rentabilidadPorcentaje: 55,
      colorVisual: 'var(--color-purple)',
    },
    {
      tipoCurso: 'SENCE (Singulares)',
      ingresos: 1_350_000,
      gastosDirectos: 540_000,
      margenNeto: 810_000,
      rentabilidadPorcentaje: 60,
      colorVisual: 'var(--state-success)',
    },
    {
      tipoCurso: 'Psicotécnico',
      ingresos: 200_000,
      gastosDirectos: 40_000,
      margenNeto: 160_000,
      rentabilidadPorcentaje: 80,
      colorVisual: 'var(--state-warning)',
    },
  ]);

  // ── Computed: fila de totales ──────────────────────────────────────────────
  protected readonly totales = computed(() => {
    const datos = this.datosRentabilidad();
    const ingresos = datos.reduce((sum, d) => sum + d.ingresos, 0);
    const gastosDirectos = datos.reduce((sum, d) => sum + d.gastosDirectos, 0);
    const margenNeto = ingresos - gastosDirectos;
    const rentabilidadPorcentaje = Math.round((margenNeto / ingresos) * 100);
    return { ingresos, gastosDirectos, margenNeto, rentabilidadPorcentaje };
  });

  // ── Computed: mes/año actual ───────────────────────────────────────────────
  protected readonly mesActual = computed(() => {
    const now = new Date();
    const mes = now.toLocaleDateString('es-CL', { month: 'long' });
    const year = now.getFullYear();
    return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${year}`;
  });
}
