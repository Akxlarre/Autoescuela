import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmailInputComponent } from '@shared/components/email-input/email-input.component';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { PublicContextBannerComponent } from '../public-context-banner/public-context-banner.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import type {
  EnrollmentPersonalData,
  AgeAlertStatus,
  Gender,
} from '@core/models/ui/enrollment-personal-data.model';

import type { PublicEnrollmentContext } from '@core/models/ui/public-enrollment-context.model';
import { validateRut, formatRut } from '@core/utils/rut.utils';
import { validateEmail } from '@core/utils/email.utils';
import { getAgeStatus, isInvalidDate } from '@core/utils/age.utils';
import { validateName, stripInvalidNameChars } from '@core/utils/name.utils';

export { getAgeStatus };

export function canAdvanceFn(data: EnrollmentPersonalData, courseType: string): boolean {
  const age = getAgeStatus(data.birthDate, courseType);
  const today = new Date().toISOString().split('T')[0];
  return (
    validateRut(data.rut) &&
    validateEmail(data.email) &&
    age !== 'under-17' &&
    age !== 'requires-authorization' &&
    age !== 'under-20-professional' &&
    validateName(data.firstNames.trim()) &&
    validateName(data.paternalLastName.trim()) &&
    data.gender.length > 0 &&
    /^\+\d{7,15}$/.test(data.phone) &&
    data.birthDate.length > 0 &&
    data.birthDate >= '1920-01-01' &&
    data.birthDate <= today &&
    !isInvalidDate(data.birthDate)
  );
}

const FIELD_STYLE = `
  background: var(--bg-surface);
  border: 1.5px solid var(--border-default);
  color: var(--text-primary);
  font-family: var(--font-body);
`;
const FIELD_STYLE_ERROR = `${FIELD_STYLE} border-color: var(--state-error);`;
const FIELD_STYLE_SUCCESS = `${FIELD_STYLE} border-color: var(--state-success);`;

const FIELD_CLASS = 'w-full rounded-xl px-4 py-3 text-sm transition-all outline-none';

const GENDER_OPTIONS: { value: Exclude<Gender, ''>; label: string }[] = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'X', label: 'Prefiero no especificar' },
];

@Component({
  selector: 'app-public-personal-data',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IconComponent,
    EmailInputComponent,
    PhoneInputComponent,
    PublicContextBannerComponent,
    DateInputComponent,
  ],
  template: `
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
            (change)="onRutInput($any($event.target).value)"
            (keydown)="onRutKeydown($event)"
            (paste)="onRutPaste($event)"
            (blur)="onRutInput($any($event.target).value); markDirty('rut')"
            autocomplete="off"
            aria-required="true"
            [attr.aria-invalid]="isDirty('rut') && !rutValid()"
            aria-describedby="pub-rut-error"
            data-llm-description="Chilean RUT (tax ID) of the student enrolling"
          />
          @if (formData().rut.length > 0 && !rutValid()) {
            <p
              id="pub-rut-error"
              class="text-xs flex items-center gap-1"
              style="color: var(--state-error);"
            >
              <app-icon name="circle-alert" [size]="12" color="var(--state-error)" />
              RUT inválido — verifica el dígito verificador
            </p>
          } @else if (rutValid()) {
            <p
              id="pub-rut-error"
              class="text-xs flex items-center gap-1"
              style="color: var(--state-success);"
            >
              <app-icon name="check-circle" [size]="12" color="var(--state-success)" />
              RUT válido
            </p>
          } @else {
            <p id="pub-rut-error" class="text-xs italic" style="color: var(--text-muted);">
              Formato: 12.345.678-9
            </p>
          }
        </div>

        <div class="flex flex-col gap-1.5">
          <label
            id="pub-gender-label"
            class="text-xs font-semibold"
            style="color: var(--text-secondary);"
          >
            Género <span style="color: var(--state-error);">*</span>
          </label>
          <div
            class="flex rounded-xl overflow-hidden"
            style="border: 1.5px solid var(--border-default);"
            role="radiogroup"
            aria-labelledby="pub-gender-label"
            aria-required="true"
            data-llm-description="Student gender for enrollment records and certificate"
          >
            @for (opt of genderOptions; track opt.value; let last = $last) {
              <button
                type="button"
                class="flex-1 py-2.5 text-xs text-center cursor-pointer transition-all"
                [style.background]="
                  formData().gender === opt.value
                    ? 'color-mix(in srgb, var(--ds-brand) 10%, transparent)'
                    : 'var(--bg-surface)'
                "
                [style.color]="
                  formData().gender === opt.value ? 'var(--ds-brand)' : 'var(--text-secondary)'
                "
                [style.font-weight]="formData().gender === opt.value ? '600' : '400'"
                [style.border-right]="!last ? '1px solid var(--border-default)' : 'none'"
                (click)="patch('gender', opt.value); markDirty('gender')"
                [attr.aria-pressed]="formData().gender === opt.value"
                [attr.data-llm-action]="'select-gender-' + opt.value"
              >
                {{ opt.label }}
              </button>
            }
          </div>
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
            [style]="firstNamesBorderStyle()"
            placeholder="María José"
            name="firstNames"
            maxlength="80"
            [ngModel]="formData().firstNames"
            (ngModelChange)="onNamesInput('firstNames', $event)"
            (change)="onNamesInput('firstNames', $any($event.target).value)"
            (blur)="onNamesInput('firstNames', $any($event.target).value); markDirty('firstNames')"
            autocomplete="given-name"
            aria-required="true"
            [attr.aria-invalid]="isDirty('firstNames') && !firstNamesValid()"
            aria-describedby="pub-names-error"
            data-llm-description="Student first names for enrollment"
          />
          @if (isDirty('firstNames') && !firstNamesValid()) {
            <p
              id="pub-names-error"
              class="text-xs flex items-center gap-1"
              style="color: var(--state-error);"
            >
              <app-icon name="circle-alert" [size]="12" color="var(--state-error)" />
              Verifica que no contenga números ni símbolos especiales
            </p>
          } @else {
            <p id="pub-names-error" class="text-xs italic" style="color: var(--text-muted);">
              Mín. 2 letras
            </p>
          }
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
            [style]="paternalLastNameBorderStyle()"
            placeholder="Orellana"
            name="paternalLastName"
            maxlength="80"
            [ngModel]="formData().paternalLastName"
            (ngModelChange)="onNamesInput('paternalLastName', $event)"
            (change)="onNamesInput('paternalLastName', $any($event.target).value)"
            (blur)="onNamesInput('paternalLastName', $any($event.target).value); markDirty('paternalLastName')"
            autocomplete="family-name"
            aria-required="true"
            [attr.aria-invalid]="isDirty('paternalLastName') && !paternalLastNameValid()"
            aria-describedby="pub-lastname-error"
            data-llm-description="Student paternal last name for enrollment"
          />
          @if (isDirty('paternalLastName') && !paternalLastNameValid()) {
            <p
              id="pub-lastname-error"
              class="text-xs flex items-center gap-1"
              style="color: var(--state-error);"
            >
              <app-icon name="circle-alert" [size]="12" color="var(--state-error)" />
              Verifica que no contenga números ni símbolos especiales
            </p>
          } @else {
            <p id="pub-lastname-error" class="text-xs italic" style="color: var(--text-muted);">
              Mín. 2 letras
            </p>
          }
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
          maxlength="80"
          [ngModel]="formData().maternalLastName"
          (ngModelChange)="patch('maternalLastName', $event)"
          (change)="patch('maternalLastName', $any($event.target).value)"
          (blur)="patch('maternalLastName', $any($event.target).value)"
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
        [forceDirty]="_allDirty()"
        (valueChange)="patch('email', $event)"
      />

      <!-- Teléfono + Fecha de nacimiento -->
      <div class="grid sm:grid-cols-2 gap-4">
        <app-phone-input
          [value]="formData().phone"
          id="pub-phone"
          [required]="true"
          [forceDirty]="_allDirty()"
          (valueChange)="patch('phone', $event)"
        />

        <div class="flex flex-col gap-1.5">
          <app-date-input
            label="Fecha de nacimiento"
            [required]="true"
            min="1920-01-01"
            [max]="today()"
            [value]="formData().birthDate"
            (valueChange)="patch('birthDate', $event); onBirthDateBlur()"
            data-llm-description="Student birth date for age verification and enrollment records"
          />
          @if (isDirty('birthDate') && _birthDateInvalid()) {
            <p class="text-xs flex items-center gap-1" style="color: var(--state-error);">
              <app-icon name="circle-alert" [size]="12" color="var(--state-error)" />
              Fecha inválida — verifica día y mes
            </p>
          } @else {
            <p class="text-xs italic" style="color: var(--text-muted);">Formato: DD/MM/AAAA</p>
          }
        </div>
      </div>

      <!-- Alertas de edad -->
      @if (ageStatus() === 'under-17') {
        <div
          class="flex items-start gap-3 rounded-xl p-4"
          style="background: var(--state-error-bg); border: 1.5px solid var(--state-error-border);"
          role="alert"
          aria-live="polite"
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
          class="rounded-xl p-4 space-y-3"
          style="
            background: var(--state-info-bg, color-mix(in srgb, var(--ds-brand) 8%, var(--bg-surface)));
            border: 1.5px solid var(--state-info-border, color-mix(in srgb, var(--ds-brand) 30%, transparent));
          "
          role="alert"
          aria-live="polite"
        >
          <div class="flex items-start gap-3">
            <app-icon name="info" [size]="18" color="var(--ds-brand)" class="mt-0.5 shrink-0" />
            <div>
              <p class="text-sm font-bold" style="color: var(--text-primary);">
                Menores de 18 años no pueden inscribirse online
              </p>
              <p class="text-xs mt-0.5" style="color: var(--text-secondary);">
                Para inscribirte debes seguir estos pasos presenciales:
              </p>
            </div>
          </div>
          <ol class="space-y-2 pl-1">
            <li class="flex items-start gap-2.5 text-xs" style="color: var(--text-secondary);">
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style="background: var(--ds-brand); color: white;"
                aria-hidden="true"
                >1</span
              >
              <span>
                <strong style="color: var(--text-primary);">Realiza el trámite notarial</strong> —
                pide a tu apoderado que firme una autorización ante notario.
              </span>
            </li>
            <li class="flex items-start gap-2.5 text-xs" style="color: var(--text-secondary);">
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style="background: var(--ds-brand); color: white;"
                aria-hidden="true"
                >2</span
              >
              <span>
                <strong style="color: var(--text-primary);">Preséntate en la sucursal</strong> con
                la autorización notarial original.
              </span>
            </li>
            <li class="flex items-start gap-2.5 text-xs" style="color: var(--text-secondary);">
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style="background: var(--ds-brand); color: white;"
                aria-hidden="true"
                >3</span
              >
              <span>
                <strong style="color: var(--text-primary);">La secretaria te inscribirá</strong> en
                el sistema con tu documentación en mano.
              </span>
            </li>
          </ol>
        </div>
      }

      @if (ageStatus() === 'under-20-professional') {
        <div
          class="flex items-start gap-3 rounded-xl p-4"
          style="background: var(--state-error-bg); border: 1.5px solid var(--state-error-border);"
          role="alert"
          aria-live="polite"
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
          (change)="patch('address', $any($event.target).value)"
          (blur)="patch('address', $any($event.target).value)"
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

  private readonly el = inject(ElementRef);

  // CSS helpers
  protected readonly fieldStyle = FIELD_STYLE;
  protected readonly fieldClass = FIELD_CLASS;
  protected readonly genderOptions = GENDER_OPTIONS;

  // Dirty-state tracking
  protected readonly _dirtyFields = signal<Record<string, boolean>>({});
  protected readonly _allDirty = signal(false);
  protected readonly _birthDateInvalid = signal(false);
  
  // Anti-Race-Condition para Autofill
  private _lastEmitted: EnrollmentPersonalData | null = null;
  private _emitTimeout: any = null;

  // Derived from input
  protected readonly formData = computed(() => this.data());
  protected readonly today = computed(() => new Date().toISOString().split('T')[0]);

  // Validation computeds
  protected readonly rutValid = computed(() => validateRut(this.formData().rut));
  protected readonly firstNamesValid = computed(() =>
    validateName(this.formData().firstNames.trim()),
  );
  protected readonly paternalLastNameValid = computed(() =>
    validateName(this.formData().paternalLastName.trim()),
  );

  private readonly courseTypeForValidation = computed(
    () => this.context()?.courseType ?? this.formData().courseType,
  );

  protected readonly ageStatus = computed(
    (): AgeAlertStatus => getAgeStatus(this.formData().birthDate, this.courseTypeForValidation()),
  );

  protected readonly rutBorderStyle = computed(() => {
    const rut = this.formData().rut;
    if (!rut) return FIELD_STYLE;
    if (this.rutValid()) return FIELD_STYLE; // Diseño neutral (sin remarcado verde de éxito)
    return FIELD_STYLE_ERROR;
  });

  protected readonly firstNamesBorderStyle = computed(() => {
    if (!this.isDirty('firstNames')) return FIELD_STYLE;
    return this.firstNamesValid() ? FIELD_STYLE : FIELD_STYLE_ERROR;
  });

  protected readonly paternalLastNameBorderStyle = computed(() => {
    if (!this.isDirty('paternalLastName')) return FIELD_STYLE;
    return this.paternalLastNameValid() ? FIELD_STYLE : FIELD_STYLE_ERROR;
  });

  protected readonly canAdvance = computed(() =>
    canAdvanceFn(this.formData(), this.courseTypeForValidation()),
  );

  // Dirty helpers
  protected isDirty(field: string): boolean {
    return !!this._dirtyFields()[field] || this._allDirty();
  }

  protected markDirty(field: string): void {
    this._dirtyFields.update((m) => ({ ...m, [field]: true }));
  }

  // RUT handlers
  protected onRutInput(raw: string): void {
    this.patch('rut', formatRut(raw));
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
    this.patch('rut', formatRut(pasted));
  }

  // Names handler — auto-strips invalid chars on input
  protected onNamesInput(field: keyof EnrollmentPersonalData, raw: string): void {
    const cleaned = stripInvalidNameChars(raw);
    this.patch(field, cleaned);
  }

  // Birth date handler
  protected onBirthDateBlur(): void {
    this.markDirty('birthDate');
    this._birthDateInvalid.set(isInvalidDate(this.formData().birthDate));
  }

  // Generic field patch
  protected patch(field: keyof EnrollmentPersonalData, value: string): void {
    // Autofill Race Condition fix: Cuando Chrome inyecta 5 campos en el mismo milisegundo,
    // Angular OnPush aún no propaga el Signal del padre. Acumulamos en un buffer sincrónico.
    const base = this._lastEmitted ?? this.formData();
    this._lastEmitted = { ...base, [field]: value };
    
    // Emitimos de inmediato al padre (si el padre es síncrono, bien; si no, el buffer salva el ciclo)
    this.dataChange.emit(this._lastEmitted);

    // Limpiamos el buffer al final del macrotask para volver a sincronizar con Input
    if (!this._emitTimeout) {
      this._emitTimeout = setTimeout(() => {
        this._lastEmitted = null;
        this._emitTimeout = null;
      }, 0);
    }
  }

  protected focusFirstError(): void {
    const host = this.el.nativeElement as HTMLElement;
    const first = host.querySelector('[aria-invalid="true"]') as HTMLElement | null;
    first?.focus();
  }

  protected onNext(): void {
    // Silver Bullet para Chrome Autofill en Angular:
    // Los navegadores a veces rellenan los inputs visualmente pero no emiten `input` o `change`,
    // dejando a Angular desincronizado. Al dar 'Continuar', despachamos eventos falsos
    // sobre todos los inputs, obligando a los bindings locales (ngModel) y subcomponentes a
    // actualizar su estado interno antes de evaluar.
    const host = this.el.nativeElement as HTMLElement;
    const inputs = host.querySelectorAll('input');
    
    // Forzamos la emisión nativa en todos los inputs
    inputs.forEach(input => {
      if (input.value && !input.readOnly) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        // El blur también asegura que los componentes hijos como Email actualicen su validación
        input.dispatchEvent(new Event('blur', { bubbles: true })); 
      }
    });

    // Como `dispatchEvent` ejecuta de forma síncrona los handlers,
    // el estado de Angular (incluso si depende del padre) recibirá los eventos.
    // Usamos un ligero delay de microtask para garantizar que todos los EventEmitter
    // hayan propagado el `dataChange` y Angular haya bajado el nuevo `data()` al hijo.
    setTimeout(() => {
      const d = this.formData();
      const advance = canAdvanceFn(d, this.courseTypeForValidation());
      
      if (!advance) {
        this._allDirty.set(true);
        this.markDirty('rut');
        this.markDirty('gender');
        this.markDirty('firstNames');
        this.markDirty('paternalLastName');
        this.markDirty('birthDate');
        this._birthDateInvalid.set(isInvalidDate(d.birthDate));
        setTimeout(() => this.focusFirstError(), 0);
      } else {
        this.next.emit();
      }
    }, 10);
  }
}
