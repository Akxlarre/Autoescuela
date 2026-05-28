import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SelectModule } from 'primeng/select';
import type { EgresoFormData } from '@core/models/ui/cuadratura.model';

@Component({
  selector: 'app-egreso-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, SelectModule],
  template: `
    @if (isOpen()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-40"
        class="bg-black/40" style="backdrop-filter: blur(2px)"
        aria-hidden="true"
        (click)="onCerrar()"
      ></div>

      <!-- Panel modal -->
      <div
        class="fixed z-50 flex flex-col bg-surface border border-border-muted"
        style="top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(480px, calc(100vw - 32px)); border-radius: var(--radius-lg, 12px); box-shadow: 0 24px 48px rgba(0,0,0,0.18)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="egreso-modal-title"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-border-muted"
          
        >
          <div class="flex items-center gap-2.5">
            <app-icon name="minus-circle" [size]="18" color="var(--state-warning)" />
            <h2 id="egreso-modal-title" class="text-base font-semibold text-text-primary">
              Registrar Egreso
            </h2>
          </div>
          <button
            class="flex items-center justify-center w-8 h-8 rounded-lg opacity-60 hover:opacity-100 transition-opacity text-text-muted"
            aria-label="Cerrar modal de egreso"
            (click)="onCerrar()"
          >
            <app-icon name="x" [size]="16" />
          </button>
        </div>

        <!-- Formulario -->
        <form [formGroup]="form" class="flex flex-col gap-5 px-6 py-5" (ngSubmit)="onSubmit()">
          <!-- Tipo de egreso -->
          <div class="flex flex-col gap-1.5">
            <label
              for="egreso-tipo"
              class="text-xs font-semibold uppercase tracking-wide text-text-muted"
            >
              Tipo de Egreso <span class="text-error">*</span>
            </label>
            <p-select
              formControlName="tipo"
              [options]="tipoOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccionar tipo..."
              styleClass="w-full"
              data-llm-description="Selector del tipo de egreso: gasto varios o anticipo a instructor"
            />
            @if (form.get('tipo')?.invalid && form.get('tipo')?.touched) {
              <p class="text-xs text-error" >Seleccione un tipo de egreso.</p>
            }
          </div>

          <!-- Monto -->
          <div class="flex flex-col gap-1.5">
            <label
              for="egreso-monto"
              class="text-xs font-semibold uppercase tracking-wide text-text-muted"
            >
              Monto (CLP) <span class="text-error">*</span>
            </label>
            <div class="relative">
              <span
                class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold pointer-events-none text-text-muted"
              >
                $
              </span>
              <input
                id="egreso-monto"
                type="number"
                min="1"
                formControlName="monto"
                class="w-full text-sm pl-7 pr-3 py-2.5 rounded-lg bg-surface border border-border-muted text-text-primary outline-none"
                
                placeholder="0"
                data-llm-description="Monto del egreso en pesos chilenos"
                [style.borderColor]="
                  form.get('monto')?.invalid && form.get('monto')?.touched
                    ? 'var(--state-error)'
                    : 'var(--border-muted)'
                "
              />
            </div>
            @if (form.get('monto')?.hasError('required') && form.get('monto')?.touched) {
              <p class="text-xs text-error" >Ingrese el monto.</p>
            } @else if (form.get('monto')?.hasError('min') && form.get('monto')?.touched) {
              <p class="text-xs text-error" >El monto debe ser mayor a 0.</p>
            }
          </div>

          <!-- Descripción / Motivo -->
          <div class="flex flex-col gap-1.5">
            <label
              for="egreso-descripcion"
              class="text-xs font-semibold uppercase tracking-wide text-text-muted"
            >
              {{ tipoLabel() }} <span class="text-error">*</span>
            </label>
            <input
              id="egreso-descripcion"
              type="text"
              formControlName="descripcion"
              class="w-full text-sm px-3 py-2.5 rounded-lg bg-surface border border-border-muted text-text-primary outline-none"
              
              [placeholder]="tipoPlaceholder()"
              data-llm-description="Descripción o motivo del egreso"
              [style.borderColor]="
                form.get('descripcion')?.invalid && form.get('descripcion')?.touched
                  ? 'var(--state-error)'
                  : 'var(--border-muted)'
              "
            />
            @if (form.get('descripcion')?.invalid && form.get('descripcion')?.touched) {
              <p class="text-xs text-error" >
                Ingrese una descripción o motivo.
              </p>
            }
          </div>

          <!-- Fecha (display-only) -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Fecha
            </label>
            <div
              class="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg bg-surface border border-border-muted text-text-muted"
              
            >
              <app-icon name="calendar" [size]="14" />
              {{ fechaHoy() }}
              <span class="text-xs ml-auto">(Hoy — no modificable)</span>
            </div>
          </div>
        </form>

        <!-- Footer con botones -->
        <div
          class="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-muted"
          
        >
          <button
            type="button"
            class="text-sm font-medium px-4 py-2 rounded-lg bg-surface border border-border-muted text-text-primary"
            
            [disabled]="isSaving()"
            aria-label="Cancelar registro de egreso"
            (click)="onCerrar()"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg btn-primary transition-opacity"
            [disabled]="form.invalid || isSaving()"
            [style.opacity]="form.invalid || isSaving() ? '0.6' : '1'"
            data-llm-action="guardar-egreso-cuadratura"
            aria-label="Guardar egreso en caja"
            (click)="onSubmit()"
          >
            @if (isSaving()) {
              <app-icon name="loader" [size]="14" />
              Guardando...
            } @else {
              <app-icon name="check" [size]="14" />
              Guardar Egreso
            }
          </button>
        </div>
      </div>
    }
  `,
})
export class EgresoModalComponent {
  readonly tipoOptions = [
    { label: 'Gasto Varios', value: 'gasto' },
    { label: 'Anticipo a Instructor', value: 'anticipo' },
  ];

  private readonly fb = inject(FormBuilder);

  // ── Inputs ────────────────────────────────────────────────────────────────
  readonly isOpen = input<boolean>(false);
  readonly isSaving = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────
  readonly guardar = output<EgresoFormData>();
  readonly cerrado = output<void>();

  // ── Formulario ────────────────────────────────────────────────────────────
  readonly form = this.fb.group({
    tipo: ['', Validators.required],
    monto: [null as number | null, [Validators.required, Validators.min(1)]],
    descripcion: ['', [Validators.required, Validators.minLength(3)]],
  });

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly tipoLabel = computed(() => {
    const tipo = this.form.get('tipo')?.value;
    return tipo === 'anticipo' ? 'Motivo del anticipo' : 'Descripción / Motivo';
  });

  readonly tipoPlaceholder = computed(() => {
    const tipo = this.form.get('tipo')?.value;
    return tipo === 'anticipo'
      ? 'Ej: Anticipo por combustible...'
      : 'Ej: Compra insumos oficina...';
  });

  readonly fechaHoy = computed(() =>
    new Date().toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  );

  // Resetea el form cuando el modal se cierra
  private readonly _resetOnClose = effect(() => {
    if (!this.isOpen()) {
      this.form.reset();
    }
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { tipo, monto, descripcion } = this.form.getRawValue();
    this.guardar.emit({
      tipo: tipo as 'gasto' | 'anticipo',
      monto: Number(monto),
      descripcion: descripcion ?? '',
    });
  }

  protected onCerrar(): void {
    this.cerrado.emit();
  }
}
