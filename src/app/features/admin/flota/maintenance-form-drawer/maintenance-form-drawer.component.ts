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
import { TextareaModule } from 'primeng/textarea';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';

// Shared
import { IconComponent } from '@shared/components/icon/icon.component';

// Facades & Models
import { FlotaFacade } from '@core/facades/flota.facade';
import { FlotaDetalleFacade } from '@core/facades/flota-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

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
    DateInputComponent,
    IconComponent,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer-form>
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-6 px-6 py-8">
            <!-- Tipo de Servicio -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="40%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="44px" />
            </div>
            <!-- Kilometraje -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="50%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="44px" />
            </div>
            <!-- Taller / Fecha -->
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="55%" height="12px" />
                <app-skeleton-block variant="rect" width="100%" height="44px" />
              </div>
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="60%" height="12px" />
                <app-skeleton-block variant="rect" width="100%" height="44px" />
              </div>
            </div>
            <!-- Costo -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="30%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="44px" />
            </div>
            <!-- Observaciones (textarea) -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="45%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="100px" />
            </div>
          </div>
        </ng-template>
        <ng-template #content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="grid grid-cols-1 gap-6">
              <!-- Tipo de Mantenimiento -->
              <div class="flex flex-col gap-1.5">
                <label
                  for="mf-type"
                  class="text-xs font-semibold text-text-muted uppercase tracking-wider"
                >
                  Tipo de Servicio <span class="text-error">*</span>
                </label>
                <p-select
                  inputId="mf-type"
                  formControlName="type"
                  [options]="typeOptions"
                  placeholder="Seleccionar tipo"
                  aria-required="true"
                  styleClass="w-full h-11 rounded-xl border-border-subtle bg-base"
                ></p-select>
              </div>

              <!-- Kilometraje -->
              <div class="flex flex-col gap-1.5">
                <label
                  for="mf-km"
                  class="text-xs font-semibold text-text-muted uppercase tracking-wider"
                >
                  Kilometraje al momento <span class="text-error">*</span>
                </label>
                <p-inputNumber
                  inputId="mf-km"
                  formControlName="km_at_time"
                  placeholder="Ej: 45000"
                  aria-required="true"
                  inputStyleClass="w-full h-11 rounded-xl border-border-subtle bg-base px-4"
                />
              </div>

              <!-- Taller / Fecha -->
              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                  <label
                    for="mf-workshop"
                    class="text-xs font-semibold text-text-muted uppercase tracking-wider"
                  >
                    Taller / Proveedor
                  </label>
                  <input
                    id="mf-workshop"
                    pInputText
                    formControlName="workshop"
                    placeholder="Ej: Nissan Center"
                    class="w-full h-11 rounded-xl border-border-subtle hover:border-ds-brand bg-base px-4"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <app-date-input
                    label="Fecha Realización"
                    [required]="true"
                    [value]="form.get('completed_date')?.value ?? ''"
                    (valueChange)="
                      form.get('completed_date')?.setValue($event);
                      form.get('completed_date')?.markAsTouched()
                    "
                    data-llm-description="Fecha en que se realizó el mantenimiento"
                  />
                </div>
              </div>

              <!-- Costo -->
              <div class="flex flex-col gap-1.5">
                <label
                  for="mf-cost"
                  class="text-xs font-semibold text-text-muted uppercase tracking-wider"
                >
                  Costo Total ($)
                </label>
                <p-inputNumber
                  inputId="mf-cost"
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
                <label
                  for="mf-desc"
                  class="text-xs font-semibold text-text-muted uppercase tracking-wider"
                >
                  Observaciones / Detalles
                </label>
                <textarea
                  id="mf-desc"
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
          </form>
        </ng-template>
      </app-drawer-content-loader>

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button type="button" class="btn-secondary" (click)="onCancel()">Cancelar</button>
        <button
          type="button"
          class="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          [disabled]="form.invalid || isSaving()"
          (click)="onSubmit()"
        >
          @if (isSaving()) {
            <app-icon name="loader-2" [size]="18" class="animate-spin" />
          }
          {{ isEdit() ? 'Guardar Cambios' : 'Registrar Mantenimiento' }}
        </button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class MaintenanceFormDrawerComponent {
  private readonly sanitizer = inject(ErrorSanitizerService);
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
        error instanceof Error
          ? this.sanitizer.sanitize(error).message
          : 'Error al guardar el mantenimiento',
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  onCancel(): void {
    this.layoutDrawer.close();
  }
}
