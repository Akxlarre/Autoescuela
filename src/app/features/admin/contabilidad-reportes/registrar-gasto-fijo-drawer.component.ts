import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SelectModule } from 'primeng/select';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { ReportesContablesFacade } from '@core/facades/reportes-contables.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import {
  GASTO_FIJO_CATEGORIES,
  type RegistrarGastoFijoPayload,
} from '@core/models/ui/reportes-contables.model';

/**
 * RegistrarGastoFijoDrawerComponent — Formulario Smart de gasto fijo.
 *
 * Renderizado vía LayoutDrawerFacadeService como NgComponentOutlet.
 * Inyecta ReportesContablesFacade directamente para persistir y refrescar datos.
 */
@Component({
  selector: 'app-registrar-gasto-fijo-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IconComponent,
    SelectModule,
    DateInputComponent,
    DrawerContentLoaderComponent,
    SkeletonBlockComponent,
  ],
  template: `
    <app-drawer-content-loader>
      <ng-template #skeletons>
        <div class="flex flex-col gap-4 p-5">
          <app-skeleton-block variant="text" width="100%" height="60px" />
          <app-skeleton-block variant="text" width="100%" height="60px" />
          <app-skeleton-block variant="text" width="100%" height="60px" />
          <app-skeleton-block variant="text" width="100%" height="60px" />
        </div>
      </ng-template>

      <ng-template #content>
        <!-- Cuerpo del formulario -->
        <div class="flex-1 overflow-y-auto p-5">
          <form [formGroup]="form" class="flex flex-col gap-5" (ngSubmit)="onGuardar()">
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
              <app-date-input
                label="Fecha"
                [required]="true"
                [value]="form.get('date')?.value ?? ''"
                (valueChange)="form.get('date')?.setValue($event); form.get('date')?.markAsTouched()"
                data-llm-description="fecha en que ocurrió o se registra el gasto fijo"
              />
              @if (form.get('date')?.invalid && form.get('date')?.touched) {
                <span class="text-xs" style="color: var(--state-error)"
                  >La fecha es obligatoria</span
                >
              }
            </div>

            @if (saveError()) {
              <div
                class="flex items-start gap-2 p-3 rounded-lg"
                style="background: color-mix(in srgb, var(--state-error) 8%, transparent)"
              >
                <app-icon name="circle-alert" [size]="15" color="var(--state-error)" />
                <p class="text-sm" style="color: var(--state-error)">{{ saveError() }}</p>
              </div>
            }
          </form>
        </div>

        <!-- Footer fijo -->
        <div
          class="p-5 border-t flex items-center justify-end gap-3 sticky bottom-0 z-20"
          style="background: var(--bg-surface); border-color: var(--border-muted)"
        >
          <button
            type="button"
            class="btn-secondary cursor-pointer"
            [disabled]="isSaving()"
            data-llm-action="cancelar-gasto-fijo"
            (click)="onCerrar()"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn-primary flex items-center gap-2 cursor-pointer"
            [disabled]="form.invalid || isSaving()"
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
      </ng-template>
    </app-drawer-content-loader>
  `,
})
export class RegistrarGastoFijoDrawerComponent {
  private readonly facade = inject(ReportesContablesFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly fb = inject(FormBuilder);

  protected readonly categorias = [...GASTO_FIJO_CATEGORIES];
  protected readonly isSaving = this.facade.isRegistrando;
  protected readonly saveError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    category: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(3)]],
    amount: [0, [Validators.required, Validators.min(1)]],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
  });

  protected async onGuardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saveError.set(null);
    const { category, description, amount, date } = this.form.getRawValue();
    const ok = await this.facade.registrarGastoFijo({
      category: category as RegistrarGastoFijoPayload['category'],
      description,
      amount,
      date,
    });
    if (ok) {
      this.layoutDrawer.close();
    } else {
      this.saveError.set('Ocurrió un error al guardar el gasto. Intenta de nuevo.');
    }
  }

  protected onCerrar(): void {
    this.layoutDrawer.close();
  }
}
