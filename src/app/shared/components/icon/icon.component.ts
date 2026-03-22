import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/**
 * IconComponent — Átomo de ícono (Lucide Angular).
 *
 * Wrapper estricto sobre <lucide-icon> que garantiza proporciones consistentes:
 * - stroke-width forzado en 2px con absoluteStrokeWidth (no escala con el tamaño)
 * - color: currentColor heredado del padre por defecto
 * - aria-hidden="true" por defecto (tratado como decorativo)
 *
 * Los íconos disponibles se registran globalmente en app.config.ts via provideIcons().
 * Para agregar un ícono nuevo, impórtalo de 'lucide-angular' y agrégalo al objeto de provideIcons().
 *
 * @example
 * <!-- Uso básico (tamaño 16px por defecto) -->
 * <app-icon name="settings" />
 *
 * <!-- Con tamaño personalizado -->
 * <app-icon name="trending-up" [size]="20" />
 *
 * <!-- Ícono interactivo con label accesible en el botón padre -->
 * <button aria-label="Eliminar registro">
 *   <app-icon name="trash-2" [size]="16" />
 * </button>
 *
 * <!-- Ícono semántico (visible para AT) -->
 * <app-icon name="circle-alert" [size]="20" [ariaHidden]="false" ariaLabel="Error de validación" />
 *
 * PROHIBIDO:
 * ❌ Usar emojis como íconos de UI (✅, ⚠️, 🔒)
 * ❌ Usar SVG inline ad-hoc sin pasar por este wrapper
 * ❌ Cambiar stroke-width fuera de este componente
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <lucide-icon
      [name]="name()"
      [size]="size()"
      [strokeWidth]="2"
      [absoluteStrokeWidth]="true"
      [color]="color()"
      [attr.aria-hidden]="ariaHidden() ? 'true' : null"
      [attr.aria-label]="!ariaHidden() ? ariaLabel() : null"
    />
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 0;
    }
  `]
})
export class IconComponent {
  /** Nombre del ícono en kebab-case tal como aparece en lucide.dev (ej: "settings", "trending-up", "trash-2") */
  readonly name = input.required<string>();

  /** Tamaño en px. Valores recomendados: 12, 14, 16, 18, 20, 24 */
  readonly size = input<number>(16);

  /** Color CSS. Default: currentColor — hereda el color del elemento padre */
  readonly color = input<string>('currentColor');

  /**
   * Ocultar de lectores de pantalla.
   * true  → decorativo, AT lo ignora (default)
   * false → semántico, requiere ariaLabel
   */
  readonly ariaHidden = input<boolean>(true);

  /** Label para AT cuando el ícono tiene significado semántico (ariaHidden: false) */
  readonly ariaLabel = input<string | undefined>(undefined);
}
