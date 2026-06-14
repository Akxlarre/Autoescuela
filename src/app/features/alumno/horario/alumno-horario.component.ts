import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { ScrollRevealDirective } from '@core/directives/scroll-reveal.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { StudentHorarioFacade } from '@core/facades/student-horario.facade';
import { StudentEnrollmentContextFacade } from '@core/facades/student-enrollment-context.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import type { SectionHeroChip } from '@core/models/ui/section-hero.model';
import type {
  StudentHorarioDay,
  StudentHorarioSessionItem,
} from '@core/models/ui/student-horario.model';

@Component({
  selector: 'app-alumno-horario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BentoGridLayoutDirective,
    ScrollRevealDirective,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
  ],
  template: `
    <section class="bento-grid" appBentoGridLayout #bentoGrid aria-label="Mi horario">
      <!-- ── HERO ─────────────────────────────────────────────────────────────── -->
      <app-section-hero
        class="bento-hero"
        icon="calendar-days"
        title="Mi Horario"
        [contextLine]="heroContextLine()"
        [chips]="heroChips()"
        [actions]="[]"
        [animateOnInit]="false"
      />

      <!-- ── Selector de matrícula ──────────────────────────────────────────── -->
      @if (context.enrollments().length > 1) {
        <div class="bento-banner">
          <div class="flex flex-wrap gap-2" role="tablist" aria-label="Mis matrículas">
            @for (enr of context.enrollments(); track enr.id) {
              <button
                type="button"
                role="tab"
                class="px-4 py-1.5 rounded-full text-sm font-medium border transition-colors"
                [class.bg-brand-muted]="context.activeEnrollmentId() === enr.id"
                [class.border-brand]="context.activeEnrollmentId() === enr.id"
                [class.text-primary]="context.activeEnrollmentId() === enr.id"
                [class.bg-surface]="context.activeEnrollmentId() !== enr.id"
                [class.border-border-subtle]="context.activeEnrollmentId() !== enr.id"
                [class.text-text-secondary]="context.activeEnrollmentId() !== enr.id"
                [attr.aria-selected]="context.activeEnrollmentId() === enr.id"
                [attr.data-llm-action]="'select-enrollment-' + enr.id"
                (click)="selectEnrollment(enr.id)"
              >
                {{ enr.label }}
              </button>
            }
          </div>
        </div>
      }

      <!-- ── PRÓXIMA CLASE — tarjeta destacada ─────────────────────────────────── -->
      @if (!loading() && nextSession()) {
        <div class="bento-banner" appScrollReveal>
          <div
            class="card card-tinted flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4"
            style="border-left: 3px solid var(--ds-brand)"
          >
            <div
              class="flex items-center justify-center w-12 h-12 rounded-xl shrink-0 bg-brand-tint"
            >
              <app-icon name="calendar-check" [size]="22" class="text-brand" />
            </div>

            <div class="flex flex-col gap-1 flex-1 min-w-0">
              <span class="text-[10px] uppercase font-bold tracking-wider text-brand"
                >Próxima clase</span
              >
              <p class="font-semibold text-text-primary m-0 leading-tight">
                {{ formatDate(nextSession()!.date) }}
                @if (nextSession()!.startTime) {
                  <span class="text-text-secondary font-normal">
                    · {{ nextSession()!.startTime }}</span
                  >
                }
              </p>
              @if (nextSession()!.classNumber) {
                <span class="text-xs text-text-muted">
                  Clase {{ nextSession()!.classNumber }} de 12
                </span>
              }
            </div>

            <span
              class="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-brand-tint text-brand"
            >
              {{ daysUntil(nextSession()!.date) }}
            </span>
          </div>
        </div>
      }

      <!-- ── CALENDARIO SEMANAL ─────────────────────────────────────────────────── -->
      <div class="bento-banner card flex flex-col gap-4" appScrollReveal>
        <!-- Navegación de semana -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex items-center justify-center w-8 h-8 rounded-lg border-0 cursor-pointer transition-colors bg-subtle text-text-secondary"
            (click)="facade.goToPrevWeek()"
            aria-label="Semana anterior"
            data-llm-action="horario-semana-anterior"
          >
            <app-icon name="chevron-left" [size]="16" />
          </button>

          <span class="flex-1 text-center text-sm font-semibold text-text-primary">
            {{ facade.weekMeta().weekLabel }}
          </span>

          <button
            type="button"
            class="flex items-center justify-center w-8 h-8 rounded-lg border-0 cursor-pointer transition-colors bg-subtle text-text-secondary"
            (click)="facade.goToNextWeek()"
            aria-label="Semana siguiente"
            data-llm-action="horario-semana-siguiente"
          >
            <app-icon name="chevron-right" [size]="16" />
          </button>

          @if (!facade.isCurrentWeek()) {
            <button
              type="button"
              class="text-xs font-semibold px-3 py-1.5 rounded-lg border-0 cursor-pointer transition-colors bg-brand-tint text-brand"
              (click)="facade.goToToday()"
              data-llm-action="horario-hoy"
            >
              Hoy
            </button>
          }
        </div>

        <!-- Grid de 7 días -->
        @if (loading()) {
          <div class="grid gap-2" style="grid-template-columns: repeat(7, 1fr)">
            @for (_ of skeletonDays; track _) {
              <div class="flex flex-col gap-2">
                <app-skeleton-block variant="rect" width="100%" height="52px" />
              </div>
            }
          </div>
        } @else {
          <div class="overflow-x-auto -mx-4 px-4">
            <div
              class="grid gap-1.5"
              style="grid-template-columns: repeat(7, minmax(88px, 1fr)); min-width: 620px"
            >
              @for (day of weekDays(); track day.date) {
                <div class="flex flex-col gap-1.5">
                  <!-- Cabecera del día -->
                  <div
                    class="flex flex-col items-center py-2 px-1 rounded-lg text-center"
                    [style.background]="day.isToday ? 'var(--bg-tinted)' : 'var(--bg-subtle)'"
                    [style.borderTop]="
                      day.isToday ? '2px solid var(--ds-brand)' : '2px solid transparent'
                    "
                  >
                    <span
                      class="text-[9px] uppercase font-bold tracking-wider"
                      [style.color]="day.isToday ? 'var(--ds-brand)' : 'var(--text-muted)'"
                    >
                      {{ dayAbbr(day.date) }}
                    </span>
                    <span
                      class="text-lg font-bold leading-none mt-0.5"
                      [style.color]="
                        day.isToday
                          ? 'var(--ds-brand)'
                          : day.isPast
                            ? 'var(--text-muted)'
                            : 'var(--text-primary)'
                      "
                    >
                      {{ dayNumber(day.date) }}
                    </span>
                    <span
                      class="text-[9px] leading-none mt-0.5"
                      [style.color]="day.isToday ? 'var(--ds-brand)' : 'var(--text-muted)'"
                    >
                      {{ monthAbbr(day.date) }}
                    </span>
                  </div>

                  <!-- Sesiones del día -->
                  @for (session of day.sessions; track session.id) {
                    <div
                      class="flex flex-col gap-1 rounded-lg px-2 py-2 text-center"
                      [style.background]="sessionBg(session)"
                      [style.borderLeft]="'3px solid ' + sessionAccent(session)"
                      [style.opacity]="session.isPast && !session.isNext ? '0.65' : '1'"
                    >
                      @if (session.startTime) {
                        <span class="text-xs font-bold" [style.color]="sessionAccent(session)">
                          {{ session.startTime }}
                        </span>
                      }

                      @if (session.classNumber) {
                        <span class="text-[11px] font-semibold text-text-secondary">
                          Clase {{ session.classNumber }}
                        </span>
                      } @else {
                        <span class="text-[11px] font-semibold text-text-secondary">
                          {{ kindLabel(session.kind) }}
                        </span>
                      }

                      @if (session.isNext) {
                        <span
                          class="text-[8px] font-bold px-1 py-0.5 rounded-full self-center bg-brand"
                          style="color: #fff"
                        >
                          PRÓXIMA
                        </span>
                      } @else {
                        <div
                          class="w-1.5 h-1.5 rounded-full self-center"
                          [style.background]="sessionAccent(session)"
                        ></div>
                      }
                    </div>
                  }

                  <!-- Día vacío (sin sesiones) -->
                  @if (day.sessions.length === 0) {
                    <div
                      class="rounded-lg py-3 flex items-center justify-center border border-dashed border-border-subtle"
                    >
                      <span class="text-[10px] text-text-muted">—</span>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Leyenda de estados -->
          <div
            class="flex items-center gap-4 flex-wrap pt-1"
            style="border-top: 1px solid var(--border-subtle)"
          >
            @for (item of legend; track item.label) {
              <div class="flex items-center gap-1.5">
                <div class="w-2 h-2 rounded-full" [style.background]="item.color"></div>
                <span class="text-[10px] text-text-muted">{{ item.label }}</span>
              </div>
            }
          </div>
        }
      </div>

      <!-- ── SIN MATRÍCULA ────────────────────────────────────────────────────── -->
      @if (!loading() && facade.licenseGroup() === null) {
        <div class="bento-banner" appScrollReveal>
          <div class="card flex flex-col items-center gap-3 py-10 text-center">
            <app-icon name="calendar-x" [size]="36" class="text-text-muted" />
            <p class="text-sm text-text-muted m-0">
              Sin matrícula activa. Consulta a la secretaría.
            </p>
          </div>
        </div>
      }
    </section>
  `,
})
export class AlumnoHorarioComponent {
  readonly facade = inject(StudentHorarioFacade);
  readonly context = inject(StudentEnrollmentContextFacade);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  readonly skeletonDays = [1, 2, 3, 4, 5, 6, 7];

  readonly legend = [
    { label: 'Completada', color: 'var(--state-success)' },
    { label: 'Agendada', color: 'var(--ds-brand)' },
    { label: 'Inasistencia', color: 'var(--state-error)' },
    { label: 'Cancelada', color: 'var(--text-muted)' },
  ];

  // ── Estado ─────────────────────────────────────────────────────────────────

  readonly loading = computed(() => this.facade.isLoading());
  readonly weekDays = computed(() => this.facade.weekDays());
  readonly nextSession = computed(() => this.facade.nextSession());

  readonly heroContextLine = computed(() => {
    const next = this.nextSession();
    if (next) {
      const dateStr = this.formatDate(next.date);
      return next.startTime ? `Próxima: ${dateStr} · ${next.startTime}` : `Próxima: ${dateStr}`;
    }
    return 'Sin clases agendadas próximamente';
  });

  readonly heroChips = computed((): SectionHeroChip[] => {
    const next = this.nextSession();
    if (!next) return [];
    return [{ label: this.daysUntil(next.date), icon: 'clock', style: 'default' }];
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  constructor() {
    void this.facade.initialize();

    effect(() => {
      const isReady = !this.loading();
      const el = this.bentoGrid()?.nativeElement;
      if (isReady && el) {
        Promise.resolve().then(() => this.gsap.animateBentoGrid(el));
      }
    });
  }

  selectEnrollment(id: number): void {
    this.context.setActive(id);
    void this.facade.initialize();
  }

  // ── Helpers de template ───────────────────────────────────────────────────

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' });
  }

  dayAbbr(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '');
  }

  dayNumber(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return String(d.getDate());
  }

  monthAbbr(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '');
  }

  daysUntil(dateStr: string): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff < 0) return 'Pasada';
    return `En ${diff} días`;
  }

  kindLabel(kind: string): string {
    if (kind === 'prof_theory') return 'Teoría';
    if (kind === 'prof_practice') return 'Práctica';
    if (kind === 'theory') return 'Teoría';
    return 'Práctica';
  }

  sessionBg(session: StudentHorarioSessionItem): string {
    if (session.isNext) return 'var(--bg-tinted)';
    if (session.status === 'completed') return 'var(--state-success-bg)';
    if (session.status === 'absent') return 'var(--state-error-bg)';
    if (session.status === 'cancelled') return 'var(--bg-subtle)';
    return 'var(--bg-subtle)';
  }

  sessionAccent(session: StudentHorarioSessionItem): string {
    if (session.isNext) return 'var(--ds-brand)';
    if (session.status === 'completed') return 'var(--state-success)';
    if (session.status === 'absent') return 'var(--state-error)';
    if (session.status === 'no_show') return 'var(--state-warning)';
    if (session.status === 'cancelled') return 'var(--text-muted)';
    return 'var(--ds-brand)';
  }
}
