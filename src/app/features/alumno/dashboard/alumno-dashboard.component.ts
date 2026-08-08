import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';
import { formatKpiEsCl } from '@core/utils/kpi-es-cl-format.util';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { StudentHomeFacade } from '@core/facades/student-home.facade';
import { StudentEnrollmentContextFacade } from '@core/facades/student-enrollment-context.facade';

import { TabsComponent } from '@shared/components/tabs/tabs.component';

@Component({
  selector: 'app-alumno-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
    BentoGridLayoutDirective,
    BentoRevealDirective,
    CardHoverDirective,
    IconComponent,
    SectionHeroComponent,
    SkeletonBlockComponent,
    TabsComponent,
  ],
  template: `
    <section
      class="bento-grid bento-grid--fill-screen-2"
      appBentoReveal
      appBentoGridLayout
      aria-label="Mi progreso"
    >
      <!-- ── HERO — 4 KPIs en el strip (Prácticas, Asist. teoría, Próxima clase,
           Saldo). Próxima clase/Saldo son clickeables (navegan a horario/pagos) en
           vez de vivir como cards propias — el detalle completo ya vive en esas
           páginas (spec 0035, reformulación 2026-08-08): mostrarlo dos veces era
           redundante. Solo Evaluación/Certificado son datos que NO existen en
           ninguna otra pantalla del portal alumno; por eso son las únicas que se
           quedan con espacio protagonista. ── -->
      <app-section-hero
        icon="graduation-cap"
        [title]="heroTitle()"
        [contextLine]="heroContextLine()"
        [chips]="heroChips()"
        [actions]="heroActions()"
        [animateOnInit]="false"
        density="slim"
        [kpis]="heroKpis()"
        [loading]="loading()"
        [loadingKpiCount]="4"
        (actionClick)="onHeroAction($event)"
        (kpiClick)="onKpiClick($event)"
      />

      <!-- ── COLUMNA IZQUIERDA — Mi Progreso ──────────────────────────────────
           .bento-fill, row-span 1 (no 2): antes ocupaba las 2 filas fr enteras
           y su contenido corto quedaba flotando con vacío abajo (feedback
           visual del owner, ronda 2). Ahora comparte fila con "Evaluación" y
           una fila 3 nueva ("Camino al Certificado") toma la otra — reutiliza
           --fill-screen-2 tal cual su propio comentario lo describe ("Hero +
           2 FILAS de tarjetas", no 2 columnas altas). ── -->
      <div
        class="bento-wide bento-card bento-fill flex flex-col gap-4"
        appCardHover
        data-col-span="6"
        data-col-start="1"
      >
        <!-- Selector de matrícula (solo con >1 enrollment) — vive acá porque
             Progreso/Evaluación son datos por-matrícula; no hay fila propia en
             el grid para él (mismo criterio que la fusión del selector de ciclo
             en ciclos-teoricos-content, spec 0031). -->
        @if (context.enrollments().length > 1) {
          <app-tabs
            [tabs]="enrollmentTabs()"
            [activeId]="activeEnrollmentStr()"
            variant="pill"
            (activeIdChange)="selectEnrollment(+$event)"
          />
        }

        <div class="flex items-center gap-2">
          <app-icon name="trending-up" [size]="16" class="text-brand" />
          <h2 class="item-title m-0">Mi Progreso</h2>
          @if (!loading()) {
            <span class="ml-auto text-xs font-bold text-brand">
              {{ progress()?.pctOverall ?? 0 }}%
            </span>
          }
        </div>

        @if (loading()) {
          <div class="flex flex-col gap-6">
            <!-- Skeleton para el anillo de progreso y leyenda -->
            <div class="flex items-center gap-4 shrink-0">
              <app-skeleton-block variant="circle" width="80px" height="80px" />
              <div class="flex flex-col gap-2 flex-1">
                <app-skeleton-block variant="text" width="60%" height="12px" />
                <app-skeleton-block variant="text" width="40%" height="10px" />
              </div>
            </div>
            <!-- Skeleton para la cuadrícula de clases -->
            <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
              @for (i of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; track i) {
                <app-skeleton-block variant="rect" width="100%" height="32px" />
              }
            </div>
          </div>
        } @else {
          <!-- Centrado vertical: el contenido (anillo+barras+stepper) es acotado
               y ahora la celda es la mitad de alta que antes (row-span 1, ver
               comentario de arriba) — debería alcanzarle sin scroll en el caso
               normal; overflow-y-auto como red de seguridad en viewports
               bajos (768px de alto). -->
          <div class="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center gap-3">
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
                <div class="h-1.5 rounded-full overflow-hidden bg-subtle">
                  <div
                    class="h-full rounded-full transition-all bg-brand"
                    [style.width.%]="practicesPct()"
                  ></div>
                </div>
                <div class="flex items-center justify-between text-xs mt-1">
                  <span class="text-text-muted">Asistencia teoría</span>
                  <span class="font-semibold text-text-primary"
                    >{{ progress()?.pctTheoryAttendance ?? 0 }}%</span
                  >
                </div>
                <div class="h-1.5 rounded-full overflow-hidden bg-subtle">
                  <div
                    class="h-full rounded-full transition-all bg-brand"
                    [style.width.%]="progress()?.pctTheoryAttendance ?? 0"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Stepper de 12 prácticas — reemplaza la grilla 4×3 anterior (celdas
               gigantes ~140px solo para un numerito): círculos compactos con
               tooltip de la fecha real (p.date, dato ya existente, antes sin
               usar). Verde SÓLIDO para completada, no un tint casi invisible. -->
            <div class="overline">Prácticas</div>
            <div class="flex flex-wrap gap-2">
              @for (p of practices(); track p.number) {
                <div
                  class="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border-2"
                  [style.background]="
                    p.status === 'completed' ? 'var(--state-success)' : 'transparent'
                  "
                  [style.border-color]="
                    p.status === 'completed'
                      ? 'var(--state-success)'
                      : p.status === 'scheduled'
                        ? 'var(--ds-brand)'
                        : 'var(--border-subtle)'
                  "
                  [style.color]="
                    p.status === 'completed'
                      ? 'var(--color-primary-text)'
                      : p.status === 'scheduled'
                        ? 'var(--ds-brand)'
                        : 'var(--text-muted)'
                  "
                  [pTooltip]="
                    'Práctica ' +
                    p.number +
                    (p.date
                      ? ' — ' + formatShortDate(p.date)
                      : p.status === 'completed'
                        ? ' — completada'
                        : ' — pendiente')
                  "
                  tooltipPosition="top"
                >
                  @if (p.status === 'completed') {
                    <app-icon name="check" [size]="14" />
                  } @else {
                    {{ p.number }}
                  }
                </div>
              }
            </div>

            <!-- Próxima práctica agendada — usa practices[].date (ya existía en
               el modelo, sin usar en el dashboard). Distinto de la "Próxima
               clase" del hero: acá se ve el NÚMERO de práctica en la secuencia,
               no solo la fecha. -->
            @if (nextScheduledPractice(); as next) {
              <div class="flex items-center gap-2 text-xs text-text-secondary mt-1">
                <app-icon name="clock" [size]="13" class="text-brand" />
                <span
                  >Próxima: <strong class="text-text-primary">Práctica {{ next.number }}</strong>
                  @if (next.date) {
                    — {{ formatShortDate(next.date) }}
                  }
                </span>
              </div>
            }
          </div>
        }
      </div>

      <!-- ── COLUMNA DERECHA — Evaluación y Certificado ───────────────────────
           Única sección con contenido que no vive en ninguna otra pantalla del
           portal alumno. row-span 1 (ver comentario de la columna izquierda). ── -->
      <div
        class="bento-wide bento-card bento-fill flex flex-col gap-4"
        appCardHover
        data-col-span="6"
        data-col-start="7"
      >
        <!-- El certificado ya NO vive acá — se consolidó en la celda "Camino al
             Certificado" de abajo (evita mostrar el mismo dato 2 veces y le
             devuelve a esta columna todo el alto para la lista de módulos,
             que quedaba muy apretada compartiendo espacio con el bloque de
             certificado — feedback del owner, ronda 4). -->
        <div class="flex items-center gap-2">
          <app-icon name="star" [size]="16" class="text-warning" />
          <h2 class="item-title m-0">
            @if (licenseGroup() === 'class_b') {
              Examen Final
            } @else {
              Módulos
            }
          </h2>
        </div>

        <!-- Centrado vertical solo para Clase B (1 tarjeta corta): Profesional
             ya usa el espacio con su lista de módulos + scroll interno propio
             (mismo criterio que la columna izquierda). Celda ahora la mitad de
             alta que antes (row-span 1) — debería alcanzar sin scroll. -->
        <div
          class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4"
          [class.justify-center]="!loading() && licenseGroup() === 'class_b'"
        >
          @if (loading()) {
            <div class="flex flex-col gap-3">
              @for (_ of [1, 2, 3]; track _) {
                <app-skeleton-block variant="text" width="100%" height="14px" />
              }
            </div>
          } @else if (licenseGroup() === 'class_b') {
            <!-- Clase B: 1 examen final. Círculo de nota más grande (antes w-12,
               ahora w-16) + fecha rendida (finalExamDate, dato ya existente
               en el modelo, antes sin usar) — le da más presencia a la única
               tarjeta de esta columna en vez de dejarla perdida en el vacío. -->
            <div class="card-tinted rounded-lg p-4 flex items-center gap-4">
              <div class="flex items-center justify-center w-16 h-16 rounded-xl shrink-0 bg-subtle">
                @if (grades()?.finalExamGrade !== null) {
                  <span class="text-2xl font-bold text-brand">
                    {{ grades()?.finalExamGrade }}
                  </span>
                } @else {
                  <app-icon name="star" [size]="24" class="text-text-muted" />
                }
              </div>
              <div class="flex flex-col gap-0.5">
                <p class="text-sm font-semibold text-text-primary m-0">Examen Final</p>
                @if (grades()?.finalExamGrade !== null) {
                  <p class="text-xs text-text-muted m-0">
                    {{ grades()?.passed ? 'Aprobado ✓' : 'Reprobado' }}
                    @if (grades()?.finalExamDate; as examDate) {
                      · rendido el {{ formatShortDate(examDate) }}
                    }
                  </p>
                } @else {
                  <p class="text-xs text-text-muted m-0">Pendiente de rendir</p>
                }
              </div>
            </div>
          } @else {
            <!-- Profesional: 7 módulos -->
            <div class="flex flex-col gap-1.5 flex-1 overflow-auto">
              @for (mod of grades()?.modules ?? []; track mod.number) {
                <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-subtle">
                  <span
                    class="shrink-0 text-2xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                    [style.background]="
                      mod.passed === true ? 'var(--state-success-bg)' : 'var(--bg-surface)'
                    "
                    [style.color]="
                      mod.passed === true ? 'var(--state-success)' : 'var(--text-muted)'
                    "
                  >
                    {{ mod.number }}
                  </span>
                  <span
                    class="text-xs text-text-secondary flex-1 truncate"
                    [pTooltip]="mod.name"
                    tooltipPosition="top"
                    >{{ mod.name }}</span
                  >
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
                  class="flex items-center justify-between px-2 py-1.5 rounded-lg mt-1 bg-brand-tint"
                >
                  <span class="text-xs font-semibold text-text-primary">Promedio</span>
                  <span class="text-sm font-bold text-brand">
                    {{ grades()?.averageGrade }}
                  </span>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- ── CAMINO AL CERTIFICADO — tercera celda, fila 3 ─────────────────────
           No inventa datos: son los 3 mismos signals de siempre (progress,
           grades, certificate) presentados como secuencia en vez de bloques
           separados. Ocupa la fila que Mi Progreso/Evaluación dejaron libre al
           pasar de row-span 2 a 1 (feedback del owner: "rellenemos con info,
           agreguemos un componente más al grid"). ── -->
      <div class="bento-banner bento-card bento-fill flex flex-col gap-4" appCardHover>
        <div class="flex items-center gap-2">
          <app-icon name="milestone" [size]="16" class="text-brand" />
          <h2 class="item-title m-0">Camino al Certificado</h2>
        </div>

        @if (loading()) {
          <div class="flex-1 flex items-center gap-4">
            @for (_ of [1, 2, 3]; track _) {
              <app-skeleton-block variant="rect" width="100%" height="56px" />
            }
          </div>
        } @else {
          <div class="flex-1 min-h-0 flex items-center">
            <div class="flex items-center w-full">
              @for (step of journeySteps(); track step.id; let last = $last) {
                <div class="flex flex-col items-center gap-2 px-2" style="min-width: 96px">
                  <div
                    class="w-12 h-12 rounded-full flex items-center justify-center border-2 shrink-0"
                    [style.background]="
                      step.state === 'done' ? 'var(--state-success)' : 'transparent'
                    "
                    [style.border-color]="
                      step.state === 'done'
                        ? 'var(--state-success)'
                        : step.state === 'current'
                          ? 'var(--ds-brand)'
                          : 'var(--border-subtle)'
                    "
                  >
                    <app-icon
                      [name]="step.state === 'done' ? 'check' : step.icon"
                      [size]="20"
                      [style.color]="
                        step.state === 'done'
                          ? 'var(--color-primary-text)'
                          : step.state === 'current'
                            ? 'var(--ds-brand)'
                            : 'var(--text-muted)'
                      "
                    />
                  </div>
                  <div class="text-center">
                    <p class="text-xs font-semibold text-text-primary m-0">{{ step.label }}</p>
                    <p class="text-2xs text-text-muted m-0">{{ step.detail }}</p>
                  </div>
                </div>
                @if (!last) {
                  <app-icon
                    name="chevron-right"
                    [size]="18"
                    class="shrink-0"
                    [style.color]="
                      step.state === 'done' ? 'var(--state-success)' : 'var(--border-subtle)'
                    "
                  />
                  <div
                    class="h-0.5 flex-1"
                    [style.background]="
                      step.state === 'done' ? 'var(--state-success)' : 'var(--border-subtle)'
                    "
                  ></div>
                }
              }
            </div>
          </div>

          <!-- Motivo de bloqueo — única fuente de esta info ahora que se sacó
               del bloque de certificado de la columna Evaluación. -->
          @if (certificate()?.state === 'locked' && certificate()?.blockingReason) {
            <div class="flex items-start gap-2 text-xs text-text-muted">
              <app-icon name="info" [size]="14" class="text-warning shrink-0 mt-0.5" />
              <span>{{ certificate()?.blockingReason }}</span>
            </div>
          }
        }
      </div>
    </section>
  `,
})
export class AlumnoDashboardComponent {
  private readonly facade = inject(StudentHomeFacade);
  private readonly router = inject(Router);
  readonly context = inject(StudentEnrollmentContextFacade);

  // ── Estado ────────────────────────────────────────────────────────────────

  readonly loading = computed(() => this.facade.isLoading());
  readonly snapshot = computed(() => this.facade.snapshot());
  readonly hero = computed(() => this.facade.hero());
  readonly progress = computed(() => this.facade.progress());

  readonly enrollmentTabs = computed(() => {
    return this.context.enrollments().map((enr) => ({
      id: String(enr.id),
      label: enr.label,
    }));
  });

  readonly activeEnrollmentStr = computed(() => String(this.context.activeEnrollmentId()));

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
  readonly nextScheduledPractice = computed(
    () => this.practices().find((p) => p.status === 'scheduled') ?? null,
  );

  /**
   * "Camino al Certificado" — los mismos 3 signals (progress/grades/certificate)
   * que ya se muestran en las 2 columnas, presentados como secuencia. No agrega
   * ninguna regla de negocio nueva: el paso "actual" es simplemente el primero
   * no completado, en el orden real en que ocurren (prácticas → evaluación →
   * certificado).
   */
  readonly journeySteps = computed(() => {
    const prog = this.progress();
    const gr = this.grades();
    const cert = this.certificate();
    const isClassB = this.licenseGroup() === 'class_b';

    const practicesDone = (prog?.practicesCompleted ?? 0) >= (prog?.practicesTotal ?? 12);

    let examDone: boolean;
    let examDetail: string;
    if (isClassB) {
      examDone = gr?.passed === true;
      examDetail =
        gr?.finalExamGrade != null ? (gr.passed ? 'Aprobado' : 'Reprobado') : 'Pendiente';
    } else {
      const mods = gr?.modules ?? [];
      examDone = mods.length > 0 && mods.every((m) => m.passed === true);
      examDetail = gr?.averageGrade != null ? `Promedio ${gr.averageGrade}` : 'Pendiente';
    }

    const certDone = cert?.state === 'issued';
    const certDetail =
      cert?.state === 'issued'
        ? `Folio ${cert.folio ?? '—'}`
        : cert?.state === 'enabled'
          ? 'Listo'
          : 'Pendiente';

    const steps = [
      {
        id: 'practicas',
        label: 'Prácticas',
        icon: 'car',
        done: practicesDone,
        detail: `${prog?.practicesCompleted ?? 0}/${prog?.practicesTotal ?? 12}`,
      },
      {
        id: 'evaluacion',
        label: isClassB ? 'Examen Final' : 'Módulos',
        icon: 'star',
        done: examDone,
        detail: examDetail,
      },
      {
        id: 'certificado',
        label: 'Certificado',
        icon: 'award',
        done: certDone,
        detail: certDetail,
      },
    ];

    const firstPendingIdx = steps.findIndex((s) => !s.done);
    return steps.map((s, i) => ({
      ...s,
      state: (s.done ? 'done' : i === firstPendingIdx ? 'current' : 'pending') as
        | 'done'
        | 'current'
        | 'pending',
    }));
  });

  readonly attendanceColor = computed(() => {
    const s = this.attendance()?.semaphore;
    if (s === 'red') return 'error' as const;
    if (s === 'yellow') return 'warning' as const;
    return 'success' as const;
  });

  /**
   * 4 KPIs del strip del hero. Próxima clase y Saldo son clickeables (navegan
   * a horario/pagos) en vez de ser cards propias — su detalle completo ya vive
   * en esas páginas (reformulación spec 0035, 2026-08-08).
   */
  readonly heroKpis = computed<SectionHeroKpi[]>(() => {
    const balance = this.side()?.pendingBalance ?? 0;
    const nextClass = this.side()?.nextClass;
    return [
      {
        id: 'practicas',
        label: 'Clases prácticas',
        value: formatKpiEsCl(this.practicesCompleted()),
        suffix: '/' + formatKpiEsCl(this.practicesTotal()),
        icon: 'car',
      },
      {
        id: 'asist-teoria',
        label: 'Asist. teoría',
        value: formatKpiEsCl(this.pctTheory()),
        suffix: '%',
        icon: 'clipboard-check',
        color: this.attendanceColor(),
      },
      {
        id: 'proxima-clase',
        label: 'Próxima clase',
        value: nextClass?.date ?? 'Sin clases',
        subValue: nextClass?.time ?? undefined,
        icon: 'calendar',
        clickable: true,
      },
      {
        id: 'saldo',
        label: 'Saldo',
        value: balance === 0 ? 'Al día' : this.formatCLP(balance),
        icon: 'wallet',
        color: balance > 0 ? 'warning' : 'success',
        clickable: true,
      },
    ];
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
    if (this.certificate()?.state === 'issued' && this.certificate()?.pdfUrl) {
      return [
        {
          id: 'cert',
          label: 'Descargar certificado',
          icon: 'download',
          primary: true,
          route: undefined,
        },
      ];
    }
    return [];
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  constructor() {
    void this.facade.initialize();
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  selectEnrollment(id: number): void {
    this.context.setActive(id);
    void this.facade.initialize();
  }

  onHeroAction(actionId: string): void {
    if (actionId === 'cert') {
      void this.downloadCertificate();
    }
  }

  onKpiClick(id: string): void {
    if (id === 'proxima-clase') {
      void this.router.navigate(['/app/alumno/horario']);
    } else if (id === 'saldo') {
      void this.router.navigate(['/app/alumno/pagos']);
    }
  }

  async downloadCertificate(): Promise<void> {
    // Abre la ventana sincrónicamente (gesto directo del usuario) para evitar
    // que el browser bloquee el popup al llamarla después del await.
    const win = window.open('', '_blank');
    const url = await this.facade.downloadCertificate();
    if (url && win) {
      win.location.href = url;
    } else {
      win?.close();
    }
  }

  formatCLP(amount: number): string {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  }

  formatShortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  }
}
