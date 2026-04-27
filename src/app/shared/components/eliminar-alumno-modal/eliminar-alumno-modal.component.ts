import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

/**
 * Modal de confirmación para archivar un alumno (soft-delete).
 *
 * Dos modos:
 * - Sin historial: confirmación simple (Archivar / Cancelar).
 * - Con historial: advertencia contable + campo de texto que exige escribir
 *   "borrarlo" antes de habilitar el botón.
 */
@Component({
  selector: 'app-eliminar-alumno-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
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
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Confirmar archivado de ' + alumnoNombre()"
      >
        <!-- Card -->
        <div
          class="relative w-full max-w-md rounded-2xl shadow-2xl flex flex-col gap-0 overflow-hidden"
          style="background: white"
        >
          <!-- Header -->
          <div
            class="flex items-center gap-3 px-6 py-5 border-b"
            style="border-color: var(--border-subtle);"
          >
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              [style.background]="
                hasHistory() ? 'var(--state-error-bg)' : 'var(--state-warning-bg)'
              "
              [style.border]="
                '1px solid ' +
                (hasHistory() ? 'var(--state-error-border)' : 'var(--state-warning-border)')
              "
            >
              <app-icon
                [name]="hasHistory() ? 'triangle-alert' : 'archive'"
                [size]="20"
                [color]="hasHistory() ? 'var(--state-error)' : 'var(--state-warning)'"
              />
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-bold text-base" style="color: var(--text-primary);">
                {{ hasHistory() ? 'Archivar con historial' : 'Archivar alumno' }}
              </span>
              <span class="text-xs truncate" style="color: var(--text-muted);">
                {{ alumnoNombre() }}
              </span>
            </div>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 flex flex-col gap-4">
            @if (hasHistory()) {
              <!-- Advertencia historial contable -->
              <div
                class="flex items-start gap-3 p-4 rounded-xl"
                style="background: var(--state-error-bg); border: 1px solid var(--state-error-border);"
              >
                <app-icon
                  name="circle-alert"
                  [size]="16"
                  color="var(--state-error)"
                  class="shrink-0 mt-0.5"
                />
                <p class="text-sm leading-relaxed m-0" style="color: var(--text-primary);">
                  Este alumno tiene <strong>registros de pagos o clases</strong>. Al archivarlo, sus
                  datos se preservarán, pero no aparecerá en los listados activos. Esto puede
                  <strong>afectar los reportes contables</strong>.
                </p>
              </div>

              <!-- Campo de confirmación por texto -->
              <div class="flex flex-col gap-2">
                <label
                  for="confirm-text"
                  class="text-sm font-medium"
                  style="color: var(--text-secondary);"
                >
                  Para confirmar, escribe
                  <span
                    class="font-bold font-mono px-1.5 py-0.5 rounded"
                    style="background: var(--bg-elevated); color: var(--text-primary);"
                    >borrarlo</span
                  >
                  en el campo:
                </label>
                <input
                  id="confirm-text"
                  type="text"
                  [ngModel]="confirmTextValue()"
                  (ngModelChange)="confirmTextValue.set($event)"
                  placeholder="Escribe borrarlo"
                  class="confirm-input"
                  [class.confirm-input--error]="confirmTextValue().length > 0 && !canConfirm()"
                  data-llm-description="confirmation text field — user must type 'borrarlo' to enable archive action"
                  autocomplete="off"
                />
                @if (confirmTextValue().length > 0 && !canConfirm()) {
                  <span class="text-xs" style="color: var(--state-error);">
                    Escribe exactamente "borrarlo" para continuar.
                  </span>
                }
              </div>
            } @else {
              <p class="text-sm leading-relaxed m-0" style="color: var(--text-secondary);">
                ¿Estás seguro de que deseas archivar a
                <strong style="color: var(--text-primary);">{{ alumnoNombre() }}</strong
                >? El alumno dejará de aparecer en el listado activo.
              </p>
            }
          </div>

          <!-- Footer -->
          <div
            class="flex items-center justify-end gap-3 px-6 py-4 border-t"
            style="border-color: var(--border-subtle);"
          >
            <button
              type="button"
              class="btn-neutral"
              [disabled]="isDeleting()"
              (click)="onCancelar()"
              data-llm-action="cancel-archive-student"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="btn-danger-solid"
              [disabled]="!canConfirm() || isDeleting()"
              (click)="onConfirmar()"
              data-llm-action="confirm-archive-student"
            >
              @if (isDeleting()) {
                <app-icon name="loader" [size]="14" class="animate-spin" />
                Archivando...
              } @else {
                <app-icon name="archive" [size]="14" />
                Archivar
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EliminarAlumnoModalComponent {
  readonly visible = input.required<boolean>();
  readonly alumnoNombre = input.required<string>();
  readonly hasHistory = input(false);
  readonly isDeleting = input(false);

  readonly confirmado = output<void>();
  readonly cancelado = output<void>();

  protected readonly confirmTextValue = signal('');

  protected readonly canConfirm = computed(
    () =>
      !this.isDeleting() &&
      (!this.hasHistory() || this.confirmTextValue().toLowerCase().trim() === 'borrarlo'),
  );

  constructor() {
    effect(() => {
      if (this.visible()) this.confirmTextValue.set('');
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
