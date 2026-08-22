import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { ScrollRevealDirective } from '@core/directives/scroll-reveal.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { StudentClasesFacade } from '@core/facades/student-clases.facade';
import { StudentEnrollmentContextFacade } from '@core/facades/student-enrollment-context.facade';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { TabsComponent } from '@shared/components/tabs/tabs.component';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';
import { formatKpiEsCl } from '@core/utils/kpi-es-cl-format.util';

type TabId = 'practice' | 'theory';

@Component({
  selector: 'app-alumno-clases',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BentoGridLayoutDirective,
    BentoRevealDirective,
    ScrollRevealDirective,
    AnimateInDirective,
    CardHoverDirective,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    BadgeComponent,
    AlertCardComponent,
    TabsComponent,
  ],
  template: `
    <section
      class="bento-grid bento-grid--fill-screen-kpi bento-grid--rows-fit"
      appBentoReveal
      appBentoGridLayout
      aria-label="Mis clases"
    >
      <!-- ── HERO ────────────────────────────────────────────────────────────── -->
      <app-section-hero
        icon="clipboard-list"
        title="Mis Clases"
        [contextLine]="heroContextLine()"
        [chips]="heroChips()"
        [actions]="[]"
        [animateOnInit]="false"
        density="slim"
        [kpis]="heroKpis()"
        [loading]="loading()"
        [loadingKpiCount]="2"
      />

      <!-- ── Selector de matrícula + alerta sin matrícula (1 sola fila auto) ────
           Ambas son condicionales y PUEDEN COEXISTIR (el panel principal no tiene @if,
           así que la alerta no lo reemplaza: se sumaba como 4ta fila). Agrupadas en un
           wrapper SIEMPRE presente para que --fill-screen-kpi, que fija 3 filas de grid
           (hero/auto/fill), siga colocando el panel de tabs en la fila fill — si el @if
           envolvente ocultara el wrapper, el auto-placement correría el panel a la fila
           "auto" y contain:size lo colapsaría a 0 (mismo mecanismo que fix-127-b).
           La alerta sube acá a propósito: explica por qué el panel de abajo está vacío. -->
      <div class="bento-banner flex flex-col gap-3">
        @if (context.enrollments().length > 1) {
          <div class="p-2">
            <app-tabs
              [tabs]="enrollmentTabs()"
              [activeId]="activeEnrollmentStr()"
              variant="pill"
              (activeIdChange)="selectEnrollment(+$event)"
            />
          </div>
        }

        @if (!loading() && !facade.data()) {
          <div appScrollReveal>
            <app-alert-card severity="info" title="Sin matrícula activa">
              Aún no tienes un curso activo. Consulta a la secretaría para iniciar tu matrícula.
            </app-alert-card>
          </div>
        }
      </div>

      <!-- ── PANEL PRINCIPAL — celda protagonista (fila fill, scroll interno) ──── -->
      <div class="bento-banner bento-fill card flex flex-col gap-4" appScrollReveal appCardHover>
        <!-- Tabs — fijas: quedan fuera del scroller para no perderse al bajar el listado -->
        @if (!loading()) {
          <div class="p-1 self-start shrink-0">
            <app-tabs
              [tabs]="viewTabs()"
              [activeId]="activeTab()"
              variant="segmented"
              (activeIdChange)="activeTab.set($any($event))"
            />
          </div>
        }

        <!-- Listado: único scroller de la celda. En desktop su alto lo dicta la fila
             fill del grid; bajo lg el contenido mide natural y scrollea la página. -->
        <div class="flex-1 min-h-0 overflow-y-auto">
          <!-- ── Skeleton del listado ───────────────────────────────────────────── -->
          @if (loading()) {
            <div class="flex flex-col gap-3">
              @for (_ of skeletonRows; track _) {
                <div
                  class="flex items-center gap-3 py-3"
                  style="border-bottom: 1px solid var(--border-subtle)"
                >
                  <app-skeleton-block variant="rect" width="36px" height="36px" />
                  <div class="flex flex-col gap-1.5 flex-1">
                    <app-skeleton-block variant="text" width="40%" height="13px" />
                    <app-skeleton-block variant="text" width="60%" height="11px" />
                  </div>
                  <app-skeleton-block variant="rect" width="72px" height="22px" />
                </div>
              }
            </div>

            <!-- ── Tab Prácticas ────────────────────────────────────────────────── -->
          } @else if (activeTab() === 'practice') {
            @if (licenseGroup() === 'class_b') {
              @if (practiceSessions().length === 0) {
                <div class="flex flex-col items-center gap-2 py-10 text-center">
                  <app-icon name="car" [size]="32" class="text-text-muted" />
                  <p class="text-sm text-text-muted m-0">
                    Aún no tienes clases prácticas registradas
                  </p>
                </div>
              } @else {
                <div class="flex flex-col divide-y divide-border-subtle">
                  @for (session of practiceSessions(); track session.id) {
                    <div
                      class="flex items-center gap-3 py-3 first:pt-0"
                      [class.opacity-60]="session.status === 'cancelled'"
                      appAnimateIn
                    >
                      <!-- Número de clase -->
                      <div
                        class="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 text-xs font-bold"
                        [style.background]="statusBg(session.status)"
                        [style.color]="statusColor(session.status)"
                      >
                        {{ session.classNumber }}
                      </div>

                      <!-- Detalle -->
                      <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="item-title truncate">
                            {{ formatDate(session.date) }}
                            @if (session.time) {
                              <span class="font-normal text-text-muted"> · {{ session.time }}</span>
                            }
                          </span>
                        </div>
                        <div class="flex items-center gap-1 text-xs text-text-muted">
                          <app-icon name="clock" [size]="10" />
                          {{ session.durationMin }} min
                        </div>
                      </div>

                      <!-- Estado -->
                      <app-badge [variant]="statusVariant(session.status)" class="shrink-0">
                        {{ statusLabel(session.status) }}
                      </app-badge>
                    </div>
                  }
                </div>
              }
            } @else {
              <!-- Profesional: Prácticas -->
              @if (profPracticeSessions().length === 0) {
                <div class="flex flex-col items-center gap-2 py-10 text-center">
                  <app-icon name="car" [size]="32" class="text-text-muted" />
                  <p class="text-sm text-text-muted m-0">Sin prácticas registradas aún</p>
                </div>
              } @else {
                <div class="flex flex-col divide-y divide-border-subtle">
                  @for (s of profPracticeSessions(); track s.id) {
                    <div class="flex items-center gap-3 py-3 first:pt-0" appAnimateIn>
                      <div
                        class="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                        [style.background]="attBg(s.attendanceStatus)"
                        [style.color]="attColor(s.attendanceStatus)"
                      >
                        <app-icon [name]="attIcon(s.attendanceStatus)" [size]="16" />
                      </div>
                      <div class="flex flex-col gap-0.5 flex-1">
                        <span class="item-title">
                          {{ formatDate(s.date) }}
                        </span>
                        <span class="text-xs text-text-muted">Sesión práctica</span>
                      </div>
                      <app-badge [variant]="attVariant(s.attendanceStatus)" class="shrink-0">
                        {{ attLabel(s.attendanceStatus) }}
                      </app-badge>
                    </div>
                  }
                </div>
              }
            }

            <!-- ── Tab Teoría ───────────────────────────────────────────────────── -->
          } @else {
            @if (licenseGroup() === 'class_b') {
              @if (theorySessions().length === 0) {
                <div class="flex flex-col items-center gap-2 py-10 text-center">
                  <app-icon name="clipboard-list" [size]="32" class="text-text-muted" />
                  <p class="text-sm text-text-muted m-0">Sin sesiones de teoría registradas</p>
                </div>
              } @else {
                <div class="flex flex-col divide-y divide-border-subtle">
                  @for (s of theorySessions(); track s.id) {
                    <div class="flex items-center gap-3 py-3 first:pt-0" appAnimateIn>
                      <div
                        class="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                        [style.background]="attBg(s.attendanceStatus)"
                        [style.color]="attColor(s.attendanceStatus)"
                      >
                        <app-icon [name]="attIcon(s.attendanceStatus)" [size]="16" />
                      </div>
                      <div class="flex flex-col gap-0.5 flex-1">
                        <span class="item-title">
                          {{ formatDate(s.date) }}
                          @if (s.time) {
                            <span class="font-normal text-text-muted"> · {{ s.time }}</span>
                          }
                        </span>
                        <span class="text-xs text-text-muted">Sesión de teoría</span>
                      </div>
                      <app-badge [variant]="attVariant(s.attendanceStatus)" class="shrink-0">
                        {{ attLabel(s.attendanceStatus) }}
                      </app-badge>
                    </div>
                  }
                </div>
              }
            } @else {
              <!-- Profesional: Teoría -->
              @if (profTheorySessions().length === 0) {
                <div class="flex flex-col items-center gap-2 py-10 text-center">
                  <app-icon name="clipboard-list" [size]="32" class="text-text-muted" />
                  <p class="text-sm text-text-muted m-0">Sin sesiones de teoría registradas</p>
                </div>
              } @else {
                <div class="flex flex-col divide-y divide-border-subtle">
                  @for (s of profTheorySessions(); track s.id) {
                    <div class="flex items-center gap-3 py-3 first:pt-0" appAnimateIn>
                      <div
                        class="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                        [style.background]="attBg(s.attendanceStatus)"
                        [style.color]="attColor(s.attendanceStatus)"
                      >
                        <app-icon [name]="attIcon(s.attendanceStatus)" [size]="16" />
                      </div>
                      <div class="flex flex-col gap-0.5 flex-1">
                        <span class="item-title">
                          {{ formatDate(s.date) }}
                        </span>
                        <span class="text-xs text-text-muted">Sesión de teoría</span>
                      </div>
                      <app-badge [variant]="attVariant(s.attendanceStatus)" class="shrink-0">
                        {{ attLabel(s.attendanceStatus) }}
                      </app-badge>
                    </div>
                  }
                </div>
              }
            }
          }
        </div>
      </div>
    </section>
  `,
})
export class AlumnoClasesComponent {
  readonly facade = inject(StudentClasesFacade);
  readonly context = inject(StudentEnrollmentContextFacade);

  readonly activeTab = signal<TabId>('practice');
  readonly skeletonRows = [1, 2, 3, 4, 5];

  // ── Estado ────────────────────────────────────────────────────────────────

  readonly loading = computed(() => this.facade.isLoading());
  readonly licenseGroup = computed(() => this.facade.licenseGroup());
  readonly kpis = computed(() => this.facade.kpis());
  readonly practiceSessions = computed(() => this.facade.practiceSessions());
  readonly theorySessions = computed(() => this.facade.theorySessions());
  readonly profTheorySessions = computed(() =>
    this.facade.profSessions().filter((s) => s.kind === 'theory'),
  );
  readonly profPracticeSessions = computed(() =>
    this.facade.profSessions().filter((s) => s.kind === 'practice'),
  );

  readonly enrollmentTabs = computed(() => {
    return this.context.enrollments().map((enr) => ({
      id: String(enr.id),
      label: enr.label,
    }));
  });

  readonly activeEnrollmentStr = computed(() => String(this.context.activeEnrollmentId()));

  readonly viewTabs = computed(() => [
    {
      id: 'practice',
      label: 'Prácticas',
    },
    {
      id: 'theory',
      label: 'Teoría',
    },
  ]);

  readonly theoryColor = computed(() => {
    const pct = this.kpis()?.theoryPct ?? 0;
    if (pct >= 75) return 'success' as const;
    if (pct >= 50) return 'warning' as const;
    return 'error' as const;
  });

  /**
   * KPIs del strip del hero slim (antes: hasta 2 celdas `bento-square` sueltas,
   * la 2ª condicional a `licenseGroup`). Valores pre-formateados: el strip
   * renderiza `{{ kpi.value }}` crudo y no pasa por `animateCounter`.
   */
  readonly heroKpis = computed<SectionHeroKpi[]>(() => {
    const group = this.licenseGroup();
    const k = this.kpis();
    const kpis: SectionHeroKpi[] = [
      {
        id: 'practicas',
        label: group === 'class_b' ? 'Prácticas completadas' : 'Prácticas',
        value: formatKpiEsCl(k?.completedPractices ?? 0),
        suffix: group === 'class_b' && k?.totalPractices ? `/${k.totalPractices}` : '',
      },
    ];
    if (group !== 'class_b') {
      kpis.push({
        id: 'teoria',
        label: 'Asistencia teoría',
        value: formatKpiEsCl(k?.theoryPct ?? 0),
        suffix: '%',
        color: this.theoryColor(),
      });
    }
    if (group === 'class_b') {
      kpis.push({
        id: 'proximas',
        label: 'Próximas agendadas',
        value: formatKpiEsCl(k?.scheduledUpcoming ?? 0),
      });
    }
    return kpis;
  });

  readonly heroContextLine = computed(() => {
    const group = this.licenseGroup();
    if (!group) return '';
    const completed = this.kpis()?.completedPractices ?? 0;
    const total = this.kpis()?.totalPractices ?? 0;
    const label = group === 'class_b' ? 'Clase B' : 'Clase Profesional';
    return total > 0 ? `${label} · ${completed}/${total} prácticas` : label;
  });

  readonly heroChips = computed((): SectionHeroChip[] => {
    const pct = this.kpis()?.theoryPct ?? 0;
    const chips: SectionHeroChip[] = [];
    if (pct > 0) {
      chips.push({
        label: `${pct}% teoría`,
        icon: 'clipboard-check',
        style: pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'error',
      });
    }
    return chips;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  constructor() {
    void this.facade.initialize();
  }

  selectEnrollment(id: number): void {
    this.context.setActive(id);
    void this.facade.initialize();
  }

  // ── Helpers de template ───────────────────────────────────────────────────

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  statusColor(status: string): string {
    const map: Record<string, string> = {
      completed: 'var(--state-success)',
      absent: 'var(--state-error)',
      no_show: 'var(--state-warning)',
      cancelled: 'var(--text-muted)',
      in_progress: 'var(--ds-brand)',
      scheduled: 'var(--ds-brand)',
    };
    return map[status] ?? 'var(--text-muted)';
  }

  /** Variant de app-badge para el pill de estado (el círculo del número de clase
   *  sigue usando statusBg/statusColor — solo el pill de texto migra a app-badge). */
  statusVariant(status: string): 'success' | 'warning' | 'error' | 'brand' | 'neutral' {
    const map: Record<string, 'success' | 'warning' | 'error' | 'brand' | 'neutral'> = {
      completed: 'success',
      absent: 'error',
      no_show: 'warning',
      cancelled: 'neutral',
      in_progress: 'brand',
      scheduled: 'brand',
    };
    return map[status] ?? 'neutral';
  }

  statusBg(status: string): string {
    const map: Record<string, string> = {
      completed: 'var(--state-success-bg)',
      absent: 'var(--state-error-bg)',
      no_show: 'var(--state-warning-bg, var(--bg-subtle))',
      cancelled: 'var(--bg-subtle)',
      in_progress: 'var(--bg-tinted)',
      scheduled: 'var(--bg-tinted)',
    };
    return map[status] ?? 'var(--bg-subtle)';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      completed: 'Completada',
      absent: 'Inasistencia',
      no_show: 'No se presentó',
      cancelled: 'Cancelada',
      in_progress: 'En curso',
      scheduled: 'Agendada',
    };
    return map[status] ?? status;
  }

  /** Variant de app-badge para el pill de asistencia (el círculo de ícono sigue
   *  usando attBg/attColor — solo el pill de texto migra a app-badge). */
  attVariant(status: string | null): 'success' | 'warning' | 'error' | 'brand' | 'neutral' {
    if (status === 'present') return 'success';
    if (status === 'late') return 'warning';
    if (status === 'absent') return 'error';
    if (status === 'justified') return 'brand';
    return 'neutral';
  }

  attColor(status: string | null): string {
    if (status === 'present') return 'var(--state-success)';
    if (status === 'late') return 'var(--state-warning)';
    if (status === 'absent') return 'var(--state-error)';
    if (status === 'justified') return 'var(--ds-brand)';
    return 'var(--text-muted)';
  }

  attBg(status: string | null): string {
    if (status === 'present') return 'var(--state-success-bg)';
    if (status === 'late') return 'var(--state-warning-bg, var(--bg-subtle))';
    if (status === 'absent') return 'var(--state-error-bg)';
    if (status === 'justified') return 'var(--bg-tinted)';
    return 'var(--bg-subtle)';
  }

  attIcon(status: string | null): string {
    if (status === 'present') return 'check-circle';
    if (status === 'late') return 'clock-alert';
    if (status === 'absent') return 'x-circle';
    if (status === 'justified') return 'shield-check';
    return 'circle';
  }

  attLabel(status: string | null): string {
    if (status === 'present') return 'Presente';
    if (status === 'late') return 'Tardanza';
    if (status === 'absent') return 'Ausente';
    if (status === 'justified') return 'Justificada';
    return '—';
  }
}
