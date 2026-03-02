import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { PressFeedbackDirective } from '@core/directives/press-feedback.directive';

/** Tipo de severidad de la alerta. Controla color, ícono y fondo. */
export type AlertSeverity = 'error' | 'warning' | 'info' | 'success';

/**
 * AlertCardComponent — Feedback de estado con jerarquía visual clara.
 *
 * Presenta mensajes de error, advertencia, info o éxito con:
 * - Barra de acento izquierda (color por severidad)
 * - Ícono en contenedor de color suave
 * - Título prominente + contenido proyectado vía ng-content
 * - Acción inline opcional (ej: "Ver detalles", "Reintentar")
 * - Botón de descarte opcional
 *
 * El host tiene `role="alert"` — los lectores de pantalla lo anuncian
 * automáticamente al insertar el elemento en el DOM.
 *
 * @example
 * <!-- Info básica -->
 * <app-alert-card title="Actualización disponible">
 *   Se publicó la versión 2.1 con mejoras de rendimiento.
 * </app-alert-card>
 *
 * <!-- Error con acción -->
 * <app-alert-card
 *   severity="error"
 *   title="No se pudo guardar"
 *   actionLabel="Reintentar"
 *   (action)="saveData()"
 * >
 *   Hubo un problema al conectarse con el servidor.
 * </app-alert-card>
 *
 * <!-- Éxito descartable -->
 * <app-alert-card
 *   severity="success"
 *   title="Cambios guardados"
 *   [dismissible]="true"
 *   (dismissed)="showAlert.set(false)"
 * />
 */
@Component({
  selector: 'app-alert-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PressFeedbackDirective],
  host: {
    class: 'card flex items-start gap-3 relative overflow-hidden pl-4',
    '[class.alert-error]': 'severity() === "error"',
    '[class.alert-warning]': 'severity() === "warning"',
    '[class.alert-info]': 'severity() === "info"',
    '[class.alert-success]': 'severity() === "success"',
    role: 'alert',
  },
  template: `
    <!-- Barra de acento izquierda — comunica severidad al instante -->
    <div
      class="absolute left-0 top-0 h-full w-[3px]"
      [style.background]="accentColor()"
      aria-hidden="true"
    ></div>

    <!-- Ícono en contenedor de color suave -->
    <div
      class="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg mt-0.5"
      [style.background]="iconBg()"
      aria-hidden="true"
    >
      <app-icon [name]="iconName()" [size]="16" [style.color]="accentColor()" />
    </div>

    <!-- Contenido principal -->
    <div class="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
      <p class="m-0 text-sm font-semibold text-text-primary">{{ title() }}</p>

      <!-- Cuerpo libre — proyectado por el consumidor -->
      <div class="text-sm text-text-secondary leading-relaxed">
        <ng-content />
      </div>

      @if (actionLabel()) {
        <button
          type="button"
          class="self-start mt-0.5 text-xs font-semibold cursor-pointer border-none bg-transparent p-0 underline-offset-2 hover:underline"
          [style.color]="accentColor()"
          [appPressFeedback]="'press'"
          (click)="action.emit()"
        >
          {{ actionLabel() }}
        </button>
      }
    </div>

    <!-- Botón de descarte (opcional) -->
    @if (dismissible()) {
      <button
        type="button"
        class="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer border-none bg-transparent p-0 self-start"
        style="color: var(--text-muted)"
        [appPressFeedback]="'press'"
        aria-label="Cerrar"
        (click)="dismissed.emit()"
      >
        <app-icon name="x" [size]="14" />
      </button>
    }
  `,
})
export class AlertCardComponent {
  /** Nivel de severidad. Controla colores e ícono. Default: 'info'. */
  readonly severity = input<AlertSeverity>('info');

  /** Título de la alerta (requerido — frase corta y accionable). */
  readonly title = input.required<string>();

  /** Texto del botón inline de acción (ej: "Reintentar", "Ver detalles"). */
  readonly actionLabel = input<string>();

  /** Si true, muestra el botón X de descarte en la esquina superior derecha. */
  readonly dismissible = input<boolean>(false);

  /** Emitido al hacer clic en el botón de acción. */
  readonly action = output<void>();

  /** Emitido al hacer clic en el botón de descarte (X). */
  readonly dismissed = output<void>();

  // ── Computed internos — derivados de severity ─────────────────────────────

  protected readonly iconName = computed<string>(() => {
    const icons: Record<AlertSeverity, string> = {
      error:   'alert-circle',
      warning: 'alert-triangle',
      info:    'info',
      success: 'check-circle',
    };
    return icons[this.severity()];
  });

  protected readonly accentColor = computed<string>(() => {
    const colors: Record<AlertSeverity, string> = {
      error:   'var(--state-error)',
      warning: 'var(--state-warning)',
      info:    'var(--color-primary)',
      success: 'var(--state-success)',
    };
    return colors[this.severity()];
  });

  protected readonly iconBg = computed<string>(() => {
    const bgs: Record<AlertSeverity, string> = {
      error:   'var(--state-error-bg)',
      warning: 'var(--state-warning-bg)',
      info:    'var(--color-primary-muted)',
      success: 'var(--state-success-bg)',
    };
    return bgs[this.severity()];
  });
}
