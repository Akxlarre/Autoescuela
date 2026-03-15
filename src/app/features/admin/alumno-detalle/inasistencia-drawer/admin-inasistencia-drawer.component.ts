import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DrawerComponent } from '@shared/components/drawer/drawer.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';

/**
 * AdminInasistenciaDrawerComponent — Panel lateral para registrar una inasistencia.
 *
 * Smart component (features/): inyecta AdminAlumnoDetalleFacade para llamar
 * a insertAbsenceEvidence y lee enrollmentId directamente desde alumno().
 *
 * Inputs:  isOpen (boolean)
 * Outputs: closed, saved
 */
@Component({
  selector: 'app-admin-inasistencia-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent, ReactiveFormsModule, IconComponent],
  template: `
    <app-drawer
      [isOpen]="isOpen()"
      title="Registrar Inasistencia"
      icon="alert-triangle"
      [hasFooter]="true"
      (closed)="onCancel()"
    >
      <!-- ── Formulario ── -->
      <form [formGroup]="form" class="flex flex-col gap-5" (ngSubmit)="onSubmit()">
        <!-- Fecha de inasistencia -->
        <div class="flex flex-col gap-1.5">
          <label for="inas-date" class="field-label">
            FECHA DE INASISTENCIA <span style="color: var(--state-error)">*</span>
          </label>
          <input
            id="inas-date"
            type="date"
            formControlName="document_date"
            class="field-input"
            data-llm-description="Fecha en que ocurrió la inasistencia del alumno"
            [class.field-input--error]="isInvalid('document_date')"
          />
          @if (isInvalid('document_date')) {
            <span class="field-error">Este campo es obligatorio.</span>
          }
        </div>

        <!-- Tipo de justificación -->
        <div class="flex flex-col gap-1.5">
          <label for="inas-type" class="field-label">
            TIPO DE JUSTIFICACIÓN <span style="color: var(--state-error)">*</span>
          </label>
          <select
            id="inas-type"
            formControlName="document_type"
            class="field-input field-select"
            data-llm-description="Categoría del documento que justifica la inasistencia"
            [class.field-input--error]="isInvalid('document_type')"
          >
            <option value="" disabled>Selecciona un tipo...</option>
            <option value="Justificación Médica">Justificación Médica</option>
            <option value="Permiso Personal">Permiso Personal</option>
            <option value="Emergencia Familiar">Emergencia Familiar</option>
            <option value="Accidente">Accidente</option>
            <option value="Otro">Otro</option>
          </select>
          @if (isInvalid('document_type')) {
            <span class="field-error">Selecciona un tipo de justificación.</span>
          }
        </div>

        <!-- Descripción / Motivo -->
        <div class="flex flex-col gap-1.5">
          <label for="inas-desc" class="field-label">MOTIVO / DESCRIPCIÓN</label>
          <textarea
            id="inas-desc"
            formControlName="description"
            rows="3"
            class="field-input"
            placeholder="Describe brevemente el motivo de la inasistencia..."
            data-llm-description="Descripción detallada del motivo de la inasistencia del alumno"
          ></textarea>
        </div>

        <!-- Archivo adjunto (simulado) -->
        <div class="flex flex-col gap-1.5">
          <span class="field-label">DOCUMENTO DE RESPALDO</span>
          <label
            class="file-upload-zone"
            [class.file-upload-zone--selected]="selectedFileName()"
            tabindex="0"
            role="button"
            aria-label="Seleccionar archivo de respaldo"
            (keydown.enter)="fileInput.click()"
            (keydown.space)="fileInput.click(); $event.preventDefault()"
          >
            <input
              #fileInput
              type="file"
              class="sr-only"
              accept=".pdf,.jpg,.jpeg,.png"
              (change)="onFileChange($event)"
              data-llm-description="Archivo PDF o imagen que respalda la justificación"
            />
            @if (selectedFileName()) {
              <div class="flex items-center gap-2" style="color: var(--state-success)">
                <app-icon name="check-circle" [size]="16" />
                <span class="text-sm font-medium">{{ selectedFileName() }}</span>
              </div>
            } @else {
              <div class="flex flex-col items-center gap-1.5" style="color: var(--text-muted)">
                <app-icon name="upload-cloud" [size]="22" />
                <span class="text-sm">
                  Arrastra o
                  <span style="color: var(--ds-brand); font-weight: 500"
                    >haz clic para seleccionar</span
                  >
                </span>
                <span class="text-xs">PDF, JPG o PNG — máx. 5 MB</span>
              </div>
            }
          </label>
        </div>

        @if (saveError()) {
          <p class="text-sm" style="color: var(--state-error)">
            {{ saveError() }}
          </p>
        }
      </form>

      <!-- ── Footer ── -->
      <div drawer-footer class="flex items-center justify-end gap-2">
        <button
          type="button"
          class="btn-cancel"
          (click)="onCancel()"
          data-llm-action="cancelar-registro-inasistencia"
          aria-label="Cancelar y cerrar panel"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary"
          [disabled]="form.invalid || isSaving()"
          (click)="onSubmit()"
          data-llm-action="guardar-inasistencia"
          aria-label="Guardar registro de inasistencia"
        >
          @if (isSaving()) {
            <app-icon name="loader" [size]="14" />
            Guardando...
          } @else {
            Guardar
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
    textarea.field-input {
      resize: vertical;
      min-height: 76px;
    }
    .field-select {
      appearance: auto;
      cursor: pointer;
    }

    .field-error {
      font-size: var(--text-xs);
      color: var(--state-error);
    }

    .file-upload-zone {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 84px;
      padding: 16px;
      border: 1.5px dashed var(--border-default);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition:
        border-color var(--duration-fast),
        background var(--duration-fast);
      background: var(--bg-base);
    }
    .file-upload-zone:hover {
      border-color: var(--ds-brand);
      background: color-mix(in srgb, var(--ds-brand) 4%, var(--bg-base));
    }
    .file-upload-zone--selected {
      border-color: var(--state-success);
      border-style: solid;
      background: var(--state-success-bg);
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
export class AdminInasistenciaDrawerComponent {
  // ── Inputs / Outputs ────────────────────────────────────────────────────────
  readonly isOpen = input.required<boolean>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  // ── Injections ──────────────────────────────────────────────────────────────
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
  private readonly fb = inject(FormBuilder);

  // ── Estado local ────────────────────────────────────────────────────────────
  protected readonly isSaving = signal(false);
  protected readonly selectedFileName = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);

  // ── Formulario reactivo ─────────────────────────────────────────────────────
  protected readonly form = this.fb.group({
    document_date: ['', Validators.required],
    document_type: ['', Validators.required],
    description: [''],
  });

  // ── Helpers de template ─────────────────────────────────────────────────────
  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFileName.set(input.files?.[0]?.name ?? null);
  }

  protected onCancel(): void {
    this.resetForm();
    this.closed.emit();
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const enrollmentId = this.facade.alumno()?.enrollmentId ?? null;
    if (enrollmentId == null) {
      this.saveError.set('No se encontró matrícula activa para este alumno.');
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);

    try {
      const { document_date, document_type, description } = this.form.getRawValue();
      await this.facade.insertAbsenceEvidence({
        enrollmentId,
        documentDate: document_date!,
        documentType: document_type!,
        description: description ?? '',
        fileUrl: null, // Simulado — integrar Supabase Storage cuando esté disponible
      });
      this.resetForm();
      this.saved.emit();
      this.closed.emit();
    } catch (err) {
      this.saveError.set(
        err instanceof Error ? err.message : 'Error al guardar. Intenta de nuevo.',
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  private resetForm(): void {
    this.form.reset();
    this.selectedFileName.set(null);
    this.saveError.set(null);
  }
}
