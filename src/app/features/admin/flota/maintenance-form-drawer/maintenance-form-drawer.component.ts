import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

// PrimeNG
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';

// Shared
import { IconComponent } from '@shared/components/icon/icon.component';

// Facades & Models
import { FlotaFacade } from '@core/facades/flota.facade';
import { FlotaDetalleFacade } from '@core/facades/flota-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

/**
 * MaintenanceFormDrawerComponent — Contenido dinámico para el LayoutDrawer.
 * Maneja el registro y edición de mantenimientos de un vehículo.
 */
@Component({
  selector: 'app-maintenance-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    SelectModule,
    ButtonModule,
    InputNumberModule,
    MessageModule,
    TextareaModule,
    DatePickerModule,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex-1 flex flex-col min-h-0 bg-surface">
      <form [formGroup]="form" class="flex-1 flex flex-col min-h-0" (ngSubmit)="onSubmit()">
        <!-- Body Scrolleable -->
        <div class="flex-1 overflow-y-auto px-6 py-8">
          <div class="grid grid-cols-1 gap-6 max-w-xl mx-auto">
            
            <!-- Tipo de Mantenimiento -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Tipo de Servicio <span class="text-error">*</span>
              </label>
              <p-select
                formControlName="type"
                [options]="typeOptions"
                placeholder="Seleccionar tipo"
                styleClass="w-full h-11 rounded-xl border-border-subtle bg-base"
              ></p-select>
            </div>

            <!-- Kilometraje -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Kilometraje al momento <span class="text-error">*</span>
              </label>
              <p-inputNumber
                formControlName="km_at_time"
                placeholder="Ej: 45000"
                inputStyleClass="w-full h-11 rounded-xl border-border-subtle bg-base px-4"
              />
            </div>

            <!-- Taller / Fecha -->
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Taller / Proveedor
                </label>
                <input
                  pInputText
                  formControlName="workshop"
                  placeholder="Ej: Nissan Center"
                  class="w-full h-11 rounded-xl border-border-subtle hover:border-ds-brand bg-base px-4"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Fecha Realización <span class="text-error">*</span>
                </label>
                <input
                  type="date"
                  formControlName="completed_date"
                  class="w-full h-11 rounded-xl border-border-subtle bg-base px-4"
                />
              </div>
            </div>

            <!-- Costo -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Costo Total ($)
              </label>
              <p-inputNumber
                formControlName="cost"
                mode="currency"
                currency="CLP"
                locale="es-CL"
                placeholder="0"
                inputStyleClass="w-full h-11 rounded-xl border-border-subtle bg-base px-4"
              />
            </div>

            <!-- Observaciones -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Observaciones / Detalles
              </label>
              <textarea
                pTextarea
                formControlName="description"
                rows="4"
                placeholder="Describe el trabajo realizado..."
                class="w-full rounded-xl border-border-subtle bg-base p-4 resize-none"
              ></textarea>
            </div>

            <!-- Error -->
            @if (errorMsg()) {
              <p-message severity="error" [text]="errorMsg()!" class="w-full"></p-message>
            }
          </div>
        </div>

        <!-- Footer Fixed -->
        <div class="shrink-0 p-6 border-t bg-surface flex items-center justify-end gap-3" style="border-color: var(--border-subtle);">
          <button
            type="button"
            class="h-11 px-6 rounded-xl border bg-transparent cursor-pointer font-medium hover:bg-subtle transition-all"
            style="color: var(--text-secondary); border-color: var(--border-strong);"
            (click)="onCancel()"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="h-11 px-8 rounded-xl bg-ds-brand text-white border-none cursor-pointer font-semibold shadow-sm hover:opacity-90 transition-all flex items-center gap-2"
            [disabled]="form.invalid || isSaving()"
          >
            @if (isSaving()) {
              <app-icon name="loader-2" [size]="18" class="animate-spin" />
            }
            {{ isEdit() ? 'Guardar Cambios' : 'Registrar Mantenimiento' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class MaintenanceFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly flotaFacade = inject(FlotaFacade);
  private readonly detalleFacade = inject(FlotaDetalleFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Estado ────────────────────────────────────────────────────────────────
  readonly vehicleId = this.flotaFacade.selectedVehicleId;
  readonly maintenanceId = this.detalleFacade.selectedMaintenanceId;
  readonly isEdit = computed(() => this.maintenanceId() !== null);
  readonly isSaving = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly typeOptions = [
    { label: 'Cambio de Aceite', value: 'Cambio de Aceite' },
    { label: 'Alineación y Balanceo', value: 'Alineación' },
    { label: 'Frenos', value: 'Frenos' },
    { label: 'Neumáticos', value: 'Neumáticos' },
    { label: 'Servicio Preventivo (KM)', value: 'Preventivo' },
    { label: ' Reparación Correctiva', value: 'Correctiva' },
    { label: 'Otro', value: 'Otro' },
  ];

  readonly form = this.fb.group({
    type: ['', Validators.required],
    km_at_time: [0, [Validators.required, Validators.min(0)]],
    workshop: [''],
    completed_date: [new Date().toISOString().split('T')[0], Validators.required],
    cost: [0, [Validators.required, Validators.min(0)]],
    description: [''],
  });

  constructor() {
    effect(() => {
      const mid = this.maintenanceId();
      if (mid) {
        const maint = this.detalleFacade.maintenances().find((m) => m.id === mid);
        if (maint) {
          this.form.patchValue({
            type: maint.type,
            km_at_time: maint.km ?? 0,
            workshop: maint.workshop ?? '',
            completed_date: maint.date,
            cost: maint.cost ?? 0,
            description: maint.description ?? '',
          });
        }
      } else {
        const v = this.detalleFacade.vehicle();
        this.form.reset({
          type: '',
          km_at_time: v?.currentKm ?? 0,
          workshop: '',
          completed_date: new Date().toISOString().split('T')[0],
          cost: 0,
          description: '',
        });
      }
    });
  }

  async onSubmit(): Promise<void> {
    const vid = this.vehicleId();
    if (!vid || this.form.invalid || this.isSaving()) return;

    this.errorMsg.set(null);
    this.isSaving.set(true);

    try {
      const val = this.form.getRawValue();
      const mid = this.maintenanceId();

      if (mid) {
        await this.detalleFacade.updateMaintenance(mid, vid, val);
      } else {
        await this.detalleFacade.createMaintenance(vid, val);
      }
      this.layoutDrawer.close();
    } catch (error) {
      this.errorMsg.set(
        error instanceof Error ? error.message : 'Error al guardar el mantenimiento',
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  onCancel(): void {
    this.layoutDrawer.close();
  }
}
