import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { TableSort } from '@core/utils/table-sort.utils';

/**
 * Control "Ordenar por" + botón de sentido para la vista de tarjetas, que no tiene títulos de
 * columna (spec 0023-m; diseño de la spec 0020-m, AC11).
 *
 * Dumb: avisa la columna elegida (null = orden por defecto) y el cambio de sentido. La lista
 * decide cuándo mostrarlo (p. ej. con `class="show-on-squeeze"` en el host).
 */
@Component({
  selector: 'app-sort-control',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, IconComponent],
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <p-select
        [options]="selectOptions()"
        [ngModel]="sort()?.field ?? null"
        (ngModelChange)="fieldChange.emit($event)"
        optionLabel="label"
        optionValue="value"
        placeholder="Ordenar por"
        [showClear]="true"
        class="h-9"
        [attr.data-llm-description]="'Sort the ' + llmSubject() + ' list by a column'"
      />
      @if (sort(); as current) {
        <button
          type="button"
          class="btn-secondary flex items-center gap-2"
          (click)="directionToggle.emit()"
          [attr.aria-label]="
            current.direction === 'asc'
              ? 'Orden ascendente. Cambiar a descendente'
              : 'Orden descendente. Cambiar a ascendente'
          "
          [attr.data-llm-action]="'toggle-' + llmSubject() + '-sort-direction'"
        >
          <app-icon
            [name]="current.direction === 'asc' ? 'chevron-up' : 'chevron-down'"
            [size]="16"
          />
          {{ current.direction === 'asc' ? 'Ascendente' : 'Descendente' }}
        </button>
      }
    </div>
  `,
})
export class SortControlComponent {
  /** Columnas ordenables, en el orden de la tabla. */
  readonly options = input.required<readonly { label: string; value: string }[]>();
  readonly sort = input<TableSort<string> | null>(null);
  readonly llmSubject = input('list');
  /** Columna elegida; null cuando se limpia el control (vuelve al orden por defecto). */
  readonly fieldChange = output<string | null>();
  readonly directionToggle = output<void>();

  /** p-select pide un arreglo mutable; las listas de columnas son constantes de solo lectura. */
  protected readonly selectOptions = computed(() => [...this.options()]);
}
