import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * Botón "Limpiar filtros" de las barras de filtro (spec 0022-m).
 *
 * Dumb: solo se muestra si `active` es true y avisa con `clear`; qué se limpia lo decide la
 * lista (selectores en "todos" y buscador vacío). Mismo diseño que tenía Pagos.
 * El host usa display: contents para no ocupar un hueco del gap de la barra cuando está oculto.
 */
@Component({
  selector: 'app-clear-filters-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { style: 'display: contents' },
  template: `
    @if (active()) {
      <button
        type="button"
        class="btn-ghost shrink-0 flex items-center gap-1.5"
        (click)="clear.emit()"
        [attr.data-llm-action]="'clear-' + llmSubject() + '-filters'"
      >
        <app-icon name="x" [size]="14" />
        Limpiar filtros
      </button>
    }
  `,
})
export class ClearFiltersButtonComponent {
  /** Hay al menos un filtro distinto de su valor por defecto o texto en el buscador. */
  readonly active = input.required<boolean>();
  /** Sujeto del data-llm-action (p. ej. "students" → "clear-students-filters"). */
  readonly llmSubject = input('list');
  readonly clear = output<void>();
}
