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
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { InstructorType } from '@core/models/ui/instructor-table.model';

@Component({
  selector: 'app-admin-instructor-editar-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, DatePickerModule, IconComponent],
  template: `
    @if (facade.selectedInstructor(); as inst) {
      <!-- ── Mini-header ─────────────────────────────────────────────────── -->
      <div
        class="flex items-center gap-3 rounded-lg p-3 mb-5"
        style="background: var(--bg-elevated); border: 1px solid var(--border-subtle)"
      >
        <div
          class="flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-sm font-bold"
          style="background: var(--color-primary-tint); color: var(--color-primary)"
        >
          {{ inst.initials }}
        </div>
        <div class="min-w-0">
          <p class="text-sm font-semibold truncate" style="color: var(--text-primary)">
            {{ inst.nombre }}
          </p>
          <p class="text-xs truncate" style="color: var(--text-muted)">{{ inst.email }}</p>
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
            class="field-input"
            [ngModel]="inst.rut"
            [disabled]="true"
            style="opacity: 0.6; cursor: not-allowed"
            data-llm-description="RUT del instructor (no editable)"
          />
          <span class="text-xs" style="color: var(--text-muted)">
            El RUT no puede ser modificado
          </span>
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
            <span class="text-xs" style="color: var(--state-warning)">
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

        <!-- Sede -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label" for="e-sede">Sede asignada *</label>
          <p-select
            inputId="e-sede"
            [options]="sedeOptions()"
            [(ngModel)]="sedeIdModel"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleccione sede"
            [style]="{ width: '100%', height: '40px' }"
            aria-required="true"
            data-llm-description="Sede de trabajo del instructor"
          />
        </div>
      </div>

      <!-- ── Información de Licencia ─────────────────────────────────────── -->
      <h3 class="section-title">Información de Licencia</h3>
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

        <!-- Clase de licencia -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label" for="e-license-class">Clase de licencia *</label>
          <p-select
            inputId="e-license-class"
            [options]="licenseClassOptions"
            [(ngModel)]="licenseClassModel"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleccione clase"
            [style]="{ width: '100%', height: '40px' }"
            aria-required="true"
            data-llm-description="Clase de licencia del instructor"
          />
          @if (licenseClassTouched() && !licenseClassValido()) {
            <span class="field-error">Selecciona la clase de licencia</span>
          }
        </div>

        <!-- Fecha de vencimiento -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label" for="e-license-expiry">Fecha de vencimiento *</label>
          <p-datepicker
            inputId="e-license-expiry"
            [(ngModel)]="licenseExpiryModel"
            dateFormat="dd/mm/yy"
            [showIcon]="true"
            [style]="{ width: '100%' }"
            placeholder="dd/mm/aaaa"
            aria-required="true"
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
            [style]="{ width: '100%', height: '40px' }"
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
            [style]="{ width: '100%', height: '40px' }"
            data-llm-description="Vehículo asignado al instructor"
          />
          <span class="text-xs" style="color: var(--text-muted)">
            Solo se muestran vehículos disponibles y el actualmente asignado
          </span>
          @if (vehicleId() !== currentVehicleId()) {
            <span class="text-xs" style="color: var(--text-muted)">
              Al cambiar el vehículo, se creará una nueva entrada en el historial de asignaciones.
            </span>
          }
        </div>
      </div>

      <!-- ── Historial de Asignaciones ───────────────────────────────────── -->
      <h3 class="section-title">Historial de Asignaciones</h3>
      <div class="flex flex-col gap-2 mb-6">
        @if (facade.assignmentHistory().length === 0) {
          <div class="flex flex-col items-center gap-2 py-6">
            <app-icon name="file-text" [size]="28" color="var(--text-muted)" />
            <p class="text-xs text-center" style="color: var(--text-muted)">
              Sin historial de asignaciones de vehículos
            </p>
            <p class="text-xs text-center" style="color: var(--text-muted)">
              Las asignaciones futuras aparecerán aquí
            </p>
          </div>
        } @else {
          @for (h of facade.assignmentHistory(); track h.id) {
            <div
              class="flex items-center justify-between py-2.5 px-3 rounded-lg"
              style="background: var(--bg-elevated)"
            >
              <div>
                <p class="text-sm font-semibold" style="color: var(--text-primary)">
                  {{ h.vehiclePlate }}
                </p>
                <p class="text-xs" style="color: var(--text-muted)">{{ h.vehicleModel }}</p>
              </div>
              <div class="text-right">
                <p class="text-xs" style="color: var(--text-secondary)">
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
          <div
            class="rounded-lg p-3"
            style="
              background: color-mix(in srgb, var(--state-error) 6%, transparent);
              border: 1px solid color-mix(in srgb, var(--state-error) 20%, transparent);
            "
          >
            <p class="text-xs" style="color: var(--state-error)">
              Desactivar este instructor impedirá nuevas asignaciones de clases.
            </p>
          </div>
        }
      </div>

      <!-- ── Acciones ────────────────────────────────────────────────────── -->
      <div class="flex items-center gap-3 pt-4" style="border-top: 1px solid var(--border-subtle)">
        <button
          class="cancel-btn"
          (click)="layoutDrawer.close()"
          data-llm-action="cancelar-editar-instructor"
        >
          Cancelar
        </button>
        <button
          class="submit-btn"
          [disabled]="facade.isSubmitting()"
          (click)="submit(inst.id, inst.userId)"
          data-llm-action="guardar-editar-instructor"
          aria-label="Guardar cambios del instructor"
        >
          @if (facade.isSubmitting()) {
            <span class="spinner"><app-icon name="loader-circle" [size]="15" /></span>
            Guardando...
          } @else {
            <app-icon name="check" [size]="15" />
            Guardar cambios
          }
        </button>
      </div>
    }
  `,
  styles: `
    .section-title {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .field-label {
      font-size: var(--text-sm);
      font-weight: 500;
      color: var(--text-primary);
    }

    .field-input {
      width: 100%;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      outline: none;
      transition:
        border-color var(--duration-fast),
        box-shadow var(--duration-fast);
      box-sizing: border-box;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }
    .field-input::placeholder {
      color: var(--text-muted);
    }
    .field-input--error {
      border-color: var(--state-error, #ef4444);
    }

    .field-error {
      font-size: 12px;
      color: var(--state-error, #ef4444);
    }

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

    .cancel-btn {
      flex: 1;
      padding: 9px 0;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: transparent;
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .cancel-btn:hover {
      border-color: var(--border-strong, var(--text-muted));
      color: var(--text-primary);
    }

    .submit-btn {
      flex: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 9px 0;
      border-radius: var(--radius-md);
      border: none;
      background: var(--ds-brand);
      color: white;
      font-size: var(--text-sm);
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: opacity var(--duration-fast);
    }
    .submit-btn:hover:not(:disabled) {
      opacity: 0.85;
    }
    .submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
    .spinner {
      display: inline-flex;
      animation: spin 0.75s linear infinite;
    }
  `,
})
export class AdminInstructorEditarDrawerComponent implements OnInit {
  protected readonly facade = inject(InstructoresFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  protected readonly branchFacade = inject(BranchFacade);

  // ── Campos ─────────────────────────────────────────────────────────────────
  protected readonly nombres = signal('');
  protected readonly paterno = signal('');
  protected readonly materno = signal('');
  protected readonly email = signal('');
  protected readonly telefono = signal('');
  protected readonly licenseNumber = signal('');
  protected readonly licenseClass = signal<string | null>(null);
  protected readonly licenseExpiry = signal<Date | null>(null);
  protected readonly tipo = signal<InstructorType | null>(null);
  protected readonly vehicleId = signal<number | null>(null);
  protected readonly sedeId = signal<number | null>(null);
  protected readonly activo = signal(true);

  protected currentEmail = '';
  protected readonly currentVehicleId = signal<number | null>(null);

  // ── Touched ────────────────────────────────────────────────────────────────
  protected readonly nombresTouched = signal(false);
  protected readonly paternoTouched = signal(false);
  protected readonly maternoTouched = signal(false);
  protected readonly emailTouched = signal(false);
  protected readonly licenseClassTouched = signal(false);
  protected readonly licenseExpiryTouched = signal(false);
  protected readonly tipoTouched = signal(false);

  // ── Validaciones ───────────────────────────────────────────────────────────
  protected readonly nombresValido = computed(() => this.nombres().trim().length >= 2);
  protected readonly paternoValido = computed(() => this.paterno().trim().length >= 2);
  protected readonly maternoValido = computed(() => this.materno().trim().length >= 2);
  protected readonly emailValido = computed(() =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()),
  );
  protected readonly licenseClassValido = computed(() => !!this.licenseClass());
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
      this.licenseClassValido() &&
      this.licenseExpiryValido() &&
      this.tipoValido(),
  );

  // ── Options ────────────────────────────────────────────────────────────────
  protected readonly licenseClassOptions = [
    { label: 'Clase B (Automóviles)', value: 'B' },
    { label: 'Clase A2 (Taxi básico)', value: 'A2' },
    { label: 'Clase A3 (Ambulancia)', value: 'A3' },
    { label: 'Clase A4 (Buses)', value: 'A4' },
    { label: 'Clase A5 (Camiones)', value: 'A5' },
  ];

  protected readonly typeOptions = [
    { label: 'Práctico', value: 'practice' },
    { label: 'Teórico', value: 'theory' },
    { label: 'Ambos', value: 'both' },
  ];

  protected readonly vehicleOptions = computed(() =>
    this.facade
      .vehicles()
      .filter((v) => v.status === 'available' || v.id === this.currentVehicleId())
      .map((v) => ({
        label: v.label,
        value: v.id,
      })),
  );

  // ── Sede ──────────────────────────────────────────────────────────────────
  protected readonly sedeOptions = computed(() =>
    this.branchFacade.branches().map((b) => ({ label: b.name, value: b.id })),
  );

  protected get sedeIdModel(): number | null {
    return this.sedeId();
  }
  protected set sedeIdModel(v: number | null) {
    this.sedeId.set(v);
  }

  // ── p-select models ────────────────────────────────────────────────────────
  protected get licenseClassModel(): string | null {
    return this.licenseClass();
  }
  protected set licenseClassModel(v: string | null) {
    this.licenseClass.set(v);
  }

  protected get licenseExpiryModel(): Date | null {
    return this.licenseExpiry();
  }
  protected set licenseExpiryModel(v: Date | null) {
    this.licenseExpiry.set(v);
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
        this.licenseClass.set(inst.licenseClass || null);
        this.tipo.set(inst.tipo);
        this.vehicleId.set(inst.vehicleId);
        this.currentVehicleId.set(inst.vehicleId);
        this.sedeId.set(inst.branchId);
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

  protected async submit(instructorId: number, userId: number): Promise<void> {
    this.nombresTouched.set(true);
    this.paternoTouched.set(true);
    this.maternoTouched.set(true);
    this.emailTouched.set(true);
    this.licenseClassTouched.set(true);
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
      licenseClass: this.licenseClass() ?? '',
      licenseExpiry: expiryStr,
      active: this.activo(),
      vehicleId: this.vehicleId(),
      currentVehicleId: this.currentVehicleId(),
      branchId: this.sedeId()!,
    });

    if (ok) {
      this.layoutDrawer.close();
      this.facade.initialize(); // Refresh table
    }
  }
}
