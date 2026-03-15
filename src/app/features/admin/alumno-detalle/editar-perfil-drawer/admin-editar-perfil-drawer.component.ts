import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DrawerComponent } from '@shared/components/drawer/drawer.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';

/**
 * AdminEditarPerfilDrawerComponent — Panel lateral para editar datos personales del alumno.
 *
 * Smart component (features/): inyecta AdminAlumnoDetalleFacade para leer
 * alumno() y llamar a actualizarPerfilAlumno(). Al abrir, pre-rellena el
 * formulario con los datos actuales. Al guardar exitosamente emite `saved`
 * para que el padre recargue la ficha.
 *
 * Inputs:  isOpen (boolean, requerido)
 * Outputs: closed, saved
 */
@Component({
  selector: 'app-admin-editar-perfil-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent, ReactiveFormsModule, IconComponent],
  template: `
    <app-drawer
      [isOpen]="isOpen()"
      title="Editar Perfil del Alumno"
      icon="user-pen"
      [hasFooter]="true"
      (closed)="onCancel()"
    >
      <!-- ── Formulario ── -->
      <form [formGroup]="form" class="flex flex-col gap-5" (ngSubmit)="onSubmit()">
        <!-- Nombres -->
        <div class="flex flex-col gap-1.5">
          <label for="edit-first-names" class="field-label">
            NOMBRES <span style="color: var(--state-error)">*</span>
          </label>
          <input
            id="edit-first-names"
            type="text"
            formControlName="first_names"
            class="field-input"
            placeholder="Ej: Juan Carlos"
            data-llm-description="Nombres del alumno"
            [class.field-input--error]="isInvalid('first_names')"
          />
          @if (isInvalid('first_names')) {
            <span class="field-error">Los nombres son obligatorios.</span>
          }
        </div>

        <!-- Apellido Paterno -->
        <div class="flex flex-col gap-1.5">
          <label for="edit-paternal" class="field-label">
            APELLIDO PATERNO <span style="color: var(--state-error)">*</span>
          </label>
          <input
            id="edit-paternal"
            type="text"
            formControlName="paternal_last_name"
            class="field-input"
            placeholder="Ej: González"
            data-llm-description="Apellido paterno del alumno"
            [class.field-input--error]="isInvalid('paternal_last_name')"
          />
          @if (isInvalid('paternal_last_name')) {
            <span class="field-error">El apellido paterno es obligatorio.</span>
          }
        </div>

        <!-- Apellido Materno -->
        <div class="flex flex-col gap-1.5">
          <label for="edit-maternal" class="field-label">APELLIDO MATERNO</label>
          <input
            id="edit-maternal"
            type="text"
            formControlName="maternal_last_name"
            class="field-input"
            placeholder="Ej: Pérez"
            data-llm-description="Apellido materno del alumno"
          />
        </div>

        <!-- Email -->
        <div class="flex flex-col gap-1.5">
          <label for="edit-email" class="field-label">
            EMAIL <span style="color: var(--state-error)">*</span>
          </label>
          <input
            id="edit-email"
            type="email"
            formControlName="email"
            class="field-input"
            placeholder="correo@ejemplo.cl"
            data-llm-description="Correo electrónico del alumno"
            [class.field-input--error]="isInvalid('email')"
          />
          @if (isInvalid('email')) {
            <span class="field-error">Ingresa un email válido.</span>
          }
        </div>

        <!-- Teléfono -->
        <div class="flex flex-col gap-1.5">
          <label for="edit-phone" class="field-label">TELÉFONO</label>
          <input
            id="edit-phone"
            type="tel"
            formControlName="phone"
            class="field-input"
            placeholder="+56 9 1234 5678"
            data-llm-description="Número de teléfono del alumno"
          />
        </div>

        <!-- Feedback de error -->
        @if (saveError()) {
          <p class="text-sm" style="color: var(--state-error)">
            {{ saveError() }}
          </p>
        }

        <!-- Feedback de éxito -->
        @if (saveSuccess()) {
          <div
            class="flex items-center gap-2 p-3 rounded-lg text-sm font-medium"
            style="background: var(--state-success-bg); color: var(--state-success); border: 1px solid var(--state-success-border)"
          >
            <app-icon name="check-circle" [size]="16" />
            Datos actualizados correctamente.
          </div>
        }
      </form>

      <!-- ── Footer ── -->
      <div drawer-footer class="flex items-center justify-end gap-2">
        <button
          type="button"
          class="btn-cancel"
          (click)="onCancel()"
          data-llm-action="cancelar-edicion-perfil"
          aria-label="Cancelar y cerrar panel"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary"
          [disabled]="form.invalid || isSaving()"
          (click)="onSubmit()"
          data-llm-action="guardar-perfil-alumno"
          aria-label="Guardar cambios del perfil del alumno"
        >
          @if (isSaving()) {
            <app-icon name="loader" [size]="14" />
            Guardando...
          } @else {
            Guardar Cambios
          }
        </button>
      </div>
    </app-drawer>
  `,
  styles: `
    .field-label {
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      letter-spacing: 0.06em;
      color: var(--ds-brand);
    }

    .field-input {
      width: 100%;
      padding: 8px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      transition:
        border-color var(--duration-fast),
        box-shadow var(--duration-fast);
      outline: none;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }
    .field-input--error {
      border-color: var(--state-error) !important;
    }

    .field-error {
      font-size: var(--text-xs);
      color: var(--state-error);
    }

    .btn-cancel {
      padding: 7px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-strong);
      background: transparent;
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      cursor: pointer;
      transition: background var(--duration-fast);
    }
    .btn-cancel:hover {
      background: var(--bg-elevated);
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 20px;
      border-radius: var(--radius-md);
      border: none;
      background: var(--ds-brand);
      color: #fff;
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      cursor: pointer;
      transition: opacity var(--duration-fast);
    }
    .btn-primary:hover:not(:disabled) {
      opacity: 0.85;
    }
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class AdminEditarPerfilDrawerComponent {
  // ── Inputs / Outputs ────────────────────────────────────────────────────────
  readonly isOpen = input.required<boolean>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  // ── Injections ──────────────────────────────────────────────────────────────
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
  private readonly fb = inject(FormBuilder);

  // ── Estado local ────────────────────────────────────────────────────────────
  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saveSuccess = signal(false);

  // ── Formulario reactivo ─────────────────────────────────────────────────────
  protected readonly form = this.fb.group({
    first_names: ['', Validators.required],
    paternal_last_name: ['', Validators.required],
    maternal_last_name: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
  });

  constructor() {
    // Pre-rellenar el formulario cada vez que el drawer se abre
    effect(() => {
      if (this.isOpen()) {
        const alumno = this.facade.alumno();
        if (alumno) {
          this.form.patchValue({
            first_names: alumno.firstName,
            paternal_last_name: alumno.paternalLastName,
            maternal_last_name: alumno.maternalLastName,
            email: alumno.email,
            phone: alumno.telefono === '—' ? '' : alumno.telefono,
          });
          this.saveError.set(null);
          this.saveSuccess.set(false);
        }
      }
    });
  }

  // ── Helpers de template ─────────────────────────────────────────────────────
  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  protected onCancel(): void {
    this.form.reset();
    this.saveError.set(null);
    this.saveSuccess.set(false);
    this.closed.emit();
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const userId = this.facade.alumno()?.userId;
    if (!userId) {
      this.saveError.set('No se pudo identificar al usuario. Recarga la página.');
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);

    try {
      const { first_names, paternal_last_name, maternal_last_name, email, phone } =
        this.form.getRawValue();

      await this.facade.actualizarPerfilAlumno(userId, {
        first_names: first_names!,
        paternal_last_name: paternal_last_name!,
        maternal_last_name: maternal_last_name ?? '',
        email: email!,
        phone: phone ?? '',
      });

      this.saveSuccess.set(true);
      this.saved.emit();

      // Cerrar automáticamente tras mostrar el mensaje de éxito
      setTimeout(() => {
        this.saveSuccess.set(false);
        this.form.reset();
        this.closed.emit();
      }, 1200);
    } catch (err) {
      this.saveError.set(
        err instanceof Error ? err.message : 'Error al guardar. Intenta de nuevo.',
      );
    } finally {
      this.isSaving.set(false);
    }
  }
}
