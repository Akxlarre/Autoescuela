import { chileYear } from '@core/utils/chile-time.utils';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  type AbstractControl,
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
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { resolveInstructorCreateBranch } from '@core/utils/instructor-create-branch.utils';
import {
  isKmDecrease,
  isValidLicensePlate,
  maxVehicleYear,
  MIN_VEHICLE_YEAR,
  normalizeLicensePlate,
  vehicleSaveErrorMessage,
} from '@core/utils/vehicle-form.utils';

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
                  placeholder="ABCD12"
                  maxlength="9"
                  autocapitalize="characters"
                  (input)="onPlateInput($event)"
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
                  <span class="field-error">Patente inválida. Ejemplos: ABCD12 o AB1234.</span>
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
                    [class.field-input--error]="
                      vehicleForm.controls.year.touched && vehicleForm.controls.year.invalid
                    "
                    data-llm-description="input for the vehicle year"
                  />
                  @if (vehicleForm.controls.year.touched && vehicleForm.controls.year.invalid) {
                    <span class="field-error">Año entre {{ minYear }} y {{ maxYear }}.</span>
                  }
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

              <!-- Sede + Ambas sedes: la elige el admin o la secretaria multi-sede; la secretaria
                   anclada crea y edita en la suya, sin selector (spec 0051-b) -->
              @if (branchRule().missingOwnBranch) {
                <span class="field-error" data-llm-description="vehículo sin sede asignada">
                  Tu usuario no tiene una sede asignada. Pide a un administrador que te asigne una.
                </span>
              }
              @if (branchRule().canPick) {
                <app-branch-scope-selector
                  [branches]="branchOptions()"
                  [branchId]="vehicleForm.controls.branch_id.value"
                  [bothBranches]="vehicleForm.controls.both_branches.value"
                  [role]="authFacade.currentUser()?.role ?? ''"
                  [canAccessBothBranches]="authFacade.currentUser()?.canAccessBothBranches ?? false"
                  [mode]="isEdit() ? 'editar' : 'crear'"
                  [disabledReason]="sedeDisabledReason()"
                  (valueChange)="onSedeScopeChange($event)"
                />
              }

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
  private readonly confirmModal = inject(ConfirmModalService);

  protected readonly minYear = MIN_VEHICLE_YEAR;
  protected readonly maxYear = maxVehicleYear(chileYear());
  /** Vehículo ya precargado en el formulario: se precarga UNA vez por vehículo (hotfix-075-b, S18). */
  private loadedVehicleId: number | null = null;
  /** Patente y kilometraje guardados del vehículo en edición (null al crear). */
  private savedPlate: string | null = null;
  private savedKm: number | null = null;

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
      [
        Validators.required,
        // hotfix-075-b (S19): AA1234 o ABCD12; una patente ya guardada que no se toca se respeta.
        (control: AbstractControl<string>) =>
          isValidLicensePlate(control.value, this.savedPlate) ? null : { licensePlate: true },
      ],
    ],
    brand: ['', Validators.required],
    model: ['', Validators.required],
    year: [
      chileYear(),
      [
        Validators.required,
        Validators.min(MIN_VEHICLE_YEAR),
        Validators.max(maxVehicleYear(chileYear())),
        Validators.pattern(/^\d+$/),
      ],
    ],
    current_km: [0, [Validators.required, Validators.min(0)]],
    status: ['available', Validators.required],
    branch_id: [null as number | null, Validators.required],
    both_branches: [false],
  });

  readonly branchOptions = this.branchFacade.branches;

  /** Quién elige la sede y con cuál parte el formulario (misma regla del alta de instructores). */
  protected readonly branchRule = computed(() => {
    const user = this.authFacade.currentUser();
    return resolveInstructorCreateBranch(
      user?.role,
      user?.branchId,
      !!user?.canAccessBothBranches,
      this.branchFacade.selectedBranchId(),
    );
  });

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
        // S18: la lista del facade cambia con cada refresco, cambio de sede o evento en vivo. Si
        // el formulario se precargara cada vez, pisaría lo que la persona está escribiendo.
        if (this.loadedVehicleId === id) return;
        const vehicle = this.flotaFacade.vehicles().find((v) => v.id === id);
        if (vehicle) {
          this.loadedVehicleId = id;
          this.savedPlate = vehicle.licensePlate;
          this.savedKm = vehicle.currentKm;
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
        this.loadedVehicleId = null;
        this.savedPlate = null;
        this.savedKm = null;
        this.vehicleForm.reset({
          year: chileYear(),
          status: 'available',
          both_branches: false,
          // spec 0051-b: parte con la sede que corresponde (la propia de la secretaria anclada, o
          // la del topbar para quien elige). Antes quedaba vacía y la secretaria no podía crear.
          branch_id: untracked(() => this.branchRule().branchId),
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

  /** Mayúsculas y sin guiones ni espacios mientras se escribe (hotfix-075-b, S19). */
  protected onPlateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalized = normalizeLicensePlate(input.value);
    if (normalized !== input.value) {
      this.vehicleForm.controls.license_plate.setValue(normalized);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.vehicleForm.invalid || this.isSaving()) return;

    // Decisión del owner (S3): el kilometraje no baja sin que el admin lo confirme.
    const nextKm = this.vehicleForm.getRawValue().current_km;
    if (this.vehicleId() && isKmDecrease(this.savedKm, nextKm)) {
      const confirmed = await this.confirmModal.confirm({
        title: 'Bajar el kilometraje',
        message: `El kilometraje registrado es ${this.savedKm} km y vas a guardar ${nextKm} km. ¿Confirmas la corrección?`,
        confirmLabel: 'Sí, corregir',
        cancelLabel: 'Cancelar',
        severity: 'warn',
      });
      if (!confirmed) return;
    }

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
      // hotfix-078-b: el error de Supabase no es un Error; antes caía siempre en el genérico.
      this.errorMsg.set(
        vehicleSaveErrorMessage(error, this.vehicleForm.getRawValue().license_plate ?? '') ??
          this.sanitizer.sanitize(error).message,
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
