import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-contacto-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div class="flex flex-col gap-6 animate-fade-in">
      <h3 class="text-base font-bold text-text-primary border-b pb-2 mb-2 border-border-subtle">
        Datos de Sucursal y Geolocalización SEO
      </h3>

      <div [formGroup]="contactGroup()" class="flex flex-col gap-5">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div class="md:col-span-2 flex flex-col gap-1.5">
            <label class="field-label">Dirección Física de la Escuela *</label>
            <input
              type="text"
              formControlName="address"
              class="field-input"
              placeholder="Ej: Calle Arturo Prat 123"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="field-label">Ciudad *</label>
            <input type="text" formControlName="city" class="field-input" placeholder="Chillán" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="flex flex-col gap-1.5">
            <label class="field-label"
              >WhatsApp de Soporte/Matrículas (Código país + número) *</label
            >
            <input
              type="text"
              formControlName="whatsapp"
              class="field-input"
              placeholder="Ej: 56912345678"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="field-label">Teléfono de Llamadas Fijo/Móvil *</label>
            <input
              type="text"
              formControlName="phone"
              class="field-input"
              placeholder="Ej: +56 42 222 3344"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="flex flex-col gap-1.5">
            <label class="field-label">Correo Electrónico de Contacto *</label>
            <input
              type="email"
              formControlName="email"
              class="field-input"
              placeholder="ejemplo@autoescuela.cl"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="field-label">Región *</label>
            <input type="text" formControlName="region" class="field-input" placeholder="Ñuble" />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="field-label">URL de Embed Google Maps *</label>
          <textarea
            formControlName="mapEmbedUrl"
            rows="2"
            class="field-input"
            placeholder="Pegue la URL provista en el iframe src de Google Maps Compartir"
          ></textarea>
        </div>

        <h4 class="text-xs font-bold uppercase tracking-wider text-text-secondary mt-2">
          Coordenadas de Ubicación (Google Schema.org SEO)
        </h4>
        <div formGroupName="geo" class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="flex flex-col gap-1.5">
            <label class="field-label">Latitud *</label>
            <input
              type="number"
              step="any"
              formControlName="lat"
              class="field-input"
              placeholder="-36.606709"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="field-label">Longitud *</label>
            <input
              type="number"
              step="any"
              formControlName="lng"
              class="field-input"
              placeholder="-72.105436"
            />
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between border-b pb-2 mt-4 mb-2 border-border-subtle">
        <h3 class="text-base font-bold text-text-primary">Horarios de Atención</h3>
        <button
          type="button"
          class="btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1"
          (click)="addHour()"
          data-llm-action="add-hour-block"
        >
          <app-icon name="plus" [size]="14" />
          <span>Agregar Horario</span>
        </button>
      </div>

      <div class="flex flex-col gap-4">
        @if (hoursArray().length === 0) {
          <div
            class="p-8 text-center border rounded-xl border-dashed border-border-subtle bg-elevated"
          >
            <p class="text-text-muted text-sm">
              No hay horarios configurados. Haz clic en "Agregar Horario" para crear uno.
            </p>
          </div>
        }

        @for (hourCtrl of hoursArray().controls; track $index) {
          <div
            [formGroup]="asFormGroup(hourCtrl)"
            class="p-4 rounded-xl border flex flex-col gap-3 border-border-default bg-elevated"
          >
            <div class="flex items-center justify-between border-b pb-1 mb-1 border-border-subtle">
              <span class="text-xs font-bold text-text-secondary">Bloque #{{ $index + 1 }}</span>
              <button
                type="button"
                class="btn-ghost py-1 px-2 text-xs flex items-center gap-1 rounded cursor-pointer text-error"
                (click)="removeHour($index)"
                data-llm-action="remove-hour-block"
              >
                <app-icon name="trash-2" [size]="13" />
                <span>Eliminar</span>
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div class="flex flex-col gap-1.5">
                <label class="field-label">Días de Atención *</label>
                <input
                  type="text"
                  formControlName="days"
                  class="field-input"
                  placeholder="Ej: Lunes a Viernes"
                />
                @if (
                  asFormGroup(hourCtrl).get('days')?.touched &&
                  asFormGroup(hourCtrl).get('days')?.invalid
                ) {
                  <span class="text-xs mt-1 text-error">Los días de atención son requeridos.</span>
                }
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="field-label">Rango de Horas *</label>
                <input
                  type="text"
                  formControlName="time"
                  class="field-input"
                  placeholder="Ej: 09:00 - 18:30"
                />
                @if (
                  asFormGroup(hourCtrl).get('time')?.touched &&
                  asFormGroup(hourCtrl).get('time')?.invalid
                ) {
                  <span class="text-xs mt-1 text-error">El rango de horas es requerido.</span>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .field-label {
      display: block;
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .field-input {
      width: 100%;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
      transition: border-color var(--duration-fast, 150ms) ease;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
    }
  `,
})
export class ContactoTabComponent {
  private fb = inject(FormBuilder);

  contactGroup = input.required<FormGroup>();
  hoursArray = input.required<FormArray>();

  protected asFormGroup(ctrl: AbstractControl): FormGroup {
    return ctrl as FormGroup;
  }

  protected addHour(): void {
    this.hoursArray().push(
      this.fb.group({
        days: ['', Validators.required],
        time: ['', Validators.required],
      }),
    );
    this.hoursArray().markAsDirty();
  }

  protected removeHour(index: number): void {
    this.hoursArray().removeAt(index);
    this.hoursArray().markAsDirty();
  }
}
