import { ChangeDetectionStrategy, Component, OnInit, inject, signal, effect, computed } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { EvaluationChecklistComponent } from '@shared/components/evaluation-checklist/evaluation-checklist.component';
import { SignaturePadComponent } from '@shared/components/signature-pad/signature-pad.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import {
  EVALUATION_CHECKLIST_ITEMS,
  EvaluationChecklistItem,
  EvaluationFormData,
} from '@core/models/ui/instructor-portal.model';

@Component({
  selector: 'app-instructor-clase-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TagModule,
    IconComponent,
    EmptyStateComponent,
    EvaluationChecklistComponent,
    SignaturePadComponent,
    SectionHeroComponent,
    AlertCardComponent,
  ],
  template: `
    <div class="px-6 py-6 pb-20 max-w-4xl mx-auto space-y-6">
      <!-- Section Hero Premium -->
      <app-section-hero
        [title]="showFinalStep() ? 'Finalizar Sesión' : 'Clase en Curso'"
        [subtitle]="showFinalStep() ? 'Registra el kilometraje final y firmas' : 'Completa la evaluación mientras transcurre la clase'"
        variant="compact"
        [actions]="heroActions()"
        (actionClick)="onHeroAction($event)"
      />

      @if (clasesFacade.isLoading()) {
        <div class="flex justify-center p-12">
          <app-icon name="loader-2" [size]="32" class="text-brand animate-spin" />
        </div>
      } @else if (clasesFacade.error()) {
        <app-alert-card title="Error al cargar clase" severity="error">
          {{ clasesFacade.error() }}
        </app-alert-card>
      } @else if (clasesFacade.selectedClass(); as cls) {
        <!-- Resumen de Clase Estilo "Ticket" -->
        <div class="bento-card relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-bl-full pointer-events-none -mr-8 -mt-8"></div>
          <div class="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5 relative z-10">
            <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-brand/10 border border-brand/20 flex flex-col items-center justify-center shrink-0">
              <span class="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold text-brand leading-tight">Clase</span>
              <span class="text-lg sm:text-xl font-display font-bold text-brand leading-none">{{ cls.classNumber }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-lg sm:text-xl font-display font-bold text-text-primary leading-tight break-words">{{ cls.studentName }}</h2>
              <p class="text-xs sm:text-sm text-text-muted mt-1">RUT: {{ cls.studentRut }}</p>
            </div>
            <p-tag [value]="cls.statusLabel" [severity]="$any(cls.statusColor)" styleClass="hidden sm:inline-flex shrink-0" />
          </div>

          <div class="mb-5 sm:hidden mt-2">
            <p-tag [value]="cls.statusLabel" [severity]="$any(cls.statusColor)" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 pt-4 sm:pt-5 border-t border-border-default/50 relative z-10">
            <div class="flex items-center gap-3 bg-surface-hover/50 sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none">
              <div class="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center shrink-0 shadow-sm sm:shadow-none">
                <app-icon name="gauge" [size]="16" class="text-text-secondary" />
              </div>
              <div>
                <p class="text-[9px] sm:text-[10px] font-bold text-text-muted uppercase tracking-wider">Km Inicial</p>
                <p class="text-sm font-mono text-text-primary font-medium mt-0.5">{{ cls.kmStart }} km</p>
              </div>
            </div>
            <div class="flex items-center gap-3 bg-surface-hover/50 sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none">
              <div class="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center shrink-0 shadow-sm sm:shadow-none">
                <app-icon name="clock" [size]="16" class="text-text-secondary" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[9px] sm:text-[10px] font-bold text-text-muted uppercase tracking-wider">Iniciada</p>
                <p class="text-sm text-text-primary font-medium truncate mt-0.5">{{ cls.startTime || 'Recién' }}</p>
              </div>
            </div>
          </div>
        </div>

        @if (!showFinalStep()) {
          <!-- STEP 1: EVALUATION (DURING CLASS) -->
          <div class="grid grid-cols-1 gap-6 mt-2">
            <div class="bento-card p-6 sm:p-10 space-y-10 relative overflow-hidden">
              
              <!-- Checklist Premium -->
              <div class="relative z-10 w-full max-w-2xl mx-auto">
                <app-evaluation-checklist
                  [items]="checklistItems"
                  (itemsChange)="onChecklistChange($event)"
                />
              </div>

              <div class="w-full h-px bg-divider/60 max-w-2xl mx-auto"></div>

              <!-- Observaciones Premium -->
              <div class="space-y-4 relative z-10 w-full max-w-2xl mx-auto">
                <label class="text-xs sm:text-sm font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2" for="obs">
                  <app-icon name="pen-tool" [size]="16" />
                  Observaciones y Correcciones
                </label>
                <div class="relative group">
                  <textarea
                    id="obs"
                    [(ngModel)]="observations"
                    rows="4"
                    class="form-control w-full resize-none rounded-2xl p-5 bg-surface-base border-border-default/60 focus:bg-surface focus:border-brand/40 focus:ring-4 focus:ring-brand/10 transition-all text-sm sm:text-base shadow-inner placeholder:text-text-muted/60 hover:border-border-strong cursor-text"
                    placeholder="Documenta áreas de mejora, destrezas adquiridas o tareas pendientes para la próxima sesión..."
                  ></textarea>
                </div>
              </div>

              <div class="pt-4 relative z-10 flex justify-center">
                <button
                  class="btn-primary w-full sm:w-80 h-14 text-base sm:text-lg rounded-2xl shadow-md flex items-center justify-center sm:ml-auto group hover:-translate-y-0.5 transition-all"
                  (click)="showFinalStep.set(true)"
                >
                  <app-icon
                    name="flag"
                    [size]="20"
                    class="mr-2 group-hover:translate-x-1 transition-transform"
                  />
                  <span>Finalizar y Registrar Retorno</span>
                </button>
              </div>
            </div>
          </div>
        } @else {
          <!-- STEP 2: CLOSURE (KM END + SIGNATURES) -->
          <div class="card p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div class="space-y-6">
              <!-- KM END ODOMETER -->
              <div>
                <label class="text-sm font-bold text-text-secondary uppercase tracking-widest mb-2 flex justify-center text-center">
                  Kilometraje al Retorno
                </label>
                <div class="flex items-center justify-center gap-3 w-full max-w-sm mx-auto bg-surface-base rounded-2xl shadow-inner border border-border-default/60 px-6 py-4 mt-2 transition-colors focus-within:border-brand/50 focus-within:bg-surface-hover">
                  <input
                    type="number"
                    [(ngModel)]="kmEnd"
                    max="999999"
                    class="!bg-transparent !border-none !outline-none !shadow-none !ring-0 text-5xl sm:text-7xl font-display font-black text-text-primary text-center p-0 w-32 sm:w-56 placeholder:text-border-strong tracking-tighter tabular-nums m-0 focus:!bg-transparent"
                    placeholder="0"
                  />
                  <span class="text-2xl sm:text-3xl font-bold text-text-muted select-none mt-2">km</span>
                </div>
                <!-- Warning Label -->
                <div class="flex justify-center mt-3">
                  @if (kmEnd !== null && kmEnd <= (cls?.kmStart ?? 0)) {
                    <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-error/10 text-error text-sm font-medium animate-in fade-in">
                      <app-icon name="alert-circle" [size]="14" />
                      <span>Debe ser mayor al inicial ({{ cls.kmStart }} km)</span>
                    </div>
                  } @else {
                    <p class="text-xs text-text-muted opacity-70">
                      Verifique el odómetro del tablero central.
                    </p>
                  }
                </div>
              </div>

              <!-- NOTA GLOBAL (Estrellas / Premium UI) -->
              <div class="space-y-4 flex flex-col items-center border-t border-b border-divider py-8 my-8">
                <h3 class="font-bold text-text-primary uppercase tracking-widest text-sm text-center">Calificación General</h3>
                <div class="flex gap-2 sm:gap-4 p-2 bg-surface-base rounded-2xl shadow-inner border border-border-default/50 w-max mx-auto">
                  @for (grade of [1, 2, 3, 4, 5]; track grade) {
                    <button
                      class="w-12 h-12 sm:w-16 sm:h-16 flex flex-col items-center justify-center font-display font-bold text-lg sm:text-2xl rounded-xl transition-all duration-300"
                      [class.bg-brand]="selectedGrade() === grade"
                      [class.text-white]="selectedGrade() === grade"
                      [class.shadow-md]="selectedGrade() === grade"
                      [class.scale-110]="selectedGrade() === grade"
                      [class.bg-transparent]="selectedGrade() !== grade"
                      [class.text-text-muted]="selectedGrade() !== grade"
                      [class.hover:bg-surface-hover]="selectedGrade() !== grade"
                      (click)="selectedGrade.set(grade)"
                    >
                      <span class="leading-none">{{ grade }}</span>
                    </button>
                  }
                </div>
              </div>

              <!-- SIGNATURES -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <app-signature-pad
                  label="Firma del Alumno"
                  (signatureChange)="onSignatureChange('student', $event)"
                  [height]="150"
                />
                <app-signature-pad
                  label="Firma del Instructor"
                  (signatureChange)="onSignatureChange('instructor', $event)"
                  [height]="150"
                />
              </div>
            </div>

            <div class="pt-6 flex justify-center mt-4">
              <button
                class="btn-primary w-full sm:w-80 h-14 text-base sm:text-lg rounded-2xl shadow-md flex items-center justify-center hover:-translate-y-0.5 transition-all"
                [disabled]="!canFinalize() || isSubmitting()"
                (click)="onFinalize(cls)"
              >
                @if (isSubmitting()) {
                  <app-icon name="loader-2" [size]="20" class="animate-spin mr-2" />
                  <span>Guardando Resultados...</span>
                } @else {
                  <app-icon name="check-circle" [size]="20" class="mr-2" />
                  <span>Cerrar Clase Definitivamente</span>
                }
              </button>
            </div>
          </div>
        }
      } @else {
        <app-empty-state
          icon="search-x"
          message="Clase no encontrada"
          subtitle="La clase solicitada no existe o no está en curso."
          actionLabel="Volver al Dashboard"
          actionIcon="arrow-left"
          (action)="goToDashboard()"
        />
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .form-control:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary-muted);
      }
    `,
  ],
})
export class InstructorClaseDetailComponent implements OnInit {
  public clasesFacade = inject(InstructorClasesFacade);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  public showFinalStep = signal(false);
  public isSubmitting = signal(false);

  readonly heroActions = computed<SectionHeroAction[]>(() => {
    if (this.showFinalStep()) {
      return [
        {
          id: 'back_to_eval',
          label: 'Atrás a Evaluación',
          icon: 'arrow-left',
          primary: false,
        }
      ];
    }
    return [
      {
        id: 'back_to_dash',
        label: 'Dashboard',
        icon: 'arrow-left',
        primary: false,
        route: '/app/instructor/dashboard'
      }
    ];
  });

  onHeroAction(id: string) {
    if (id === 'back_to_eval') {
      this.showFinalStep.set(false);
    }
  }

  // Evaluation Data
  public checklistItems: EvaluationChecklistItem[] = [...EVALUATION_CHECKLIST_ITEMS].map((item) => ({
    ...item,
    checked: true,
  }));
  public observations = '';
  public selectedGrade = signal<number | null>(null);

  constructor() {
    // Sincronizar datos cargados desde el Facade si existen (para persistencia ante refresco)
    effect(() => {
      const cls = this.clasesFacade.selectedClass();
      if (cls) {
        // Solo sobreescribimos si el checklist cargado tiene datos
        if (cls.evaluationChecklist && cls.evaluationChecklist.length > 0) {
          this.checklistItems = [...cls.evaluationChecklist];
        }
        if (cls.notes) {
          this.observations = cls.notes;
        }
      }
    });
  }

  // Closure Data
  public kmEnd: number | null = null;
  private studentSignature: string | null = null;
  private instructorSignature: string | null = null;

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const sessionIdStr = params['id'];
      if (sessionIdStr) {
        const sessionId = parseInt(sessionIdStr, 10);
        if (!isNaN(sessionId)) {
          this.clasesFacade.loadClassDetail(sessionId);
        }
      }
    });

    // Restaurar si ya había algo (puedes añadir persistencia en localStorage después)
  }

  onChecklistChange(items: EvaluationChecklistItem[]) {
    this.checklistItems = items;
  }

  onSignatureChange(type: 'student' | 'instructor', dataUrl: string | null) {
    if (type === 'student') this.studentSignature = dataUrl;
    else this.instructorSignature = dataUrl;
  }

  canFinalize(): boolean {
    const cls = this.clasesFacade.selectedClass();
    const kmValid = this.kmEnd !== null && this.kmEnd > (cls?.kmStart || 0);
    const gradeValid = this.selectedGrade() !== null;
    return !!kmValid && !!gradeValid;
  }

  async onFinalize(cls: any) {
    if (!this.canFinalize()) return;

    this.isSubmitting.set(true);
    try {
      // 1. Guardar Evaluación
      const evalData: EvaluationFormData = {
        sessionId: cls.sessionId,
        classNumber: cls.classNumber,
        studentName: cls.studentName,
        kmStart: cls.kmStart,
        kmEnd: this.kmEnd,
        grade: this.selectedGrade()!,
        observations: this.observations,
        checklist: this.checklistItems,
        studentSignature: this.studentSignature,
        instructorSignature: this.instructorSignature,
      };

      // 2. Finalizar clase (status + km_end)
      await this.clasesFacade.finishClass(cls.sessionId, this.kmEnd!);
      await this.clasesFacade.saveEvaluation(evalData);

      this.clasesFacade.showSuccess('Clase Finalizada', 'La sesión y evaluación se han guardado con éxito.');
      this.router.navigate(['/app/instructor/dashboard']);
    } catch {
      this.clasesFacade.showError('Error al finalizar', 'Hubo un problema al guardar los datos.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  goToDashboard() {
    this.router.navigate(['/app/instructor/dashboard']);
  }
}
