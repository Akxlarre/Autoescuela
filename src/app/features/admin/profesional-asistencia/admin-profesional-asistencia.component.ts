import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { AsistenciaProfesionalFacade } from '@core/facades/asistencia-profesional.facade';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { DrawerComponent } from '@shared/components/drawer/drawer.component';
import { AdminSesionDrawerComponent } from './admin-sesion-drawer.component';
import type { SesionProfesional, WeekDay } from '@core/models/ui/sesion-profesional.model';

@Component({
  selector: 'app-admin-profesional-asistencia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    SkeletonBlockComponent,
    IconComponent,
    DrawerComponent,
    AdminSesionDrawerComponent,
  ],
  template: `
    <!-- ═══ Hero ═══ -->
    <app-section-hero
      title="Clases y Asistencia"
      subtitle="Gestión de sesiones teóricas y prácticas de Clase Profesional"
      [actions]="[]"
    />

    <!-- ═══ Filtros ═══ -->
    <section class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="mb-1 block text-xs font-medium text-secondary">Promoción</label>
        <p-select
          [options]="promoOptions()"
          optionLabel="name"
          optionValue="id"
          placeholder="Seleccionar promoción"
          [ngModel]="facade.selectedPromocionId()"
          (ngModelChange)="onPromoChange($event)"
          styleClass="w-full"
          [style]="{ height: '40px' }"
          data-llm-description="select promotion for attendance"
        />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-secondary">Curso</label>
        <p-select
          [options]="cursoOptions()"
          optionLabel="courseCode"
          optionValue="id"
          placeholder="Seleccionar curso"
          [ngModel]="facade.selectedCursoId()"
          (ngModelChange)="onCursoChange($event)"
          class="w-full"
          [style]="{ height: '40px' }"
          [disabled]="facade.cursos().length === 0"
          data-llm-description="select course for attendance"
        />
      </div>
    </section>

    <!-- ═══ KPIs ═══ -->
    <section class="grid grid-cols-2 gap-4 mt-6 md:grid-cols-4">
      <app-kpi-card-variant
        label="Alumnos matriculados"
        [value]="facade.alumnosMatriculados()"
        icon="users"
        [loading]="facade.isLoading()"
        data-llm-description="Alumnos inscritos en el curso seleccionado"
      />
      <app-kpi-card-variant
        label="Asistencia esta semana"
        [value]="facade.pctAsistenciaSemanal()"
        suffix="%"
        icon="bar-chart-2"
        color="success"
        [loading]="facade.isLoading()"
        data-llm-description="Porcentaje de asistencia de la semana visible"
      />
      <app-kpi-card-variant
        label="Asistencia total"
        [value]="facade.pctAsistenciaTotal()"
        suffix="%"
        icon="trending-up"
        [loading]="facade.isLoading()"
        data-llm-description="Porcentaje de asistencia acumulada del curso"
      />
      <app-kpi-card-variant
        label="Sesiones canceladas"
        [value]="facade.sesionesCanceladas()"
        icon="ban"
        color="warning"
        [loading]="facade.isLoading()"
        data-llm-description="Sesiones canceladas por feriados u otras razones"
      />
    </section>

    <!-- ═══ Navegación semanal ═══ -->
    <section class="mt-6 flex items-center justify-between">
      <button
        class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface"
        (click)="facade.prevWeek()"
        data-llm-action="previous-week"
      >
        <app-icon name="chevron-left" [size]="16" />
        Anterior
      </button>

      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-primary">{{ facade.weekLabel() }}</span>
        @if (!facade.isCurrentWeek()) {
          <button
            class="rounded-md bg-surface px-2 py-1 text-xs text-secondary transition-colors hover:bg-surface-elevated"
            (click)="facade.goToCurrentWeek()"
            data-llm-action="go-to-current-week"
          >
            Hoy
          </button>
        }
      </div>

      <button
        class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface"
        (click)="facade.nextWeek()"
        data-llm-action="next-week"
      >
        Siguiente
        <app-icon name="chevron-right" [size]="16" />
      </button>
    </section>

    <!-- ═══ Grilla semanal ═══ -->
    @if (facade.isLoading()) {
      <section class="mt-4 grid grid-cols-6 gap-3">
        @for (i of skeletonDays; track i) {
          <div class="rounded-xl border border-border bg-surface p-3">
            <app-skeleton-block variant="text" width="60%" height="14px" />
            <div class="mt-3 space-y-2">
              <app-skeleton-block variant="rect" width="100%" height="56px" />
              <app-skeleton-block variant="rect" width="100%" height="56px" />
            </div>
          </div>
        }
      </section>
    } @else if (facade.selectedCursoId()) {
      <section class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        @for (day of facade.weekDays(); track day.date) {
          <div
            class="day-column rounded-xl border p-3 transition-colors"
            [class.border-brand]="day.isToday"
            [class.bg-brand-muted]="day.isToday"
            [class.border-border]="!day.isToday"
            [class.bg-surface]="!day.isToday"
          >
            <div class="mb-2 text-center">
              <span class="text-xs font-medium text-secondary">{{ day.dayLabel }}</span>
              <p class="text-sm font-semibold text-primary">{{ day.label }}</p>
            </div>

            <!-- Teoría -->
            @if (day.theory; as session) {
              <button
                class="session-card mb-2 w-full rounded-lg border p-2 text-left transition-all hover:shadow-md"
                [class]="getSessionClasses(session)"
                (click)="openSesion(session)"
                data-llm-action="open-theory-session"
              >
                <div class="flex items-center gap-1">
                  <app-icon name="book-open" [size]="12" />
                  <span class="text-xs font-medium">Teoría</span>
                </div>
                @if (session.status === 'cancelled') {
                  <span class="mt-1 block text-xs text-muted">Cancelada</span>
                } @else {
                  <span class="mt-1 block text-xs text-secondary">
                    {{ session.attendanceCount }}/{{ session.enrolledCount }}
                  </span>
                }
              </button>
            }

            <!-- Práctica -->
            @if (day.practice; as session) {
              <button
                class="session-card w-full rounded-lg border p-2 text-left transition-all hover:shadow-md"
                [class]="getSessionClasses(session)"
                (click)="openSesion(session)"
                data-llm-action="open-practice-session"
              >
                <div class="flex items-center gap-1">
                  <app-icon name="wrench" [size]="12" />
                  <span class="text-xs font-medium">Práctica</span>
                </div>
                @if (session.status === 'cancelled') {
                  <span class="mt-1 block text-xs text-muted">Cancelada</span>
                } @else {
                  <span class="mt-1 block text-xs text-secondary">
                    {{ session.attendanceCount }}/{{ session.enrolledCount }}
                  </span>
                }
              </button>
            }

            @if (!day.theory && !day.practice) {
              <p class="py-4 text-center text-xs text-muted">Sin sesiones</p>
            }
          </div>
        }
      </section>
    } @else {
      <div class="mt-8 text-center">
        <app-icon name="calendar-check" [size]="48" color="var(--color-text-muted)" />
        <p class="mt-2 text-sm text-muted">
          Selecciona una promoción y curso para ver las sesiones
        </p>
      </div>
    }

    <!-- ═══ Resumen de asistencia por alumno ═══ -->
    @if (facade.selectedCursoId()) {
      <section class="mt-8">
        <div class="flex items-center gap-2 mb-3">
          <app-icon name="users" [size]="16" color="var(--ds-brand)" />
          <h2 class="text-sm font-semibold text-primary">Resumen de asistencia por alumno</h2>
          <span class="text-xs text-muted ml-1">(sesiones completadas)</span>
        </div>

        @if (facade.isLoadingResumen()) {
          <div class="card p-4 flex flex-col gap-3">
            @for (i of [1, 2, 3]; track i) {
              <app-skeleton-block variant="text" width="100%" height="36px" />
            }
          </div>
        } @else if (facade.resumenAlumnos().length === 0) {
          <div class="card p-8 text-center">
            <p class="text-sm text-muted">No hay alumnos matriculados en este curso.</p>
          </div>
        } @else {
          <div class="card overflow-hidden">
            <table class="resumen-table w-full">
              <thead>
                <tr>
                  <th class="text-left">Alumno</th>
                  <th class="text-center">Teoría</th>
                  <th class="text-center">% Teoría</th>
                  <th class="text-center">Práctica</th>
                  <th class="text-center">% Práctica</th>
                </tr>
              </thead>
              <tbody>
                @for (alumno of facade.resumenAlumnos(); track alumno.studentId) {
                  <tr>
                    <td>
                      <div class="flex items-center gap-2">
                        <div class="initials-avatar">{{ alumno.initials }}</div>
                        <div>
                          <p class="text-sm font-medium text-primary">{{ alumno.nombre }}</p>
                          <p class="text-xs text-muted">{{ alumno.rut }}</p>
                        </div>
                      </div>
                    </td>
                    <td class="text-center text-sm text-secondary">
                      {{ alumno.teoriaAsistida }}/{{ alumno.teoriaTotal }}
                    </td>
                    <td class="text-center">
                      <span
                        class="pct-badge"
                        [class.pct-ok]="alumno.pctTeoria >= 75"
                        [class.pct-warn]="alumno.pctTeoria >= 50 && alumno.pctTeoria < 75"
                        [class.pct-danger]="alumno.pctTeoria < 50"
                      >
                        {{ alumno.pctTeoria }}%
                      </span>
                    </td>
                    <td class="text-center text-sm text-secondary">
                      {{ alumno.practicaAsistida }}/{{ alumno.practicaTotal }}
                    </td>
                    <td class="text-center">
                      <span
                        class="pct-badge"
                        [class.pct-ok]="alumno.pctPractica >= 75"
                        [class.pct-warn]="alumno.pctPractica >= 50 && alumno.pctPractica < 75"
                        [class.pct-danger]="alumno.pctPractica < 50"
                      >
                        {{ alumno.pctPractica }}%
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }

    <!-- ═══ Drawer de sesión ═══ -->
    <app-drawer
      [isOpen]="drawerOpen()"
      [title]="drawerTitle()"
      icon="clipboard-list"
      (closed)="closeDrawer()"
    >
      @if (facade.selectedSesion(); as sesion) {
        <app-admin-sesion-drawer (closed)="closeDrawer()" />
      }
    </app-drawer>
  `,
  styles: `
    .session-card {
      cursor: pointer;
    }
    .session-scheduled {
      border-color: var(--color-border);
      background: var(--color-bg-surface);
    }
    .session-completed {
      border-color: var(--color-success);
      background: color-mix(in srgb, var(--color-success) 8%, transparent);
    }
    .session-in_progress {
      border-color: var(--ds-brand);
      background: color-mix(in srgb, var(--ds-brand) 8%, transparent);
    }
    .session-cancelled {
      border-color: var(--color-border);
      background: var(--color-bg-surface);
      opacity: 0.5;
    }
    .session-future {
      border-color: var(--color-border);
      background: var(--color-bg-surface);
      opacity: 0.6;
      cursor: pointer;
    }
    .day-column {
      min-height: 120px;
    }

    .resumen-table {
      border-collapse: collapse;
    }
    .resumen-table th {
      padding: 10px 16px;
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-elevated);
    }
    .resumen-table td {
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .resumen-table tr:last-child td {
      border-bottom: none;
    }
    .resumen-table tr:hover td {
      background: var(--bg-elevated);
    }

    .initials-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
      background: var(--color-primary-tint);
      color: var(--color-primary);
    }

    .pct-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: var(--text-xs);
      font-weight: 600;
    }
    .pct-ok {
      background: color-mix(in srgb, var(--state-success) 12%, transparent);
      color: var(--state-success);
    }
    .pct-warn {
      background: color-mix(in srgb, var(--state-warning) 12%, transparent);
      color: var(--state-warning);
    }
    .pct-danger {
      background: color-mix(in srgb, var(--state-error) 12%, transparent);
      color: var(--state-error);
    }
    .border-brand {
      border-color: var(--ds-brand);
    }
    .bg-brand-muted {
      background: color-mix(in srgb, var(--ds-brand) 4%, var(--color-bg-surface));
    }
  `,
})
export class AdminProfesionalAsistenciaComponent implements OnInit {
  readonly facade = inject(AsistenciaProfesionalFacade);

  readonly drawerOpen = signal(false);
  readonly skeletonDays = [1, 2, 3, 4, 5, 6];

  readonly promoOptions = computed(() =>
    this.facade.promociones().map((p) => ({
      ...p,
      name: `${p.name} (${p.code})`,
    })),
  );

  readonly cursoOptions = computed(() =>
    this.facade.cursos().map((c) => ({
      ...c,
      courseCode: `${c.courseCode} — ${c.courseName}`,
    })),
  );

  readonly drawerTitle = computed(() => {
    const sesion = this.facade.selectedSesion();
    if (!sesion) return 'Sesión';
    const tipo = sesion.tipo === 'theory' ? 'Teoría' : 'Práctica';
    return `${tipo} — ${this.formatDate(sesion.date)}`;
  });

  ngOnInit(): void {
    void this.facade.initialize();
  }

  onPromoChange(id: number): void {
    void this.facade.selectPromocion(id);
  }

  onCursoChange(id: number): void {
    void this.facade.selectCurso(id);
  }

  openSesion(sesion: SesionProfesional): void {
    void this.facade.selectSesion(sesion);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.facade.clearSelectedSesion();
  }

  getSessionClasses(session: SesionProfesional): string {
    const today = new Date().toISOString().slice(0, 10);
    if (session.date > today) return 'session-future';
    return `session-${session.status}`;
  }

  private formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthNames = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
  }
}
