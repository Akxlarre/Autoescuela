import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SignaturePadComponent } from '@shared/components/signature-pad/signature-pad.component';
import { EvaluationChecklistComponent } from '@shared/components/evaluation-checklist/evaluation-checklist.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import {
  EVALUATION_CHECKLIST_ITEMS,
  EvaluationChecklistItem,
  EvaluationFormData,
} from '@core/models/ui/instructor-portal.model';
import { StableWidthDirective } from '@core/directives/stable-width.directive';

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
    BadgeComponent,
    StableWidthDirective,
  ],
  template: `
    <div class="px-6 py-6 pb-20 space-y-6">
      <!-- Breadcrumb simple -->
      <div class="flex items-center gap-2 text-sm text-text-muted">
        <button
          class="hover:text-text-primary flex items-center gap-1 cursor-pointer"
          (click)="goBack()"
        >
          <app-icon name="arrow-left" [size]="14" />
          Ficha Técnica
        </button>
        <span>/</span>
        <span class="text-text-primary font-medium">Evaluación Práctica</span>
      </div>

      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-text-primary">Evaluación Práctica</h1>
          @if (readonlyMode()) {
            <app-badge variant="info">Modo lectura</app-badge>
          }
        </div>
        <p class="text-sm text-text-muted mt-1">
          {{
            readonlyMode()
              ? 'Evaluación ya registrada — solo lectura'
              : 'Calificar el desempeño y firmar el registro'
          }}
        </p>
      </div>

      @if (clasesFacade.isLoading()) {
        <div class="flex justify-center p-12">
          <app-icon name="loader-2" [size]="32" class="animate-spin text-brand" />
        </div>
      } @else if (clasesFacade.error()) {
        <div class="card p-4 flex items-start gap-3 bg-error-subtle text-error">
          <app-icon name="alert-circle" [size]="20" class="mt-0.5 shrink-0" />
          <p class="text-sm">{{ clasesFacade.error() }}</p>
        </div>
      } @else if (clasesFacade.selectedClass(); as cls) {
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Sidebar Info -->
          <div class="lg:col-span-1 space-y-6">
            <div class="card p-5">
              <h3 class="micro-label mb-4 border-b border-border-subtle pb-2">
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

          <!-- Formulario de Evaluación (un solo paso continuo) -->
          <div class="lg:col-span-2">
            <form
              [formGroup]="evalForm"
              (ngSubmit)="submit(cls.sessionId)"
              class="card p-0 overflow-hidden flex flex-col"
            >
              <div class="p-6 space-y-8 bg-surface">
                <!-- Checklist de aspectos a evaluar -->
                <app-evaluation-checklist
                  [items]="checklistItems"
                  [readonly]="readonlyMode()"
                  (itemsChange)="onChecklistChange($event)"
                />

                <hr class="border-border-subtle" />

                <!-- Nota Global (síntesis del checklist) -->
                <div>
                  <h3 class="text-text-primary font-semibold mb-1 flex items-center gap-2">
                    <app-icon name="award" [size]="18" class="text-warning" />
                    Nota Global
                  </h3>
                  <p class="text-sm text-text-muted mb-3">
                    Asigna una calificación en base a los aspectos evaluados arriba.
                  </p>
                  <div
                    class="flex gap-2 p-1 bg-subtle rounded-lg w-max border border-border-subtle"
                  >
                    @for (grade of gradeOptions; track grade) {
                      <label class="cursor-pointer relative">
                        <input
                          type="radio"
                          formControlName="grade"
                          [value]="grade"
                          class="peer sr-only"
                        />
                        <div
                          class="w-12 h-10 flex items-center justify-center font-bold text-text-muted rounded transition-colors peer-checked:bg-brand peer-checked:text-white hover:bg-border-subtle"
                        >
                          {{ grade }}
                        </div>
                      </label>
                    }
                  </div>
                  @if (evalForm.get('grade')?.invalid && evalForm.get('grade')?.touched) {
                    <p class="text-xs mt-2 text-error">La nota es obligatoria.</p>
                  }
                </div>

                <hr class="border-border-subtle" />

                <!-- Observaciones (opcional) -->
                <div class="space-y-1.5">
                  <label
                    class="text-xs sm:text-sm font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2"
                    for="obs"
                  >
                    <app-icon name="pen-tool" [size]="16" />
                    Observaciones o Tareas (opcional)
                  </label>
                  <p class="text-sm text-text-muted mb-3">
                    Comentarios sobre el desempeño o indicaciones para la próxima clase.
                  </p>
                  <div class="relative group">
                    <textarea
                      id="obs"
                      formControlName="observations"
                      rows="4"
                      class="form-control w-full resize-none rounded-2xl p-5 bg-subtle border-border-default/60 focus:bg-surface focus:border-brand/40 focus:ring-4 focus:ring-brand/10 transition-all text-sm sm:text-base shadow-inner placeholder:text-text-muted/60 hover:border-border-strong cursor-text"
                      placeholder="Ej: Necesita repasar marcha atrás..."
                      data-llm-description="textarea for evaluation observations and tasks"
                    ></textarea>
                  </div>
                </div>

                <hr class="border-border-subtle" />

                <!-- Firmas (opcional) -->
                <div>
                  <h3 class="text-text-primary font-semibold mb-3">Firmas (opcional)</h3>
                  @if (readonlyMode()) {
                    <!-- Solo lectura — el schema solo registra un booleano de firma, no una imagen -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div class="space-y-2">
                        <label
                          class="text-xs sm:text-sm font-bold text-text-primary uppercase tracking-widest"
                          >Firma Alumno</label
                        >
                        <div
                          class="border-2 border-border-default rounded-2xl bg-surface flex items-center justify-center gap-2"
                          style="height: 150px"
                        >
                          @if (cls.studentSigned) {
                            <app-icon name="check-circle" [size]="20" class="text-success" />
                            <span class="text-sm text-text-primary font-medium">Firmado</span>
                          } @else {
                            <span class="text-sm text-text-muted">Sin firma registrada</span>
                          }
                        </div>
                      </div>
                      <div class="space-y-2">
                        <label
                          class="text-xs sm:text-sm font-bold text-text-primary uppercase tracking-widest"
                          >Firma Instructor</label
                        >
                        <div
                          class="border-2 border-border-default rounded-2xl bg-surface flex items-center justify-center gap-2"
                          style="height: 150px"
                        >
                          @if (cls.instructorSigned) {
                            <app-icon name="check-circle" [size]="20" class="text-success" />
                            <span class="text-sm text-text-primary font-medium">Firmado</span>
                          } @else {
                            <span class="text-sm text-text-muted">Sin firma registrada</span>
                          }
                        </div>
                      </div>
                    </div>
                  } @else {
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
                  }
                </div>
              </div>

              <!-- Form Actions -->
              <div class="p-6 bg-surface border-t border-border-subtle flex justify-end gap-3">
                @if (readonlyMode()) {
                  <button type="button" class="btn-primary" (click)="goBack()">Volver</button>
                } @else {
                  <button
                    type="submit"
                    class="btn-primary"
                    [disabled]="evalForm.invalid || isSubmitting()"
                    [appStableWidth]="isSubmitting()"
                    data-llm-action="save-evaluation"
                  >
                    @if (!isSubmitting()) {
                      <app-icon name="save" [size]="16" />
                    } @else {
                      <app-icon name="loader-2" [size]="16" class="animate-spin" />
                    }
                    <span>{{ isSubmitting() ? 'Guardando...' : 'Finalizar Evaluación' }}</span>
                  </button>
                }
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

  readonly readonlyMode = computed(() => {
    const cls = this.clasesFacade.selectedClass();
    return !!cls && cls.status === 'completed' && !cls.canEvaluate;
  });

  constructor() {
    this.evalForm = this.fb.group({
      grade: [null, Validators.required],
      observations: [''],
    });

    // Precarga la evaluación ya guardada (checklist/nota/observaciones) al revisar
    // una clase cerrada — sin esto "Ver" mostraba un formulario en blanco.
    effect(() => {
      const cls = this.clasesFacade.selectedClass();
      if (!cls) return;

      if (cls.evaluationChecklist?.length) {
        this.checklistItems = [...cls.evaluationChecklist];
      }
      this.evalForm.patchValue(
        {
          grade: cls.evaluationGrade,
          observations: cls.notes ?? '',
        },
        { emitEvent: false },
      );

      if (this.readonlyMode()) {
        this.evalForm.disable({ emitEvent: false });
      }
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
    if (this.readonlyMode() || this.evalForm.invalid) return;

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
