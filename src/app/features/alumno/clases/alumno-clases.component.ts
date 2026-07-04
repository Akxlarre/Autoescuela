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
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { TabsComponent } from '@shared/components/tabs/tabs.component';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';

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
    KpiCardVariantComponent,
    SkeletonBlockComponent,
    IconComponent,
    AlertCardComponent,
    TabsComponent,
  ],
  template: `
    <section class="bento-grid" appBentoReveal appBentoGridLayout aria-label="Mis clases">
      <!-- ── HERO ────────────────────────────────────────────────────────────── -->
      <app-section-hero
        class="bento-hero"
        icon="clipboard-list"
        title="Mis Clases"
        [contextLine]="heroContextLine()"
        [chips]="heroChips()"
        [actions]="[]"
        [animateOnInit]="false"
      />

      <!-- ── Selector de matrícula ──────────────────────────────────────────── -->
      @if (context.enrollments().length > 1) {
        <div class="bento-banner p-2">
          <app-tabs
            [tabs]="enrollmentTabs()"
            [activeId]="activeEnrollmentStr()"
            variant="pill"
            (activeIdChange)="selectEnrollment(+$event)"
          />
        </div>
      }

      <!-- ── KPIs ─────────────────────────────────────────────────────────────── -->
      <div class="bento-square">
        <app-kpi-card-variant
          [label]="licenseGroup() === 'class_b' ? 'Prácticas completadas' : 'Prácticas'"
          [value]="kpis()?.completedPractices ?? 0"
          [suffix]="licenseGroup() === 'class_b' ? '/12' : ''"
          icon="car"
          color="default"
          [accent]="true"
          [loading]="loading()"
        />
      </div>

      @if (licenseGroup() !== 'class_b') {
        <div class="bento-square">
          <app-kpi-card-variant
            label="Asistencia teoría"
            [value]="kpis()?.theoryPct ?? 0"
            suffix="%"
            icon="clipboard-check"
            [color]="theoryColor()"
            [loading]="loading()"
          />
        </div>
      }

      @if (licenseGroup() === 'class_b') {
        <div class="bento-square">
          <app-kpi-card-variant
            label="Próximas agendadas"
            [value]="kpis()?.scheduledUpcoming ?? 0"
            icon="calendar"
            color="default"
            [loading]="loading()"
          />
        </div>
      }

      <!-- ── PANEL PRINCIPAL ──────────────────────────────────────────────────── -->
      <div class="bento-banner card flex flex-col gap-4" appScrollReveal appCardHover>
        <!-- Tabs -->
        @if (!loading()) {
          <div class="p-1 self-start">
            <app-tabs
              [tabs]="viewTabs()"
              [activeId]="activeTab()"
              variant="segmented"
              (activeIdChange)="activeTab.set($any($event))"
            />
          </div>
        }

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
              <div class="flex flex-col divide-y" style="--tw-divide-opacity:1">
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
                        <span class="text-sm font-semibold text-text-primary truncate">
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
                    <span
                      class="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full"
                      [style.background]="statusBg(session.status)"
                      [style.color]="statusColor(session.status)"
                    >
                      {{ statusLabel(session.status) }}
                    </span>
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
              <div class="flex flex-col divide-y">
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
                      <span class="text-sm font-semibold text-text-primary">
                        {{ formatDate(s.date) }}
                      </span>
                      <span class="text-xs text-text-muted">Sesión práctica</span>
                    </div>
                    <span
                      class="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full"
                      [style.background]="attBg(s.attendanceStatus)"
                      [style.color]="attColor(s.attendanceStatus)"
                    >
                      {{ attLabel(s.attendanceStatus) }}
                    </span>
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
              <div class="flex flex-col divide-y">
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
                      <span class="text-sm font-semibold text-text-primary">
                        {{ formatDate(s.date) }}
                        @if (s.time) {
                          <span class="font-normal text-text-muted"> · {{ s.time }}</span>
                        }
                      </span>
                      <span class="text-xs text-text-muted">Sesión de teoría</span>
                    </div>
                    <span
                      class="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full"
                      [style.background]="attBg(s.attendanceStatus)"
                      [style.color]="attColor(s.attendanceStatus)"
                    >
                      {{ attLabel(s.attendanceStatus) }}
                    </span>
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
              <div class="flex flex-col divide-y">
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
                      <span class="text-sm font-semibold text-text-primary">
                        {{ formatDate(s.date) }}
                      </span>
                      <span class="text-xs text-text-muted">Sesión de teoría</span>
                    </div>
                    <span
                      class="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full"
                      [style.background]="attBg(s.attendanceStatus)"
                      [style.color]="attColor(s.attendanceStatus)"
                    >
                      {{ attLabel(s.attendanceStatus) }}
                    </span>
                  </div>
                }
              </div>
            }
          }
        }
      </div>

      <!-- ── ALERTA SIN MATRÍCULA ────────────────────────────────────────────── -->
      @if (!loading() && !facade.data()) {
        <div class="bento-banner" appScrollReveal>
          <app-alert-card severity="info" title="Sin matrícula activa" appAnimateIn>
            Aún no tienes un curso activo. Consulta a la secretaría para iniciar tu matrícula.
          </app-alert-card>
        </div>
      }
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
