import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';

import { IconComponent } from '@shared/components/icon/icon.component';

import type { DraftSummary, EnrollmentWizardStep } from '@core/models/ui/enrollment-wizard.model';

@Component({
  selector: 'app-draft-list',
  standalone: true,
  imports: [DatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <!-- Encabezado -->
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Matrículas en progreso</h2>
        <p class="text-sm text-text-muted mt-1">
          Hay {{ drafts().length }} matrícula(s) pendiente(s) de completar.
        </p>
      </div>

      <!-- Lista de borradores -->
      <div class="grid gap-3">
        @for (draft of drafts(); track draft.enrollmentId) {
          <div class="card p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
            <!-- Avatar iniciales -->
            <div
              class="w-11 h-11 rounded-full bg-brand-muted flex items-center justify-center text-sm font-bold text-brand shrink-0"
            >
              {{ getInitials(draft.studentName) }}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold text-text-primary truncate">{{
                  draft.studentName
                }}</span>
                <span class="text-xs text-text-muted font-mono">{{ draft.studentRut }}</span>
              </div>
              <p class="text-sm text-text-secondary mt-0.5">{{ draft.courseLabel }}</p>

              <!-- Mini stepper de progreso -->
              <div class="flex items-center gap-1 mt-3">
                @for (step of stepNumbers; track step) {
                  <div
                    class="h-1.5 flex-1 rounded-full transition-colors"
                    [class.bg-brand]="step === draft.currentStep"
                    [class.bg-brand-muted]="step < draft.currentStep"
                    [class.bg-bg-subtle]="step > draft.currentStep"
                  ></div>
                }
              </div>
              <p class="text-xs text-text-muted mt-1.5 flex items-center gap-1">
                <app-icon name="clock" [size]="11" />
                Paso {{ draft.currentStep }}/6 — {{ draft.stepLabel }} · Creada
                {{ draft.createdAt | date: 'dd/MM/yyyy HH:mm' }}
              </p>
            </div>

            <!-- Acciones -->
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                class="cursor-pointer btn-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
                data-llm-action="resume-enrollment-draft"
                (click)="resume.emit(draft.enrollmentId)"
              >
                <app-icon name="play-circle" [size]="15" />
                Retomar
              </button>
              <button
                type="button"
                class="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-state-error hover:bg-state-error-bg border border-border-default hover:border-state-error-border transition-all"
                data-llm-action="discard-enrollment-draft"
                (click)="discard.emit(draft.enrollmentId)"
              >
                <app-icon name="trash-2" [size]="14" />
                Descartar
              </button>
            </div>
          </div>
        }
      </div>

      <!-- CTA principal — Nueva matrícula -->
      <div class="pt-2 border-t border-border-subtle">
        <button
          type="button"
          class="cursor-pointer w-full h-14 flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-default hover:border-brand hover:bg-brand-muted text-text-secondary hover:text-brand font-semibold transition-all"
          data-llm-action="start-new-enrollment"
          (click)="startNew.emit()"
        >
          <app-icon name="plus" [size]="20" />
          Nueva matrícula
        </button>
      </div>
    </div>
  `,
})
export class DraftListComponent {
  readonly drafts = input.required<DraftSummary[]>();

  readonly resume = output<number>();
  readonly discard = output<number>();
  readonly startNew = output<void>();

  readonly stepNumbers: EnrollmentWizardStep[] = [1, 2, 3, 4, 5, 6];

  getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }
}
