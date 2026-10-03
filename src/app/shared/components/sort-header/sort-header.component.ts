import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { sortIconOf, type TableSort } from '@core/utils/table-sort.utils';

/**
 * Título de columna ordenable (spec 0023-m; diseño de la spec 0020-m).
 *
 * Dumb: muestra el texto y la flecha del sentido, y avisa el clic. El ciclo
 * ascendente → descendente → por defecto y el `aria-sort` del `<th>` los maneja la lista con
 * `nextSort()` / `ariaSortOf()` de `table-sort.utils`.
 */
@Component({
  selector: 'app-sort-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="sort-header"
      [class.sort-header--active]="active()"
      (click)="sortClick.emit()"
      [attr.data-llm-action]="'sort-' + llmSubject() + '-by-' + field()"
      [attr.aria-label]="'Ordenar por ' + label()"
    >
      {{ label() }}
      <app-icon [name]="icon()" [size]="12" />
    </button>
  `,
  styles: [
    `
      /* Hereda la tipografía de micro-label del tr de la cabecera. */
      .sort-header {
        position: relative;
        display: inline-block;
        font: inherit;
        letter-spacing: inherit;
        text-transform: inherit;
        text-align: left;
        color: inherit;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
      }

      /* El indicador va fuera del flujo, sobre el espacio entre columnas: no ensancha la
         tabla (con el ícono en línea, a 1600 px aparecía scroll horizontal y se cortaba
         la columna Acciones, spec 0020-m). */
      .sort-header app-icon {
        position: absolute;
        left: calc(100% + 3px);
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.35;
        transition: opacity var(--duration-fast);
      }

      .sort-header:hover app-icon,
      .sort-header--active app-icon {
        opacity: 1;
      }
    `,
  ],
})
export class SortHeaderComponent {
  readonly label = input.required<string>();
  /** Valor de la columna (para el data-llm-action y para saber si es la activa). */
  readonly field = input.required<string>();
  /** Orden vigente de la lista, o null si está en su orden por defecto. */
  readonly sort = input<TableSort<string> | null>(null);
  /** Sujeto del data-llm-action, p. ej. "students" → "sort-students-by-rut". */
  readonly llmSubject = input('list');
  readonly sortClick = output<void>();

  protected readonly active = computed(() => this.sort()?.field === this.field());
  protected readonly icon = computed(() => sortIconOf(this.sort(), this.field()));
}
