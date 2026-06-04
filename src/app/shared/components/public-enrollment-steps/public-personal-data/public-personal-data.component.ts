import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { PublicContextBannerComponent } from '../public-context-banner/public-context-banner.component';
import type { EnrollmentPersonalData } from '@core/models/ui/enrollment-personal-data.model';
import type { PublicEnrollmentContext } from '@core/models/ui/public-enrollment-context.model';

@Component({
  selector: 'app-public-personal-data',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, PublicContextBannerComponent],
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
    <p class="text-sm mb-6" style="color: var(--text-secondary);">
      Necesitamos esta información para emitir tu matrícula y certificado.
    </p>

    <form (ngSubmit)="onNext()" class="space-y-4" novalidate>
      <!-- Honeypot anti-bot (Spec 0010 S1): trampa oculta. Los bots la llenan, los
           humanos no. NO lleva data-llm-* a propósito (debe ser invisible para humanos
           y agentes legítimos). El facade la envía como body.honeypot a la Edge Function. -->
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

      <!-- RUT + Phone -->
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold" style="color: var(--text-secondary);" for="pub-rut">
            RUT
          </label>
          <input
            id="pub-rut"
            type="text"
            class="w-full rounded-xl px-4 py-3 text-sm transition-all"
            style="
              background: var(--bg-surface);
              border: 1.5px solid var(--border-default);
              color: var(--text-primary);
              font-family: var(--font-body);
            "
            placeholder="12.345.678-9"
            name="rut"
            [ngModel]="formData().rut"
            (ngModelChange)="patch('rut', $event)"
            autocomplete="off"
            data-llm-description="Chilean RUT (tax ID) of the student enrolling"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label
            class="text-xs font-semibold"
            style="color: var(--text-secondary);"
            for="pub-phone"
          >
            Teléfono
          </label>
          <input
            id="pub-phone"
            type="tel"
            class="w-full rounded-xl px-4 py-3 text-sm transition-all"
            style="
              background: var(--bg-surface);
              border: 1.5px solid var(--border-default);
              color: var(--text-primary);
            "
            placeholder="+56 9 1234 5678"
            name="phone"
            [ngModel]="formData().phone"
            (ngModelChange)="patch('phone', $event)"
            autocomplete="tel"
            data-llm-description="Student phone number for enrollment contact"
          />
        </div>
      </div>

      <!-- First names + last name -->
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label
            class="text-xs font-semibold"
            style="color: var(--text-secondary);"
            for="pub-names"
          >
            Nombres
          </label>
          <input
            id="pub-names"
            type="text"
            class="w-full rounded-xl px-4 py-3 text-sm"
            style="
              background: var(--bg-surface);
              border: 1.5px solid var(--border-default);
              color: var(--text-primary);
            "
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
            Apellido paterno
          </label>
          <input
            id="pub-lastname"
            type="text"
            class="w-full rounded-xl px-4 py-3 text-sm"
            style="
              background: var(--bg-surface);
              border: 1.5px solid var(--border-default);
              color: var(--text-primary);
            "
            placeholder="Orellana"
            name="paternalLastName"
            [ngModel]="formData().paternalLastName"
            (ngModelChange)="patch('paternalLastName', $event)"
            autocomplete="family-name"
            data-llm-description="Student paternal last name for enrollment"
          />
        </div>
      </div>

      <!-- Email -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold" style="color: var(--text-secondary);" for="pub-email">
          Correo electrónico
        </label>
        <input
          id="pub-email"
          type="email"
          class="w-full rounded-xl px-4 py-3 text-sm"
          style="
            background: var(--bg-surface);
            border: 1.5px solid var(--border-default);
            color: var(--text-primary);
          "
          placeholder="correo@ejemplo.com"
          name="email"
          [ngModel]="formData().email"
          (ngModelChange)="patch('email', $event)"
          autocomplete="email"
          data-llm-description="Student email address for enrollment confirmation and portal access"
        />
      </div>

      <!-- Birthdate + address -->
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label
            class="text-xs font-semibold"
            style="color: var(--text-secondary);"
            for="pub-birth"
          >
            Fecha de nacimiento
          </label>
          <input
            id="pub-birth"
            type="date"
            class="w-full rounded-xl px-4 py-3 text-sm"
            style="
              background: var(--bg-surface);
              border: 1.5px solid var(--border-default);
              color: var(--text-primary);
            "
            name="birthDate"
            [ngModel]="formData().birthDate"
            (ngModelChange)="patch('birthDate', $event)"
            autocomplete="bday"
            data-llm-description="Student birth date for age verification and enrollment records"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label
            class="text-xs font-semibold"
            style="color: var(--text-secondary);"
            for="pub-address"
          >
            Dirección
          </label>
          <input
            id="pub-address"
            type="text"
            class="w-full rounded-xl px-4 py-3 text-sm"
            style="
              background: var(--bg-surface);
              border: 1.5px solid var(--border-default);
              color: var(--text-primary);
            "
            placeholder="Av. Ejemplo 123"
            name="address"
            [ngModel]="formData().address"
            (ngModelChange)="patch('address', $event)"
            autocomplete="street-address"
            data-llm-description="Student home address for enrollment records"
          />
        </div>
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

  protected readonly formData = computed(() => this.data());

  protected readonly canAdvance = computed(() => {
    const d = this.formData();
    return !!(d.rut && d.firstNames && d.paternalLastName && d.email);
  });

  protected patch(field: keyof EnrollmentPersonalData, value: string): void {
    this.dataChange.emit({ ...this.formData(), [field]: value });
  }

  protected onNext(): void {
    if (this.canAdvance()) this.next.emit();
  }
}
