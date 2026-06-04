import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmailInputComponent } from '@shared/components/email-input/email-input.component';
import { PublicContextBannerComponent } from '../public-context-banner/public-context-banner.component';
import type {
  EnrollmentPersonalData,
  AgeAlertStatus,
} from '@core/models/ui/enrollment-personal-data.model';
import type { PublicEnrollmentContext } from '@core/models/ui/public-enrollment-context.model';
import { validateRut, formatRut } from '@core/utils/rut.utils';
import { validateEmail } from '@core/utils/email.utils';
import { calcAge } from '@core/utils/age.utils';

// ── Functional Core (testeables sin framework) ────────────────────────────────

export function getAgeStatus(birthDate: string, courseType: string): AgeAlertStatus {
  const age = calcAge(birthDate);
  if (age === null) return 'none';
  if (age < 17) return 'under-17';
  if (age < 18) return 'requires-authorization';
  if (courseType?.startsWith('professional') && age < 20) return 'under-20-professional';
  return 'ok';
}

export function canAdvanceFn(data: EnrollmentPersonalData, courseType: string): boolean {
  const age = getAgeStatus(data.birthDate, courseType);
  return (
    validateRut(data.rut) &&
    validateEmail(data.email) &&
    age !== 'under-17' &&
    age !== 'under-20-professional' &&
    data.firstNames.trim().length >= 2 &&
    data.paternalLastName.trim().length >= 2 &&
    data.gender.length > 0 &&
    data.phone.trim().length >= 8 &&
    data.birthDate.length > 0
  );
}

const FIELD_STYLE = `
  background: var(--bg-surface);
  border: 1.5px solid var(--border-default);
  color: var(--text-primary);
  font-family: var(--font-body);
`;

const FIELD_CLASS = 'w-full rounded-xl px-4 py-3 text-sm transition-all outline-none';

@Component({
  selector: 'app-public-personal-data',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, EmailInputComponent, PublicContextBannerComponent],
  template: `
    <!-- Context banner (AC3/AC5) -->
    @if (context()) {
      <app-public-context-banner [context]="context()!" (editRequested)="back.emit()" />
    }

    <h2
      class="font-bold mb-1"
      style="font-family: var(--font-display); font-size: 1.3rem; color: var(--text-primary);"
    >
      Tus datos personales
    </h2>
    <p class="text-sm mb-5" style="color: var(--text-secondary);">
      Los campos marcados con <span style="color: var(--state-error);">*</span> son obligatorios.
    </p>

    <form (ngSubmit)="onNext()" class="space-y-4" novalidate>
      <!-- Honeypot anti-bot -->
      <input
        type="text"
        name="website"
        tabindex="-1"
        autocomplete="off"
        aria-hidden="true"
        [ngModel]="formData().honeypot"
        (ngModelChange)="patch('honeypot', $event)"
        style="position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none;"
      />

      <!-- RUT + Género -->
      <div class="grid sm:grid-cols-2 gap-4">
        <!-- RUT con validación inline -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold" style="color: var(--text-secondary);" for="pub-rut">
            RUT <span style="color: var(--state-error);">*</span>
          </label>
          <input
            id="pub-rut"
            type="text"
            [class]="fieldClass"
            [style]="rutBorderStyle()"
            placeholder="12.345.678-9"
            name="rut"
            maxlength="12"
            [ngModel]="formData().rut"
            (ngModelChange)="onRutInput($event)"
            (keydown)="onRutKeydown($event)"
            (paste)="onRutPaste($event)"
            autocomplete="off"
            data-llm-description="Chilean RUT (tax ID) of the student enrolling"
          />
          @if (formData().rut.length > 0 && !rutValid()) {
            <p class="text-xs flex items-center gap-1" style="color: var(--state-error);">
              <app-icon name="circle-alert" [size]="12" color="var(--state-error)" />
              RUT inválido — verifica el dígito verificador
            </p>
          } @else if (rutValid()) {
            <p class="text-xs flex items-center gap-1" style="color: var(--state-success);">
              <app-icon name="check-circle" [size]="12" color="var(--state-success)" />
              RUT válido
            </p>
          } @else {
            <p class="text-xs italic" style="color: var(--text-muted);">Formato: 12.345.678-9</p>
          }
        </div>

        <!-- Género -->
        <div class="flex flex-col gap-1.5">
          <label
            class="text-xs font-semibold"
            style="color: var(--text-secondary);"
            for="pub-gender"
          >
            Género <span style="color: var(--state-error);">*</span>
          </label>
          <select
            id="pub-gender"
            [class]="fieldClass"
            [style]="fieldStyle"
            name="gender"
            [ngModel]="formData().gender"
            (ngModelChange)="patch('gender', $event)"
            data-llm-description="Student gender for enrollment records and certificate"
          >
            <option value="">— Seleccionar —</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
          </select>
        </div>
      </div>

      <!-- Nombres + Apellido paterno -->
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label
            class="text-xs font-semibold"
            style="color: var(--text-secondary);"
            for="pub-names"
          >
            Nombres <span style="color: var(--state-error);">*</span>
          </label>
          <input
            id="pub-names"
            type="text"
            [class]="fieldClass"
            [style]="fieldStyle"
            placeholder="María José"
            name="firstNames"
            [ngModel]="formData().firstNames"
            (ngModelChange)="patch('firstNames', $event)"
            autocomplete="given-name"
            data-llm-description="Student first names for enrollment"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label
            class="text-xs font-semibold"
            style="color: var(--text-secondary);"
            for="pub-lastname"
          >
            Apellido paterno <span style="color: var(--state-error);">*</span>
          </label>
          <input
            id="pub-lastname"
            type="text"
            [class]="fieldClass"
            [style]="fieldStyle"
            placeholder="Orellana"
            name="paternalLastName"
            [ngModel]="formData().paternalLastName"
            (ngModelChange)="patch('paternalLastName', $event)"
            autocomplete="family-name"
            data-llm-description="Student paternal last name for enrollment"
          />
        </div>
      </div>

      <!-- Apellido materno (opcional) -->
      <div class="flex flex-col gap-1.5">
        <label
          class="text-xs font-semibold"
          style="color: var(--text-secondary);"
          for="pub-maternal"
        >
          Apellido materno
          <span class="font-normal italic" style="color: var(--text-muted);">(Opcional)</span>
        </label>
        <input
          id="pub-maternal"
          type="text"
          [class]="fieldClass"
          [style]="fieldStyle"
          placeholder="González"
          name="maternalLastName"
          [ngModel]="formData().maternalLastName"
          (ngModelChange)="patch('maternalLastName', $event)"
          autocomplete="additional-name"
          data-llm-description="Student maternal last name for enrollment"
        />
      </div>

      <!-- Email -->
      <app-email-input
        [value]="formData().email"
        label="Correo electrónico"
        [required]="true"
        placeholder="correo@ejemplo.com"
        (valueChange)="patch('email', $event)"
      />

      <!-- Teléfono + Fecha de nacimiento -->
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label
            class="text-xs font-semibold"
            style="color: var(--text-secondary);"
            for="pub-phone"
          >
            Teléfono / WhatsApp <span style="color: var(--state-error);">*</span>
          </label>
          <input
            id="pub-phone"
            type="tel"
            [class]="fieldClass"
            [style]="fieldStyle"
            placeholder="+56 9 1234 5678"
            name="phone"
            [ngModel]="formData().phone"
            (ngModelChange)="patch('phone', $event)"
            autocomplete="tel"
            data-llm-description="Student phone number for enrollment contact"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label
            class="text-xs font-semibold"
            style="color: var(--text-secondary);"
            for="pub-birth"
          >
            Fecha de nacimiento <span style="color: var(--state-error);">*</span>
          </label>
          <input
            id="pub-birth"
            type="date"
            [class]="fieldClass"
            [style]="fieldStyle"
            name="birthDate"
            [ngModel]="formData().birthDate"
            (ngModelChange)="patch('birthDate', $event)"
            autocomplete="bday"
            data-llm-description="Student birth date for age verification and enrollment records"
          />
        </div>
      </div>

      <!-- Alertas de edad -->
      @if (ageStatus() === 'under-17') {
        <div
          class="flex items-start gap-3 rounded-xl p-4"
          style="
            background: var(--state-error-bg);
            border: 1.5px solid var(--state-error-border);
          "
          role="alert"
        >
          <app-icon name="ban" [size]="18" color="var(--state-error)" class="mt-0.5 shrink-0" />
          <div>
            <p class="text-sm font-bold" style="color: var(--state-error);">
              Menor de 17 años — No es posible inscribirse
            </p>
            <p class="text-xs mt-0.5" style="color: var(--text-secondary);">
              La edad mínima para ingresar a una escuela de conductores es de 17 años cumplidos.
            </p>
          </div>
        </div>
      }

      @if (ageStatus() === 'requires-authorization') {
        <div
          class="flex items-start gap-3 rounded-xl p-4"
          style="
            background: var(--state-warning-bg);
            border: 1.5px solid var(--state-warning-border);
          "
          role="alert"
        >
          <app-icon
            name="alert-triangle"
            [size]="18"
            color="var(--state-warning)"
            class="mt-0.5 shrink-0"
          />
          <div>
            <p class="text-sm font-bold" style="color: var(--state-warning);">
              17 años — Requiere Autorización Notarial
            </p>
            <p class="text-xs mt-0.5" style="color: var(--text-secondary);">
              Deberás adjuntar una autorización notarial firmada por tu apoderado en el paso de
              documentación.
            </p>
          </div>
        </div>
      }

      @if (ageStatus() === 'under-20-professional') {
        <div
          class="flex items-start gap-3 rounded-xl p-4"
          style="
            background: var(--state-error-bg);
            border: 1.5px solid var(--state-error-border);
          "
          role="alert"
        >
          <app-icon name="ban" [size]="18" color="var(--state-error)" class="mt-0.5 shrink-0" />
          <div>
            <p class="text-sm font-bold" style="color: var(--state-error);">
              Menor de 20 años — No es posible inscribirse en Clase Profesional
            </p>
            <p class="text-xs mt-0.5" style="color: var(--text-secondary);">
              La edad mínima para Clase Profesional (A2, A3, A4, A5) es de 20 años cumplidos.
            </p>
          </div>
        </div>
      }

      <!-- Dirección (opcional) -->
      <div class="flex flex-col gap-1.5">
        <label
          class="text-xs font-semibold"
          style="color: var(--text-secondary);"
          for="pub-address"
        >
          Dirección
          <span class="font-normal italic" style="color: var(--text-muted);">(Opcional)</span>
        </label>
        <input
          id="pub-address"
          type="text"
          [class]="fieldClass"
          [style]="fieldStyle"
          placeholder="Av. Ejemplo 123"
          name="address"
          [ngModel]="formData().address"
          (ngModelChange)="patch('address', $event)"
          autocomplete="street-address"
          data-llm-description="Student home address for enrollment records"
        />
      </div>

      <!-- Nav -->
      <div class="flex justify-between pt-4 border-t" style="border-color: var(--border-subtle);">
        <button
          type="button"
          class="flex items-center gap-1.5 text-sm font-medium cursor-pointer transition-colors"
          style="color: var(--text-secondary);"
          (click)="back.emit()"
        >
          <app-icon name="arrow-left" [size]="16" />
          Volver
        </button>
        <button
          type="submit"
          class="btn-primary px-7 py-2.5 rounded-xl font-semibold text-sm"
          [disabled]="!canAdvance()"
          data-llm-action="submit-personal-data"
        >
          Continuar
        </button>
      </div>
    </form>
  `,
})
export class PublicPersonalDataComponent {
  readonly data = input.required<EnrollmentPersonalData>();
  readonly context = input<PublicEnrollmentContext | null>(null);
  readonly dataChange = output<EnrollmentPersonalData>();
  readonly next = output<void>();
  readonly back = output<void>();

  // ── CSS helpers (evita repetir inline styles en el template) ──────────────
  protected readonly fieldStyle = FIELD_STYLE;
  protected readonly fieldClass = FIELD_CLASS;

  // ── Derived from input ────────────────────────────────────────────────────
  protected readonly formData = computed(() => this.data());

  // ── Validation computeds (delegan a Functional Core) ─────────────────────
  protected readonly rutValid = computed(() => validateRut(this.formData().rut));

  private readonly courseTypeForValidation = computed(
    () => this.context()?.courseType ?? this.formData().courseType,
  );

  protected readonly ageStatus = computed(
    (): AgeAlertStatus => getAgeStatus(this.formData().birthDate, this.courseTypeForValidation()),
  );

  protected readonly rutBorderStyle = computed(() => {
    const rut = this.formData().rut;
    if (!rut) return FIELD_STYLE;
    if (this.rutValid()) return `${FIELD_STYLE} border-color: var(--state-success);`;
    return `${FIELD_STYLE} border-color: var(--state-error);`;
  });

  protected readonly canAdvance = computed(() =>
    canAdvanceFn(this.formData(), this.courseTypeForValidation()),
  );

  // ── RUT handlers ──────────────────────────────────────────────────────────
  protected onRutInput(raw: string): void {
    this.dataChange.emit({ ...this.formData(), rut: formatRut(raw) });
  }

  protected onRutKeydown(event: KeyboardEvent): void {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    if (allowed.includes(event.key) || event.ctrlKey || event.metaKey) return;
    if (/^\d$/.test(event.key) || event.key === 'k' || event.key === 'K') return;
    event.preventDefault();
  }

  protected onRutPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') ?? '';
    this.dataChange.emit({ ...this.formData(), rut: formatRut(pasted) });
  }

  // ── Generic field patch ───────────────────────────────────────────────────
  protected patch(field: keyof EnrollmentPersonalData, value: string): void {
    this.dataChange.emit({ ...this.formData(), [field]: value });
  }

  protected onNext(): void {
    if (this.canAdvance()) this.next.emit();
  }
}
