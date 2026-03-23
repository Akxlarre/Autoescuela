import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { RentabilidadCurso } from '@core/models/ui/pagos.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { formatCLP } from '@core/utils/date.utils';

@Component({
  selector: 'app-rentabilidad-cursos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <!-- ── Cabecera ─────────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <app-icon name="bar-chart-2" [size]="18" color="var(--text-primary)" />
        <h2 class="text-base font-semibold" style="color: var(--text-primary)">
          Rentabilidad Estimada por Tipo de Curso (RF-040)
        </h2>
      </div>
      <span class="text-sm font-medium" style="color: var(--color-primary)">
        {{ mesActual() }}
      </span>
    </div>

    <!-- ── Tabla ─────────────────────────────────────────────────────────────── -->
    <div class="overflow-x-auto">
      <!-- Encabezado de columnas -->
      <div
        class="grid gap-4 px-4 py-2 text-xs font-semibold tracking-wide uppercase"
        style="
          grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;
          color: var(--text-muted);
          background: var(--bg-surface);
          border-radius: 6px 6px 0 0;
        "
      >
        <span>Tipo de Curso</span>
        <span class="text-right">Ingresos</span>
        <span class="text-right">Gastos Directos</span>
        <span class="text-right">Margen Neto</span>
        <span class="text-right">Rentabilidad</span>
        <span class="text-center">Visual</span>
      </div>

      <!-- Filas de datos -->
      <div class="divide-y" style="border-color: var(--border-muted)">
        @for (item of datosRentabilidad(); track item.tipoCurso) {
          <div
            class="grid gap-4 px-4 py-4 items-center"
            style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr"
          >
            <!-- Tipo de Curso -->
            <span class="text-sm font-semibold" style="color: var(--text-primary)">
              {{ item.tipoCurso }}
            </span>

            <!-- Ingresos -->
            <span class="text-sm text-right" style="color: var(--text-primary)">
              {{ formatCLP(item.ingresos) }}
            </span>

            <!-- Gastos Directos -->
            <span class="text-sm font-medium text-right" style="color: var(--state-error)">
              -{{ formatCLP(item.gastosDirectos) }}
            </span>

            <!-- Margen Neto -->
            <span class="text-sm font-semibold text-right" style="color: var(--state-success)">
              {{ formatCLP(item.margenNeto) }}
            </span>

            <!-- Rentabilidad badge -->
            <div class="flex justify-end">
              <span
                class="text-xs font-bold px-2.5 py-1 rounded-full"
                style="
                  background: color-mix(in srgb, var(--state-success) 15%, transparent);
                  color: var(--state-success);
                "
              >
                {{ item.rentabilidadPorcentaje }}%
              </span>
            </div>

            <!-- Visual: barra de progreso -->
            <div class="flex items-center gap-2 justify-center">
              <div
                class="h-2 rounded-full overflow-hidden flex-1"
                style="background: var(--border-muted); max-width: 120px"
              >
                <div
                  class="h-full rounded-full"
                  [style.width.%]="item.rentabilidadPorcentaje"
                  [style.background]="item.colorVisual"
                ></div>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Fila de TOTAL -->
      <div
        class="grid gap-4 px-4 py-4 items-center border-t-2"
        style="
          grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;
          border-color: var(--border-muted);
          background: var(--bg-surface);
          border-radius: 0 0 6px 6px;
        "
      >
        <span class="text-sm font-bold" style="color: var(--text-primary)">TOTAL</span>

        <span class="text-sm font-bold text-right" style="color: var(--text-primary)">
          {{ formatCLP(totales().ingresos) }}
        </span>

        <span class="text-sm font-bold text-right" style="color: var(--state-error)">
          -{{ formatCLP(totales().gastosDirectos) }}
        </span>

        <span class="text-sm font-bold text-right" style="color: var(--state-success)">
          {{ formatCLP(totales().margenNeto) }}
        </span>

        <div class="flex justify-end">
          <span
            class="text-xs font-bold px-2.5 py-1 rounded-full"
            style="
              background: color-mix(in srgb, var(--state-success) 15%, transparent);
              color: var(--state-success);
            "
          >
            {{ totales().rentabilidadPorcentaje }}%
          </span>
        </div>

        <div></div>
      </div>
    </div>

    <!-- ── Nota al pie ────────────────────────────────────────────────────────── -->
    <div
      class="mt-4 px-4 py-3 rounded-lg text-xs"
      style="
        background: color-mix(in srgb, var(--text-muted) 8%, transparent);
        color: var(--text-muted);
        border: 1px solid var(--border-muted);
      "
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
