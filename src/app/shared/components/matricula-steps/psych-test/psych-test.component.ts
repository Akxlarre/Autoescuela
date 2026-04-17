import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import {
  EPQ_QUESTIONS,
  EPQ_TOTAL,
  EPQ_PAGE_SIZE,
  EPQ_TOTAL_PAGES,
} from '@core/utils/epq-questions.const';

const TOTAL = EPQ_TOTAL;
const PAGE_SIZE = EPQ_PAGE_SIZE;
const TOTAL_PAGES = EPQ_TOTAL_PAGES;

@Component({
  selector: 'app-psych-test',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div>
        <h2 class="text-lg font-semibold text-primary mb-1">Test Psicológico</h2>
        <p class="text-sm text-secondary">
          Responde cada pregunta con <strong class="text-primary">Sí</strong> o
          <strong class="text-primary">No</strong> según tu realidad actual. No hay respuestas
          correctas o incorrectas.
        </p>
      </div>

      <!-- Progress bar -->
      <div>
        <div class="flex items-center justify-between text-xs text-secondary mb-1.5">
          <span>{{ answeredCount() }} de {{ totalQuestions }} respondidas</span>
          <span>Página {{ currentPage() }} / {{ totalPages }}</span>
        </div>
        <div class="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300"
            style="background: var(--ds-brand)"
            [style.width.%]="progressPct()"
          ></div>
        </div>
      </div>

      <!-- Questions for current page -->
      <div class="space-y-3">
        @for (q of pageQuestions(); track q.idx) {
          <div
            class="rounded-xl border p-4 transition-colors"
            [class.border-border]="answers()[q.idx] === null || answers()[q.idx] === undefined"
            [style.border-color]="
              answers()[q.idx] !== null && answers()[q.idx] !== undefined
                ? 'var(--ds-brand)'
                : undefined
            "
            [style.background]="
              answers()[q.idx] !== null && answers()[q.idx] !== undefined
                ? 'color-mix(in srgb, var(--ds-brand) 5%, transparent)'
                : undefined
            "
          >
            <p class="text-sm text-primary mb-3 leading-relaxed">
              <span class="font-semibold text-secondary mr-1">{{ q.idx + 1 }}.</span>
              {{ q.text }}
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                [class.border-border]="answers()[q.idx] !== true"
                [class.text-secondary]="answers()[q.idx] !== true"
                [class.bg-surface]="answers()[q.idx] !== true"
                [class.text-white]="answers()[q.idx] === true"
                [style.border-color]="answers()[q.idx] === true ? 'var(--ds-brand)' : undefined"
                [style.background]="answers()[q.idx] === true ? 'var(--ds-brand)' : undefined"
                data-llm-action="psych-test-answer-yes"
                (click)="setAnswer(q.idx, true)"
              >
                Sí
              </button>
              <button
                type="button"
                class="flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                [class.border-border]="answers()[q.idx] !== false"
                [class.text-secondary]="answers()[q.idx] !== false"
                [class.bg-surface]="answers()[q.idx] !== false"
                [class.text-white]="answers()[q.idx] === false"
                [style.border-color]="answers()[q.idx] === false ? 'var(--ds-brand)' : undefined"
                [style.background]="answers()[q.idx] === false ? 'var(--ds-brand)' : undefined"
                data-llm-action="psych-test-answer-no"
                (click)="setAnswer(q.idx, false)"
              >
                No
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Navigation -->
      <div class="flex items-center justify-between pt-2">
        <button
          type="button"
          class="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors cursor-pointer"
          (click)="onBack()"
        >
          <app-icon name="arrow-left" [size]="16" />
          Volver
        </button>

        @if (isLastPage()) {
          <button
            type="button"
            class="btn-primary px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            [disabled]="!pageComplete() || loading()"
            data-llm-action="psych-test-submit"
            (click)="onSubmit()"
          >
            @if (loading()) {
              <app-icon name="loader-circle" [size]="16" color="white" class="animate-spin" />
              Enviando...
            } @else {
              <app-icon name="send" [size]="16" color="white" />
              Enviar test
            }
          </button>
        } @else {
          <button
            type="button"
            class="btn-primary px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            [disabled]="!pageComplete()"
            data-llm-action="psych-test-next-page"
            (click)="nextPage()"
          >
            Siguiente
            <app-icon name="arrow-right" [size]="16" color="white" />
          </button>
        }
      </div>
    </div>
  `,
})
export class PsychTestComponent {
  // ── Inputs ──
  readonly answers = input.required<(boolean | null)[]>();
  readonly loading = input<boolean>(false);

  // ── Outputs ──
  readonly answersChange = output<(boolean | null)[]>();
  readonly next = output<void>();
  readonly back = output<void>();

  // ── Constants exposed to template ──
  readonly totalQuestions = TOTAL;
  readonly totalPages = TOTAL_PAGES;

  // ── Internal state ──
  readonly currentPage = signal(1);

  // ── Computed ──
  readonly pageQuestions = computed(() => {
    const page = this.currentPage();
    const start = (page - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, TOTAL);
    return EPQ_QUESTIONS.slice(start, end).map((text, i) => ({ text, idx: start + i }));
  });

  readonly answeredCount = computed(() => this.answers().filter((a) => a !== null).length);

  readonly progressPct = computed(() => Math.round((this.answeredCount() / TOTAL) * 100));

  readonly pageComplete = computed(() => {
    const page = this.currentPage();
    const start = (page - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, TOTAL);
    return this.answers()
      .slice(start, end)
      .every((a) => a !== null);
  });

  readonly isLastPage = computed(() => this.currentPage() === TOTAL_PAGES);

  // ── Actions ──

  setAnswer(idx: number, value: boolean): void {
    const updated = [...this.answers()];
    updated[idx] = value;
    this.answersChange.emit(updated);
  }

  nextPage(): void {
    if (!this.pageComplete()) return;
    this.currentPage.update((p) => Math.min(p + 1, TOTAL_PAGES));
    // Scroll suave al inicio del card
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onBack(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.back.emit();
    }
  }

  onSubmit(): void {
    if (!this.pageComplete()) return;
    this.next.emit();
  }
}
