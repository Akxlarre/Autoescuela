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
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

// Shared
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { BranchScopeSelectorComponent } from '@shared/components/branch-scope-selector/branch-scope-selector.component';
import type { BranchScopeValue } from '@shared/components/branch-scope-selector/branch-scope-selector.component';

// Facades & Models
import { FlotaFacade } from '@core/facades/flota.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { StableWidthDirective } from '@core/directives/stable-width.directive';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { VEHICLE_DOC_TYPES } from '@core/utils/vehicle-doc-types.util';
import { validateDocumentFile } from '@core/utils/document-file-validation.util';

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
    SelectModule,
    ButtonModule,
    MessageModule,
    IconComponent,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
    StableWidthDirective,
    BranchScopeSelectorComponent,
    DateInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer-form>
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-4">
            <!-- Patente -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="25%" height="13px" />
              <app-skeleton-block variant="rect" width="100%" height="38px" />
            </div>
            <!-- Marca / Modelo -->
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="35%" height="13px" />
                <app-skeleton-block variant="rect" width="100%" height="38px" />
              </div>
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="40%" height="13px" />
                <app-skeleton-block variant="rect" width="100%" height="38px" />
              </div>
            </div>
            <!-- Año / KM -->
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="25%" height="13px" />
                <app-skeleton-block variant="rect" width="100%" height="38px" />
              </div>
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="45%" height="13px" />
                <app-skeleton-block variant="rect" width="100%" height="38px" />
              </div>
            </div>
            <!-- Estado -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="40%" height="13px" />
              <app-skeleton-block variant="rect" width="100%" height="38px" />
            </div>
            <!-- Sede -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="35%" height="13px" />
              <app-skeleton-block variant="rect" width="100%" height="38px" />
            </div>
          </div>
        </ng-template>
        <ng-template #content>
          <form [formGroup]="vehicleForm" (ngSubmit)="onSubmit()">
            <div class="flex flex-col gap-4">
              <!-- Patente -->
              <div class="flex flex-col gap-1.5">
                <label for="vf-plate" class="field-label">Patente *</label>
                <input
                  id="vf-plate"
                  type="text"
                  formControlName="license_plate"
                  placeholder="ABC-123"
                  aria-required="true"
                  class="field-input"
                  [class.field-input--error]="
                    vehicleForm.controls.license_plate.touched &&
                    vehicleForm.controls.license_plate.invalid
                  "
                  data-llm-description="input for the vehicle license plate"
                />
                @if (
                  vehicleForm.controls.license_plate.touched &&
                  vehicleForm.controls.license_plate.invalid
                ) {
                  <span class="field-error">Formato inválido (Ej: AB1234 o ABCD12)</span>
                }
              </div>

              <!-- Marca / Modelo -->
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <label for="vf-brand" class="field-label">Marca *</label>
                  <input
                    id="vf-brand"
                    type="text"
                    formControlName="brand"
                    placeholder="Nissan"
                    aria-required="true"
                    class="field-input"
                    data-llm-description="input for the vehicle brand"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label for="vf-model" class="field-label">Modelo *</label>
                  <input
                    id="vf-model"
                    type="text"
                    formControlName="model"
                    placeholder="Versa"
                    aria-required="true"
                    class="field-input"
                    data-llm-description="input for the vehicle model"
                  />
                </div>
              </div>

              <!-- Año / KM -->
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <label for="vf-year" class="field-label">Año *</label>
                  <input
                    id="vf-year"
                    type="number"
                    formControlName="year"
                    placeholder="2024"
                    aria-required="true"
                    class="field-input"
                    data-llm-description="input for the vehicle year"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label for="vf-km" class="field-label">KM Actual</label>
                  <input
                    id="vf-km"
                    type="number"
                    formControlName="current_km"
                    placeholder="0"
                    class="field-input"
                    data-llm-description="input for the vehicle current odometer reading"
                  />
                </div>
              </div>

              <!-- Estado -->
              <div class="flex flex-col gap-1.5">
                <label for="vf-status" class="field-label">Estado Actual</label>
                <p-select
                  inputId="vf-status"
                  formControlName="status"
                  [options]="statusOptions"
                  placeholder="Seleccionar estado"
                  styleClass="w-full"
                  appendTo="body"
                  data-llm-description="select for the vehicle status"
                ></p-select>
              </div>

              <!-- Sede + Ambas sedes -->
              <app-branch-scope-selector
                [branches]="branchOptions()"
                [branchId]="vehicleForm.controls.branch_id.value"
                [bothBranches]="vehicleForm.controls.both_branches.value"
                [role]="authFacade.currentUser()?.role ?? ''"
                [mode]="isEdit() ? 'editar' : 'crear'"
                [disabledReason]="sedeDisabledReason()"
                (valueChange)="onSedeScopeChange($event)"
              />

              <!-- ── Sección: Documentos (solo al crear — recién existe vehicleId al guardar) ── -->
              @if (!isEdit()) {
                <h3 class="section-title">Documentos (opcional)</h3>
                <div class="flex flex-col gap-3 mb-2">
                  <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label" for="vf-doc-type">Tipo de documento</label>
                      <p-select
                        inputId="vf-doc-type"
                        [options]="availableDocTypes()"
                        [(ngModel)]="pendingDocTypeModel"
                        [ngModelOptions]="{ standalone: true }"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Selecciona un tipo..."
                        styleClass="w-full"
                        appendTo="body"
                        data-llm-description="Tipo de documento a adjuntar para el nuevo vehículo"
                      ></p-select>
                    </div>
                    <app-date-input
                      label="Fecha de vencimiento"
                      id="vf-doc-expiry"
                      [value]="pendingDocExpiry()"
                      (valueChange)="pendingDocExpiry.set($event)"
                    />
                  </div>
                  <input
                    #vehicleDocFileInput
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    class="hidden"
                    data-llm-description="hidden file input for the vehicle document to attach"
                    (change)="onDocFileSelected($event)"
                  />
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="btn-secondary flex items-center justify-center gap-2"
                      data-llm-action="adjuntar-documento-vehiculo"
                      (click)="vehicleDocFileInput.click()"
                    >
                      <app-icon name="upload" [size]="14" />
                      {{ pendingDocFile()?.name ?? 'Adjuntar archivo (opcional)' }}
                    </button>
                    <button
                      type="button"
                      class="btn-secondary"
                      [disabled]="!pendingDocType() || !pendingDocExpiry()"
                      data-llm-action="agregar-documento-vehiculo"
                      (click)="addStagedDoc()"
                    >
                      Agregar
                    </button>
                  </div>
                  @if (docValidationError()) {
                    <span class="field-error">{{ docValidationError() }}</span>
                  }

                  @if (stagedDocs().length > 0) {
                    <ul class="flex flex-col gap-2 m-0 p-0 list-none">
                      @for (doc of stagedDocs(); track doc.type) {
                        <li
                          class="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border-subtle"
                        >
                          <div class="min-w-0">
                            <p class="text-sm font-medium m-0 text-text-primary truncate">
                              {{ docTypeLabel(doc.type) }}
                            </p>
                            <p class="text-xs m-0 text-text-secondary">
                              Vence: {{ doc.expiryDate }}{{ doc.file ? ' · ' + doc.file.name : '' }}
                            </p>
                          </div>
                          <button
                            type="button"
                            class="text-xs shrink-0 w-8 h-8 flex items-center justify-center rounded-md cursor-pointer border-0 bg-transparent text-error hover:bg-error/10"
                            aria-label="Quitar documento adjunto"
                            data-llm-action="quitar-documento-vehiculo"
                            (click)="removeStagedDoc(doc.type)"
                          >
                            <app-icon name="trash-2" [size]="14" />
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </div>
              }

              <!-- Mensajes -->
              @if (errorMsg()) {
                <p-message severity="error" [text]="errorMsg()!" class="w-full"></p-message>
              }
            </div>
          </form>
        </ng-template>
      </app-drawer-content-loader>

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          type="button"
          class="btn-secondary"
          data-llm-action="cancel-vehicle-form"
          (click)="onCancel()"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          [disabled]="vehicleForm.invalid || isSaving()"
          [appStableWidth]="isSaving()"
          data-llm-action="save-vehicle"
          (click)="onSubmit()"
        >
          @if (isSaving()) {
            <app-icon name="loader-2" [size]="18" class="animate-spin" />
          }
          {{ isEdit() ? 'Guardar Cambios' : 'Crear Vehículo' }}
        </button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class VehicleFormDrawerComponent {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly flotaFacade = inject(FlotaFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);
  protected readonly authFacade = inject(AuthFacade);

  // ── Estado ────────────────────────────────────────────────────────────────
  readonly vehicleId = this.flotaFacade.selectedVehicleId;
  readonly isEdit = computed(() => this.vehicleId() !== null);
  readonly isSaving = signal(false);
  readonly errorMsg = signal<string | null>(null);

  /** Si el vehículo tiene instructor activo asignado, la sede no puede tocarse desde acá (fix-119-m). */
  readonly sedeDisabledReason = computed<string | null>(() => {
    const id = this.vehicleId();
    if (!id) return null;
    const vehicle = this.flotaFacade.vehicles().find((v) => v.id === id);
    if (!vehicle?.instructorId) return null;
    return `Este vehículo está asignado a ${vehicle.instructorName ?? 'un instructor'}. Para cambiar la sede, primero desasígnalo desde Editar Instructor.`;
  });

  readonly statusOptions = [
    { label: 'Disponible', value: 'available' },
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
    branch_id: [null as number | null, Validators.required],
    both_branches: [false],
  });

  readonly branchOptions = this.branchFacade.branches;

  // ── Documentos adjuntos (se suben recién al crear el vehículo, cuando ya hay id — fix-154-m) ──
  readonly stagedDocs = signal<{ type: string; expiryDate: string; file: File | null }[]>([]);
  readonly pendingDocType = signal<string | null>(null);
  readonly pendingDocExpiry = signal<string>('');
  readonly pendingDocFile = signal<File | null>(null);
  readonly docValidationError = signal<string | null>(null);

  readonly vehicleDocTypes = VEHICLE_DOC_TYPES;
  readonly availableDocTypes = computed(() => {
    const used = new Set(this.stagedDocs().map((d) => d.type));
    return this.vehicleDocTypes.filter((t) => !used.has(t.value));
  });

  protected get pendingDocTypeModel(): string | null {
    return this.pendingDocType();
  }
  protected set pendingDocTypeModel(v: string | null) {
    this.pendingDocType.set(v);
  }

  docTypeLabel(type: string): string {
    return this.vehicleDocTypes.find((t) => t.value === type)?.label ?? type;
  }

  onDocFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const error = validateDocumentFile(file);
    this.docValidationError.set(error);
    if (error) return;

    this.pendingDocFile.set(file);
  }

  addStagedDoc(): void {
    const type = this.pendingDocType();
    const expiryDate = this.pendingDocExpiry();
    if (!type || !expiryDate) return;

    this.stagedDocs.update((docs) => [...docs, { type, expiryDate, file: this.pendingDocFile() }]);
    this.pendingDocType.set(null);
    this.pendingDocExpiry.set('');
    this.pendingDocFile.set(null);
    this.docValidationError.set(null);
  }

  removeStagedDoc(type: string): void {
    this.stagedDocs.update((docs) => docs.filter((d) => d.type !== type));
  }

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
            both_branches: vehicle.bothBranches,
          });
        }
      } else {
        this.vehicleForm.reset({
          year: new Date().getFullYear(),
          status: 'available',
          both_branches: false,
        });
      }
    });
  }

  /** Delegado a app-branch-scope-selector (mismo componente que instructores, spec 0004-m). */
  onSedeScopeChange(value: BranchScopeValue): void {
    this.vehicleForm.patchValue({
      branch_id: value.branchId,
      both_branches: value.bothBranches,
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
        const newVehicleId = await this.flotaFacade.createVehicle(val);
        if (newVehicleId) {
          await this.uploadStagedDocs(newVehicleId);
        }
      }
      this.layoutDrawer.close();
    } catch (error) {
      this.errorMsg.set(
        error instanceof Error
          ? this.sanitizer.sanitize(error).message
          : 'Error al guardar el vehículo',
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  onCancel(): void {
    this.layoutDrawer.close();
  }

  /**
   * Sube los documentos adjuntados durante la creación — recién ahora existe el vehicleId.
   * Fallas individuales no bloquean el cierre del drawer (el vehículo ya quedó creado); se
   * avisan por toast para que se reintenten desde el drawer de Documentos (mismo criterio que
   * `admin-instructor-crear-drawer`).
   */
  private async uploadStagedDocs(vehicleId: number): Promise<void> {
    for (const doc of this.stagedDocs()) {
      try {
        await this.flotaFacade.upsertVehicleDocument({
          vehicleId,
          type: doc.type,
          expiryDate: doc.expiryDate,
          file: doc.file,
        });
      } catch {
        this.toast.error(
          'No se pudo subir un documento',
          `${this.docTypeLabel(doc.type)} — puedes reintentarlo desde Documentos del vehículo.`,
        );
      }
    }
  }
}
