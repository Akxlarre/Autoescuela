import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { AnticiosFacade } from '@core/facades/anticipos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';

const MOTIVO_OPTIONS = [
  { value: '', label: 'Sin categoría' },
  { value: 'salary', label: 'Anticipo de sueldo' },
  { value: 'allowance', label: 'Anticipo viático' },
  { value: 'materials', label: 'Anticipo materiales' },
  { value: 'other', label: 'Otros' },
];

@Component({
  selector: 'app-registrar-anticipo-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectModule, IconComponent, DateInputComponent],
  template: `
    <div class="flex flex-col h-full">
      <!-- Cuerpo del formulario -->
      <div class="flex-1 overflow-y-auto p-5">
        <form [formGroup]="form" class="flex flex-col gap-5" (ngSubmit)="onSubmit()">
          <!-- Instructor -->
          <div class="flex flex-col gap-1.5">
            <label for="ant-instructor" class="field-label">
              INSTRUCTOR <span class="text-error">*</span>
            </label>
            <p-select
              id="ant-instructor"
              formControlName="instructorId"
              [options]="facade.instructores()"
              optionLabel="nombre"
              optionValue="id"
              styleClass="w-full"
              placeholder="Seleccionar instructor..."
              data-llm-description="Selector del instructor al que se registra el anticipo"
              [class.field-input--error]="isInvalid('instructorId')"
            />
            @if (isInvalid('instructorId')) {
              <span class="field-error">Seleccione un instructor.</span>
            }
          </div>

          <!-- Fecha -->
          <div class="flex flex-col gap-1.5">
            <app-date-input
              label="Fecha"
              [required]="true"
              [value]="form.get('date')?.value ?? ''"
              (valueChange)="form.get('date')?.setValue($event); form.get('date')?.markAsTouched()"
              data-llm-description="Fecha del anticipo"
            />
            @if (isInvalid('date')) {
              <span class="field-error">Ingrese una fecha válida.</span>
            }
          </div>

          <!-- Monto -->
          <div class="flex flex-col gap-1.5">
            <label for="ant-monto" class="field-label">
              MONTO (CLP) <span class="text-error">*</span>
            </label>
            <div class="input-prefix-wrapper">
              <span class="input-prefix">$</span>
              <input
                id="ant-monto"
                type="number"
                formControlName="amount"
                placeholder="0"
                min="1"
                class="field-input pl-8"
                data-llm-description="Monto del anticipo en pesos chilenos"
                [class.field-input--error]="isInvalid('amount')"
              />
            </div>
            @if (isInvalid('amount')) {
              <span class="field-error">Ingrese un monto mayor a cero.</span>
            }
          </div>

          <!-- Motivo -->
          <div class="flex flex-col gap-1.5">
            <label for="ant-reason" class="field-label">MOTIVO</label>
            <p-select
              id="ant-reason"
              formControlName="reason"
              [options]="motivoOptions"
              optionLabel="label"
              optionValue="value"
              styleClass="w-full"
              data-llm-description="Categoría o motivo del anticipo"
            />
          </div>

          <!-- Descripción libre -->
          <div class="flex flex-col gap-1.5">
            <label for="ant-desc" class="field-label">DESCRIPCIÓN (opcional)</label>
            <textarea
              id="ant-desc"
              formControlName="description"
              rows="3"
              placeholder="Ej: Anticipo sueldo febrero, viatico terreno norte..."
              class="field-input resize-none"
              data-llm-description="Descripción libre del anticipo para el historial"
            ></textarea>
          </div>
        </form>
      </div>

      <!-- Footer de acciones -->
      <div class="border-t p-4 flex gap-3 border-border-subtle">
        <button
          type="button"
          class="btn-ghost flex-1"
          (click)="drawer.close()"
          [disabled]="facade.isSaving()"
          data-llm-action="cancel-anticipo"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary flex-1 flex items-center justify-center gap-2"
          (click)="onSubmit()"
          [disabled]="facade.isSaving() || form.invalid"
          data-llm-action="save-anticipo"
        >
          @if (facade.isSaving()) {
            <app-icon name="loader-2" [size]="16" />
            <span>Guardando...</span>
          } @else {
            <app-icon name="check" [size]="16" />
            <span>Registrar Anticipo</span>
          }
        </button>
      </div>
    </div>
  `,
})
export class RegistrarAnticipoDrawerComponent {
  protected readonly facade = inject(AnticiosFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly fb = inject(FormBuilder);

  protected readonly motivoOptions = MOTIVO_OPTIONS;

  protected readonly errorMsg = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    instructorId: ['', Validators.required],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    reason: [''],
    description: [''],
  });

  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  protected async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const ok = await this.facade.registrarAnticipo({
      instructorId: Number(raw.instructorId),
      date: raw.date,
      amount: raw.amount!,
      reason: raw.reason,
      description: raw.description,
    });

    if (ok) this.drawer.close();
  }
}
