import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RelatoresFacade } from '@core/facades/relatores.facade';
import { formatRut, validateRut } from '@core/utils/rut.utils';
import { IconComponent } from '@shared/components/icon/icon.component';

const SPECIALIZATIONS = ['A2', 'A3', 'A4', 'A5'];

@Component({
  selector: 'app-admin-relator-crear-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  template: `
    <!-- ── Aviso ───────────────────────────────────────────────────────────── -->
    <div
      class="flex items-start gap-3 rounded-lg p-3 mb-5"
      style="
        background: color-mix(in srgb, var(--ds-brand) 6%, transparent);
        border: 1px solid color-mix(in srgb, var(--ds-brand) 20%, transparent);
      "
    >
      <app-icon name="mic" [size]="16" color="var(--ds-brand)" />
      <p class="text-xs leading-relaxed" style="color: var(--ds-brand)">
        Los relatores son exclusivos de Clase Profesional y no tienen acceso al sistema.
      </p>
    </div>

    <!-- ── Información Personal ───────────────────────────────────────────── -->
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
          placeholder="Roberto"
          [ngModel]="nombres()"
          (ngModelChange)="nombres.set($event)"
          (blur)="nombresTouched.set(true)"
          data-llm-description="Nombres del nuevo relator"
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
          placeholder="Muñoz"
          [ngModel]="paterno()"
          (ngModelChange)="paterno.set($event)"
          (blur)="paternoTouched.set(true)"
          data-llm-description="Apellido paterno del nuevo relator"
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
          placeholder="Sánchez"
          [ngModel]="materno()"
          (ngModelChange)="materno.set($event)"
          data-llm-description="Apellido materno del nuevo relator (opcional)"
        />
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
          data-llm-description="RUT chileno del relator, formato 12.345.678-9"
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
        <label class="field-label" for="c-email">Correo electrónico</label>
        <input
          id="c-email"
          type="email"
          class="field-input"
          [class.field-input--error]="emailTouched() && email().length > 0 && !emailValido()"
          placeholder="rmunoz@conductores.cl"
          [ngModel]="email()"
          (ngModelChange)="email.set($event)"
          (blur)="emailTouched.set(true)"
          data-llm-description="Correo electrónico del relator (opcional)"
        />
        @if (emailTouched() && email().length > 0 && !emailValido()) {
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
          placeholder="+56 9 8111 2233"
          [ngModel]="telefono()"
          (ngModelChange)="telefono.set($event)"
          (blur)="telefonoTouched.set(true)"
          data-llm-description="Teléfono de contacto del relator"
          aria-required="true"
        />
        @if (telefonoTouched() && !telefonoValido()) {
          <span class="field-error">Ingresa un teléfono válido (mínimo 8 dígitos).</span>
        }
      </div>
    </div>

    <!-- ── Especialidades ──────────────────────────────────────────────────── -->
    <h3 class="section-title">Especialidades *</h3>
    <p class="text-xs mb-3" style="color: var(--text-muted)">
      Selecciona las clases que el relator puede dictar
    </p>
    <div class="grid grid-cols-2 gap-2 mb-2">
      @for (spec of specializationOptions; track spec.value) {
        <button
          type="button"
          class="spec-chip"
          [class.spec-chip--active]="isSelected(spec.value)"
          (click)="toggleSpec(spec.value)"
          [attr.aria-pressed]="isSelected(spec.value)"
          data-llm-action="toggle-especialidad"
        >
          <span class="spec-badge" [style.background]="spec.color">{{ spec.value }}</span>
          <span class="text-xs">{{ spec.label }}</span>
        </button>
      }
    </div>
    @if (specsTouched() && !specsValidas()) {
      <span class="field-error mb-4 block">Selecciona al menos una especialidad.</span>
    }

    <!-- ── Acciones ────────────────────────────────────────────────────────── -->
    <div
      class="flex items-center gap-3 pt-4 mt-4"
      style="border-top: 1px solid var(--border-subtle)"
    >
      <button class="cancel-btn" (click)="closed.emit()" data-llm-action="cancelar-crear-relator">
        Cancelar
      </button>
      <button
        class="submit-btn"
        [disabled]="facade.isSubmitting()"
        (click)="submit()"
        data-llm-action="confirmar-crear-relator"
        aria-label="Crear nuevo relator"
      >
        @if (facade.isSubmitting()) {
          <span class="spinner"><app-icon name="loader-circle" [size]="15" /></span>
          Creando...
        } @else {
          <app-icon name="user-plus" [size]="15" />
          Crear relator
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
    .field-error {
      font-size: 12px;
      color: var(--state-error, #ef4444);
    }
    .field-success {
      font-size: 12px;
      color: var(--state-success, #22c55e);
    }

    .spec-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-family: inherit;
      cursor: pointer;
      transition: all var(--duration-fast);
      text-align: left;
    }
    .spec-chip:hover {
      border-color: var(--ds-brand);
    }
    .spec-chip--active {
      border-color: var(--ds-brand);
      background: color-mix(in srgb, var(--ds-brand) 6%, transparent);
      color: var(--text-primary);
    }
    .spec-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      color: white;
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
export class AdminRelatorCrearDrawerComponent {
  protected readonly facade = inject(RelatoresFacade);
  readonly closed = output<void>();

  // ── Campos ──────────────────────────────────────────────────────────────────
  protected readonly nombres = signal('');
  protected readonly paterno = signal('');
  protected readonly materno = signal('');
  protected readonly rut = signal('');
  protected readonly email = signal('');
  protected readonly telefono = signal('');
  protected readonly selectedSpecs = signal<string[]>([]);

  // ── Touched ─────────────────────────────────────────────────────────────────
  protected readonly nombresTouched = signal(false);
  protected readonly paternoTouched = signal(false);
  protected readonly emailTouched = signal(false);
  protected readonly telefonoTouched = signal(false);
  protected readonly specsTouched = signal(false);

  // ── Validaciones ────────────────────────────────────────────────────────────
  protected readonly nombresValido = computed(() => this.nombres().trim().length >= 2);
  protected readonly paternoValido = computed(() => this.paterno().trim().length >= 2);
  protected readonly rutValido = computed(() => {
    const cleaned = this.rut().replace(/[^0-9kK]/g, '');
    return cleaned.length >= 8 && validateRut(this.rut());
  });
  protected readonly emailValido = computed(
    () => this.email().length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()),
  );
  protected readonly telefonoValido = computed(
    () => this.telefono().replace(/\D/g, '').length >= 8,
  );
  protected readonly specsValidas = computed(() => this.selectedSpecs().length > 0);

  protected readonly formValido = computed(
    () =>
      this.nombresValido() &&
      this.paternoValido() &&
      this.rutValido() &&
      this.emailValido() &&
      this.telefonoValido() &&
      this.specsValidas(),
  );

  // ── Opciones especialidades ─────────────────────────────────────────────────
  protected readonly specializationOptions = [
    { value: 'A2', label: 'Taxis y colectivos', color: '#3b82f6' },
    { value: 'A3', label: 'Buses', color: '#8b5cf6' },
    { value: 'A4', label: 'Carga simple', color: '#f59e0b' },
    { value: 'A5', label: 'Carga profesional', color: '#10b981' },
  ];

  protected isSelected(spec: string): boolean {
    return this.selectedSpecs().includes(spec);
  }

  protected toggleSpec(spec: string): void {
    this.specsTouched.set(true);
    const current = this.selectedSpecs();
    if (current.includes(spec)) {
      this.selectedSpecs.set(current.filter((s) => s !== spec));
    } else {
      this.selectedSpecs.set([...current, spec]);
    }
  }

  protected onRutInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatRut(input.value);
    this.rut.set(formatted);
    input.value = formatted;
  }

  protected async submit(): Promise<void> {
    this.nombresTouched.set(true);
    this.paternoTouched.set(true);
    this.emailTouched.set(true);
    this.telefonoTouched.set(true);
    this.specsTouched.set(true);

    if (!this.formValido()) return;

    const ok = await this.facade.crearRelator({
      rut: this.rut(),
      firstNames: this.nombres().trim(),
      paternalLastName: this.paterno().trim(),
      maternalLastName: this.materno().trim(),
      email: this.email().trim().toLowerCase(),
      phone: this.telefono().trim(),
      specializations: this.selectedSpecs(),
    });

    if (ok) this.closed.emit();
  }
}
