import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { AnimateInDirective } from '@core/directives/animate-in.directive';

/** Tipo de severidad de la alerta. Controla color, ícono y fondo. */
export type AlertSeverity = 'error' | 'warning' | 'info' | 'success';

/**
 * AlertCardComponent — Nota de estado tintada por severidad.
 *
 * Superficie completa tintada (`--state-{severity}-bg`) + borde izquierdo real en el color
 * de estado — mismo idioma visual que el rail de alertas de Asistencia B
 * (`border-l-[3px]` + color por token). `severity="info"` usa `--state-info`, no el azul de
 * marca: "info" es un estado, no una promoción de marca (regla 3-2-1).
 *
 * La entrada anima sola vía `AnimateInDirective` (hostDirectives) — no requiere que el
 * consumidor agregue `appAnimateIn`.
 *
 * @example
 * <app-alert-card severity="error" title="No se pudo guardar">
 *   Hubo un problema al conectarse con el servidor.
 * </app-alert-card>
 */
@Component({
  selector: 'app-alert-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  hostDirectives: [AnimateInDirective],
  host: {
    class: 'card flex items-start gap-3',
    '[style.background]': 'tintBg()',
    '[style.border-left]': 'accentBorder()',
    role: 'alert',
  },
  template: `
    <app-icon
      [name]="iconName()"
      [size]="18"
      [style.color]="accentColor()"
      class="shrink-0 mt-0.5"
    />

    <div class="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
      <p class="item-title m-0">{{ title() }}</p>
      <div class="text-sm text-text-secondary leading-relaxed">
        <ng-content />
      </div>
    </div>
  `,
})
export class AlertCardComponent {
  /** Nivel de severidad. Controla colores e ícono. Default: 'info'. */
  readonly severity = input<AlertSeverity>('info');

  /** Título de la alerta (requerido — frase corta y accionable). */
  readonly title = input.required<string>();

  // ── Computed internos — derivados de severity ─────────────────────────────

  protected readonly iconName = computed<string>(() => {
    const icons: Record<AlertSeverity, string> = {
      error: 'circle-alert',
      warning: 'alert-triangle',
      info: 'info',
      success: 'circle-check',
    };
    return icons[this.severity()];
  });

  protected readonly accentColor = computed<string>(() => {
    const colors: Record<AlertSeverity, string> = {
      error: 'var(--state-error)',
      warning: 'var(--state-warning)',
      info: 'var(--state-info)',
      success: 'var(--state-success)',
    };
    return colors[this.severity()];
  });

  protected readonly tintBg = computed<string>(() => {
    const bgs: Record<AlertSeverity, string> = {
      error: 'var(--state-error-bg)',
      warning: 'var(--state-warning-bg)',
      info: 'var(--state-info-bg)',
      success: 'var(--state-success-bg)',
    };
    return bgs[this.severity()];
  });

  protected readonly accentBorder = computed<string>(() => `3px solid ${this.accentColor()}`);
}
