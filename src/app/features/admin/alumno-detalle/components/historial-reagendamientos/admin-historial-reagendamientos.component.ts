import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { ReagendamientoHistorialUI } from '@core/models/ui/alumno-detalle.model';

/**
 * AdminHistorialReagendamientosComponent — Dumb Component (fix-008-i).
 *
 * Muestra el historial de reagendamientos de la matrícula (razón + fecha
 * anterior/nueva), alimentado por `AdminAlumnoDetalleFacade.historialReagendamientos()`.
 */
@Component({
  selector: 'app-admin-historial-reagendamientos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="bento-card !p-0 flex flex-col h-full w-full overflow-hidden">
      <div
        class="flex items-center justify-between p-5 border-b border-border-subtle bg-elevated/30"
      >
        <div class="flex flex-col">
          <h2 class="text-base font-bold text-text-primary m-0">Reagendamientos</h2>
          <span class="text-2xs text-text-muted font-bold uppercase tracking-widest mt-0.5">
            Historial de razones
          </span>
        </div>
        <div
          class="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center text-warning"
        >
          <app-icon name="calendar-clock" [size]="18" />
        </div>
      </div>

      <div class="flex flex-col gap-3 p-5 flex-1 min-h-0 overflow-y-auto">
        @if (reagendamientos().length === 0) {
          <div class="flex flex-col items-center justify-center gap-3 py-8 opacity-40">
            <app-icon name="calendar-clock" [size]="32" />
            <p class="text-xs font-medium text-center">Sin reagendamientos registrados</p>
          </div>
        }

        @for (r of reagendamientos(); track r.id) {
          <div
            class="flex flex-col gap-1 p-3 rounded-xl bg-elevated/50 border border-border-subtle"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-text-primary">
                @if (r.claseNumero) {
                  Clase #{{ r.claseNumero }} — {{ r.razonLabel }}
                } @else {
                  {{ r.razonLabel }}
                }
              </span>
              <span class="text-2xs text-text-muted">{{ r.fechaRegistro }}</span>
            </div>
            @if (r.razonOtro) {
              <p class="text-2xs text-text-muted">{{ r.razonOtro }}</p>
            }
            @if (r.fechaAnterior && r.fechaNueva) {
              <p class="text-2xs text-text-muted">{{ r.fechaAnterior }} → {{ r.fechaNueva }}</p>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class AdminHistorialReagendamientosComponent {
  reagendamientos = input.required<ReagendamientoHistorialUI[]>();
}
