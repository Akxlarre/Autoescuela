import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-faqs-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div class="flex flex-col gap-6 animate-fade-in">
      <div class="flex items-center justify-between border-b pb-2 mb-2 border-border-subtle">
        <div>
          <h3 class="text-base font-bold text-text-primary">Preguntas Frecuentes (FAQs)</h3>
          <span class="text-xs text-text-muted"
            >Estas preguntas se mostrarán en la sección FAQ de la landing page.</span
          >
        </div>
        <button
          type="button"
          class="btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1"
          (click)="addFaq()"
          data-llm-action="add-faq"
        >
          <app-icon name="plus" [size]="14" />
          <span>Agregar Pregunta</span>
        </button>
      </div>

      <div class="flex flex-col gap-4">
        @if (faqsArray().length === 0) {
          <div
            class="p-8 text-center border rounded-xl border-dashed border-border-subtle bg-elevated"
          >
            <app-icon name="help-circle" [size]="32" class="text-text-muted mx-auto mb-2" />
            <p class="text-sm font-medium text-text-secondary">No hay preguntas configuradas</p>
            <p class="text-xs text-text-muted mt-1">
              Agrega preguntas frecuentes para informar mejor a tus alumnos potenciales.
            </p>
          </div>
        }

        @for (faqCtrl of faqsArray().controls; track $index) {
          <div
            [formGroup]="asFormGroup(faqCtrl)"
            class="p-4 rounded-xl border flex flex-col gap-3 border-border-default bg-elevated"
          >
            <div class="flex items-center justify-between border-b pb-1 mb-1 border-border-subtle">
              <span class="text-xs font-bold text-text-secondary">FAQ #{{ $index + 1 }}</span>
              <button
                type="button"
                class="btn-ghost py-1 px-2 text-xs flex items-center gap-1 rounded cursor-pointer text-error"
                (click)="removeFaq($index)"
                data-llm-action="remove-faq"
              >
                <app-icon name="trash-2" [size]="13" />
                <span>Eliminar</span>
              </button>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="field-label">Pregunta *</label>
              <input
                type="text"
                formControlName="question"
                class="field-input"
                placeholder="Ej: ¿Cuánto tiempo dura el curso de conducir?"
              />
              @if (
                asFormGroup(faqCtrl).get('question')?.touched &&
                asFormGroup(faqCtrl).get('question')?.invalid
              ) {
                <span class="text-xs mt-1 text-error">La pregunta es requerida.</span>
              }
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="field-label">Respuesta *</label>
              <textarea
                formControlName="answer"
                rows="3"
                class="field-input resize-none"
                placeholder="Escribe una respuesta clara y concisa..."
              ></textarea>
              @if (
                asFormGroup(faqCtrl).get('answer')?.touched &&
                asFormGroup(faqCtrl).get('answer')?.invalid
              ) {
                <span class="text-xs mt-1 text-error">La respuesta es requerida.</span>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .field-label {
      display: block;
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
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
      transition: border-color var(--duration-fast, 150ms) ease;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
    }
  `,
})
export class FaqsTabComponent {
  private fb = inject(FormBuilder);

  faqsArray = input.required<FormArray>();

  protected asFormGroup(ctrl: AbstractControl): FormGroup {
    return ctrl as FormGroup;
  }

  protected addFaq(): void {
    this.faqsArray().push(
      this.fb.group({
        question: ['', Validators.required],
        answer: ['', Validators.required],
      }),
    );
    this.faqsArray().markAsDirty();
  }

  protected removeFaq(index: number): void {
    this.faqsArray().removeAt(index);
    this.faqsArray().markAsDirty();
  }
}
