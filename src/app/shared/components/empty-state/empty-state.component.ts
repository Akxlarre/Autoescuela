import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { PressFeedbackDirective } from '@core/directives/press-feedback.directive';

/**
 * EmptyStateComponent — Estado vacío unificado.
 *
 * Úsalo en lugar de texto plano cuando una lista, búsqueda o sección
 * no tiene datos que mostrar. Combina ícono ilustrativo, mensaje y una
 * acción de recuperación opcional.
 *
 * El host tiene `role="status"` y `aria-label` igual al mensaje principal
 * para que los lectores de pantalla anuncien el estado vacío.
 *
 * @example
 * <!-- Sin datos (mínimo) -->
 * <app-empty-state message="No hay transacciones todavía." />
 *
 * <!-- Con ícono, subtítulo y acción -->
 * <app-empty-state
 *   icon="search"
 *   message="Sin resultados"
 *   subtitle="Intenta con otros términos de búsqueda."
 *   actionLabel="Limpiar filtros"
 *   actionIcon="x"
 *   (action)="resetFilters()"
 * />
 *
 * <!-- Con ícono de sección específica (registrar en provideIcons) -->
 * <app-empty-state
 *   icon="users"
 *   message="No tienes usuarios todavía"
 *   subtitle="Invita a tu equipo para empezar a colaborar."
 *   actionLabel="Invitar usuario"
 *   (action)="openInviteModal()"
 * />
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PressFeedbackDirective],
  host: {
    class: 'flex flex-col items-center justify-center gap-4 py-12 px-6 text-center',
    role: 'status',
    '[attr.aria-label]': 'message()',
  },
  template: `
    @if (icon()) {
      <!-- Contenedor ilustrativo del ícono -->
      <div
        class="flex items-center justify-center w-16 h-16 rounded-2xl flex-shrink-0"
        style="background: var(--bg-subtle)"
        aria-hidden="true"
      >
        <app-icon [name]="icon()!" [size]="32" style="color: var(--text-muted)" />
      </div>
    }

    <!-- Texto principal -->
    <div class="flex flex-col gap-1.5 max-w-[280px]">
      <p class="m-0 text-sm font-semibold text-text-primary">{{ message() }}</p>
      @if (subtitle()) {
        <p class="m-0 text-sm" style="color: var(--text-muted)">{{ subtitle() }}</p>
      }
    </div>

    <!-- Acción de recuperación (opcional) -->
    @if (actionLabel()) {
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border cursor-pointer"
        style="border-color: var(--border-subtle); background: var(--bg-elevated); color: var(--text-secondary)"
        [appPressFeedback]="'press'"
        (click)="action.emit()"
        [attr.aria-label]="actionLabel()"
      >
        @if (actionIcon()) {
          <app-icon [name]="actionIcon()!" [size]="14" />
        }
        {{ actionLabel() }}
      </button>
    }
  `,
})
export class EmptyStateComponent {
  /**
   * Mensaje principal. Se muestra en bold y se usa como aria-label del host.
   * Debe ser una oración completa y descriptiva (ej: "No hay usuarios todavía").
   */
  readonly message = input.required<string>();

  /** Subtítulo con contexto o instrucciones adicionales. */
  readonly subtitle = input<string>();

  /**
   * Nombre Lucide del ícono ilustrativo (kebab-case — ver lucide.dev).
   * El ícono debe estar registrado en provideIcons() en app.config.ts.
   * Si se omite, no se renderiza ningún ícono.
   * @example 'search', 'users', 'download', 'bar-chart-2'
   */
  readonly icon = input<string>();

  /** Texto del botón de acción. Si se omite, el botón no se renderiza. */
  readonly actionLabel = input<string>();

  /**
   * Ícono Lucide del botón de acción (kebab-case).
   * Solo visible si actionLabel también está presente.
   * Default: 'plus'.
   */
  readonly actionIcon = input<string>('plus');

  /** Emitido al hacer clic en el botón de acción. */
  readonly action = output<void>();
}
