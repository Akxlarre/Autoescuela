import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getClauseCharacterStatus } from '@core/utils/document-clause-limits.util';
import { getTokenDescription } from '@core/utils/document-clause-tokens.util';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * DocumentClauseFieldComponent — Dumb. Campo de edición de una cláusula/sección del editor de
 * plantillas (spec 0016-m): textarea + contador de caracteres + advertencia de overflow (AC5) +
 * hint de los datos automáticos (`{{token}}`) disponibles para esa cláusula (AC7), si aplica.
 */
@Component({
  selector: 'app-document-clause-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, BadgeComponent],
  template: `
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-2">
        <label class="micro-label" [attr.for]="fieldId()">{{ label() }}</label>
        <span
          class="text-xs"
          [class.text-text-muted]="status().withinLimit"
          [class.text-error]="!status().withinLimit"
        >
          {{ body().length }} / {{ maxLength() }}
        </span>
      </div>

      <textarea
        [id]="fieldId()"
        class="w-full min-h-24 p-3 text-sm rounded-lg border transition-colors duration-150 bg-subtle border-border-subtle text-text-primary outline-none focus:border-brand"
        [class.border-error]="!status().withinLimit"
        [ngModel]="body()"
        (ngModelChange)="bodyChange.emit($event)"
        [attr.data-llm-description]="
          'input for the ' + label() + ' clause of the document template'
        "
      ></textarea>

      @if (!status().withinLimit) {
        <p class="text-xs text-error m-0">
          Excede el límite sugerido por {{ -status().remaining }} caracteres — revisa la Vista
          Previa antes de publicar.
        </p>
      }

      @if (availableTokens().length > 0) {
        <div class="flex flex-col gap-1.5 p-2 rounded-lg bg-subtle">
          <div class="flex items-start gap-1.5">
            <app-icon name="info" [size]="14" class="mt-0.5 shrink-0 text-text-muted" />
            <p class="text-xs text-text-muted m-0">
              Placeholders disponibles: son marcadores que el sistema reemplaza automáticamente por
              el dato real del alumno al generar el documento (pasa el mouse sobre uno para ver qué
              dato representa). No los borres ni los escribas de nuevo — si falta uno, ese dato no
              va a aparecer en el documento final.
            </p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            @for (token of availableTokens(); track token) {
              <app-badge variant="neutral" [title]="tokenDescription(token)"
                ><code>{{ '{{' + token + '}}' }}</code></app-badge
              >
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class DocumentClauseFieldComponent {
  readonly sectionId = input.required<string>();
  readonly label = input.required<string>();
  readonly body = input.required<string>();
  readonly maxLength = input.required<number>();
  readonly availableTokens = input<string[]>([]);

  readonly bodyChange = output<string>();

  readonly fieldId = computed(() => `document-clause-${this.sectionId()}`);
  readonly status = computed(() => getClauseCharacterStatus(this.body(), this.maxLength()));

  readonly tokenDescription = getTokenDescription;
}
