import { ChangeDetectionStrategy, Component, inject, OnInit, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

@Component({
  selector: 'app-admin-editar-perfil-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div class="flex flex-col h-full bg-surface">
      <!-- ── Body ── -->
      <div class="flex-1 overflow-y-auto p-5">
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
              aria-required="true"
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
              aria-required="true"
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
              aria-required="true"
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
      </div>

      <!-- ── Footer ── -->
      <div class="p-4 border-t bg-subtle flex items-center justify-end gap-2">
        <button
          type="button"
          class="btn-secondary"
          (click)="onCancel()"
          data-llm-action="cancelar-edicion-perfil"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary"
          [disabled]="form.invalid || isSaving()"
          (click)="onSubmit()"
          data-llm-action="guardar-perfil-alumno"
        >
          @if (isSaving()) {
            <app-icon name="loader" [size]="14" class="animate-spin" />
            Guardando...
          } @else {
            Guardar Cambios
          }
        </button>
      </div>
    </div>
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
      padding: 10px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
    }
    .field-input--error {
      border-color: var(--state-error) !important;
    }
    .field-error {
      font-size: var(--text-xs);
      color: var(--state-error);
      margin-top: 4px;
    }
  `,
})
export class AdminEditarPerfilDrawerComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly fb = inject(FormBuilder);

  readonly saved = output<void>();

  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saveSuccess = signal(false);

  protected readonly form = this.fb.group({
    first_names: ['', Validators.required],
    paternal_last_name: ['', Validators.required],
    maternal_last_name: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
  });

  ngOnInit(): void {
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

  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  protected onCancel(): void {
    this.form.reset();
    this.saveError.set(null);
    this.saveSuccess.set(false);
    this.layoutDrawer.close();
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

      setTimeout(() => {
        this.saveSuccess.set(false);
        this.form.reset();
        this.layoutDrawer.close();
      }, 1200);
    } catch (err) {
      this.saveError.set(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
