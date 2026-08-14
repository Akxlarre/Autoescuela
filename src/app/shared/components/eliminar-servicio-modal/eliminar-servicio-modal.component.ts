import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { ModalOverlayDirective } from '@core/directives/modal-overlay.directive';
import { StableWidthDirective } from '@core/directives/stable-width.directive';

/**
 * Modal de confirmación para borrar un servicio del Catálogo de forma DEFINITIVA (fix-024-i).
 *
 * Solo se ofrece desde una tarjeta ya Inactiva (borrado suave previo, fix-022-i). Exige
 * escribir "ELIMINAR" antes de habilitar el botón — mismo patrón de confirmación por texto
 * que `app-eliminar-alumno-modal`, pero sin modo simple: acá siempre es irreversible.
 */
@Component({
  selector: 'app-eliminar-servicio-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, AnimateInDirective, StableWidthDirective],
  hostDirectives: [
    {
      directive: ModalOverlayDirective,
      inputs: ['appModalOverlay: visible'],
    },
  ],
  styles: [
    `
      .confirm-input {
        width: 100%;
        height: 2.5rem;
        padding: 0 0.75rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        background: var(--surface);
        border: 1px solid var(--border-default);
        color: var(--text-primary);
        outline: none;
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .confirm-input:focus {
        border-color: var(--state-error);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--state-error) 20%, transparent);
      }
      .confirm-input--error {
        border-color: var(--state-error);
      }
      .confirm-input--error:focus {
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--state-error) 12%, transparent);
      }
    `,
  ],
  template: `
    @if (visible()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-(--overlay-backdrop) backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Confirmar eliminación definitiva de ' + servicioNombre()"
        (click)="onCancelar()"
        (document:keydown.escape)="onCancelar()"
      >
        <!-- Card -->
        <div
          class="relative w-full max-w-md rounded-2xl shadow-2xl flex flex-col gap-0 overflow-hidden bg-surface"
          (click)="$event.stopPropagation()"
          appAnimateIn
        >
          <!-- Header -->
          <div class="flex items-center gap-3 px-6 py-5 border-b border-border-subtle">
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style="background:var(--state-error-bg);border:1px solid var(--state-error-border)"
            >
              <app-icon name="triangle-alert" [size]="20" color="var(--state-error)" />
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-bold text-base">Eliminar definitivamente</span>
              <span class="text-xs truncate text-text-muted">
                {{ servicioNombre() }}
              </span>
            </div>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 flex flex-col gap-4">
            <div
              class="flex items-start gap-3 p-4 rounded-xl bg-error-subtle"
              style="border: 1px solid var(--state-error-border)"
            >
              <app-icon
                name="circle-alert"
                [size]="16"
                color="var(--state-error)"
                class="shrink-0 mt-0.5"
              />
              <p class="text-sm leading-relaxed m-0 text-text-primary">
                Esta acción <strong>no se puede deshacer</strong>. El servicio desaparece del
                catálogo para siempre. Sus ventas ya registradas se conservan en el Historial (con
                el nombre del servicio guardado), pero dejan de estar vinculadas a él.
              </p>
            </div>

            <!-- Campo de confirmación por texto -->
            <div class="flex flex-col gap-2">
              <label for="confirm-text" class="text-sm font-medium text-text-secondary">
                Para confirmar, escribe
                <span
                  class="font-bold font-mono px-1.5 py-0.5 rounded bg-elevated text-text-primary"
                  >ELIMINAR</span
                >
                en el campo:
              </label>
              <input
                #confirmInput
                id="confirm-text"
                type="text"
                [ngModel]="confirmTextValue()"
                (ngModelChange)="confirmTextValue.set($event)"
                placeholder="Escribe ELIMINAR"
                class="confirm-input"
                [class.confirm-input--error]="confirmTextValue().length > 0 && !canConfirm()"
                data-llm-description="confirmation text field — user must type 'ELIMINAR' to enable permanent delete"
                autocomplete="off"
              />
              @if (confirmTextValue().length > 0 && !canConfirm()) {
                <span class="text-xs text-error">
                  Escribe exactamente "ELIMINAR" para continuar.
                </span>
              }
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle">
            <button
              type="button"
              class="btn-neutral"
              [disabled]="isDeleting()"
              (click)="onCancelar()"
              data-llm-action="cancel-delete-service-definitive"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="btn-danger-solid"
              [disabled]="!canConfirm() || isDeleting()"
              [appStableWidth]="isDeleting()"
              (click)="onConfirmar()"
              data-llm-action="confirm-delete-service-definitive"
            >
              @if (isDeleting()) {
                <app-icon name="loader-circle" [size]="14" class="animate-spin" />
                Eliminando...
              } @else {
                <app-icon name="trash-2" [size]="14" />
                Eliminar definitivamente
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EliminarServicioModalComponent {
  readonly visible = input.required<boolean>();
  readonly servicioNombre = input.required<string>();
  readonly isDeleting = input(false);

  readonly confirmado = output<void>();
  readonly cancelado = output<void>();

  protected readonly confirmTextValue = signal('');
  private readonly confirmInput = viewChild<ElementRef<HTMLInputElement>>('confirmInput');

  protected readonly canConfirm = computed(
    () => !this.isDeleting() && this.confirmTextValue().trim() === 'ELIMINAR',
  );

  constructor() {
    effect(() => {
      const isVisible = this.visible();
      if (isVisible) {
        untracked(() => {
          this.confirmTextValue.set('');
        });
        setTimeout(() => {
          this.confirmInput()?.nativeElement.focus();
        }, 50);
      }
    });
  }

  protected onCancelar(): void {
    this.confirmTextValue.set('');
    this.cancelado.emit();
  }

  protected onConfirmar(): void {
    if (!this.canConfirm()) return;
    this.confirmTextValue.set('');
    this.confirmado.emit();
  }
}
