import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { IconComponent } from '../icon/icon.component';

/**
 * HelpHintComponent — Ícono "?" que revela texto de ayuda contextual on-demand (hover/focus),
 * en vez de ocupar espacio permanente con una card informativa.
 *
 * @example
 * <app-help-hint text="Descarga el documento, complétalo... <strong>Documentos del Alumno</strong>." />
 */
@Component({
  selector: 'app-help-hint',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipModule, IconComponent],
  host: { class: 'inline-flex' },
  template: `
    <button
      type="button"
      class="inline-flex items-center justify-center w-5 h-5 rounded-full border-0 bg-transparent cursor-help text-text-muted hover:text-text-primary transition-colors"
      [pTooltip]="text()"
      [escape]="false"
      tooltipPosition="top"
      aria-label="Ayuda"
      data-llm-description="botón de ayuda contextual, muestra texto explicativo al pasar el mouse"
    >
      <app-icon name="circle-help" [size]="18" />
    </button>
  `,
})
export class HelpHintComponent {
  /** Texto de ayuda mostrado en el tooltip. Soporta HTML simple (ej. <strong>). */
  readonly text = input.required<string>();
}
