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
import { SecretariasFacade } from '@core/facades/secretarias.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { formatRut, validateRut } from '@core/utils/rut.utils';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-admin-secretarias-crear-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, IconComponent],
  template: `
    <!-- Info rol -->
    <div
      class="flex items-start gap-3 rounded-lg p-3 mb-5"
      style="background: color-mix(in srgb, var(--ds-brand) 6%, transparent); border: 1px solid color-mix(in srgb, var(--ds-brand) 20%, transparent);"
    >
      <app-icon name="clipboard-list" [size]="16" color="var(--ds-brand)" />
      <p class="text-xs leading-relaxed" style="color: var(--ds-brand)">
        El rol de <strong>secretaria</strong> se asigna automáticamente. Tendrá acceso a gestión de
        matrículas, pagos, agenda y alumnos.
      </p>
    </div>

    <!-- Campos del formulario -->
    <h3 class="section-title">Datos Personales</h3>
    <div class="flex flex-col gap-4">
      <!-- Nombres -->
      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="d-nombres">Nombres *</label>
        <input
          id="d-nombres"
          type="text"
          class="field-input"
          [class.field-input--error]="nombresTouched() && !nombresValido()"
          placeholder="María"
          [ngModel]="nombres()"
          (ngModelChange)="nombres.set($event)"
          (blur)="nombresTouched.set(true)"
          data-llm-description="Nombres de la nueva secretaria"
          aria-required="true"
        />
        @if (nombresTouched() && !nombresValido()) {
          <span class="field-error">Ingresa el nombre (mínimo 2 caracteres)</span>
        }
      </div>

      <!-- Apellido Paterno / Materno -->
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label class="field-label" for="d-paterno">Apellido Paterno *</label>
          <input
            id="d-paterno"
            type="text"
            class="field-input"
            [class.field-input--error]="paternoTouched() && !paternoValido()"
            placeholder="González"
            [ngModel]="paterno()"
            (ngModelChange)="paterno.set($event)"
            (blur)="paternoTouched.set(true)"
            data-llm-description="Apellido paterno de la nueva secretaria"
            aria-required="true"
          />
          @if (paternoTouched() && !paternoValido()) {
            <span class="field-error">Ingresa el apellido paterno (mínimo 2 caracteres)</span>
          }
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="field-label" for="d-materno">Apellido Materno *</label>
          <input
            id="d-materno"
            type="text"
            class="field-input"
            [class.field-input--error]="maternoTouched() && !maternoValido()"
            placeholder="Pérez"
            [ngModel]="materno()"
            (ngModelChange)="materno.set($event)"
            (blur)="maternoTouched.set(true)"
            data-llm-description="Apellido materno de la nueva secretaria"
            aria-required="true"
          />
          @if (maternoTouched() && !maternoValido()) {
            <span class="field-error">Ingresa el apellido materno (mínimo 2 caracteres)</span>
          }
        </div>
      </div>

      <!-- RUT -->
      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="d-rut">RUT *</label>
        <input
          id="d-rut"
          type="text"
          class="field-input"
          [class.field-input--error]="rut().length > 0 && !rutValido()"
          [class.field-input--valid]="rutValido()"
          placeholder="12.345.678-9"
          maxlength="12"
          [ngModel]="rut()"
          (input)="onRutInput($event)"
          data-llm-description="RUT chileno de la nueva secretaria, formato 12.345.678-9"
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
        <label class="field-label" for="d-email">Correo electrónico *</label>
        <input
          id="d-email"
          type="email"
          class="field-input"
          [class.field-input--error]="emailTouched() && !emailValido()"
          placeholder="maria@escuela.cl"
          [ngModel]="email()"
          (ngModelChange)="email.set($event)"
          (blur)="emailTouched.set(true)"
          data-llm-description="Correo electrónico de acceso de la nueva secretaria"
          aria-required="true"
        />
        @if (emailTouched() && !emailValido()) {
          <span class="field-error">Ingresa un correo electrónico válido.</span>
        }
      </div>

      <!-- Teléfono -->
      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="d-telefono">Teléfono *</label>
        <input
          id="d-telefono"
          type="tel"
          class="field-input"
          [class.field-input--error]="telefonoTouched() && !telefonoValido()"
          placeholder="+56 9 1234 5678"
          [ngModel]="telefono()"
          (ngModelChange)="telefono.set($event)"
          (blur)="telefonoTouched.set(true)"
          data-llm-description="Teléfono de contacto de la nueva secretaria"
          aria-required="true"
        />
        @if (telefonoTouched() && !telefonoValido()) {
          <span class="field-error">Ingresa un teléfono válido (mínimo 8 dígitos).</span>
        }
      </div>

      <!-- Sede -->
      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="d-sede">Sede asignada *</label>
        <p-select
          inputId="d-sede"
          [options]="sedeOptions()"
          [(ngModel)]="sedeIdModel"
          optionLabel="label"
          optionValue="value"
          placeholder="Seleccione sede"
          styleClass="w-full"
          [disabled]="sedeDisabled()"
          aria-required="true"
          data-llm-description="Sede de trabajo asignada a la nueva secretaria"
        />
        @if (sedeDisabled()) {
          <span class="flex items-center gap-1 text-xs" style="color: var(--text-muted)">
            <app-icon name="lock" [size]="11" />
            Sede fijada por el selector de la barra superior. Cambia a "Todas las escuelas" para
            elegir otra.
          </span>
        } @else if (sedeTouched() && !sedeValida()) {
          <span class="field-error">Selecciona una sede.</span>
        }
      </div>
    </div>

    <!-- Acciones -->
    <div
      class="flex items-center gap-3 mt-6 pt-4"
      style="border-top: 1px solid var(--border-subtle);"
    >
      <button
        class="btn-secondary flex-1"
        (click)="layoutDrawer.close()"
        data-llm-action="cancelar-crear-secretaria"
      >
        Cancelar
      </button>
      <button
        class="btn-primary flex-[2]"
        [disabled]="facade.isSubmitting()"
        (click)="submit()"
        data-llm-action="confirmar-crear-secretaria"
        aria-label="Crear nueva secretaria"
      >
        @if (facade.isSubmitting()) {
          <app-icon name="loader-2" [size]="15" class="animate-spin" />
          Creando...
        } @else {
          <app-icon name="user-plus" [size]="15" />
          Crear secretaria
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
  `,
})
export class AdminSecretariasCrearDrawerComponent {
  protected readonly facade = inject(SecretariasFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly branchFacade = inject(BranchFacade);

  // ── Campos ─────────────────────────────────────────────────────────────────
  protected readonly nombres = signal('');
  protected readonly paterno = signal('');
  protected readonly materno = signal('');
  protected readonly rut = signal('');
  protected readonly email = signal('');
  protected readonly telefono = signal('');
  protected readonly sedeId = signal<number | null>(null);

  // ── Touched ────────────────────────────────────────────────────────────────
  protected readonly nombresTouched = signal(false);
  protected readonly paternoTouched = signal(false);
  protected readonly maternoTouched = signal(false);
  protected readonly rutTouched = signal(false);
  protected readonly emailTouched = signal(false);
  protected readonly telefonoTouched = signal(false);
  protected readonly sedeTouched = signal(false);

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
  protected readonly sedeValida = computed(() => this.sedeId() !== null);
  protected readonly formValido = computed(
    () =>
      this.nombresValido() &&
      this.paternoValido() &&
      this.maternoValido() &&
      this.rutValido() &&
      this.emailValido() &&
      this.telefonoValido() &&
      this.sedeValida(),
  );

  // ── Sede bloqueada cuando hay branch activo en el topbar ──────────────────
  protected readonly sedeDisabled = computed(() => this.branchFacade.selectedBranchId() !== null);

  // ── Opciones p-select ──────────────────────────────────────────────────────
  protected readonly sedeOptions = computed(() =>
    this.branchFacade.branches().map((b) => ({ label: b.name, value: b.id })),
  );

  protected get sedeIdModel(): number | null {
    return this.sedeId();
  }
  protected set sedeIdModel(v: number | null) {
    this.sedeId.set(v);
    this.sedeTouched.set(true);
  }

  constructor() {
    // Sincroniza la sede del formulario con el branch selector del topbar
    effect(() => {
      const branchId = this.branchFacade.selectedBranchId();
      if (branchId !== null) {
        this.sedeId.set(branchId);
        this.sedeTouched.set(true);
      }
    });
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
    this.maternoTouched.set(true);
    this.rutTouched.set(true);
    this.emailTouched.set(true);
    this.telefonoTouched.set(true);
    this.sedeTouched.set(true);

    if (!this.formValido()) return;

    const ok = await this.facade.crearSecretaria({
      firstNames: this.nombres().trim(),
      paternalLastName: this.paterno().trim(),
      maternalLastName: this.materno().trim(),
      rut: this.rut(),
      email: this.email().trim().toLowerCase(),
      telefono: this.telefono().trim(),
      branchId: this.sedeId()!,
    });

    if (ok) {
      this.layoutDrawer.close();
      this.facade.initialize(); // Refresh table
    }
  }
}
