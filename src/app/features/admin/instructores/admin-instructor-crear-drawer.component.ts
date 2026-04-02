import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InstructoresFacade } from '@core/facades/instructores.facade';
import { formatRut, validateRut } from '@core/utils/rut.utils';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { InstructorType } from '@core/models/ui/instructor-table.model';

@Component({
  selector: 'app-admin-instructor-crear-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, DatePickerModule, IconComponent],
  template: `
    <!-- ── Info rol ──────────────────────────────────────────────────────── -->
    <div
      class="flex items-start gap-3 rounded-lg p-3 mb-5"
      style="
        background: color-mix(in srgb, var(--ds-brand) 6%, transparent);
        border: 1px solid color-mix(in srgb, var(--ds-brand) 20%, transparent);
      "
    >
      <app-icon name="clipboard-list" [size]="16" color="var(--ds-brand)" />
      <p class="text-xs leading-relaxed" style="color: var(--ds-brand)">
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
        <label class="field-label" for="c-materno">Apellido Materno *</label>
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
          <span class="field-error">Ingresa el apellido materno (mínimo 2 caracteres)</span>
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
    </div>

    <!-- ── Sección: Información de Licencia ──────────────────────────────── -->
    <h3 class="section-title">Información de Licencia</h3>
    <div class="flex flex-col gap-4 mb-6">
      <!-- Clase de licencia -->
      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="c-license-class">Clase de licencia *</label>
        <p-select
          inputId="c-license-class"
          [options]="licenseClassOptions"
          [(ngModel)]="licenseClassModel"
          optionLabel="label"
          optionValue="value"
          placeholder="Seleccione clase"
          [style]="{ width: '100%', height: '40px' }"
          aria-required="true"
          data-llm-description="Clase de licencia del instructor"
        />
        @if (licenseClassTouched() && !licenseClassValida()) {
          <span class="field-error">Selecciona la clase de licencia.</span>
        }
      </div>

      <!-- Fecha de vencimiento -->
      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="c-license-expiry">Fecha de vencimiento *</label>
        <p-datepicker
          inputId="c-license-expiry"
          [(ngModel)]="licenseExpiryModel"
          dateFormat="dd/mm/yy"
          [showIcon]="true"
          [style]="{ width: '100%' }"
          placeholder="dd/mm/aaaa"
          aria-required="true"
          data-llm-description="Fecha de vencimiento de la licencia del instructor"
        />
        @if (licenseExpiryTouched() && !licenseExpiryValida()) {
          <span class="field-error">Selecciona la fecha de vencimiento.</span>
        }
        @if (licenseExpiryValida() && licenseStatusPreview()) {
          <div class="flex items-center gap-2 mt-1">
            @if (licenseStatusPreview() === 'valid') {
              <app-icon name="check-circle" [size]="13" color="var(--state-success)" />
              <span class="text-xs" style="color: var(--state-success)">
                Vigente: más de 30 días para vencer
              </span>
            } @else if (licenseStatusPreview() === 'expiring_soon') {
              <app-icon name="alert-triangle" [size]="13" color="var(--state-warning)" />
              <span class="text-xs" style="color: var(--state-warning)">
                Por vencer: menos de 30 días
              </span>
            } @else {
              <app-icon name="circle-x" [size]="13" color="var(--state-error)" />
              <span class="text-xs" style="color: var(--state-error)">
                Vencida: no se puede registrar
              </span>
            }
          </div>
        }
      </div>
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
          [style]="{ width: '100%', height: '40px' }"
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
          [style]="{ width: '100%', height: '40px' }"
          data-llm-description="Vehículo asignado al instructor (opcional)"
        />
        <span class="text-xs" style="color: var(--text-muted)">
          Solo se muestran vehículos disponibles
        </span>
      </div>
    </div>

    <!-- ── Acciones ──────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-3 pt-4" style="border-top: 1px solid var(--border-subtle)">
      <button
        class="cancel-btn"
        (click)="closed.emit()"
        data-llm-action="cancelar-crear-instructor"
      >
        Cancelar
      </button>
      <button
        class="submit-btn"
        [disabled]="facade.isSubmitting()"
        (click)="submit()"
        data-llm-action="confirmar-crear-instructor"
        aria-label="Crear nuevo instructor"
      >
        @if (facade.isSubmitting()) {
          <span class="spinner"><app-icon name="loader-circle" [size]="15" /></span>
          Creando...
        } @else {
          <app-icon name="user-plus" [size]="15" />
          Crear instructor
        }
      </button>
    </div>
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
    .field-input--valid {
      border-color: var(--state-success, #22c55e);
    }
    .field-success {
      font-size: 12px;
      color: var(--state-success, #22c55e);
    }

    .field-error {
      font-size: 12px;
      color: var(--state-error, #ef4444);
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
export class AdminInstructorCrearDrawerComponent implements OnInit {
  protected readonly facade = inject(InstructoresFacade);
  readonly closed = output<void>();

  // ── Campos ─────────────────────────────────────────────────────────────────
  protected readonly nombres = signal('');
  protected readonly paterno = signal('');
  protected readonly materno = signal('');
  protected readonly rut = signal('');
  protected readonly email = signal('');
  protected readonly telefono = signal('');
  protected readonly licenseClass = signal<string | null>(null);
  protected readonly licenseExpiry = signal<Date | null>(null);
  protected readonly tipo = signal<InstructorType | null>(null);
  protected readonly vehicleId = signal<number | null>(null);

  // ── Touched ────────────────────────────────────────────────────────────────
  protected readonly nombresTouched = signal(false);
  protected readonly paternoTouched = signal(false);
  protected readonly maternoTouched = signal(false);
  protected readonly rutTouched = signal(false);
  protected readonly emailTouched = signal(false);
  protected readonly telefonoTouched = signal(false);
  protected readonly licenseClassTouched = signal(false);
  protected readonly licenseExpiryTouched = signal(false);
  protected readonly typeTouched = signal(false);

  // ── Validaciones ───────────────────────────────────────────────────────────
  protected readonly nombresValido = computed(() => this.nombres().trim().length >= 2);
  protected readonly paternoValido = computed(() => this.paterno().trim().length >= 2);
  protected readonly maternoValido = computed(() => this.materno().trim().length >= 2);
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
  protected readonly licenseClassValida = computed(() => this.licenseClass() !== null);
  protected readonly licenseExpiryValida = computed(() => this.licenseExpiry() !== null);
  protected readonly typeValido = computed(() => this.tipo() !== null);

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

  protected readonly formValido = computed(
    () =>
      this.nombresValido() &&
      this.paternoValido() &&
      this.maternoValido() &&
      this.rutValido() &&
      this.emailValido() &&
      this.telefonoValido() &&
      this.licenseClassValida() &&
      this.licenseExpiryValida() &&
      this.typeValido() &&
      this.licenseStatusPreview() !== 'expired',
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
      .filter((v) => v.status === 'available')
      .map((v) => ({
        label: v.label,
        value: v.id,
      })),
  );

  // ── p-select models ────────────────────────────────────────────────────────
  protected get licenseClassModel(): string | null {
    return this.licenseClass();
  }
  protected set licenseClassModel(v: string | null) {
    this.licenseClass.set(v);
    this.licenseClassTouched.set(true);
  }

  protected get licenseExpiryModel(): Date | null {
    return this.licenseExpiry();
  }
  protected set licenseExpiryModel(v: Date | null) {
    this.licenseExpiry.set(v);
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

  ngOnInit(): void {
    this.facade.loadVehicles();
  }

  protected onRutInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatRut(input.value);
    this.rut.set(formatted);
    input.value = formatted;
  }

  protected async submit(): Promise<void> {
    // Mark all as touched
    this.nombresTouched.set(true);
    this.paternoTouched.set(true);
    this.maternoTouched.set(true);
    this.rutTouched.set(true);
    this.emailTouched.set(true);
    this.telefonoTouched.set(true);
    this.licenseClassTouched.set(true);
    this.licenseExpiryTouched.set(true);
    this.typeTouched.set(true);

    if (!this.formValido()) return;

    const expiryDate = this.licenseExpiry()!;
    const expiryStr = `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, '0')}-${String(expiryDate.getDate()).padStart(2, '0')}`;

    const ok = await this.facade.crearInstructor({
      firstNames: this.nombres().trim(),
      paternalLastName: this.paterno().trim(),
      maternalLastName: this.materno().trim(),
      rut: this.rut(),
      email: this.email().trim().toLowerCase(),
      phone: this.telefono().trim(),
      type: this.tipo()!,
      licenseNumber: '',
      licenseClass: this.licenseClass()!,
      licenseExpiry: expiryStr,
      vehicleId: this.vehicleId(),
    });

    if (ok) {
      this.closed.emit();
    }
  }
}
