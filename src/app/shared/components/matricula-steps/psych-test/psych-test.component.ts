import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';

// ─── EPQ Questions (Eysenck Personality Questionnaire — 81 items SI/NO) ───
const EPQ_QUESTIONS: string[] = [
  '¿Se detiene a pensar las cosas antes de hacerlas?',
  '¿Tiene Ud. a menudo altibajos de ánimo?',
  '¿Es Ud. una persona conversadora?',
  '¿Le preocupa tener deudas?',
  '¿Tiene Ud. algunas veces la impresión de sentirse mal sin razón?',
  '¿Cierra las puertas de su casa con llave cuidadosamente y asegura las ventanas todas las noches?',
  '¿Es Ud. más bien vivaz?',
  '¿Le afectaría mucho ver sufrir a un niño o a un animal?',
  '¿Se preocupa Ud. a menudo por cosas que no debería haber hecho o dicho?',
  '¿Puede Ud. habitualmente gozar a plenitud de una reunión social agradable?',
  '¿Es Ud. una persona irritable?',
  '¿Cree Ud. que los sistemas de seguros son una buena idea?',
  '¿Se siente Ud. fácilmente herido en sus sentimientos?',
  '¿Tiende a mantenerse en segundo plano en reuniones sociales?',
  '¿Tomaría Ud. drogas que pueden tener efectos desconocidos o peligrosos?',
  '¿Se siente Ud. a menudo hasta la coronilla?',
  '¿Ha tomado Ud. alguna vez algo (aunque sea un alfiler o un botón) que perteneciera a otra persona?',
  '¿Le gusta mucho salir de su casa?',
  '¿Goza Ud. hiriendo o martirizando a la gente que ama o quiere?',
  '¿Se siente a menudo perturbado por sentimientos de culpa?',
  '¿Tiene Ud. enemigos que quieren hacerle daño?',
  '¿Se considera una persona nerviosa?',
  '¿Tiene Ud. muchos amigos?',
  '¿Goza Ud. con las bromas que pueden a veces herir a otras personas?',
  '¿Es Ud. una persona que se hace problemas por todo?',
  '¿Significa mucho para Ud. la limpieza y los buenos modales?',
  '¿Se preocupa Ud. por cosas horribles que pudieran ocurrir?',
  '¿Es Ud. quien generalmente toma la iniciativa para hacer nuevos amigos?',
  '¿Se calificaría a sí mismo como una persona tensa o muy nerviosa?',
  '¿Permanece Ud. casi siempre callado cuando está con otras personas?',
  '¿Piensa Ud. que el matrimonio está pasado de moda y que debería abolirse?',
  '¿A veces se alaba un poco a sí mismo?',
  '¿Ud. puede animar con facilidad una fiesta aburrida?',
  '¿Le molesta la gente que maneja con cuidado?',
  '¿Se preocupa mucho por su salud sin haber motivos?',
  '¿Algunas veces ha dicho algo malo o desagradable acerca de otras personas?',
  '¿La mayoría de las cosas tienen para Ud. el mismo sabor?',
  '¿De niño, alguna vez fue Ud. atrevido con sus padres?',
  '¿Le gusta a Ud. mezclarse con la gente?',
  '¿Se preocupa Ud. si sabe que hay errores en su trabajo?',
  '¿Sufre Ud. de insomnio?',
  '¿Se lava Ud. siempre las manos antes de servirse las comidas?',
  '¿Tiene Ud. casi siempre una respuesta a mano cuando la gente le habla?',
  '¿Le gusta Ud. llegar con bastante anticipación a sus citas?',
  '¿Se siente Ud. a menudo desanimado y cansado sin motivo?',
  '¿Ha hecho alguna vez trampa en un juego?',
  '¿Le gusta hacer las cosas en las cuales tiene que actuar rápidamente?',
  '¿Es (o era) su madre una buena mujer?',
  '¿Siente a menudo que la vida es muy aburrida?',
  '¿Se ha aprovechado alguna vez de alguien?',
  '¿Hay personas que tratan de evitar su presencia?',
  '¿Le preocupa mucho su apariencia?',
  '¿Piensa Ud. que la gente gasta demasiado tiempo salvaguardando su futuro con ahorros y seguros?',
  '¿Ha deseado alguna vez estar muerto?',
  '¿Evitaría Ud. pagar sus impuestos si estuviera seguro de que nunca lo descubrirían?',
  '¿Es Ud. capaz de animar una fiesta?',
  '¿Trata Ud. de no ser descortés con la gente?',
  '¿Se preocupa por mucho tiempo después de una experiencia embarazosa?',
  '¿Cuando toma un tren es común que llegue a la estación a última hora?',
  '¿Sufre de los nervios?',
  '¿Alguna vez ha dicho Ud. algo a propósito para herir los sentimientos de alguien?',
  '¿Se rompen fácilmente sus amistades sin que Ud. tenga la culpa?',
  '¿Se siente solo a menudo?',
  '¿Siempre practica lo que predica?',
  '¿Le gusta a veces molestar a los animales?',
  '¿Se siente herido con facilidad cuando la gente encuentra un defecto en Ud. o en su trabajo?',
  '¿Le gusta estar en un ambiente en que haya bastante movimiento y excitación?',
  '¿Le gustaría que los demás le tuvieran miedo?',
  '¿Está Ud. algunas veces lleno de energía y otras lento y desanimado?',
  '¿Algunas veces deja para mañana lo que debería hacer hoy?',
  '¿Piensan otras personas que es Ud. muy activo y vivaz?',
  '¿Le cuenta la gente muchas mentiras?',
  '¿Es Ud. una persona muy sensible frente a ciertas cosas?',
  '¿Le daría mucha pena ver algún animal capturado en una trampa?',
  '¿Se considera Ud. una persona despierta, con "cachativa"?',
  '¿Le incomoda a Ud. ser el centro de atención en las reuniones sociales?',
  '¿Ha sentido alguna vez deseos de darse a sí mismo más de lo que le da a los demás en una repartición?',
  '¿Alguna vez se ha quedado con alguna cosa que no fuera suya?',
  '¿Le gusta que haya bastante movimiento y excitación alrededor suyo?',
  '¿Alguna vez ha engañado a una persona solo para lograr algo que Ud. quiere?',
  '¿Cree Ud. que otras personas lo encuentran muy activo y despierto?',
];

const TOTAL = EPQ_QUESTIONS.length; // 81
const PAGE_SIZE = 14;
const TOTAL_PAGES = Math.ceil(TOTAL / PAGE_SIZE); // 6

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
