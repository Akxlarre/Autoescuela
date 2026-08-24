import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import { PERIOD_WINDOW_MONTHS, type PeriodWindow } from '@core/utils/period-window.utils';

/**
 * Selector de ventana de período para listas históricas acumulativas.
 *
 * Dumb puro: no conoce la lista ni el dominio, solo la ventana elegida y si hay una búsqueda
 * en curso. El recorte real lo hace `applyPeriodWindow()` en el consumidor.
 *
 * Cuando `searchActive` es `true`, la ventana **no aplica** (la búsqueda siempre corre sobre
 * todo el historial — ver `period-window.utils.ts`). Para que el control no mienta sobre el
 * alcance de lo que se está mostrando, en ese estado se muestra una nota debajo.
 */
@Component({
  selector: 'app-period-selector',
  standalone: true,
  imports: [FormsModule, Select, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1 min-w-0">
      <p-select
        [ngModel]="window()"
        (ngModelChange)="windowChange.emit($event)"
        [options]="options()"
        optionLabel="label"
        optionValue="value"
        [ariaLabel]="ariaLabel()"
        styleClass="w-full h-10"
        class="min-w-0"
        data-llm-action="change-list-period-window"
        [attr.data-llm-description]="'selector de ventana de tiempo de la lista; la busqueda y el export siempre ignoran esta ventana'"
      />

      @if (searchActive()) {
        <span
          class="inline-flex items-center gap-1.5 text-2xs text-text-muted"
          role="status"
          aria-live="polite"
        >
          <app-icon name="search" [size]="12" />
          Buscando en todo el historial
        </span>
      }
    </div>
  `,
})
export class PeriodSelectorComponent {
  /** Ventana actualmente elegida. */
  readonly window = input.required<PeriodWindow>();

  /** Si hay un término de búsqueda activo — la ventana queda suspendida mientras sea `true`. */
  readonly searchActive = input(false);

  /** Etiqueta accesible; los consumidores la ajustan al contenido de su lista. */
  readonly ariaLabel = input('Período de la lista');

  /**
   * Años concretos que se ofrecen además de las dos ventanas base (ej. `['2026','2025']`).
   *
   * Existe para **unificar** el filtro de año que algunas listas ya tenían por separado
   * (ex-alumnos Clase B). Dos controles de tiempo distintos se contradicen: con la ventana de
   * 12 meses activa, elegir "2024" en el otro control devolvía 0 filas y parecía roto. Acá
   * elegir un año **es** elegir una ventana, así que el conflicto no puede existir.
   */
  readonly years = input<readonly string[]>([]);

  readonly windowChange = output<PeriodWindow>();

  protected readonly options = computed(() => [
    { label: `Últimos ${PERIOD_WINDOW_MONTHS} meses`, value: 'last-12-months' as PeriodWindow },
    { label: 'Todo el historial', value: 'all' as PeriodWindow },
    ...this.years().map((y) => ({ label: y, value: `year-${y}` as PeriodWindow })),
  ]);
}
