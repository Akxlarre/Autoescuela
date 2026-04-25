import {
  effect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { StudentHomeFacade } from '@core/facades/student-home.facade';

@Component({
  selector: 'app-alumno-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BentoGridLayoutDirective,
    CardHoverDirective,
    IconComponent,
    KpiCardVariantComponent,
    AlertCardComponent,
    SectionHeroComponent,
    SkeletonBlockComponent,
    RouterLink,
  ],
  template: `
    <section class="bento-grid" appBentoGridLayout #bentoGrid aria-label="Mi progreso">
      <!-- ── HERO ──────────────────────────────────────────────────────────── -->
      <app-section-hero
        icon="graduation-cap"
        [title]="heroTitle()"
        [contextLine]="heroContextLine()"
        [chips]="heroChips()"
        [actions]="heroActions()"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── KPI 1 — Prácticas ─────────────────────────────────────────────── -->
      <div class="bento-square">
        <app-kpi-card-variant
          label="Clases prácticas"
          [value]="practicesCompleted()"
          [suffix]="'/' + practicesTotal()"
          icon="car"
          color="default"
          [accent]="true"
          [loading]="loading()"
        />
      </div>

      <!-- ── KPI 2 — Asistencia teoría ─────────────────────────────────────── -->
      <div class="bento-square">
        <app-kpi-card-variant
          label="Asist. teoría"
          [value]="pctTheory()"
          suffix="%"
          icon="clipboard-check"
          [color]="attendanceColor()"
          [loading]="loading()"
        />
      </div>

      <!-- ── KPI 3 — Próxima clase ─────────────────────────────────────────── -->
      <div class="bento-square">
        <div class="bento-card card-tinted flex flex-col gap-2 h-full" appCardHover>
          <div class="flex items-center gap-2">
            <app-icon name="calendar" [size]="14" style="color: var(--ds-brand)" />
            <span class="text-[10px] uppercase font-bold tracking-wider text-text-muted"
              >Próxima clase</span
            >
          </div>
          @if (loading()) {
            <app-skeleton-block variant="text" width="80%" height="14px" />
          } @else if (side()?.nextClass) {
            <p class="text-sm font-semibold text-text-primary m-0 leading-snug">
              {{ side()?.nextClass?.date }}
            </p>
            @if (side()?.nextClass?.time) {
              <p class="text-xs text-text-muted m-0">{{ side()?.nextClass?.time }}</p>
            }
          } @else {
            <p class="text-xs text-text-muted m-0 flex-1 flex items-center">Sin clases agendadas</p>
          }
          <a
            routerLink="/app/alumno/horario"
            class="text-xs font-medium no-underline mt-auto"
            style="color: var(--ds-brand)"
            data-llm-nav="alumno-horario"
          >
            Ver horario →
          </a>
        </div>
      </div>

      <!-- ── KPI 4 — Saldo ──────────────────────────────────────────────────── -->
      <div class="bento-square">
        <div
          class="bento-card flex flex-col gap-2 h-full"
          appCardHover
          [class.card-tinted]="(side()?.pendingBalance ?? 0) === 0"
        >
          <div class="flex items-center gap-2">
            <app-icon
              name="wallet"
              [size]="14"
              [style.color]="
                (side()?.pendingBalance ?? 0) > 0 ? 'var(--state-warning)' : 'var(--state-success)'
              "
            />
            <span class="text-[10px] uppercase font-bold tracking-wider text-text-muted"
              >Saldo</span
            >
          </div>
          @if (loading()) {
            <app-skeleton-block variant="text" width="60%" height="20px" />
          } @else {
            <p
              class="text-lg font-bold m-0"
              [style.color]="
                (side()?.pendingBalance ?? 0) > 0 ? 'var(--state-warning)' : 'var(--state-success)'
              "
            >
              @if ((side()?.pendingBalance ?? 0) === 0) {
                Al día ✓
              } @else {
                {{ formatCLP(side()?.pendingBalance ?? 0) }}
              }
            </p>
            <p class="text-xs text-text-muted m-0">
              Pagado: {{ formatCLP(side()?.totalPaid ?? 0) }}
            </p>
          }
          @if ((side()?.pendingBalance ?? 0) > 0) {
            <a
              routerLink="/app/alumno/pagos"
              class="btn-primary text-xs no-underline text-center mt-auto"
              data-llm-nav="alumno-pagos"
            >
              Pagar
            </a>
          }
        </div>
      </div>

      <!-- ── PANEL IZQUIERDO — Progreso prácticas (bento-wide × 2 rows) ─────── -->
      <div
        class="bento-wide bento-card bento-activity-lg flex flex-col gap-4"
        appCardHover
        data-col-span="6"
        data-col-start="1"
        data-row-span="2"
      >
        <div class="flex items-center gap-2">
          <app-icon name="trending-up" [size]="16" style="color: var(--ds-brand)" />
          <h2 class="m-0 font-semibold text-text-primary text-sm">Mi Progreso</h2>
          @if (!loading()) {
            <span class="ml-auto text-xs font-bold" style="color: var(--ds-brand)">
              {{ progress()?.pctOverall ?? 0 }}%
            </span>
          }
        </div>

        @if (loading()) {
          <div class="flex flex-col gap-3">
            <app-skeleton-block variant="rect" width="100%" height="80px" />
            <app-skeleton-block variant="text" width="100%" height="12px" />
            <app-skeleton-block variant="text" width="80%" height="12px" />
          </div>
        } @else {
          <!-- Anillo de progreso -->
          <div class="flex items-center gap-4">
            <div
              class="relative shrink-0 w-20 h-20 rounded-full flex items-center justify-center"
              [style.background]="progressRingBg()"
              aria-label="Progreso global {{ progress()?.pctOverall }}%"
            >
              <div
                class="absolute w-14 h-14 rounded-full bg-surface flex items-center justify-center"
              >
                <span class="text-xs font-bold text-text-primary"
                  >{{ progress()?.pctOverall ?? 0 }}%</span
                >
              </div>
            </div>
            <div class="flex flex-col gap-1 flex-1">
              <div class="flex items-center justify-between text-xs">
                <span class="text-text-muted">Prácticas</span>
                <span class="font-semibold text-text-primary">
                  {{ progress()?.practicesCompleted ?? 0 }}/{{ progress()?.practicesTotal ?? 12 }}
                </span>
              </div>
              <div class="h-1.5 rounded-full overflow-hidden" style="background: var(--bg-subtle)">
                <div
                  class="h-full rounded-full transition-all"
                  style="background: var(--ds-brand)"
                  [style.width.%]="practicesPct()"
                ></div>
              </div>
              <div class="flex items-center justify-between text-xs mt-1">
                <span class="text-text-muted">Asistencia teoría</span>
                <span class="font-semibold text-text-primary"
                  >{{ progress()?.pctTheoryAttendance ?? 0 }}%</span
                >
              </div>
              <div class="h-1.5 rounded-full overflow-hidden" style="background: var(--bg-subtle)">
                <div
                  class="h-full rounded-full transition-all"
                  style="background: var(--color-primary)"
                  [style.width.%]="progress()?.pctTheoryAttendance ?? 0"
                ></div>
              </div>
            </div>
          </div>

          <!-- Lista prácticas 1..N -->
          <div class="grid grid-cols-4 gap-1.5 flex-1">
            @for (p of practices(); track p.number) {
              <div
                class="flex items-center gap-1.5 py-1 px-1.5 rounded-lg text-xs"
                [style.background]="
                  p.status === 'completed' ? 'var(--state-success-bg)' : 'var(--bg-subtle)'
                "
              >
                <app-icon
                  [name]="
                    p.status === 'completed'
                      ? 'check-circle'
                      : p.status === 'scheduled'
                        ? 'clock'
                        : 'circle'
                  "
                  [size]="12"
                  [style.color]="
                    p.status === 'completed'
                      ? 'var(--state-success)'
                      : p.status === 'scheduled'
                        ? 'var(--ds-brand)'
                        : 'var(--text-muted)'
                  "
                />
                <span
                  [style.color]="
                    p.status === 'completed' ? 'var(--state-success)' : 'var(--text-muted)'
                  "
                >
                  {{ p.number }}
                </span>
              </div>
            }
          </div>
        }
      </div>

      <!-- ── PANEL DERECHO — Nota & Certificado (bento-wide × 2 rows) ─────────── -->
      <div
        class="bento-wide bento-card bento-alerts-lg flex flex-col gap-4"
        appCardHover
        data-col-span="6"
        data-col-start="7"
        data-row-span="2"
      >
        <div class="flex items-center gap-2">
          <app-icon name="star" [size]="16" style="color: var(--state-warning)" />
          <h2 class="m-0 font-semibold text-text-primary text-sm">
            @if (licenseGroup() === 'class_b') {
              Examen y Certificado
            } @else {
              Módulos y Certificado
            }
          </h2>
        </div>

        @if (loading()) {
          <div class="flex flex-col gap-3">
            @for (_ of [1, 2, 3]; track _) {
              <app-skeleton-block variant="text" width="100%" height="14px" />
            }
          </div>
        } @else if (licenseGroup() === 'class_b') {
          <!-- Clase B: 1 examen final -->
          <div class="card-tinted rounded-lg p-3 flex items-center gap-3">
            <div
              class="flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
              style="background: var(--bg-subtle)"
            >
              @if (grades()?.finalExamGrade !== null) {
                <span class="text-xl font-bold" style="color: var(--ds-brand)">
                  {{ grades()?.finalExamGrade }}
                </span>
              } @else {
                <app-icon name="star" [size]="20" style="color: var(--text-muted)" />
              }
            </div>
            <div class="flex flex-col gap-0.5">
              <p class="text-xs font-semibold text-text-primary m-0">Examen Final</p>
              @if (grades()?.finalExamGrade !== null) {
                <p class="text-xs text-text-muted m-0">
                  {{ grades()?.passed ? 'Aprobado ✓' : 'Reprobado' }}
                </p>
              } @else {
                <p class="text-xs text-text-muted m-0">Pendiente</p>
              }
            </div>
          </div>
        } @else {
          <!-- Profesional: 7 módulos -->
          <div class="flex flex-col gap-1.5 flex-1 overflow-auto">
            @for (mod of grades()?.modules ?? []; track mod.number) {
              <div
                class="flex items-center gap-2 py-1.5 px-2 rounded-lg"
                style="background: var(--bg-subtle)"
              >
                <span
                  class="shrink-0 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                  [style.background]="
                    mod.passed === true ? 'var(--state-success-bg)' : 'var(--bg-surface)'
                  "
                  [style.color]="mod.passed === true ? 'var(--state-success)' : 'var(--text-muted)'"
                >
                  {{ mod.number }}
                </span>
                <span class="text-xs text-text-secondary flex-1 truncate">{{ mod.name }}</span>
                @if (mod.grade !== null) {
                  <span
                    class="shrink-0 text-xs font-bold"
                    [style.color]="mod.passed ? 'var(--state-success)' : 'var(--state-error)'"
                  >
                    {{ mod.grade }}
                  </span>
                } @else {
                  <span class="shrink-0 text-xs text-text-muted">—</span>
                }
              </div>
            }
            @if ((grades()?.averageGrade ?? null) !== null) {
              <div
                class="flex items-center justify-between px-2 py-1.5 rounded-lg mt-1"
                style="background: var(--bg-tinted)"
              >
                <span class="text-xs font-semibold text-text-primary">Promedio</span>
                <span class="text-sm font-bold" style="color: var(--ds-brand)">
                  {{ grades()?.averageGrade }}
                </span>
              </div>
            }
          </div>
        }

        <!-- Separador -->
        <div style="border-top: 1px solid var(--border-subtle)"></div>

        <!-- Bloque certificado -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <app-icon [name]="certIcon()" [size]="14" [style.color]="certIconColor()" />
            <span class="text-xs font-semibold text-text-primary">{{ certStatusLabel() }}</span>
          </div>
          @if (certificate()?.state === 'locked' && certificate()?.blockingReason) {
            <p class="text-xs text-text-muted m-0">{{ certificate()?.blockingReason }}</p>
          } @else if (certificate()?.state === 'enabled') {
            <app-alert-card severity="success" title="Tu certificado está listo para ser generado">
              Solicita a la secretaría que lo emita.
            </app-alert-card>
          } @else if (certificate()?.state === 'issued') {
            <div class="flex items-center gap-2">
              <span class="text-xs text-text-muted">Folio:</span>
              <span class="text-xs font-semibold text-text-primary">{{
                certificate()?.folio ?? '—'
              }}</span>
            </div>
            @if (certificate()?.pdfUrl) {
              <button
                type="button"
                class="btn-primary w-full"
                data-llm-action="download-certificate"
                (click)="downloadCertificate()"
              >
                <app-icon name="download" [size]="14" />
                Descargar certificado
              </button>
            }
          }
        </div>
      </div>

      <!-- ── BANNER ASISTENCIA (full width) ────────────────────────────────── -->
      <div class="bento-banner bento-card flex flex-col gap-3" appCardHover>
        <div class="flex items-center gap-2">
          <app-icon name="calendar-check" [size]="16" style="color: var(--ds-brand)" />
          <h2 class="m-0 font-semibold text-text-primary text-sm">Asistencia reciente</h2>
          @if (!loading() && attendance()) {
            <span
              class="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
              [style.background]="semaphoreChipBg()"
              [style.color]="semaphoreChipColor()"
            >
              {{ semaphoreLabel() }}
            </span>
          }
        </div>

        @if (loading()) {
          <div class="flex gap-2">
            @for (_ of [1, 2, 3, 4, 5, 6, 7, 8]; track _) {
              <app-skeleton-block variant="rect" width="48px" height="56px" />
            }
          </div>
        } @else if (recentSessions().length === 0) {
          <p class="text-xs text-text-muted m-0">Sin sesiones registradas aún.</p>
        } @else {
          <div class="flex gap-2 flex-wrap">
            @for (s of recentSessions(); track s.id) {
              <div class="flex flex-col items-center gap-1" style="min-width: 48px">
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  [style.background]="sessionDotBg(s.status)"
                  [attr.aria-label]="s.status + ' — ' + s.label"
                >
                  <app-icon
                    [name]="s.status === 'present' ? 'check' : 'x'"
                    [size]="12"
                    [style.color]="sessionDotColor(s.status)"
                  />
                </div>
                <span class="text-[9px] text-text-muted text-center leading-tight">
                  {{ formatSessionDate(s.date) }}
                </span>
                <span class="text-[9px] text-text-muted leading-tight">
                  {{ s.kind === 'theory' ? 'T' : 'P' }}
                </span>
              </div>
            }
          </div>

          @if ((attendance()?.consecutiveAbsences ?? 0) >= 1) {
            <app-alert-card
              [severity]="(attendance()?.consecutiveAbsences ?? 0) >= 2 ? 'error' : 'warning'"
              [title]="
                (attendance()?.consecutiveAbsences ?? 0) >= 2
                  ? 'Riesgo de pérdida de avance'
                  : 'Inasistencia reciente'
              "
            >
              {{
                (attendance()?.consecutiveAbsences ?? 0) >= 2
                  ? 'Tienes ' +
                    attendance()?.consecutiveAbsences +
                    ' faltas consecutivas. Comunícate con la secretaría.'
                  : 'Tienes 1 falta reciente. Asegúrate de asistir a tu próxima clase.'
              }}
            </app-alert-card>
          }
        }
      </div>

      <!-- ── WIDGET FINAL 1 — Módulos / Nota ──────────────────────────────── -->
      <div class="bento-square">
        @if (loading()) {
          <app-kpi-card-variant label="Nota" [value]="0" icon="star" [loading]="true" />
        } @else if (hasGrade()) {
          <app-kpi-card-variant
            [label]="gradeLabel()"
            [value]="gradeValue()"
            [suffix]="licenseGroup() === 'class_b' ? '' : '/100'"
            icon="star"
            [color]="gradeColor()"
            [loading]="false"
          />
        } @else {
          <div class="bento-card flex flex-col gap-2 h-full" appCardHover>
            <span class="text-[10px] uppercase font-bold tracking-wider text-text-muted">{{
              gradeLabel()
            }}</span>
            <div class="flex-1 flex items-center justify-center">
              <app-icon name="star" [size]="28" style="color: var(--text-muted)" />
            </div>
            <p class="text-xs text-text-muted text-center m-0">Sin calificación aún</p>
          </div>
        }
      </div>

      <!-- ── WIDGET FINAL 2 — Certificado ──────────────────────────────────── -->
      <div class="bento-square">
        @if (loading()) {
          <app-kpi-card-variant label="Certificado" [value]="0" icon="award" [loading]="true" />
        } @else {
          <div
            class="bento-card flex flex-col gap-3 h-full"
            appCardHover
            [attr.data-color-variant]="certCardColor()"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-[10px] uppercase font-bold tracking-wider text-text-muted"
                >Certificado</span
              >
              <div
                class="flex items-center justify-center rounded-md w-7 h-7"
                [style.background]="certIconBg()"
                [style.color]="certIconColor()"
              >
                <app-icon [name]="certIcon()" [size]="14" />
              </div>
            </div>
            <div class="flex-1 flex flex-col justify-center gap-1">
              <p class="kpi-value text-2xl m-0" [style.color]="certIconColor()">
                {{ certStatusLabel() }}
              </p>
            </div>
            @if (certificate()?.state === 'issued' && certificate()?.pdfUrl) {
              <button
                type="button"
                class="btn-primary text-xs"
                data-llm-action="download-certificate"
                (click)="downloadCertificate()"
              >
                <app-icon name="download" [size]="12" />
                Descargar
              </button>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class AlumnoDashboardComponent {
  private readonly facade = inject(StudentHomeFacade);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  // ── Estado ────────────────────────────────────────────────────────────────

  readonly loading = computed(() => this.facade.isLoading());
  readonly snapshot = computed(() => this.facade.snapshot());
  readonly hero = computed(() => this.facade.hero());
  readonly progress = computed(() => this.facade.progress());
  readonly attendance = computed(() => this.facade.attendance());
  readonly grades = computed(() => this.facade.grades());
  readonly certificate = computed(() => this.facade.certificate());
  readonly side = computed(() => this.facade.side());
  readonly licenseGroup = computed(() => this.facade.licenseGroup());

  // ── KPI computeds ─────────────────────────────────────────────────────────

  readonly practicesCompleted = computed(() => this.progress()?.practicesCompleted ?? 0);
  readonly practicesTotal = computed(() => this.progress()?.practicesTotal ?? 12);
  readonly practicesPct = computed(() => {
    const t = this.practicesTotal();
    return t > 0 ? Math.round((this.practicesCompleted() / t) * 100) : 0;
  });
  readonly pctTheory = computed(() => this.progress()?.pctTheoryAttendance ?? 0);
  readonly practices = computed(() => this.progress()?.practices ?? []);

  readonly attendanceColor = computed(() => {
    const s = this.attendance()?.semaphore;
    if (s === 'red') return 'error' as const;
    if (s === 'yellow') return 'warning' as const;
    return 'success' as const;
  });

  readonly gradeLabel = computed(() =>
    this.licenseGroup() === 'class_b' ? 'Examen final' : 'Promedio módulos',
  );
  readonly hasGrade = computed(() => {
    if (this.licenseGroup() === 'class_b') return this.grades()?.finalExamGrade !== null;
    return this.grades()?.averageGrade !== null;
  });
  readonly gradeValue = computed(() => {
    if (this.licenseGroup() === 'class_b') return this.grades()?.finalExamGrade ?? 0;
    return this.grades()?.averageGrade ?? 0;
  });
  readonly gradeColor = computed(() => {
    if (this.licenseGroup() === 'class_b') {
      const g = this.grades()?.finalExamGrade;
      if (g == null) return 'default' as const;
      return g >= 4 ? ('success' as const) : ('error' as const);
    }
    const avg = this.grades()?.averageGrade;
    if (avg == null) return 'default' as const;
    return avg >= 75 ? ('success' as const) : ('error' as const);
  });

  // ── Certificado KPI computeds ──────────────────────────────────────────────

  readonly certIcon = computed(() => {
    const s = this.certificate()?.state;
    if (s === 'issued') return 'award';
    if (s === 'enabled') return 'check-circle';
    return 'lock';
  });
  readonly certIconColor = computed(() => {
    const s = this.certificate()?.state;
    if (s === 'issued' || s === 'enabled') return 'var(--state-success)';
    return 'var(--text-muted)';
  });
  readonly certIconBg = computed(() => {
    const s = this.certificate()?.state;
    if (s === 'issued' || s === 'enabled') return 'var(--state-success-bg)';
    return 'var(--bg-subtle)';
  });
  readonly certCardColor = computed(() => {
    const s = this.certificate()?.state;
    if (s === 'issued' || s === 'enabled') return 'success';
    return 'default';
  });
  readonly certStatusLabel = computed(() => {
    const s = this.certificate()?.state;
    if (s === 'issued') return 'Emitido';
    if (s === 'enabled') return 'Listo';
    return 'Pendiente';
  });

  // ── Progress ring ──────────────────────────────────────────────────────────

  readonly progressRingBg = computed(() => {
    const pct = this.progress()?.pctOverall ?? 0;
    const deg = Math.round(pct * 3.6);
    return `conic-gradient(var(--ds-brand) 0deg ${deg}deg, var(--bg-subtle) ${deg}deg 360deg)`;
  });

  // ── Hero computeds ─────────────────────────────────────────────────────────

  readonly heroTitle = computed(() => {
    const name = this.hero()?.studentFirstName;
    return name ? `Hola, ${name}` : 'Mi progreso';
  });
  readonly heroContextLine = computed(() => {
    const h = this.hero();
    if (!h) return '';
    const type = h.licenseGroup === 'class_b' ? 'Clase B' : 'Clase Profesional';
    const parts = [type];
    if (h.branchName) parts.push(h.branchName);
    if (h.enrollmentNumber) parts.push(`#${h.enrollmentNumber}`);
    return parts.join(' · ');
  });
  readonly heroChips = computed((): SectionHeroChip[] => {
    const h = this.hero();
    if (!h) return [];
    const chips: SectionHeroChip[] = [
      { label: 'Curso activo', icon: 'check-circle', style: 'success' },
    ];
    const abs = this.attendance()?.consecutiveAbsences ?? 0;
    if (abs >= 2)
      chips.push({ label: `${abs} faltas seguidas`, icon: 'alert-triangle', style: 'error' });
    else if (abs === 1)
      chips.push({ label: '1 falta reciente', icon: 'alert-triangle', style: 'warning' });
    return chips;
  });
  readonly heroActions = computed((): SectionHeroAction[] => {
    const actions: SectionHeroAction[] = [
      {
        id: 'agendar',
        label: 'Agendar clase',
        icon: 'calendar',
        primary: true,
        route: '/app/alumno/agendar',
      },
    ];
    if (this.certificate()?.state === 'issued' && this.certificate()?.pdfUrl) {
      actions.push({
        id: 'cert',
        label: 'Descargar certificado',
        icon: 'download',
        primary: false,
        route: undefined,
      });
    }
    return actions;
  });

  // ── Semáforo ───────────────────────────────────────────────────────────────

  readonly semaphoreLabel = computed(() => {
    const s = this.attendance()?.semaphore;
    if (s === 'red') return 'En riesgo';
    if (s === 'yellow') return 'Atención';
    return 'Al día';
  });
  readonly semaphoreChipBg = computed(() => {
    const s = this.attendance()?.semaphore;
    if (s === 'red') return 'var(--state-error-bg)';
    if (s === 'yellow') return 'var(--state-warning-bg, var(--bg-subtle))';
    return 'var(--state-success-bg)';
  });
  readonly semaphoreChipColor = computed(() => {
    const s = this.attendance()?.semaphore;
    if (s === 'red') return 'var(--state-error)';
    if (s === 'yellow') return 'var(--state-warning)';
    return 'var(--state-success)';
  });

  readonly recentSessions = computed(() => this.attendance()?.recentSessions ?? []);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  constructor() {
    void this.facade.initialize();

    effect(() => {
      const isReady = !this.loading();
      const el = this.bentoGrid()?.nativeElement;
      
      if (isReady && el) {
        Promise.resolve().then(() => {
          this.gsap.animateBentoGrid(el);
        });
      }
    });
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  onHeroAction(actionId: string): void {
    if (actionId === 'cert') {
      void this.downloadCertificate();
    }
  }

  async downloadCertificate(): Promise<void> {
    const url = await this.facade.downloadCertificate();
    if (url) window.open(url, '_blank');
  }

  // ── Helpers de template ────────────────────────────────────────────────────

  sessionDotBg(status: string): string {
    if (status === 'present') return 'var(--state-success-bg)';
    if (status === 'absent') return 'var(--state-error-bg)';
    return 'var(--state-warning-bg, var(--bg-subtle))';
  }

  sessionDotColor(status: string): string {
    if (status === 'present') return 'var(--state-success)';
    if (status === 'absent') return 'var(--state-error)';
    return 'var(--state-warning)';
  }

  formatSessionDate(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  }

  formatCLP(amount: number): string {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  }
}
