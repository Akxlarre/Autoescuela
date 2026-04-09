import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';

import { IconComponent } from '@shared/components/icon/icon.component';

import type { DraftSummary, EnrollmentWizardStep } from '@core/models/ui/enrollment-wizard.model';

@Component({
  selector: 'app-draft-list',
  standalone: true,
  imports: [DatePipe, IconComponent],
  styleUrls: ['./draft-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="draft-container">
      <!-- Encabezado -->
      <div class="draft-header">
        <h2 class="text-2xl font-bold text-text-primary">Matrículas en progreso</h2>
        <p class="text-sm text-text-muted">
          Hay {{ drafts().length }} matrícula(s) pendiente(s). Puedes retomar una o empezar de cero.
        </p>
      </div>

      <!-- Lista de borradores -->
      <div class="draft-list">
        @for (draft of drafts(); track draft.enrollmentId) {
          <div class="draft-card" [class.draft-card--active]="draft.currentStep > 1">
            <!-- Arriba: Identidad e Info básica -->
            <div class="draft-card__top">
              <div class="draft-avatar">
                {{ getInitials(draft.studentName) }}
              </div>

              <div class="draft-info">
                <div class="draft-info__header">
                  <span class="draft-info__name" [title]="draft.studentName">{{
                    draft.studentName
                  }}</span>
                  <span class="draft-info__rut">{{ draft.studentRut }}</span>
                </div>
                <p class="draft-info__course">{{ draft.courseLabel }}</p>
              </div>
            </div>

            <!-- Centro: Progreso visual (Stepper compacto) -->
            <div class="draft-card__middle">
              <div class="draft-stepper">
                @for (step of stepNumbers; track step) {
                  <div
                    class="step-bar"
                    [class.step-bar--active]="step === draft.currentStep"
                    [class.step-bar--completed]="step < draft.currentStep"
                    [class.step-bar--pending]="step > draft.currentStep"
                  ></div>
                }
              </div>
              <p class="draft-status">
                <app-icon name="clock" [size]="12" />
                <span>Paso {{ draft.currentStep }}/6 — {{ draft.stepLabel }}</span>
                <span class="draft-status__date">· {{ draft.createdAt | date: 'dd/MM' }}</span>
              </p>
            </div>

            <!-- Acciones (Sticky on bottom mobile, Top right desktop) -->
            <div class="draft-actions">
              <button
                type="button"
                class="btn-resume"
                data-llm-action="resume-enrollment-draft"
                (click)="resume.emit(draft.enrollmentId)"
              >
                <app-icon name="play-circle" [size]="15" />
                Retomar
              </button>
              <button
                type="button"
                class="btn-discard"
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

      <!-- Acción principal: Empezar nueva matrícula -->
      <div class="draft-footer">
        <button
          type="button"
          class="btn-new-draft"
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
