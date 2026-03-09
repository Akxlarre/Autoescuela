import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * Botón primario con estado de carga integrado.
 *
 * - Muestra spinner giratorio mientras `loading` es true.
 * - Se deshabilita y cambia cursor cuando `loading` o `disabled` es true.
 * - El cursor cambia automáticamente a pointer cuando está activo.
 *
 * @example
 * <app-async-btn
 *   label="Guardar y Continuar"
 *   icon="arrow-right"
 *   [loading]="isSaving()"
 *   [disabled]="!canAdvance()"
 *   (click)="onNext()"
 *   data-llm-action="submit-step"
 * />
 */
@Component({
  selector: 'app-async-btn',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './async-btn.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsyncBtnComponent {
  label = input.required<string>();
  /** Nombre Lucide del ícono decorativo (kebab-case). Se oculta durante loading. */
  icon = input<string | null>(null);
  /** Muestra spinner y deshabilita el botón mientras está en true. */
  loading = input<boolean>(false);
  /** Deshabilita el botón por condición de negocio (ej: formulario inválido). */
  disabled = input<boolean>(false);
  /** Texto a mostrar mientras `loading` es true. Por defecto "Procesando...". */
  loadingLabel = input<string>('Procesando...');

  readonly isDisabledOrLoading = computed(() => this.disabled() || this.loading());
}
