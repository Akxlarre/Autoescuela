import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

/**
 * AsyncBtnComponent — Botón primario con estados loading / success / error integrados.
 *
 * Ciclo de vida del estado:
 *   idle → loading (spinner) → success (check + bounce) → idle (auto-reset en 1.8s)
 *   idle → loading (spinner) → error  (shake + texto de error)  → idle (auto-reset en 2s)
 *
 * @example
 * <!-- Uso estándar con éxito/error -->
 * <app-async-btn
 *   label="Guardar"
 *   icon="save"
 *   [loading]="isSaving()"
 *   [success]="saved()"
 *   [error]="saveFailed()"
 *   (click)="onSave()"
 * />
 */
@Component({
  selector: 'app-async-btn',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #btn
      type="button"
      [disabled]="isDisabledOrLoading()"
      class="cursor-pointer px-8 py-2.5 text-sm font-semibold rounded-lg shadow-sm
             flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
             transition-colors duration-200"
      [class.opacity-50]="isDisabledOrLoading() && !loading()"
      [style.background]="btnBg()"
      [style.color]="btnColor()"
    >
      @switch (activeState()) {
        @case ('loading') {
          <app-icon name="loader" [size]="14" class="animate-spin" aria-hidden="true" />
          <span>{{ loadingLabel() }}</span>
        }
        @case ('success') {
          <app-icon name="check" [size]="14" aria-hidden="true" />
          <span>{{ successLabel() }}</span>
        }
        @case ('error') {
          <app-icon name="x" [size]="14" aria-hidden="true" />
          <span>{{ errorLabel() }}</span>
        }
        @default {
          <span>{{ label() }}</span>
          @if (icon()) {
            <app-icon [name]="icon()!" [size]="14" />
          }
        }
      }
    </button>
  `,
})
export class AsyncBtnComponent {
  // ── Inputs ────────────────────────────────────────────────────────────────
  readonly label = input.required<string>();
  /** Nombre Lucide del ícono decorativo (kebab-case). Se oculta durante loading. */
  readonly icon = input<string | null>(null);
  /** Muestra spinner y deshabilita mientras está en true. */
  readonly loading = input<boolean>(false);
  /** Al pasar a true: muestra checkmark + bounce premium, luego auto-resetea. */
  readonly success = input<boolean>(false);
  /** Al pasar a true: muestra X + shake, luego auto-resetea. */
  readonly error = input<boolean>(false);
  /** Deshabilita por condición de negocio (ej: formulario inválido). */
  readonly disabled = input<boolean>(false);
  /** Texto mientras loading = true. */
  readonly loadingLabel = input<string>('Procesando...');
  /** Texto mientras success = true (1.8s). */
  readonly successLabel = input<string>('¡Guardado!');
  /** Texto mientras error = true (2s). */
  readonly errorLabel = input<string>('Error al guardar');

  // ── State ─────────────────────────────────────────────────────────────────
  readonly isDisabledOrLoading = computed(() => this.disabled() || this.loading());

  /** Estado activo visible: controla qué slot del switch renderizar. */
  protected readonly activeState = signal<'idle' | 'loading' | 'success' | 'error'>('idle');

  protected readonly btnBg = computed(() => {
    switch (this.activeState()) {
      case 'success': return 'var(--state-success, #22c55e)';
      case 'error':   return 'var(--state-error, #ef4444)';
      default:        return 'var(--btn-primary-bg)';
    }
  });

  protected readonly btnColor = computed(() => {
    switch (this.activeState()) {
      case 'success':
      case 'error':   return '#fff';
      default:        return 'var(--btn-primary-text)';
    }
  });

  // ── GSAP + DOM ─────────────────────────────────────────────────────────────
  private readonly btnRef = viewChild<ElementRef<HTMLElement>>('btn');
  private readonly gsap = inject(GsapAnimationsService);

  private successTimer?: ReturnType<typeof setTimeout>;
  private errorTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Sincronizar estado externo → activeState + animaciones
    effect(() => {
      const isLoading = this.loading();
      const isSuccess = this.success();
      const isError   = this.error();

      if (isLoading) {
        this.activeState.set('loading');
        return;
      }

      if (isSuccess) {
        this.triggerSuccess();
        return;
      }

      if (isError) {
        this.triggerError();
        return;
      }

      // Volver a idle solo si no estamos en un estado temporal con timer activo
      if (!this.successTimer && !this.errorTimer) {
        this.activeState.set('idle');
      }
    });
  }

  private triggerSuccess(): void {
    clearTimeout(this.successTimer);
    clearTimeout(this.errorTimer);
    this.errorTimer = undefined;

    this.activeState.set('success');

    const el = this.btnRef()?.nativeElement;
    if (el) {
      this.gsap.animateSuccessFeedback(el);
    }

    // Auto-reset tras 1.8s
    this.successTimer = setTimeout(() => {
      this.activeState.set('idle');
      this.successTimer = undefined;
    }, 1800);
  }

  private triggerError(): void {
    clearTimeout(this.successTimer);
    clearTimeout(this.errorTimer);
    this.successTimer = undefined;

    this.activeState.set('error');

    const el = this.btnRef()?.nativeElement;
    if (el) {
      this.gsap.animateFormError(el);
    }

    // Auto-reset tras 2s
    this.errorTimer = setTimeout(() => {
      this.activeState.set('idle');
      this.errorTimer = undefined;
    }, 2000);
  }
}
