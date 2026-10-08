import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InstructoresFacade } from '@core/facades/instructores.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { toISODate, todayIso } from '@core/utils/date.utils';
import { licenseStatusFromExpiry } from '@core/utils/license-status.utils';
import { resolveInstructorCreateBranch } from '@core/utils/instructor-create-branch.utils';
import { AuthFacade } from '@core/facades/auth.facade';
import { DmsFacade } from '@core/facades/dms.facade';
import { BranchScopeSelectorComponent } from '@shared/components/branch-scope-selector/branch-scope-selector.component';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { formatRutTyping, validateRut, completeRutDv } from '@core/utils/rut.utils';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { InstructorType } from '@core/models/ui/instructor-table.model';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { StableWidthDirective } from '@core/directives/stable-width.directive';
import { INSTRUCTOR_DOC_TYPES } from '@core/utils/instructor-doc-types.util';
import { validateDocumentFile } from '@core/utils/document-file-validation.util';
import { isOptionalSurnameValid } from '@core/utils/optional-surname.utils';
import { isValidLicenseNumber } from '@core/utils/license-number.utils';

@Component({
  selector: 'app-admin-instructor-crear-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    DateInputComponent,
    DatePickerModule,
    IconComponent,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
    StableWidthDirective,
    BranchScopeSelectorComponent,
  ],
  template: `
    <app-drawer-form>
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-4">
            <!-- Banner de info del rol -->
            <app-skeleton-block variant="rect" width="100%" height="48px" />

            <!-- Sección: Información Personal (7 campos) -->
            <app-skeleton-block variant="text" width="150px" height="12px" />
            <div class="flex flex-col gap-4">
              @for (_ of [1, 2, 3, 4, 5, 6, 7]; track $index) {
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="35%" height="12px" />
                  <app-skeleton-block variant="rect" width="100%" height="40px" />
                </div>
              }
            </div>

            <!-- Sección: Información de Licencia (2 campos) -->
            <app-skeleton-block variant="text" width="180px" height="12px" />
            <div class="flex flex-col gap-4">
              @for (_ of [1, 2]; track $index) {
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="35%" height="12px" />
                  <app-skeleton-block variant="rect" width="100%" height="40px" />
                </div>
              }
            </div>

            <!-- Sección: Asignación (2 campos) -->
            <app-skeleton-block variant="text" width="100px" height="12px" />
            <div class="flex flex-col gap-4">
              @for (_ of [1, 2]; track $index) {
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="35%" height="12px" />
                  <app-skeleton-block variant="rect" width="100%" height="40px" />
                </div>
              }
            </div>
          </div>
        </ng-template>
        <ng-template #content>
          <!-- ── Info rol ──────────────────────────────────────────────────────── -->
          <div class="flex items-start gap-3 rounded-lg p-3 mb-5 bg-brand/6 border border-brand/20">
            <app-icon name="clipboard-list" [size]="16" color="var(--ds-brand)" />
            <p class="text-xs leading-relaxed text-brand">
              Registro de instructor con información personal, licencia y vehículo asignado
            </p>
          </div>

          <!-- ── Sección: Información Personal ─────────────────────────────────── -->
          <h3 class="section-title">Información Personal</h3>
          <div class="flex flex-col gap-4 mb-6">
            <!-- Nombres -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label" for="c-nombres">Nombres *</label>
              <input
                id="c-nombres"
                type="text"
                class="field-input"
                [class.field-input--error]="nombresTouched() && !nombresValido()"
                placeholder="Carlos"
                [ngModel]="nombres()"
                (ngModelChange)="nombres.set($event)"
                (blur)="nombresTouched.set(true)"
                data-llm-description="Nombres del nuevo instructor"
                aria-required="true"
              />
              @if (nombresTouched() && !nombresValido()) {
                <span class="field-error">Ingresa el nombre (mínimo 2 caracteres)</span>
              }
            </div>

            <!-- Apellido Paterno -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label" for="c-paterno">Apellido Paterno *</label>
              <input
                id="c-paterno"
                type="text"
                class="field-input"
                [class.field-input--error]="paternoTouched() && !paternoValido()"
                placeholder="Rojas"
                [ngModel]="paterno()"
                (ngModelChange)="paterno.set($event)"
                (blur)="paternoTouched.set(true)"
                data-llm-description="Apellido paterno del nuevo instructor"
                aria-required="true"
              />
              @if (paternoTouched() && !paternoValido()) {
                <span class="field-error">Ingresa el apellido paterno (mínimo 2 caracteres)</span>
              }
            </div>

            <!-- Apellido Materno -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label" for="c-materno">Apellido Materno</label>
              <input
                id="c-materno"
                type="text"
                class="field-input"
                [class.field-input--error]="maternoTouched() && !maternoValido()"
                placeholder="Pérez"
                [ngModel]="materno()"
                (ngModelChange)="materno.set($event)"
                (blur)="maternoTouched.set(true)"
                data-llm-description="Apellido materno del nuevo instructor"
                aria-required="true"
              />
              @if (maternoTouched() && !maternoValido()) {
                <span class="field-error"
                  >Si lo ingresas, el apellido materno debe tener al menos 2 caracteres</span
                >
              }
            </div>

            <!-- RUT -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label" for="c-rut">RUT *</label>
              <input
                id="c-rut"
                type="text"
                class="field-input"
                [class.field-input--error]="rut().length > 0 && !rutValido()"
                [class.field-input--valid]="rutValido()"
                placeholder="12.345.678-9"
                maxlength="12"
                [ngModel]="rut()"
                (input)="onRutInput($event)"
                (blur)="onRutBlur()"
                data-llm-description="RUT chileno del instructor, formato 12.345.678-9"
                aria-required="true"
              />
              @if (rut().length > 0 && !rutValido()) {
                <span class="field-error flex items-center gap-1">
                  <app-icon name="circle-alert" [size]="12" />
                  RUT inválido. Verifica el dígito verificador.
                </span>
              } @else if (rutValido()) {
                <span class="field-success flex items-center gap-1">
                  <app-icon name="check-circle" [size]="12" />
                  RUT válido
                </span>
              }
            </div>

            <!-- Email -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label" for="c-email">Correo electrónico *</label>
              <input
                id="c-email"
                type="email"
                class="field-input"
                [class.field-input--error]="emailTouched() && !emailValido()"
                placeholder="carlos.rojas@autoescuela.cl"
                [ngModel]="email()"
                (ngModelChange)="email.set($event)"
                (blur)="emailTouched.set(true)"
                data-llm-description="Correo electrónico de acceso del instructor"
                aria-required="true"
              />
              @if (emailTouched() && !emailValido()) {
                <span class="field-error">Ingresa un correo electrónico válido.</span>
              }
            </div>

            <!-- Teléfono -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label" for="c-telefono">Teléfono *</label>
              <input
                id="c-telefono"
                type="tel"
                class="field-input"
                [class.field-input--error]="telefonoTouched() && !telefonoValido()"
                placeholder="+56 9 8765 4321"
                [ngModel]="telefono()"
                (ngModelChange)="telefono.set($event)"
                (blur)="telefonoTouched.set(true)"
                data-llm-description="Teléfono de contacto del instructor"
                aria-required="true"
              />
              @if (telefonoTouched() && !telefonoValido()) {
                <span class="field-error">Ingresa un teléfono válido (mínimo 8 dígitos).</span>
              }
            </div>

            <!-- Sede: la elige el admin o la secretaria multi-sede; la secretaria anclada usa
                 la suya (fix-201-b) -->
            @if (branchRule().missingOwnBranch) {
              <span class="field-error" data-llm-description="alta de instructor sin sede asignada">
                Tu usuario no tiene una sede asignada. Pide a un administrador que te asigne una.
              </span>
            }
            @if (branchRule().canPick) {
              <div class="flex flex-col gap-1.5">
                <app-branch-scope-selector
                  [branches]="branchFacade.branches()"
                  [branchId]="sedeId()"
                  [bothBranches]="bothBranches()"
                  [role]="authFacade.currentUser()?.role ?? ''"
                  [canAccessBothBranches]="!!authFacade.currentUser()?.canAccessBothBranches"
                  mode="crear"
                  (valueChange)="onSedeScopeChange($event)"
                />
                @if (sedeTouched() && !sedeValida()) {
                  <span class="field-error">Selecciona una sede.</span>
                }
              </div>
            }
          </div>

          <!-- ── Sección: Información de Licencia ──────────────────────────────── -->
          <!-- Sin selector de clase: instructors es exclusivamente Clase B (los relatores
               Profesional son la tabla lecturers, aparte) — se guarda 'B' fijo al enviar. -->
          <h3 class="section-title">Licencia Clase B</h3>
          <div class="flex flex-col gap-4 mb-6">
            <!-- Número de licencia (fix-211-b, S20: obligatorio) -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label" for="c-license-num">Número de licencia *</label>
              <input
                id="c-license-num"
                type="text"
                class="field-input"
                [class.field-input--error]="licenseNumberTouched() && !licenseNumberValido()"
                placeholder="15234567"
                [ngModel]="licenseNumber()"
                (ngModelChange)="licenseNumber.set($event)"
                (blur)="licenseNumberTouched.set(true)"
                data-llm-description="Número de licencia de conducir del instructor"
              />
              @if (licenseNumberTouched() && !licenseNumberValido()) {
                <span class="field-error">Ingresa el número de licencia.</span>
              }
            </div>

            <!-- Fecha de vencimiento -->
            <div class="flex flex-col gap-1.5">
              <app-date-input
                label="Fecha de vencimiento"
                [required]="true"
                [value]="licenseExpiryIso"
                (valueChange)="setLicenseExpiryIso($event)"
                data-llm-description="Fecha de vencimiento de la licencia del instructor"
              />
              @if (licenseExpiryTouched() && !licenseExpiryValida()) {
                <span class="field-error">Selecciona la fecha de vencimiento.</span>
              }
              @if (licenseExpiryValida() && licenseStatusPreview()) {
                <div class="flex items-center gap-2 mt-1">
                  @if (licenseStatusPreview() === 'valid') {
                    <app-icon name="check-circle" [size]="13" color="var(--state-success)" />
                    <span class="text-xs text-success"> Vigente: más de 30 días para vencer </span>
                  } @else if (licenseStatusPreview() === 'expiring_soon') {
                    <app-icon name="alert-triangle" [size]="13" color="var(--state-warning)" />
                    <span class="text-xs text-warning"> Por vencer: menos de 30 días </span>
                  } @else {
                    <app-icon name="circle-x" [size]="13" color="var(--state-error)" />
                    <span class="text-xs text-error"> Vencida: no se puede registrar </span>
                  }
                </div>
              }
            </div>
          </div>

          <!-- ── Sección: Documentos ─────────────────────────────────────────────── -->
          <h3 class="section-title">Documentos (opcional)</h3>
          <div class="flex flex-col gap-3 mb-6">
            <div class="flex flex-col gap-1.5">
              <label class="field-label" for="c-doc-type">Tipo de documento</label>
              <p-select
                inputId="c-doc-type"
                [options]="availableDocTypes()"
                [(ngModel)]="pendingDocTypeModel"
                optionLabel="label"
                optionValue="value"
                placeholder="Selecciona un tipo..."
                styleClass="w-full"
                data-llm-description="Tipo de documento a adjuntar para el nuevo instructor"
              />
            </div>
            <input
              #docFileInput
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              class="hidden"
              data-llm-description="hidden file input for the instructor document to attach"
              (change)="onDocFileSelected($event)"
            />
            <button
              type="button"
              class="btn-secondary flex items-center justify-center gap-2"
              [disabled]="!pendingDocType()"
              data-llm-action="adjuntar-documento-instructor"
              (click)="docFileInput.click()"
            >
              <app-icon name="upload" [size]="14" />
              Adjuntar archivo
            </button>
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
                        {{ doc.file.name }}
                      </p>
                      <p class="text-xs m-0 text-text-secondary">{{ docTypeLabel(doc.type) }}</p>
                    </div>
                    <button
                      type="button"
                      class="text-xs shrink-0 w-8 h-8 flex items-center justify-center rounded-md cursor-pointer border-0 bg-transparent text-error hover:bg-error/10"
                      aria-label="Quitar documento adjunto"
                      data-llm-action="quitar-documento-adjunto"
                      (click)="removeStagedDoc(doc.type)"
                    >
                      <app-icon name="trash-2" [size]="14" />
                    </button>
                  </li>
                }
              </ul>
            }
          </div>

          <!-- ── Sección: Asignación ───────────────────────────────────────────── -->
          <h3 class="section-title">Asignación</h3>
          <div class="flex flex-col gap-4 mb-6">
            <!-- Tipo de instructor -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label" for="c-type">Tipo de instructor *</label>
              <p-select
                inputId="c-type"
                [options]="typeOptions"
                [(ngModel)]="typeModel"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccione tipo"
                styleClass="w-full"
                aria-required="true"
                data-llm-description="Tipo de instructor (práctico, teórico o ambos)"
              />
              @if (typeTouched() && !typeValido()) {
                <span class="field-error">Selecciona el tipo de instructor.</span>
              }
            </div>

            <!-- Vehículo asignado -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label" for="c-vehicle">Vehículo asignado</label>
              <p-select
                inputId="c-vehicle"
                [options]="vehicleOptions()"
                [(ngModel)]="vehicleIdModel"
                optionLabel="label"
                optionValue="value"
                placeholder="Sin vehículo asignado"
                [showClear]="true"
                styleClass="w-full"
                data-llm-description="Vehículo asignado al instructor (opcional)"
              />
              <span class="text-xs text-text-muted"> Solo se muestran vehículos disponibles </span>
              <!-- hotfix-065-b (S8): sin vehículo, la Agenda no le genera turnos -->
              @if (sinVehiculoParaAgenda()) {
                <span
                  class="flex items-start gap-1.5 text-xs text-warning"
                  data-llm-description="aviso: instructor práctico sin vehículo no aparece en la Agenda"
                >
                  <app-icon name="alert-triangle" [size]="14" class="shrink-0 mt-px" />
                  Sin vehículo asignado, este instructor no aparecerá en la Agenda para agendar
                  clases prácticas hasta que se le asigne uno.
                </span>
              }
            </div>
          </div>
        </ng-template>
      </app-drawer-content-loader>

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          class="btn-secondary"
          (click)="layoutDrawer.close()"
          data-llm-action="cancelar-crear-instructor"
        >
          Cancelar
        </button>
        <button
          class="btn-primary flex items-center justify-center gap-2"
          [disabled]="facade.isSubmitting()"
          [appStableWidth]="facade.isSubmitting()"
          (click)="submit()"
          data-llm-action="confirmar-crear-instructor"
          aria-label="Crear nuevo instructor"
        >
          @if (facade.isSubmitting()) {
            <app-icon name="loader-2" [size]="15" class="animate-spin" />
            Creando...
          } @else {
            <app-icon name="user-plus" [size]="15" />
            Crear instructor
          }
        </button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class AdminInstructorCrearDrawerComponent {
  protected readonly facade = inject(InstructoresFacade);
  protected readonly dmsFacade = inject(DmsFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  protected readonly branchFacade = inject(BranchFacade);
  protected readonly authFacade = inject(AuthFacade);

  // ── Campos ─────────────────────────────────────────────────────────────────
  protected readonly nombres = signal('');
  protected readonly paterno = signal('');
  protected readonly materno = signal('');
  protected readonly rut = signal('');
  protected readonly email = signal('');
  protected readonly telefono = signal('');
  protected readonly sedeId = signal<number | null>(null);
  protected readonly bothBranches = signal(false);
  protected readonly licenseNumber = signal('');
  protected readonly licenseExpiry = signal<Date | null>(null);
  protected readonly tipo = signal<InstructorType | null>(null);
  protected readonly vehicleId = signal<number | null>(null);

  // ── Documentos adjuntos (se suben recién al crear el instructor, cuando ya hay id) ────
  protected readonly stagedDocs = signal<{ file: File; type: string }[]>([]);
  protected readonly pendingDocType = signal<string | null>(null);
  protected readonly docValidationError = signal<string | null>(null);

  // ── Touched ────────────────────────────────────────────────────────────────
  protected readonly nombresTouched = signal(false);
  protected readonly paternoTouched = signal(false);
  protected readonly maternoTouched = signal(false);
  protected readonly rutTouched = signal(false);
  protected readonly emailTouched = signal(false);
  protected readonly telefonoTouched = signal(false);
  protected readonly licenseNumberTouched = signal(false);
  protected readonly licenseExpiryTouched = signal(false);
  protected readonly typeTouched = signal(false);
  protected readonly sedeTouched = signal(false);

  /** fix-201-b: quién elige la sede y con cuál parte el formulario. */
  protected readonly branchRule = computed(() => {
    const user = this.authFacade.currentUser();
    return resolveInstructorCreateBranch(
      user?.role,
      user?.branchId,
      !!user?.canAccessBothBranches,
      this.branchFacade.selectedBranchId(),
    );
  });

  // ── Validaciones ───────────────────────────────────────────────────────────
  protected readonly nombresValido = computed(() => this.nombres().trim().length >= 2);
  protected readonly paternoValido = computed(() => this.paterno().trim().length >= 2);
  // fix-204-b (S12): opcional; si se escribe, ≥ 2 caracteres.
  protected readonly maternoValido = computed(() => isOptionalSurnameValid(this.materno()));
  protected readonly rutValido = computed(() => {
    const cleaned = this.rut().replace(/[^0-9kK]/g, '');
    return cleaned.length >= 8 && validateRut(this.rut());
  });
  protected readonly emailValido = computed(() =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()),
  );
  protected readonly telefonoValido = computed(
    () => this.telefono().replace(/\D/g, '').length >= 8,
  );
  // fix-211-b (S20): obligatorio (antes no se pedía y se guardaba vacío).
  protected readonly licenseNumberValido = computed(() =>
    isValidLicenseNumber(this.licenseNumber()),
  );
  protected readonly licenseExpiryValida = computed(() => this.licenseExpiry() !== null);
  protected readonly typeValido = computed(() => this.tipo() !== null);

  /** hotfix-065-b (S8): práctico (o ambos) sin vehículo → no tendrá turnos en la Agenda. */
  protected readonly sinVehiculoParaAgenda = computed(() => {
    const tipo = this.tipo();
    return (tipo === 'practice' || tipo === 'both') && this.vehicleId() === null;
  });

  // fix-202-b: misma regla que la lista y la Agenda (antes, una copia local).
  protected readonly licenseStatusPreview = computed(() => {
    const d = this.licenseExpiry();
    return d ? licenseStatusFromExpiry(toISODate(d), todayIso()) : null;
  });

  protected readonly sedeValida = computed(() => this.sedeId() !== null);

  protected readonly formValido = computed(
    () =>
      this.nombresValido() &&
      this.paternoValido() &&
      this.maternoValido() &&
      this.rutValido() &&
      this.emailValido() &&
      this.telefonoValido() &&
      this.sedeValida() &&
      this.licenseNumberValido() &&
      this.licenseExpiryValida() &&
      this.typeValido() &&
      this.licenseStatusPreview() !== 'expired',
  );

  // ── Documentos ─────────────────────────────────────────────────────────────
  protected readonly instructorDocTypes = INSTRUCTOR_DOC_TYPES;
  protected readonly availableDocTypes = computed(() => {
    const used = new Set(this.stagedDocs().map((d) => d.type));
    return this.instructorDocTypes.filter((t) => !used.has(t.value));
  });

  protected get pendingDocTypeModel(): string | null {
    return this.pendingDocType();
  }
  protected set pendingDocTypeModel(v: string | null) {
    this.pendingDocType.set(v);
  }

  protected docTypeLabel(type: string): string {
    return this.instructorDocTypes.find((t) => t.value === type)?.label ?? type;
  }

  protected onDocFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const type = this.pendingDocType();
    if (!file || !type) return;

    const error = validateDocumentFile(file);
    this.docValidationError.set(error);
    if (error) return;

    this.stagedDocs.update((docs) => [...docs, { file, type }]);
    this.pendingDocType.set(null);
  }

  protected removeStagedDoc(type: string): void {
    this.stagedDocs.update((docs) => docs.filter((d) => d.type !== type));
  }

  // ── Options ────────────────────────────────────────────────────────────────
  protected readonly typeOptions = [
    { label: 'Práctico', value: 'practice' },
    { label: 'Teórico', value: 'theory' },
    { label: 'Ambos', value: 'both' },
  ];

  /** Solo vehículos disponibles Y de la sede elegida (o "Ambas") — spec 0004-m, AC6. */
  protected readonly vehicleOptions = computed(() => {
    const sedeId = this.sedeId();
    return this.facade
      .vehicles()
      .filter((v) => v.status === 'available')
      .filter((v) => v.bothBranches || v.branchId === sedeId)
      .map((v) => ({
        label: v.label,
        value: v.id,
      }));
  });

  protected onSedeScopeChange(value: { branchId: number | null; bothBranches: boolean }): void {
    this.sedeId.set(value.branchId);
    this.bothBranches.set(value.bothBranches);
    this.sedeTouched.set(true);
  }

  // ── p-select models ────────────────────────────────────────────────────────
  protected get licenseExpiryIso(): string {
    const d = this.licenseExpiry();
    if (!d) return '';
    return d.toISOString().slice(0, 10);
  }
  protected setLicenseExpiryIso(v: string) {
    if (!v) {
      this.licenseExpiry.set(null);
    } else {
      // Create local date correctly
      const parts = v.split('-');
      if (parts.length === 3) {
        this.licenseExpiry.set(
          new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])),
        );
      } else {
        this.licenseExpiry.set(new Date(v));
      }
    }
    this.licenseExpiryTouched.set(true);
  }

  protected get typeModel(): InstructorType | null {
    return this.tipo();
  }
  protected set typeModel(v: InstructorType | null) {
    this.tipo.set(v);
    this.typeTouched.set(true);
  }

  protected get vehicleIdModel(): number | null {
    return this.vehicleId();
  }
  protected set vehicleIdModel(v: number | null) {
    this.vehicleId.set(v);
  }

  constructor() {
    // fix-201-b: quien elige parte con la sede del topbar; la secretaria anclada, con la suya
    // (antes salía solo del topbar: sin selector nunca había sede, o quedaba la de otro usuario).
    effect(() => {
      const rule = this.branchRule();
      if (rule.branchId !== null) {
        this.sedeId.set(rule.branchId);
        this.sedeTouched.set(true);
      } else if (!rule.canPick) {
        this.sedeId.set(null);
      }
    });
    this.facade.loadVehicles();
  }

  protected onRutInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatRutTyping(input.value);
    this.rut.set(formatted);
    input.value = formatted;
  }

  /** Al perder el foco: completa el DV solo si falta (ASG-047, fix-213-b). */
  protected onRutBlur(): void {
    this.rutTouched.set(true);
    this.rut.set(completeRutDv(this.rut()));
  }

  protected async submit(): Promise<void> {
    // Mark all as touched
    this.nombresTouched.set(true);
    this.paternoTouched.set(true);
    this.maternoTouched.set(true);
    this.rutTouched.set(true);
    this.emailTouched.set(true);
    this.telefonoTouched.set(true);
    this.sedeTouched.set(true);
    this.licenseNumberTouched.set(true);
    this.licenseExpiryTouched.set(true);
    this.typeTouched.set(true);

    if (!this.formValido()) return;

    const expiryDate = this.licenseExpiry()!;
    const expiryStr = `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, '0')}-${String(expiryDate.getDate()).padStart(2, '0')}`;

    const instructorId = await this.facade.crearInstructor({
      firstNames: this.nombres().trim(),
      paternalLastName: this.paterno().trim(),
      maternalLastName: this.materno().trim(),
      rut: this.rut(),
      email: this.email().trim().toLowerCase(),
      phone: this.telefono().trim(),
      type: this.tipo()!,
      licenseNumber: this.licenseNumber().trim(),
      licenseClass: 'B', // instructors es exclusivamente Clase B
      licenseExpiry: expiryStr,
      vehicleId: this.vehicleId(),
      branchId: this.sedeId()!,
      bothBranches: this.bothBranches(),
    });

    if (instructorId === null) return;

    // Subir los documentos adjuntados — recién ahora existe el instructorId.
    // Fallas individuales no bloquean el cierre del drawer (el instructor ya quedó creado);
    // se avisan por toast para que se reintenten desde el propio drawer de documentos.
    for (const doc of this.stagedDocs()) {
      try {
        await this.dmsFacade.uploadInstructorDocument({
          file: doc.file,
          type: doc.type,
          instructorId,
        });
      } catch {
        this.dmsFacade.showError(
          'No se pudo subir un documento',
          `${doc.file.name} — puedes reintentarlo desde la ficha del instructor.`,
        );
      }
    }

    this.layoutDrawer.close();
    this.facade.initialize(); // Forzamos refresh al cerrar
  }
}
