import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

// PrimeNG
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';

// Shared
import { IconComponent } from '@shared/components/icon/icon.component';

// Facades & Models
import { FlotaFacade } from '@core/facades/flota.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

/**
 * VehicleFormDrawerComponent — Contenido dinámico para el LayoutDrawer.
 * Maneja la creación y edición de vehículos.
 */
@Component({
  selector: 'app-vehicle-form-drawer',
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
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex-1 flex flex-col min-h-0 bg-surface">
      <form [formGroup]="vehicleForm" class="flex-1 flex flex-col min-h-0" (ngSubmit)="onSubmit()">
        <!-- Body Scrolleable -->
        <div class="flex-1 overflow-y-auto px-6 py-8">
          <div class="grid grid-cols-1 gap-6 max-w-xl mx-auto">
            <!-- Patente -->
            <div class="flex flex-col gap-1.5">
              <label
                for="vf-plate"
                class="text-xs font-semibold text-text-muted uppercase tracking-wider"
              >
                Patente <span class="text-error">*</span>
              </label>
              <input
                id="vf-plate"
                pInputText
                formControlName="license_plate"
                placeholder="ABC-123"
                aria-required="true"
                class="w-full h-11 rounded-xl border-border-subtle hover:border-border-strong focus:border-brand bg-base font-mono uppercase text-lg px-4"
              />
              @if (
                vehicleForm.controls.license_plate.touched &&
                vehicleForm.controls.license_plate.invalid
              ) {
                <small class="text-error text-xs">Formato inválido (Ej: AB1234 o ABCD12)</small>
              }
            </div>

            <!-- Marca / Modelo -->
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label
                  for="vf-brand"
                  class="text-xs font-semibold text-text-muted uppercase tracking-wider"
                >
                  Marca <span class="text-error">*</span>
                </label>
                <input
                  id="vf-brand"
                  pInputText
                  formControlName="brand"
                  placeholder="Nissan"
                  aria-required="true"
                  class="w-full h-11 rounded-xl border-border-subtle hover:border-ds-brand bg-base px-4"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label
                  for="vf-model"
                  class="text-xs font-semibold text-text-muted uppercase tracking-wider"
                >
                  Modelo <span class="text-error">*</span>
                </label>
                <input
                  id="vf-model"
                  pInputText
                  formControlName="model"
                  placeholder="Versa"
                  aria-required="true"
                  class="w-full h-11 rounded-xl border-border-subtle hover:border-ds-brand bg-base px-4"
                />
              </div>
            </div>

            <!-- Año / KM -->
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label
                  for="vf-year"
                  class="text-xs font-semibold text-text-muted uppercase tracking-wider"
                >
                  Año <span class="text-error">*</span>
                </label>
                <p-inputNumber
                  inputId="vf-year"
                  formControlName="year"
                  [useGrouping]="false"
                  placeholder="2024"
                  aria-required="true"
                  inputStyleClass="w-full h-11 rounded-xl border-border-subtle bg-base px-4"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label
                  for="vf-km"
                  class="text-xs font-semibold text-text-muted uppercase tracking-wider"
                >
                  KM Actual
                </label>
                <p-inputNumber
                  inputId="vf-km"
                  formControlName="current_km"
                  placeholder="0"
                  inputStyleClass="w-full h-11 rounded-xl border-border-subtle bg-base px-4"
                />
              </div>
            </div>

            <!-- Estado -->
            <div class="flex flex-col gap-1.5">
              <label
                for="vf-status"
                class="text-xs font-semibold text-text-muted uppercase tracking-wider"
              >
                Estado Actual
              </label>
              <p-select
                inputId="vf-status"
                formControlName="status"
                [options]="statusOptions"
                placeholder="Seleccionar estado"
                styleClass="w-full h-11 rounded-xl border-border-subtle bg-base"
              ></p-select>
            </div>

            <!-- Mensajes -->
            @if (errorMsg()) {
              <p-message severity="error" [text]="errorMsg()!" class="w-full"></p-message>
            }
          </div>
        </div>

        <!-- Footer Fixed — Estilo Premium consistent con LayoutDrawer -->
        <div
          class="shrink-0 p-6 border-t bg-surface flex items-center justify-end gap-3"
          style="border-color: var(--border-subtle);"
        >
          <button type="button" class="btn-secondary h-11 px-6" (click)="onCancel()">
            Cancelar
          </button>
          <button
            type="submit"
            class="btn-primary h-11 px-8 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            [disabled]="vehicleForm.invalid || isSaving()"
          >
            @if (isSaving()) {
              <app-icon name="loader-2" [size]="18" class="animate-spin" />
            }
            {{ isEdit() ? 'Guardar Cambios' : 'Crear Vehículo' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class VehicleFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly flotaFacade = inject(FlotaFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Estado ────────────────────────────────────────────────────────────────
  readonly vehicleId = this.flotaFacade.selectedVehicleId;
  readonly isEdit = computed(() => this.vehicleId() !== null);
  readonly isSaving = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly statusOptions = [
    { label: 'Disponible', value: 'available' },
    { label: 'En Clase', value: 'in_class' },
    { label: 'Mantenimiento', value: 'maintenance' },
    { label: 'Fuera de Servicio', value: 'out_of_service' },
  ];

  readonly vehicleForm = this.fb.group({
    license_plate: [
      '',
      [Validators.required, Validators.pattern(/^[A-Z]{2}[A-Z0-9]{2,}[0-9]{2}$/)],
    ],
    brand: ['', Validators.required],
    model: ['', Validators.required],
    year: [new Date().getFullYear(), [Validators.required, Validators.min(1900)]],
    current_km: [0, [Validators.required, Validators.min(0)]],
    status: ['available', Validators.required],
    branch_id: [null as number | null],
  });

  constructor() {
    effect(() => {
      const id = this.vehicleId();
      if (id) {
        // En un caso real el Facade cargaría/seleccionaría el objeto.
        // Aquí buscamos en el pool cargado en el Facade principal.
        const vehicle = this.flotaFacade.vehicles().find((v) => v.id === id);
        if (vehicle) {
          this.vehicleForm.patchValue({
            license_plate: vehicle.licensePlate,
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            current_km: vehicle.currentKm,
            status: vehicle.status,
            branch_id: vehicle.branchId,
          });
        }
      } else {
        this.vehicleForm.reset({
          year: new Date().getFullYear(),
          status: 'available',
        });
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.vehicleForm.invalid || this.isSaving()) return;

    this.errorMsg.set(null);
    this.isSaving.set(true);

    try {
      const val = this.vehicleForm.getRawValue();
      const id = this.vehicleId();

      if (id) {
        await this.flotaFacade.updateVehicle(id, val);
      } else {
        await this.flotaFacade.createVehicle(val);
      }
      this.layoutDrawer.close();
    } catch (error) {
      this.errorMsg.set(error instanceof Error ? error.message : 'Error al guardar el vehículo');
    } finally {
      this.isSaving.set(false);
    }
  }

  onCancel(): void {
    this.layoutDrawer.close();
  }
}
