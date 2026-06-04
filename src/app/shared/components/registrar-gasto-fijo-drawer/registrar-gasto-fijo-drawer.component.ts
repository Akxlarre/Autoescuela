import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SelectModule } from 'primeng/select';
import {
  GASTO_FIJO_CATEGORIES,
  type RegistrarGastoFijoPayload,
} from '@core/models/ui/reportes-contables.model';

@Component({
  selector: 'app-registrar-gasto-fijo-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, SelectModule],
  template: `
    @if (visible()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-40 bg-black/40"
        style="backdrop-filter: blur(2px)"
        aria-hidden="true"
        (click)="onCerrar()"
      ></div>

      <!-- Panel -->
      <div
        class="fixed inset-y-0 right-0 z-50 flex flex-col w-full md:w-[420px] shadow-2xl"
        style="background: var(--bg-surface)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gasto-fijo-title"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-6 py-5 border-b"
          style="border-color: var(--border-muted)"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style="background: color-mix(in srgb, var(--state-error) 10%, transparent)"
            >
              <app-icon name="receipt" [size]="18" color="var(--state-error)" />
            </div>
            <div>
              <h2
                id="gasto-fijo-title"
                class="text-base font-bold"
                style="color: var(--text-primary)"
              >
                Registrar Gasto Fijo
              </h2>
              <p class="text-xs" style="color: var(--text-muted)">
                Solo visible en Reportes Contables
              </p>
            </div>
          </div>
          <button
            type="button"
            class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style="color: var(--text-muted)"
            aria-label="Cerrar panel"
            (click)="onCerrar()"
          >
            <app-icon name="x" [size]="18" />
          </button>
        </div>

        <!-- Formulario -->
        <form
          [formGroup]="form"
          (ngSubmit)="onGuardar()"
          class="flex flex-col flex-1 overflow-y-auto px-6 py-6 gap-5"
        >
          <!-- Categoría -->
          <div class="flex flex-col gap-1.5">
            <label
              class="text-xs font-semibold uppercase tracking-wider"
              style="color: var(--text-muted)"
            >
              Categoría *
            </label>
            <p-select
              formControlName="category"
              [options]="categorias"
              optionLabel="label"
              optionValue="value"
              placeholder="Selecciona una categoría"
              styleClass="w-full"
              data-llm-description="categoría del gasto fijo administrativo"
            />
            @if (form.get('category')?.invalid && form.get('category')?.touched) {
              <span class="text-xs" style="color: var(--state-error)"
                >Selecciona una categoría</span
              >
            }
          </div>

          <!-- Descripción -->
          <div class="flex flex-col gap-1.5">
            <label
              class="text-xs font-semibold uppercase tracking-wider"
              style="color: var(--text-muted)"
            >
              Descripción *
            </label>
            <input
              type="text"
              formControlName="description"
              class="h-10 px-3 rounded-xl text-sm outline-none transition-all"
              style="background: var(--bg-subtle); border: 1px solid var(--border-muted); color: var(--text-primary)"
              placeholder="Ej: Arriendo mayo 2026"
              data-llm-description="descripción del gasto fijo"
            />
            @if (form.get('description')?.invalid && form.get('description')?.touched) {
              <span class="text-xs" style="color: var(--state-error)"
                >La descripción es obligatoria</span
              >
            }
          </div>

          <!-- Monto -->
          <div class="flex flex-col gap-1.5">
            <label
              class="text-xs font-semibold uppercase tracking-wider"
              style="color: var(--text-muted)"
            >
              Monto (CLP) *
            </label>
            <input
              type="number"
              formControlName="amount"
              class="h-10 px-3 rounded-xl text-sm outline-none transition-all"
              style="background: var(--bg-subtle); border: 1px solid var(--border-muted); color: var(--text-primary)"
              placeholder="Ej: 450000"
              min="1"
              data-llm-description="monto en pesos chilenos del gasto fijo"
            />
            @if (form.get('amount')?.invalid && form.get('amount')?.touched) {
              <span class="text-xs" style="color: var(--state-error)"
                >Ingresa un monto válido mayor a 0</span
              >
            }
          </div>

          <!-- Fecha -->
          <div class="flex flex-col gap-1.5">
            <label
              class="text-xs font-semibold uppercase tracking-wider"
              style="color: var(--text-muted)"
            >
              Fecha *
            </label>
            <input
              type="date"
              formControlName="date"
              class="h-10 px-3 rounded-xl text-sm outline-none transition-all"
              style="background: var(--bg-subtle); border: 1px solid var(--border-muted); color: var(--text-primary)"
              data-llm-description="fecha en que ocurrió o se registra el gasto fijo"
            />
            @if (form.get('date')?.invalid && form.get('date')?.touched) {
              <span class="text-xs" style="color: var(--state-error)">La fecha es obligatoria</span>
            }
          </div>
        </form>

        <!-- Footer -->
        <div
          class="px-6 py-5 border-t flex gap-3"
          style="border-color: var(--border-muted); background: var(--bg-subtle)"
        >
          <button
            type="button"
            class="flex-1 h-10 rounded-xl text-sm font-semibold border transition-colors"
            style="color: var(--text-secondary); border-color: var(--border-muted); background: var(--bg-surface)"
            (click)="onCerrar()"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="flex-1 h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 btn-primary transition-all active:scale-[0.98]"
            [disabled]="form.invalid || isSaving()"
            [style.opacity]="form.invalid || isSaving() ? '0.6' : '1'"
            data-llm-action="guardar-gasto-fijo"
            (click)="onGuardar()"
          >
            @if (isSaving()) {
              <app-icon name="loader" [size]="16" class="animate-spin" />
              Guardando...
            } @else {
              <app-icon name="save" [size]="16" />
              Guardar Gasto
            }
          </button>
        </div>
      </div>
    }
  `,
})
export class RegistrarGastoFijoDrawerComponent {
  readonly visible = input<boolean>(false);
  readonly isSaving = input<boolean>(false);

  readonly guardar = output<RegistrarGastoFijoPayload>();
  readonly cerrar = output<void>();

  protected readonly categorias = [...GASTO_FIJO_CATEGORIES];

  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    category: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(3)]],
    amount: [0, [Validators.required, Validators.min(1)]],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
  });

  /** Resetea el formulario cada vez que el drawer se abre. */
  private readonly _resetEffect = effect(() => {
    if (this.visible()) {
      this.form.reset({
        category: '',
        description: '',
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
      });
    }
  });

  protected onGuardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { category, description, amount, date } = this.form.getRawValue();
    this.guardar.emit({
      category: category as RegistrarGastoFijoPayload['category'],
      description,
      amount,
      date,
    });
  }

  protected onCerrar(): void {
    this.cerrar.emit();
  }
}
