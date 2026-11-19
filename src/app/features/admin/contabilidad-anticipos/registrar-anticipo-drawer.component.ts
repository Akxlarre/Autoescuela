import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { todayIso } from '@core/utils/date.utils';
import { vincularInstructorAnticipo } from './vincular-instructor-anticipo';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { AnticiposFacade } from '@core/facades/anticipos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

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
  imports: [
    ReactiveFormsModule,
    SelectModule,
    IconComponent,
    DateInputComponent,
    DrawerFormComponent,
  ],
  template: `
    <app-drawer-form>
      <form [formGroup]="form" class="flex flex-col gap-5" (ngSubmit)="onSubmit()">
        <!-- Instructor -->
        <div class="flex flex-col gap-1.5">
          <label for="ant-instructor" class="field-label">
            INSTRUCTOR <span class="text-error">*</span>
          </label>
          @if (instructoresNoCargaron()) {
            <!-- spec 0060-b: una lista que no cargó no es una lista vacía -->
            <div class="flex flex-col gap-2 py-2 px-3 rounded-lg bg-error/8" role="alert">
              <p class="text-xs text-error">
                No se pudo cargar la lista de instructores. Reintenta antes de registrar el
                anticipo.
              </p>
              <button
                type="button"
                class="btn-secondary self-start flex items-center gap-2"
                data-llm-action="reintentar-instructores-anticipo"
                [disabled]="facade.isLoading()"
                (click)="facade.reintentar()"
              >
                <app-icon name="refresh-cw" [size]="12" />
                Reintentar
              </button>
            </div>
          } @else {
            <p-select
              id="ant-instructor"
              formControlName="instructorId"
              [options]="facade.instructores()"
              [loading]="facade.isLoading()"
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

      <!-- Footer de acciones -->
      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          type="button"
          class="btn-secondary"
          (click)="drawer.close()"
          [disabled]="facade.isSaving()"
          data-llm-action="cancel-anticipo"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary flex items-center gap-2"
          (click)="onSubmit()"
          [disabled]="facade.isSaving() || form.invalid || instructorAnticipo.bloqueado()"
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
      </ng-container>
    </app-drawer-form>
  `,
})
export class RegistrarAnticipoDrawerComponent {
  protected readonly facade = inject(AnticiposFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly fb = inject(FormBuilder);

  protected readonly motivoOptions = MOTIVO_OPTIONS;

  protected readonly errorMsg = signal<string | null>(null);

  /**
   * Caso A de la carga (spec 0060-b): no hay lista contra la cual elegir, y un instructor ya
   * elegido puede ser de la consulta anterior. Un refresco fallido (caso B) no bloquea.
   */
  protected readonly instructoresNoCargaron = computed(() => !!this.facade.error());

  protected readonly form = this.fb.nonNullable.group({
    // Precargado si se abrió desde la fila de un instructor (facade.selectInstructor());
    // vacío si se abrió desde el botón "Registrar Anticipo" del hero.
    instructorId: [(this.facade.selectedInstructorId() ?? '') as number | '', Validators.required],
    date: [todayIso(), Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    reason: [''],
    description: [''],
  });

  /** hotfix-189-b: la página recarga la lista al cambiar de sede; acá se revisa lo elegido. */
  protected readonly instructorAnticipo = vincularInstructorAnticipo({
    control: this.form.controls.instructorId,
    valorVacio: '',
    lista: computed(() => ({
      instructores: this.facade.instructores(),
      cargando: this.facade.isLoading(),
      conError: this.instructoresNoCargaron(),
    })),
  });

  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  protected async onSubmit(): Promise<void> {
    const instructorConfirmado = this.instructorAnticipo.confirmar();
    this.form.markAllAsTouched();
    if (this.form.invalid || !instructorConfirmado) return;

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
