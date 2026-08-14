import { TooltipModule } from 'primeng/tooltip';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
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
import { AuthFacade } from '@core/facades/auth.facade';
import { DmsFacade } from '@core/facades/dms.facade';
import { BranchScopeSelectorComponent } from '@shared/components/branch-scope-selector/branch-scope-selector.component';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { InstructorType } from '@core/models/ui/instructor-table.model';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { StableWidthDirective } from '@core/directives/stable-width.directive';

@Component({
  selector: 'app-admin-instructor-editar-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
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
    @if (facade.selectedInstructor(); as inst) {
      <app-drawer-form>
        <app-drawer-content-loader>
          <ng-template #skeletons>
            <div class="flex flex-col gap-4">
              <!-- Mini-header: avatar + nombre + email -->
              <div class="flex items-center gap-3 rounded-lg p-3">
                <app-skeleton-block variant="circle" width="36px" height="36px" />
                <div class="flex flex-col gap-1.5 flex-1">
                  <app-skeleton-block variant="text" width="55%" height="13px" />
                  <app-skeleton-block variant="text" width="70%" height="11px" />
                </div>
              </div>

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

              <!-- Sección: Información de Licencia (3 campos) -->
              <app-skeleton-block variant="text" width="180px" height="12px" />
              <div class="flex flex-col gap-4">
                @for (_ of [1, 2, 3]; track $index) {
                  <div class="flex flex-col gap-1.5">
                    <app-skeleton-block variant="text" width="35%" height="12px" />
                    <app-skeleton-block variant="rect" width="100%" height="40px" />
                  </div>
                }
              </div>

              <!-- Sección: Tipo de Instructor (1 campo) -->
              <app-skeleton-block variant="text" width="160px" height="12px" />
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="35%" height="12px" />
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              </div>

              <!-- Sección: Asignación de Vehículo (1 campo) -->
              <app-skeleton-block variant="text" width="200px" height="12px" />
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="35%" height="12px" />
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              </div>

              <!-- Sección: Historial de Asignaciones (lista) -->
              <app-skeleton-block variant="text" width="210px" height="12px" />
              <div class="flex flex-col gap-2">
                @for (_ of [1, 2]; track $index) {
                  <div class="flex items-center justify-between py-2.5 px-3 rounded-lg bg-elevated">
                    <div class="flex flex-col gap-1">
                      <app-skeleton-block variant="text" width="80px" height="13px" />
                      <app-skeleton-block variant="text" width="110px" height="11px" />
                    </div>
                    <app-skeleton-block variant="text" width="90px" height="11px" />
                  </div>
                }
              </div>

              <!-- Sección: Estado de la cuenta (2 botones) -->
              <app-skeleton-block variant="text" width="140px" height="12px" />
              <div class="flex items-center gap-3">
                <app-skeleton-block variant="rect" width="100%" height="34px" />
                <app-skeleton-block variant="rect" width="100%" height="34px" />
              </div>
            </div>
          </ng-template>
          <ng-template #content>
            <!-- ── Mini-header ─────────────────────────────────────────────────── -->
            <div
              class="flex items-center gap-3 rounded-lg p-3 mb-5 bg-elevated border border-border-subtle"
            >
              <div
                class="flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-sm font-bold bg-brand-tint text-brand"
              >
                {{ inst.initials }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="item-title truncate">
                  {{ inst.nombre }}
                </p>
                <p
                  class="text-xs truncate text-text-muted"
                  [pTooltip]="inst.email"
                  tooltipPosition="top"
                >
                  {{ inst.email }}
                </p>
              </div>
            </div>

            <!-- ── Información Personal ────────────────────────────────────────── -->
            <h3 class="section-title">Información Personal</h3>
            <div class="flex flex-col gap-4 mb-6">
              <!-- Nombres -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-nombres">Nombres *</label>
                <input
                  id="e-nombres"
                  type="text"
                  class="field-input"
                  [class.field-input--error]="nombresTouched() && !nombresValido()"
                  [ngModel]="nombres()"
                  (ngModelChange)="nombres.set($event)"
                  (blur)="nombresTouched.set(true)"
                  data-llm-description="Nombres del instructor"
                  aria-required="true"
                />
                @if (nombresTouched() && !nombresValido()) {
                  <span class="field-error">Ingresa el nombre (mínimo 2 caracteres)</span>
                }
              </div>

              <!-- Apellido Paterno -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-paterno">Apellido Paterno *</label>
                <input
                  id="e-paterno"
                  type="text"
                  class="field-input"
                  [class.field-input--error]="paternoTouched() && !paternoValido()"
                  [ngModel]="paterno()"
                  (ngModelChange)="paterno.set($event)"
                  (blur)="paternoTouched.set(true)"
                  data-llm-description="Apellido paterno del instructor"
                  aria-required="true"
                />
                @if (paternoTouched() && !paternoValido()) {
                  <span class="field-error">Ingresa el apellido paterno (mínimo 2 caracteres)</span>
                }
              </div>

              <!-- Apellido Materno -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-materno">Apellido Materno *</label>
                <input
                  id="e-materno"
                  type="text"
                  class="field-input"
                  [class.field-input--error]="maternoTouched() && !maternoValido()"
                  [ngModel]="materno()"
                  (ngModelChange)="materno.set($event)"
                  (blur)="maternoTouched.set(true)"
                  data-llm-description="Apellido materno del instructor"
                  aria-required="true"
                />
                @if (maternoTouched() && !maternoValido()) {
                  <span class="field-error">Ingresa el apellido materno (mínimo 2 caracteres)</span>
                }
              </div>

              <!-- RUT (readonly) -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-rut">RUT *</label>
                <input
                  id="e-rut"
                  type="text"
                  class="field-input cursor-not-allowed"
                  [ngModel]="inst.rut"
                  [disabled]="true"
                  style="opacity: 0.6"
                  data-llm-description="RUT del instructor (no editable)"
                />
                <span class="text-xs text-text-muted"> El RUT no puede ser modificado </span>
              </div>

              <!-- Email -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-email">Correo electrónico *</label>
                <input
                  id="e-email"
                  type="email"
                  class="field-input"
                  [class.field-input--error]="emailTouched() && !emailValido()"
                  [ngModel]="email()"
                  (ngModelChange)="email.set($event)"
                  (blur)="emailTouched.set(true)"
                  data-llm-description="Correo electrónico del instructor"
                  aria-required="true"
                />
                @if (emailTouched() && !emailValido()) {
                  <span class="field-error">Ingresa un correo electrónico válido.</span>
                }
                @if (email() !== currentEmail && emailValido()) {
                  <span class="text-xs text-warning">
                    Se actualizará el acceso. El cambio es inmediato.
                  </span>
                }
              </div>

              <!-- Teléfono -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-telefono">Teléfono</label>
                <input
                  id="e-telefono"
                  type="tel"
                  class="field-input"
                  placeholder="+56 9 8765 4321"
                  [ngModel]="telefono()"
                  (ngModelChange)="telefono.set($event)"
                  data-llm-description="Teléfono de contacto del instructor"
                />
              </div>

              <!-- Sede (solo admin: la secretaria pertenece a una única sede, ya implícita) -->
              @if (authFacade.currentUser()?.role === 'admin') {
                <div class="flex flex-col gap-1.5">
                  <app-branch-scope-selector
                    [branches]="branchFacade.branches()"
                    [branchId]="sedeId()"
                    [bothBranches]="bothBranches()"
                    [role]="authFacade.currentUser()?.role ?? ''"
                    mode="editar"
                    (valueChange)="onSedeScopeChange($event)"
                  />
                </div>
              }
            </div>

            <!-- ── Información de Licencia ─────────────────────────────────────── -->
            <!-- Sin selector de clase: instructors es exclusivamente Clase B (los relatores
                 Profesional son la tabla lecturers, aparte) — se guarda 'B' fijo al enviar. -->
            <h3 class="section-title">Licencia Clase B</h3>
            <div class="flex flex-col gap-4 mb-6">
              <!-- Número de licencia -->
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-license-num">Número de licencia *</label>
                <input
                  id="e-license-num"
                  type="text"
                  class="field-input"
                  placeholder="15234567"
                  [ngModel]="licenseNumber()"
                  (ngModelChange)="licenseNumber.set($event)"
                  data-llm-description="Número de licencia del instructor"
                />
              </div>

              <!-- Fecha de vencimiento -->
              <div class="flex flex-col gap-1.5">
                <app-date-input
                  label="Fecha de vencimiento"
                  [required]="true"
                  [value]="licenseExpiryIso"
                  (valueChange)="setLicenseExpiryIso($event)"
                  data-llm-description="Fecha de vencimiento de la licencia"
                />
                @if (licenseExpiryTouched() && !licenseExpiryValido()) {
                  <span class="field-error">Selecciona la fecha de vencimiento</span>
                }
              </div>

              <!-- Estado de validación (solo lectura) -->
              @if (licenseStatusPreview()) {
                <div class="flex flex-col gap-1.5">
                  <span class="field-label">Estado de validación</span>
                  <span class="license-badge" [class]="'license-badge--' + licenseStatusPreview()">
                    {{ licenseStatusLabel() }}
                  </span>
                </div>
              }
            </div>

            <!-- ── Documentos ───────────────────────────────────────────────────── -->
            <h3 class="section-title">Documentos</h3>
            <div class="mb-6">
              <button
                type="button"
                class="btn-secondary w-full flex items-center justify-center gap-2"
                data-llm-action="ver-documentos-instructor"
                (click)="verDocumentos(inst)"
              >
                <app-icon name="shield-check" [size]="15" />
                Ver y subir documentos
              </button>
            </div>

            <!-- ── Tipo de Instructor ──────────────────────────────────────────── -->
            <h3 class="section-title">Tipo de Instructor</h3>
            <div class="flex flex-col gap-4 mb-6">
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-type">Tipo de instructor *</label>
                <p-select
                  inputId="e-type"
                  [options]="typeOptions"
                  [(ngModel)]="typeModel"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Seleccione tipo"
                  styleClass="w-full"
                  aria-required="true"
                  data-llm-description="Tipo de instructor"
                />
                @if (tipoTouched() && !tipoValido()) {
                  <span class="field-error">Selecciona el tipo de instructor</span>
                }
              </div>
            </div>

            <!-- ── Asignación de Vehículo ──────────────────────────────────────── -->
            <h3 class="section-title">Asignación de Vehículo</h3>
            <div class="flex flex-col gap-4 mb-6">
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="e-vehicle">Vehículo asignado</label>
                <p-select
                  inputId="e-vehicle"
                  [options]="vehicleOptions()"
                  [(ngModel)]="vehicleIdModel"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Sin vehículo asignado"
                  [showClear]="true"
                  styleClass="w-full"
                  data-llm-description="Vehículo asignado al instructor"
                />
                <span class="text-xs text-text-muted">
                  Solo se muestran vehículos disponibles y el actualmente asignado
                </span>
                @if (vehicleId() !== currentVehicleId()) {
                  <span class="text-xs text-text-muted">
                    Al cambiar el vehículo, se creará una nueva entrada en el historial de
                    asignaciones.
                  </span>
                }
                @if (sedeSinCoberturaWarning(); as warning) {
                  <div
                    class="flex items-start gap-2 p-2.5 rounded-lg border border-warning bg-warning/10"
                    data-llm-description="warning that this instructor cannot take classes in the branch not covered by their assigned vehicle"
                  >
                    <app-icon
                      name="alert-triangle"
                      [size]="14"
                      color="var(--state-warning)"
                      class="shrink-0 mt-0.5"
                    />
                    <span class="text-xs text-warning">{{ warning }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- ── Historial de Asignaciones ───────────────────────────────────── -->
            <h3 class="section-title">Historial de Asignaciones</h3>
            <div class="flex flex-col gap-2 mb-6">
              @if (facade.assignmentHistory().length === 0) {
                <div class="flex flex-col items-center gap-2 py-6">
                  <app-icon name="file-text" [size]="28" color="var(--text-muted)" />
                  <p class="text-xs text-center text-text-muted">
                    Sin historial de asignaciones de vehículos
                  </p>
                  <p class="text-xs text-center text-text-muted">
                    Las asignaciones futuras aparecerán aquí
                  </p>
                </div>
              } @else {
                @for (h of facade.assignmentHistory(); track h.id) {
                  <div class="flex items-center justify-between py-2.5 px-3 rounded-lg bg-elevated">
                    <div>
                      <p class="item-title">
                        {{ h.vehiclePlate }}
                      </p>
                      <p class="text-xs text-text-muted">{{ h.vehicleModel }}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-xs text-text-secondary">
                        {{ h.startDate }}
                        @if (h.endDate) {
                          → {{ h.endDate }}
                        } @else {
                          → Actual
                        }
                      </p>
                    </div>
                  </div>
                }
              }
            </div>

            <!-- Instructor sin cuenta activada: nunca tuvo cuenta Auth (fix-169-m,
                 ej. filas insertadas vía seed/SQL directo) o nunca seteó su contraseña -->
            @if (!inst.hasAuthAccount || inst.firstLogin) {
              <div
                class="flex flex-col gap-2 p-3 rounded-lg text-sm mb-6 bg-warning-subtle text-warning"
                style="border: 1px solid var(--state-warning-border)"
              >
                <span class="flex items-center gap-2 font-medium">
                  <app-icon name="alert-triangle" [size]="16" />
                  Este instructor todavía no tiene cuenta activada para ingresar al sistema.
                </span>
                <button
                  type="button"
                  class="btn-secondary self-start flex items-center gap-2"
                  [disabled]="isSendingInvite() || !emailValido()"
                  (click)="onEnviarInvitacion(inst.userId)"
                  data-llm-action="enviar-invitacion-instructor"
                >
                  @if (isSendingInvite()) {
                    <app-icon name="loader-circle" [size]="14" class="animate-spin" />
                    Enviando...
                  } @else {
                    Reenviar invitación
                  }
                </button>
              </div>
            }

            <!-- ── Estado activo/inactivo ──────────────────────────────────────── -->
            <div class="flex flex-col gap-4 mb-6">
              <h3 class="section-title">Estado de la cuenta</h3>
              <div class="flex items-center gap-3">
                <button
                  class="estado-btn"
                  [class.estado-btn--active]="activo()"
                  (click)="activo.set(true)"
                  data-llm-action="activar-instructor"
                >
                  <app-icon name="check-circle" [size]="14" />
                  Activo
                </button>
                <button
                  class="estado-btn"
                  [class.estado-btn--inactive]="!activo()"
                  (click)="activo.set(false)"
                  data-llm-action="desactivar-instructor"
                >
                  <app-icon name="circle" [size]="14" />
                  Inactivo
                </button>
              </div>
              @if (!activo()) {
                <div class="rounded-lg p-3 bg-error/6 border border-error/20">
                  <p class="text-xs text-error">
                    Desactivar este instructor impedirá nuevas asignaciones de clases.
                  </p>
                </div>
              }
            </div>
          </ng-template>
        </app-drawer-content-loader>

        <ng-container ngProjectAs="[drawer-form-footer]">
          <button
            class="btn-secondary"
            (click)="layoutDrawer.close()"
            data-llm-action="cancelar-editar-instructor"
          >
            Cancelar
          </button>
          <button
            class="btn-primary flex items-center justify-center gap-2"
            [disabled]="facade.isSubmitting()"
            [appStableWidth]="facade.isSubmitting()"
            (click)="submit(inst.id, inst.userId)"
            data-llm-action="guardar-editar-instructor"
            aria-label="Guardar cambios del instructor"
          >
            @if (facade.isSubmitting()) {
              <app-icon name="loader-2" [size]="15" class="animate-spin" />
              Guardando...
            } @else {
              <app-icon name="check" [size]="15" />
              Guardar cambios
            }
          </button>
        </ng-container>
      </app-drawer-form>
    }
  `,
  styles: `
    /* .field-*, .section-title → globales en styles/components/_form-fields.scss */
    .license-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 4px;
      width: fit-content;
    }
    .license-badge--valid {
      background: color-mix(in srgb, var(--state-success) 12%, transparent);
      color: var(--state-success);
    }
    .license-badge--expiring_soon {
      background: color-mix(in srgb, var(--state-warning) 12%, transparent);
      color: var(--state-warning);
    }
    .license-badge--expired {
      background: color-mix(in srgb, var(--state-error) 12%, transparent);
      color: var(--state-error);
    }

    .estado-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 0;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: transparent;
      color: var(--text-muted);
      font-size: var(--text-sm);
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .estado-btn--active {
      border-color: var(--state-success);
      background: color-mix(in srgb, var(--state-success) 10%, transparent);
      color: var(--state-success);
    }
    .estado-btn--inactive {
      border-color: var(--border-strong, var(--text-muted));
      background: var(--bg-elevated);
      color: var(--text-secondary);
    }
  `,
})
export class AdminInstructorEditarDrawerComponent implements OnInit {
  protected readonly facade = inject(InstructoresFacade);
  protected readonly dmsFacade = inject(DmsFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  protected readonly branchFacade = inject(BranchFacade);
  protected readonly authFacade = inject(AuthFacade);

  // ── Campos ─────────────────────────────────────────────────────────────────
  protected readonly nombres = signal('');
  protected readonly paterno = signal('');
  protected readonly materno = signal('');
  protected readonly email = signal('');
  protected readonly telefono = signal('');
  protected readonly licenseNumber = signal('');
  protected readonly licenseExpiry = signal<Date | null>(null);
  protected readonly tipo = signal<InstructorType | null>(null);
  protected readonly vehicleId = signal<number | null>(null);
  protected readonly sedeId = signal<number | null>(null);
  protected readonly bothBranches = signal(false);
  protected readonly activo = signal(true);
  protected readonly isSendingInvite = signal(false);

  protected currentEmail = '';
  protected readonly currentVehicleId = signal<number | null>(null);

  // ── Touched ────────────────────────────────────────────────────────────────
  protected readonly nombresTouched = signal(false);
  protected readonly paternoTouched = signal(false);
  protected readonly maternoTouched = signal(false);
  protected readonly emailTouched = signal(false);
  protected readonly licenseExpiryTouched = signal(false);
  protected readonly tipoTouched = signal(false);

  // ── Validaciones ───────────────────────────────────────────────────────────
  protected readonly nombresValido = computed(() => this.nombres().trim().length >= 2);
  protected readonly paternoValido = computed(() => this.paterno().trim().length >= 2);
  protected readonly maternoValido = computed(() => this.materno().trim().length >= 2);
  protected readonly emailValido = computed(() =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()),
  );
  protected readonly licenseExpiryValido = computed(() => !!this.licenseExpiry());
  protected readonly tipoValido = computed(() => !!this.tipo());

  protected readonly licenseStatusPreview = computed(() => {
    const d = this.licenseExpiry();
    if (!d) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(d);
    expiry.setHours(0, 0, 0, 0);
    if (expiry < today) return 'expired';
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) return 'expiring_soon';
    return 'valid';
  });

  protected readonly licenseStatusLabel = computed(() => {
    const s = this.licenseStatusPreview();
    if (s === 'valid') return 'Vigente';
    if (s === 'expiring_soon') return 'Por vencer';
    if (s === 'expired') return 'Vencida';
    return '';
  });

  protected readonly formValido = computed(
    () =>
      this.nombresValido() &&
      this.paternoValido() &&
      this.maternoValido() &&
      this.emailValido() &&
      this.licenseExpiryValido() &&
      this.tipoValido(),
  );

  // ── Options ────────────────────────────────────────────────────────────────
  protected readonly typeOptions = [
    { label: 'Práctico', value: 'practice' },
    { label: 'Teórico', value: 'theory' },
    { label: 'Ambos', value: 'both' },
  ];

  /** Disponibles + el actual, filtrados por (sede elegida) o "Ambas" — spec 0004-m, AC6. */
  protected readonly vehicleOptions = computed(() => {
    const sedeId = this.sedeId();
    return this.facade
      .vehicles()
      .filter((v) => v.status === 'available' || v.id === this.currentVehicleId())
      .filter((v) => v.bothBranches || v.branchId === sedeId)
      .map((v) => ({
        label: v.label,
        value: v.id,
      }));
  });

  /** AC-E1: instructor "Ambas" con vehículo que no cubre la otra sede. */
  protected readonly sedeSinCoberturaWarning = computed((): string | null => {
    if (!this.bothBranches()) return null;
    const vid = this.vehicleId();
    if (vid === null) return null;
    const vehicle = this.facade.vehicles().find((v) => v.id === vid);
    if (!vehicle || vehicle.bothBranches) return null;
    const sedeNoCubierta = this.branchFacade
      .branches()
      .find((b) => b.id !== vehicle.branchId)?.name;
    const sedeVehiculo = this.branchFacade.branches().find((b) => b.id === vehicle.branchId)?.name;
    if (!sedeNoCubierta || !sedeVehiculo) return null;
    return `Este instructor no podrá dictar clases en ${sedeNoCubierta}: su vehículo asignado es de ${sedeVehiculo} y no está marcado "Ambas". Para que pueda operar en las dos sedes, asígnale un vehículo "Ambas".`;
  });

  protected onSedeScopeChange(value: { branchId: number | null; bothBranches: boolean }): void {
    this.sedeId.set(value.branchId);
    this.bothBranches.set(value.bothBranches);
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
  }

  protected get vehicleIdModel(): number | null {
    return this.vehicleId();
  }
  protected set vehicleIdModel(v: number | null) {
    this.vehicleId.set(v);
  }

  constructor() {
    effect(() => {
      const inst = this.facade.selectedInstructor();
      if (inst) {
        this.nombres.set(inst.firstName);
        this.paterno.set(inst.paternalLastName);
        this.materno.set(inst.maternalLastName);
        this.email.set(inst.email);
        this.currentEmail = inst.email;
        this.telefono.set(inst.phone);
        this.licenseNumber.set(inst.licenseNumber);
        this.tipo.set(inst.tipo);
        this.vehicleId.set(inst.vehicleId);
        this.currentVehicleId.set(inst.vehicleId);
        this.sedeId.set(inst.branchId);
        this.bothBranches.set(inst.bothBranches);
        this.activo.set(inst.estado === 'activo');

        // Parse license expiry date
        if (inst.licenseExpiry) {
          this.licenseExpiry.set(new Date(inst.licenseExpiry + 'T12:00:00'));
        } else {
          this.licenseExpiry.set(null);
        }

        // Reset touched
        this.nombresTouched.set(false);
        this.paternoTouched.set(false);
        this.maternoTouched.set(false);
        this.emailTouched.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.facade.loadVehicles();
  }

  protected verDocumentos(inst: { id: number; nombre: string }): void {
    this.dmsFacade.openInstructorDocsDrawer(inst.id, inst.nombre);
  }

  protected async onEnviarInvitacion(userId: number): Promise<void> {
    if (!userId || !this.emailValido()) return;

    this.isSendingInvite.set(true);
    try {
      await this.facade.enviarInvitacion(userId, this.email());
    } finally {
      this.isSendingInvite.set(false);
    }
  }

  protected async submit(instructorId: number, userId: number): Promise<void> {
    this.nombresTouched.set(true);
    this.paternoTouched.set(true);
    this.maternoTouched.set(true);
    this.emailTouched.set(true);
    this.licenseExpiryTouched.set(true);
    this.tipoTouched.set(true);

    if (!this.formValido()) return;

    const expiryDate = this.licenseExpiry();
    const expiryStr = expiryDate
      ? `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, '0')}-${String(expiryDate.getDate()).padStart(2, '0')}`
      : '';

    const ok = await this.facade.editarInstructor(instructorId, userId, {
      firstNames: this.nombres().trim(),
      paternalLastName: this.paterno().trim(),
      maternalLastName: this.materno().trim(),
      phone: this.telefono(),
      email: this.email().trim().toLowerCase(),
      currentEmail: this.currentEmail,
      type: this.tipo() ?? 'practice',
      licenseNumber: this.licenseNumber(),
      licenseClass: 'B', // instructors es exclusivamente Clase B
      licenseExpiry: expiryStr,
      active: this.activo(),
      vehicleId: this.vehicleId(),
      currentVehicleId: this.currentVehicleId(),
      branchId: this.sedeId()!,
      bothBranches: this.bothBranches(),
    });

    if (ok) {
      this.layoutDrawer.close();
      this.facade.initialize(); // Refresh table
    }
  }
}
