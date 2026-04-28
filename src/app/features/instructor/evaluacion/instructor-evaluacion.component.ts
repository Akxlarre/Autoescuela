import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SignaturePadComponent } from '@shared/components/signature-pad/signature-pad.component';
import { EvaluationChecklistComponent } from '@shared/components/evaluation-checklist/evaluation-checklist.component';
import {
  EVALUATION_CHECKLIST_ITEMS,
  EvaluationChecklistItem,
  EvaluationFormData,
} from '@core/models/ui/instructor-portal.model';

@Component({
  selector: 'app-instructor-evaluacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IconComponent,
    EmptyStateComponent,
    SignaturePadComponent,
    EvaluationChecklistComponent,
  ],
  template: `
    <div class="px-6 py-6 pb-20 max-w-4xl mx-auto space-y-6">
      <!-- Breadcrumb simple -->
      <div class="flex items-center gap-2 text-sm text-text-muted">
        <button class="hover:text-text-primary flex items-center gap-1" (click)="goBack()">
          <app-icon name="arrow-left" [size]="14" />
          Mis Alumnos
        </button>
        <span>/</span>
        <span class="text-text-primary font-medium">Evaluación Práctica</span>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-text-primary">Evaluación Práctica</h1>
          <p class="text-sm text-text-muted mt-1">Calificar el desempeño y firmar el registro</p>
        </div>
        <button class="btn btn-outline" (click)="goBack()">
          <app-icon name="arrow-left" [size]="16" />
          Volver
        </button>
      </div>

      @if (clasesFacade.isLoading()) {
        <div class="flex justify-center p-12">
          <app-icon
            name="loader-2"
            [size]="32"
            style="color: var(--color-primary)"
            class="animate-spin"
          />
        </div>
      } @else if (clasesFacade.error()) {
        <div
          class="card p-4 flex items-start gap-3"
          style="background: var(--state-error-bg); color: var(--state-error)"
        >
          <app-icon name="alert-circle" [size]="20" class="mt-0.5 shrink-0" />
          <p class="text-sm">{{ clasesFacade.error() }}</p>
        </div>
      } @else if (clasesFacade.selectedClass(); as cls) {
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Sidebar Info -->
          <div class="lg:col-span-1 space-y-6">
            <div class="card p-5">
              <h3
                class="text-xs font-bold uppercase tracking-wider text-text-muted mb-4 border-b border-divider pb-2"
              >
                Información Clase #{{ cls.classNumber }}
              </h3>
              <div class="space-y-4">
                <div>
                  <p class="text-sm text-text-muted mb-0.5">Alumno</p>
                  <p class="font-medium text-text-primary">{{ cls.studentName }}</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <p class="text-sm text-text-muted mb-0.5">Km Inicial</p>
                    <p class="font-medium text-text-primary">{{ cls.kmStart || 0 }}</p>
                  </div>
                  <div>
                    <p class="text-sm text-text-muted mb-0.5">Km Final</p>
                    <p class="font-medium text-text-primary">{{ cls.kmEnd || 0 }}</p>
                  </div>
                </div>
                <div>
                  <p class="text-sm text-text-muted mb-0.5">Vehículo</p>
                  <p class="font-medium text-text-primary">
                    {{ cls.vehiclePlate }} ({{ cls.vehicleLabel }})
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Formulario de Evaluación -->
          <div class="lg:col-span-2">
            <form
              [formGroup]="evalForm"
              (ngSubmit)="submit(cls.sessionId)"
              class="card p-0 overflow-hidden flex flex-col"
            >
              <div class="p-6 space-y-8 bg-surface">
                <!-- Nota -->
                <div>
                  <h3
                    class="text-base font-semibold text-text-primary mb-1 flex items-center gap-2"
                  >
                    <app-icon name="award" [size]="18" style="color: var(--state-warning)" />
                    Nota Global
                  </h3>
                  <p class="text-sm text-text-muted mb-3">Asigna una calificación del 1 al 5.</p>
                  <div
                    class="flex gap-2 p-1 bg-surface-hover rounded-lg w-max border border-divider"
                  >
                    @for (grade of gradeOptions; track grade) {
                      <label class="cursor-pointer">
                        <input
                          type="radio"
                          formControlName="grade"
                          [value]="grade"
                          class="peer sr-only"
                        />
                        <div
                          class="w-12 h-10 flex items-center justify-center font-bold text-text-muted rounded transition-colors peer-checked:bg-brand-primary peer-checked:text-white hover:bg-divider"
                        >
                          {{ grade }}
                        </div>
                      </label>
                    }
                  </div>
                  @if (evalForm.get('grade')?.invalid && evalForm.get('grade')?.touched) {
                    <p class="text-xs mt-2" style="color: var(--state-error)">
                      La nota es obligatoria.
                    </p>
                  }
                </div>

                <hr class="border-divider" />

                <!-- Checklist -->
                <app-evaluation-checklist
                  [items]="checklistItems"
                  (itemsChange)="onChecklistChange($event)"
                />

                <hr class="border-divider" />

                <!-- Observaciones -->
                <div class="space-y-1.5">
                  <label class="form-label font-semibold text-base mb-1" for="obs"
                    >Observaciones o Tareas</label
                  >
                  <p class="text-sm text-text-muted mb-3">
                    Comentarios sobre el desempeño o indicaciones para la próxima clase.
                  </p>
                  <textarea
                    id="obs"
                    formControlName="observations"
                    rows="3"
                    class="form-control resize-y"
                    placeholder="Ej: Necesita repasar marcha atrás..."
                    data-llm-description="textarea for evaluation observations and tasks"
                  ></textarea>
                </div>

                <hr class="border-divider" />

                <!-- Firmas -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <app-signature-pad
                    label="Firma Alumno"
                    (signatureChange)="onSignatureChange('student', $event)"
                    [height]="150"
                  />
                  <app-signature-pad
                    label="Firma Instructor"
                    (signatureChange)="onSignatureChange('instructor', $event)"
                    [height]="150"
                  />
                </div>
              </div>

              <!-- Form Actions -->
              <div class="p-6 bg-surface-hover border-t border-divider flex justify-end gap-3">
                <button type="button" class="btn btn-outline" (click)="goBack()">Cancelar</button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  [disabled]="evalForm.invalid || isSubmitting()"
                  data-llm-action="save-evaluation"
                >
                  @if (!isSubmitting()) {
                    <app-icon name="save" [size]="16" />
                  } @else {
                    <app-icon name="loader-2" [size]="16" class="animate-spin" />
                  }
                  <span>{{ isSubmitting() ? 'Guardando...' : 'Finalizar Evaluación' }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      } @else {
        <app-empty-state
          icon="file-x"
          message="Clase no encontrada"
          subtitle="La sesión a evaluar no existe o no tienes acceso."
          actionLabel="Volver"
          actionIcon="arrow-left"
          (action)="goBack()"
        />
      }
    </div>
  `,
})
export class InstructorEvaluacionComponent implements OnInit {
  public clasesFacade = inject(InstructorClasesFacade);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  public evalForm: FormGroup;
  public isSubmitting = signal(false);
  private studentId: string | null = null;

  public checklistItems: EvaluationChecklistItem[] = [...EVALUATION_CHECKLIST_ITEMS].map(
    (item: Omit<EvaluationChecklistItem, 'checked'>) => ({ ...item, checked: true }),
  );
  private studentSignature: string | null = null;
  private instructorSignature: string | null = null;

  readonly gradeOptions = [3, 4, 5, 6, 7];

  constructor() {
    this.evalForm = this.fb.group({
      grade: [null, Validators.required],
      observations: [''],
    });
  }

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.studentId = params['id'];
      const sessionIdStr = params['sessionId'];
      if (sessionIdStr) {
        const sessionId = parseInt(sessionIdStr, 10);
        if (!isNaN(sessionId)) {
          this.clasesFacade.loadClassDetail(sessionId);
        }
      }
    });
  }

  onChecklistChange(items: EvaluationChecklistItem[]) {
    this.checklistItems = items;
  }

  onSignatureChange(type: 'student' | 'instructor', dataUrl: string | null) {
    if (type === 'student') {
      this.studentSignature = dataUrl;
    } else {
      this.instructorSignature = dataUrl;
    }
  }

  goBack() {
    if (this.studentId) {
      this.router.navigate(['/app/instructor/alumnos', this.studentId, 'ficha']);
    } else {
      this.router.navigate(['/app/instructor/dashboard']);
    }
  }

  async submit(sessionId: number) {
    if (this.evalForm.invalid) return;

    this.isSubmitting.set(true);
    try {
      const cls = this.clasesFacade.selectedClass();
      const data: EvaluationFormData = {
        sessionId,
        classNumber: cls?.classNumber || 0,
        studentName: cls?.studentName || '',
        kmStart: cls?.kmStart || 0,
        kmEnd: cls?.kmEnd || 0,
        grade: this.evalForm.value.grade,
        observations: this.evalForm.value.observations,
        checklist: this.checklistItems,
        studentSignature: this.studentSignature,
        instructorSignature: this.instructorSignature,
      };
      await this.clasesFacade.saveEvaluation(data);
      this.clasesFacade.showSuccess(
        'Evaluación guardada',
        'La evaluación se ha registrado con éxito.',
      );
      this.goBack();
    } catch {
      this.clasesFacade.showError('Error al guardar la evaluación', 'Por favor intenta de nuevo.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
