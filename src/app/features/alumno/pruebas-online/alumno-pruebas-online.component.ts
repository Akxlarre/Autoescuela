import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { StudentHomeFacade } from '@core/facades/student-home.facade';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { IconComponent } from '@shared/components/icon/icon.component';

interface ExamStat {
  icon: string;
  value: string;
  label: string;
  note: string;
}

interface SimulatorLink {
  name: string;
  description: string;
  url: string;
  icon: string;
  tag: string;
  tagBg: string;
  tagColor: string;
}

@Component({
  selector: 'app-alumno-pruebas-online',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BentoGridLayoutDirective,
    BentoRevealDirective, CardHoverDirective, SectionHeroComponent, IconComponent],
  template: `
    <div class="bento-grid" appBentoReveal appBentoGridLayout>
      <!-- HERO -->
      <app-section-hero
        class="bento-hero"
        [animateOnInit]="false"
        title="Pruebas Online"
        [subtitle]="
          isProfessional()
            ? 'Practica para tu examen teórico de Licencia Profesional'
            : 'Practica con simuladores del examen teórico y llega preparado a tu prueba municipal'
        "
        icon="graduation-cap"
        backRoute="/app/alumno/inicio"
        backLabel="Inicio"
        [actions]="[]"
      />

      <!-- FORMATO DEL EXAMEN (solo Clase B) -->
      @if (!isProfessional()) {
        <div class="bento-banner">
          <div class="card p-6">
            <p class="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
              Formato del Examen — Licencia Clase B
            </p>
            <div class="bento-grid">
              @for (stat of classBStats; track stat.label) {
                <div class="card-tinted rounded-xl p-4 flex flex-col gap-1 bento-square">
                  <div class="flex items-center gap-2 mb-2">
                    <app-icon [name]="stat.icon" [size]="15" />
                    <span class="kpi-label">{{ stat.label }}</span>
                  </div>
                  <span class="kpi-value">{{ stat.value }}</span>
                  @if (stat.note) {
                    <span class="text-xs text-text-muted leading-tight">{{ stat.note }}</span>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- SIMULADORES -->
      <div class="bento-banner">
        <div class="flex flex-col gap-4">
          <div>
            <h3 class="text-lg font-bold text-text-primary">Simuladores Recomendados</h3>
            <p class="text-sm text-text-muted mt-0.5">
              @if (isProfessional()) {
                Practica en estas plataformas con preguntas para tu categoría de licencia
                profesional
              } @else {
                Practica en estas plataformas con preguntas similares al examen oficial
              }
            </p>
          </div>

          <div class="bento-grid">
            @for (sim of activeSimulators(); track sim.name) {
              <a
                [href]="sim.url"
                target="_blank"
                rel="noopener noreferrer"
                class="card p-5 flex flex-col gap-3 no-underline bento-wide"
                appCardHover
                [attr.data-llm-nav]="'external-simulator-' + sim.name"
              >
                <div class="flex items-start justify-between gap-2">
                  <div
                    class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-elevated"
                  >
                    <app-icon [name]="sim.icon" [size]="18" />
                  </div>
                  <span
                    class="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0"
                    [style.background]="sim.tagBg"
                    [style.color]="sim.tagColor"
                  >
                    {{ sim.tag }}
                  </span>
                </div>

                <div class="flex flex-col gap-1 flex-1">
                  <span class="font-semibold text-text-primary">{{ sim.name }}</span>
                  <span class="text-sm text-text-muted leading-relaxed">{{ sim.description }}</span>
                </div>

                <div
                  class="flex items-center gap-1.5 text-xs font-semibold mt-auto pt-2 border-t border-border-subtle text-brand"
                >
                  <span>Ir al simulador</span>
                  <app-icon name="external-link" [size]="12" />
                </div>
              </a>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AlumnoPruebasOnlineComponent implements OnInit, AfterViewInit {  private readonly homeFacade = inject(StudentHomeFacade);
  readonly isProfessional = computed(() => this.homeFacade.licenseGroup() === 'professional');

  readonly activeSimulators = computed(() =>
    this.isProfessional() ? this.professionalSimulators : this.classBSimulators,
  );

  readonly classBStats: ExamStat[] = [
    {
      icon: 'file-question',
      value: '35',
      label: 'Preguntas',
      note: '3 de ellas con doble puntaje',
    },
    { icon: 'clock', value: '45', label: 'Minutos', note: 'Tiempo total para responder' },
    { icon: 'star', value: '38', label: 'Puntos posibles', note: '35 + 3 preguntas × 2 pts' },
    {
      icon: 'check-circle',
      value: '33',
      label: 'Para aprobar',
      note: 'Mínimo de 38 puntos posibles',
    },
  ];

  private readonly classBSimulators: SimulatorLink[] = [
    {
      name: 'PracticaTest',
      description:
        'Preguntas actualizadas en formato idéntico al examen municipal. Temporizador incluido para simular las condiciones reales.',
      url: 'https://practicatest.cl/examen-teorico/clase-B',
      icon: 'globe',
      tag: 'Gratuito',
      tagBg: 'var(--state-info-bg, rgba(59,130,246,0.12))',
      tagColor: 'var(--state-info)',
    },
    {
      name: 'Educación Vial',
      description:
        'Simulador del examen municipal Clase B con banco de preguntas y explicaciones detalladas por cada respuesta.',
      url: 'https://www.educacionvial.cl/examen/examen-municipal-clase-b',
      icon: 'book-open',
      tag: 'Popular',
      tagBg: 'var(--state-warning-bg, rgba(234,179,8,0.12))',
      tagColor: 'var(--state-warning)',
    },
  ];

  private readonly professionalSimulators: SimulatorLink[] = [
    {
      name: 'PracticaTest',
      description:
        'Tests de práctica para Clase A2, A3, A4 y A5. Preguntas organizadas por categoría para prepararte para tu examen municipal de licencia profesional.',
      url: 'https://practicatest.cl/examen-teorico',
      icon: 'globe',
      tag: 'Gratuito',
      tagBg: 'var(--state-info-bg, rgba(59,130,246,0.12))',
      tagColor: 'var(--state-info)',
    },
  ];

  async ngOnInit(): Promise<void> {
    await this.homeFacade.initialize();
  }

  ngAfterViewInit(): void {  }
}
