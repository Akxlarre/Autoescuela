import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  viewChild,
  afterNextRender,
} from '@angular/core';
import gsap from 'gsap';
import { IconComponent } from '@shared/components/icon/icon.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { PublicStepConfig } from '@core/facades/public-enrollment.facade';

@Component({
  selector: 'app-public-wizard-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <!-- Raíz: scope del tema (data-public-theme lo pone el Smart parent) -->
    <div class="relative min-h-dvh flex flex-col" #rootRef>
      <!-- ── Orbs ambientales ── -->
      <div class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          class="absolute -left-48 -top-48 h-[520px] w-[520px] rounded-full blur-3xl"
          style="background: color-mix(in srgb, var(--pe-brand-400, var(--ds-brand)) 18%, transparent)"
        ></div>
        <div
          class="absolute -bottom-48 -right-24 h-[420px] w-[420px] rounded-full blur-3xl"
          style="background: color-mix(in srgb, var(--pe-accent-400, var(--ds-brand)) 14%, transparent)"
        ></div>
        <div
          class="absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style="background: color-mix(in srgb, var(--pe-brand-300, var(--ds-brand)) 6%, transparent)"
        ></div>
      </div>

      <!-- ── Hero ── -->
      <header
        #heroRef
        class="relative z-10 w-full surface-hero overflow-hidden"
        style="border-radius: 0 0 var(--radius-2xl) var(--radius-2xl)"
      >
        <!-- sheen diagonal sutil (mismo patrón del mockup) -->
        <div
          class="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style="
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255,255,255,0.06),
              transparent
            );
            transform: rotate(18deg) scaleX(2.5) scaleY(4);
          "
        ></div>

        <div class="relative z-10 mx-auto max-w-3xl px-5 pb-12 pt-6 sm:pb-14">
          <!-- Brand row -->
          <div class="flex items-center justify-between gap-4 mb-5">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
                style="
                  background: rgba(255,255,255,0.18);
                  box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.12);
                "
              >
                <app-icon name="car" [size]="18" color="white" />
              </div>
              <span
                class="font-bold tracking-tight text-white"
                style="font-family: var(--font-display); font-size: 1.05rem; letter-spacing: -0.01em;"
              >
                {{ brandName() }}
              </span>
            </div>

            <!-- WhatsApp help button -->
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-white text-xs font-semibold cursor-pointer transition-all"
              style="
                background: rgba(255,255,255,0.14);
                border: 1px solid rgba(255,255,255,0.28);
                backdrop-filter: blur(8px);
              "
              data-llm-action="contact-whatsapp-help"
              data-llm-description="WhatsApp help button for the enrollment wizard"
              [attr.href]="whatsappUrl() ?? null"
              (click)="helpClick.emit()"
              aria-label="Ayuda por WhatsApp"
            >
              <app-icon name="message-circle" [size]="13" color="white" />
              Ayuda
            </button>
          </div>

          <!-- Title + subtitle -->
          <h1
            class="text-white font-bold mb-1"
            style="font-family: var(--font-display); font-size: 1.8rem; font-weight: 800; letter-spacing: -0.02em; text-shadow: 0 2px 12px rgba(0,0,0,0.12);"
          >
            {{ title() }}
          </h1>
          @if (subtitle()) {
            <p class="text-sm mb-5" style="color: rgba(255,255,255,0.88);">{{ subtitle() }}</p>
          }

          <!-- ── Named progress bar (AC7) ── -->
          @if (steps().length > 0) {
            <!-- Mobile: indicador compacto "Paso N de 8 · Label" -->
            <div class="flex sm:hidden items-center gap-2 mt-1" aria-label="Progreso de matrícula">
              <div
                class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0"
                style="background: rgba(255,255,255,1); color: var(--color-primary);"
              >
                {{ activeStepIndex() + 1 }}
              </div>
              <span class="text-white/70 text-xs">de {{ steps().length }}</span>
              <span class="text-white/40 text-xs">·</span>
              <span class="text-white text-xs font-semibold truncate">{{ activeStepLabel() }}</span>
            </div>

            <!-- Desktop: lista de pasos, solo el activo muestra su etiqueta -->
            <nav
              #progressRef
              class="hidden sm:flex items-center gap-y-2"
              aria-label="Progreso de matrícula"
              role="list"
            >
              @for (step of steps(); track step.id; let last = $last) {
                <div class="flex items-center" role="listitem">
                  <div class="flex items-center gap-1.5">
                    <div
                      class="flex h-6 w-6 items-center justify-center rounded-full shrink-0 text-xs font-bold transition-all"
                      [style.background]="
                        step.status === 'active'
                          ? 'rgba(255,255,255,1)'
                          : step.status === 'completed'
                            ? 'rgba(255,255,255,1)'
                            : 'rgba(255,255,255,0.12)'
                      "
                      [style.color]="
                        step.status === 'completed' || step.status === 'active'
                          ? 'var(--color-primary)'
                          : 'rgba(255,255,255,0.55)'
                      "
                      [style.box-shadow]="
                        step.status === 'active'
                          ? '0 0 0 4px rgba(255,255,255,0.22), 0 4px 14px rgba(0,0,0,0.18)'
                          : 'none'
                      "
                      [style.border]="
                        step.status === 'pending' ? '1px solid rgba(255,255,255,0.2)' : 'none'
                      "
                      [attr.aria-current]="step.status === 'active' ? 'step' : null"
                    >
                      @if (step.status === 'completed') {
                        <app-icon name="check" [size]="11" color="var(--color-primary)" />
                      } @else {
                        {{ $index + 1 }}
                      }
                    </div>

                    <!-- Solo mostrar label en el paso activo -->
                    @if (step.status === 'active') {
                      <span class="text-xs font-semibold whitespace-nowrap text-white/95">
                        {{ step.label }}
                      </span>
                    }
                  </div>

                  @if (!last) {
                    <div
                      class="mx-1.5 h-0.5 w-4 rounded-full transition-colors shrink-0"
                      [style.background]="
                        step.status === 'completed'
                          ? 'rgba(255,255,255,0.9)'
                          : 'rgba(255,255,255,0.22)'
                      "
                      aria-hidden="true"
                    ></div>
                  }
                </div>
              }
            </nav>
          }
        </div>
      </header>

      <!-- ── Step content card (glass, overlapping hero bottom) ── -->
      <main
        class="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 pb-8"
        style="margin-top: calc(var(--space-10) * -1)"
      >
        <div
          #cardRef
          class="rounded-2xl p-6 sm:p-8"
          style="
            background: var(--bg-elevated, var(--bg-surface));
            border: 1px solid var(--border-color, var(--border-subtle));
            box-shadow:
              var(--pe-shadow-xl, var(--shadow-lg)),
              0 0 0 1px rgba(255,255,255,0.6) inset,
              0 40px 80px -24px color-mix(in srgb, var(--pe-brand-500, var(--ds-brand)) 16%, transparent);
          "
        >
          <ng-content />
        </div>
      </main>
    </div>
  `,
  host: { style: 'display: contents;' },
})
export class PublicWizardShellComponent {
  private readonly gsap = inject(GsapAnimationsService);

  readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');
  readonly progressRef = viewChild<ElementRef<HTMLElement>>('progressRef');
  readonly cardRef = viewChild<ElementRef<HTMLElement>>('cardRef');

  // ── Inputs ──
  readonly steps = input.required<PublicStepConfig[]>();
  readonly currentStep = input.required<string>();
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly brandName = input<string>('Autoescuela');
  readonly whatsappUrl = input<string | null>(null);

  // ── Outputs ──
  readonly helpClick = output<void>();

  // ── Computed (mobile compact indicator) ──
  protected readonly activeStepIndex = computed(() =>
    this.steps().findIndex((s) => s.status === 'active'),
  );
  protected readonly activeStepLabel = computed(() => {
    const step = this.steps().find((s) => s.status === 'active');
    return step?.label ?? '';
  });

  constructor() {
    afterNextRender(() => {
      const hero = this.heroRef()?.nativeElement;
      if (hero) this.gsap.animateHero(hero);

      // Stagger de pasos de progreso (T4.2)
      const progress = this.progressRef()?.nativeElement;
      if (progress) {
        const steps = Array.from(progress.children);
        gsap.from(steps, {
          opacity: 0,
          y: 8,
          duration: 0.35,
          ease: 'power2.out',
          stagger: 0.06,
          delay: 0.2,
          clearProps: 'transform',
        });
      }

      // Card fade-up (T4.2)
      const card = this.cardRef()?.nativeElement;
      if (card) {
        gsap.from(card, {
          opacity: 0,
          y: 20,
          duration: 0.45,
          ease: 'power2.out',
          delay: 0.15,
          clearProps: 'transform',
        });
      }
    });
  }
}
