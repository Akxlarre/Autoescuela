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
import { RelatoresFacade } from '@core/facades/relatores.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';

const SPEC_COLORS: Record<string, string> = {
  A2: '#3b82f6',
  A3: '#8b5cf6',
  A4: '#f59e0b',
  A5: '#10b981',
};

@Component({
  selector: 'app-admin-relator-editar-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  template: `
    <!-- ── Información Personal ───────────────────────────────────────────── -->
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
          data-llm-description="Nombres del relator"
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
          data-llm-description="Apellido paterno del relator"
          aria-required="true"
        />
        @if (paternoTouched() && !paternoValido()) {
          <span class="field-error">Ingresa el apellido paterno (mínimo 2 caracteres)</span>
        }
      </div>

      <!-- Apellido Materno -->
      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="e-materno">Apellido Materno</label>
        <input
          id="e-materno"
          type="text"
          class="field-input"
          [ngModel]="materno()"
          (ngModelChange)="materno.set($event)"
          data-llm-description="Apellido materno del relator (opcional)"
        />
      </div>

      <!-- Email -->
      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="e-email">Correo electrónico</label>
        <input
          id="e-email"
          type="email"
          class="field-input"
          [class.field-input--error]="emailTouched() && email().length > 0 && !emailValido()"
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
        <label class="field-label" for="e-telefono">Teléfono *</label>
        <input
          id="e-telefono"
          type="tel"
          class="field-input"
          [class.field-input--error]="telefonoTouched() && !telefonoValido()"
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
          data-llm-action="toggle-especialidad-editar"
        >
          <span class="spec-badge" [style.background]="spec.color">{{ spec.value }}</span>
          <span class="text-xs">{{ spec.label }}</span>
        </button>
      }
    </div>
    @if (specsTouched() && !specsValidas()) {
      <span class="field-error mb-4 block">Selecciona al menos una especialidad.</span>
    }

    <!-- ── Zona de peligro ─────────────────────────────────────────────────── -->
    <div
      class="rounded-lg p-4 mt-6 mb-2"
      style="border: 1px solid color-mix(in srgb, var(--state-error) 30%, transparent); background: color-mix(in srgb, var(--state-error) 4%, transparent);"
    >
      <h4 class="text-sm font-semibold mb-3" style="color: var(--state-error)">
        Estado del relator
      </h4>
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm" style="color: var(--text-primary)">
            {{ active() ? 'Relator activo' : 'Relator inactivo' }}
          </p>
          <p class="text-xs mt-0.5" style="color: var(--text-muted)">
            {{ active() ? 'Puede ser asignado a promociones' : 'No aparece en asignaciones' }}
          </p>
        </div>
        <button
          type="button"
          class="toggle-btn"
          [class.toggle-btn--active]="active()"
          (click)="active.set(!active())"
          [attr.aria-label]="active() ? 'Desactivar relator' : 'Activar relator'"
          data-llm-action="toggle-estado-relator"
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>

    <!-- ── Acciones ────────────────────────────────────────────────────────── -->
    <div
      class="flex items-center gap-3 pt-4 mt-4"
      style="border-top: 1px solid var(--border-subtle)"
    >
      <button class="cancel-btn" (click)="layoutDrawer.close()" data-llm-action="cancelar-editar-relator">
        Cancelar
      </button>
      <button
        class="submit-btn"
        [disabled]="facade.isSubmitting()"
        (click)="submit()"
        data-llm-action="confirmar-editar-relator"
        aria-label="Guardar cambios del relator"
      >
        @if (facade.isSubmitting()) {
          <span class="spinner"><app-icon name="loader-circle" [size]="15" /></span>
          Guardando...
        } @else {
          <app-icon name="save" [size]="15" />
          Guardar cambios
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
    .field-error {
      font-size: 12px;
      color: var(--state-error, #ef4444);
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

    /* Toggle switch */
    .toggle-btn {
      position: relative;
      width: 44px;
      height: 24px;
      border-radius: 12px;
      border: none;
      background: var(--border-default);
      cursor: pointer;
      transition: background var(--duration-fast);
      padding: 0;
      shrink: 0;
    }
    .toggle-btn--active {
      background: var(--ds-brand);
    }
    .toggle-knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: white;
      transition: transform var(--duration-fast);
    }
    .toggle-btn--active .toggle-knob {
      transform: translateX(20px);
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
export class AdminRelatorEditarDrawerComponent {
  protected readonly facade = inject(RelatoresFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Campos ──────────────────────────────────────────────────────────────────
  protected readonly nombres = signal('');
  protected readonly paterno = signal('');
  protected readonly materno = signal('');
  protected readonly email = signal('');
  protected readonly telefono = signal('');
  protected readonly selectedSpecs = signal<string[]>([]);
  protected readonly active = signal(true);

  // ── Touched ─────────────────────────────────────────────────────────────────
  protected readonly nombresTouched = signal(false);
  protected readonly paternoTouched = signal(false);
  protected readonly emailTouched = signal(false);
  protected readonly telefonoTouched = signal(false);
  protected readonly specsTouched = signal(false);

  // ── Validaciones ────────────────────────────────────────────────────────────
  protected readonly nombresValido = computed(() => this.nombres().trim().length >= 2);
  protected readonly paternoValido = computed(() => this.paterno().trim().length >= 2);
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
      this.emailValido() &&
      this.telefonoValido() &&
      this.specsValidas(),
  );

  // ── Pre-rellenar desde selectedRelator ──────────────────────────────────────
  constructor() {
    effect(() => {
      const rel = this.facade.selectedRelator();
      if (!rel) return;
      this.nombres.set(rel.firstName);
      this.paterno.set(rel.paternalLastName);
      this.materno.set(rel.maternalLastName);
      this.email.set(rel.email);
      this.telefono.set(rel.phone);
      this.selectedSpecs.set([...rel.specializations]);
      this.active.set(rel.estado === 'activo');
    });
  }

  // ── Opciones ────────────────────────────────────────────────────────────────
  protected readonly specializationOptions = [
    { value: 'A2', label: 'Taxis y colectivos', color: SPEC_COLORS['A2'] },
    { value: 'A3', label: 'Buses', color: SPEC_COLORS['A3'] },
    { value: 'A4', label: 'Carga simple', color: SPEC_COLORS['A4'] },
    { value: 'A5', label: 'Carga profesional', color: SPEC_COLORS['A5'] },
  ];

  protected isSelected(spec: string): boolean {
    return this.selectedSpecs().includes(spec);
  }

  protected toggleSpec(spec: string): void {
    this.specsTouched.set(true);
    const current = this.selectedSpecs();
    this.selectedSpecs.set(
      current.includes(spec) ? current.filter((s) => s !== spec) : [...current, spec],
    );
  }

  protected async submit(): Promise<void> {
    this.nombresTouched.set(true);
    this.paternoTouched.set(true);
    this.emailTouched.set(true);
    this.telefonoTouched.set(true);
    this.specsTouched.set(true);

    if (!this.formValido()) return;

    const rel = this.facade.selectedRelator();
    if (!rel) return;

    const ok = await this.facade.editarRelator(rel.id, {
      firstNames: this.nombres().trim(),
      paternalLastName: this.paterno().trim(),
      maternalLastName: this.materno().trim(),
      email: this.email().trim().toLowerCase(),
      phone: this.telefono().trim(),
      specializations: this.selectedSpecs(),
      active: this.active(),
    });

    if (ok) {
      this.layoutDrawer.close();
      this.facade.initialize(); // Refresh table
    }
  }
}
