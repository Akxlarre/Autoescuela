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
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { contactPolicyMismatch } from '@core/utils/website-config.utils';

@Component({
  selector: 'app-contacto-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, AlertCardComponent],
  template: `
    <div class="flex flex-col gap-6 animate-fade-in">
      <h3 class="font-bold text-text-primary border-b pb-2 mb-2 border-border-subtle">
        Datos de Sucursal y Geolocalización SEO
      </h3>

      @if (policyMismatch(); as campos) {
        @if (campos.length > 0) {
          <!-- fix-502-m: el contacto se edita libre, pero se avisa si difiere de la política -->
          <app-alert-card title="No coincide con la política de privacidad" severity="warning">
            <p class="text-sm">
              @switch (campos.join(',')) {
                @case ('dirección') {
                  La dirección de la web no coincide con la de la política de privacidad de la sede
                }
                @case ('correo') {
                  El correo de la web no coincide con el de la política de privacidad de la sede
                }
                @default {
                  La dirección y el correo de la web no coinciden con los de la política de
                  privacidad de la sede
                }
              }
              ({{ policy()?.address }} · {{ policy()?.rightsEmail }}). Si el cambio es correcto,
              avisa para actualizar también la política.
            </p>
          </app-alert-card>
        }
      }

      <div [formGroup]="contactGroup()" class="flex flex-col gap-6">
        <div class="p-5 rounded-xl border border-solid border-border-default bg-elevated">
          <div class="bento-grid bento-grid--forms bento-grid--forms">
            <div class="flex flex-col gap-1.5" data-col-span-md="6" data-col-span="8">
              <label class="field-label">Dirección Física de la Escuela *</label>
              <input
                type="text"
                formControlName="address"
                class="field-input"
                placeholder="Ej: Calle Arturo Prat 123"
              />
            </div>
            <div class="flex flex-col gap-1.5" data-col-span-md="2" data-col-span="4">
              <label class="field-label">Ciudad *</label>
              <input type="text" formControlName="city" class="field-input" placeholder="Chillán" />
            </div>
          </div>

          <div class="bento-grid bento-grid--forms bento-grid--forms mt-5">
            <div class="flex flex-col gap-1.5 bento-wide">
              <label class="field-label"
                >WhatsApp de Soporte/Matrículas (Código país + número) *</label
              >
              <input
                type="text"
                formControlName="whatsapp"
                class="field-input"
                placeholder="Ej: 56912345678"
              />
              @if (contactGroup().get('whatsapp')?.hasError('whatsapp')) {
                <span class="field-error">Solo números (8 a 15), con código de país.</span>
              }
            </div>
            <div class="flex flex-col gap-1.5 bento-wide">
              <label class="field-label">Teléfono de Llamadas Fijo/Móvil *</label>
              <input
                type="text"
                formControlName="phone"
                class="field-input"
                placeholder="Ej: +56 42 222 3344"
              />
            </div>
          </div>

          <div class="bento-grid bento-grid--forms bento-grid--forms mt-5">
            <div class="flex flex-col gap-1.5 bento-wide">
              <label class="field-label">Correo Electrónico de Contacto *</label>
              <input
                type="email"
                formControlName="email"
                class="field-input"
                placeholder="ejemplo@autoescuela.cl"
              />
            </div>
            <div class="flex flex-col gap-1.5 bento-wide">
              <label class="field-label">Región *</label>
              <input type="text" formControlName="region" class="field-input" placeholder="Ñuble" />
            </div>
          </div>
        </div>

        <div class="p-5 rounded-xl border border-solid border-border-default bg-elevated">
          <div class="flex flex-col gap-1.5">
            <label class="field-label">URL de Embed Google Maps *</label>
            <textarea
              formControlName="mapEmbedUrl"
              rows="2"
              class="field-input"
              placeholder="Pegue la URL provista en el iframe src de Google Maps Compartir"
            ></textarea>
            @if (contactGroup().get('mapEmbedUrl')?.hasError('mapEmbed')) {
              <span class="field-error"
                >Debe ser la URL de "Insertar un mapa" de Google Maps
                (https://www.google.com/maps/embed?...).</span
              >
            }
          </div>

          <h4 class="text-xs font-bold uppercase tracking-wider text-text-secondary mt-5 mb-3">
            Coordenadas de Ubicación (Google Schema.org SEO)
          </h4>
          <div formGroupName="geo" class="bento-grid bento-grid--forms bento-grid--forms">
            <div class="flex flex-col gap-1.5 bento-wide">
              <label class="field-label">Latitud *</label>
              <input
                type="number"
                step="any"
                formControlName="lat"
                class="field-input"
                placeholder="-36.606709"
              />
              @if (
                contactGroup().get('geo.lat')?.hasError('min') ||
                contactGroup().get('geo.lat')?.hasError('max')
              ) {
                <span class="field-error">Entre -90 y 90.</span>
              }
            </div>
            <div class="flex flex-col gap-1.5 bento-wide">
              <label class="field-label">Longitud *</label>
              <input
                type="number"
                step="any"
                formControlName="lng"
                class="field-input"
                placeholder="-72.105436"
              />
              @if (
                contactGroup().get('geo.lng')?.hasError('min') ||
                contactGroup().get('geo.lng')?.hasError('max')
              ) {
                <span class="field-error">Entre -180 y 180.</span>
              }
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between border-b pb-2 mt-4 mb-2 border-border-subtle">
        <h3 class="font-bold text-text-primary">Horarios de Atención</h3>
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

            <div class="bento-grid bento-grid--forms bento-grid--forms">
              <div class="flex flex-col gap-1.5 bento-wide">
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
              <div class="flex flex-col gap-1.5 bento-wide">
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
      letter-spacing: 0.02em;
      margin-bottom: 6px;
      line-height: 1.3;
    }
    .field-input {
      width: 100%;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--input-bg);
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
  /** fix-502-m: dirección y correo de la política de privacidad de la sede (null = sin política). */
  policy = input<{ address: string; rightsEmail: string } | null>(null);

  /** Campos del contacto de la web que no coinciden con la política (se lee en cada cambio). */
  protected policyMismatch(): string[] {
    const c = this.contactGroup().value as { address?: string; email?: string };
    return contactPolicyMismatch(c, this.policy());
  }

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
