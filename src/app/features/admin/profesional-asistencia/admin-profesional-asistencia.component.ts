import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { AsistenciaProfesionalFacade } from '@core/facades/asistencia-profesional.facade';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AdminSesionDrawerComponent } from './admin-sesion-drawer.component';
import type { SesionProfesional } from '@core/models/ui/sesion-profesional.model';

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
    <section class="bento-grid mt-6">
      <div class="bento-square">
        <app-kpi-card-variant
          label="Alumnos matriculados"
          [value]="facade.alumnosMatriculados()"
          icon="users"
          [loading]="facade.isLoading()"
          data-llm-description="Alumnos inscritos en el curso seleccionado"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Asistencia esta semana"
          [value]="facade.pctAsistenciaSemanal()"
          suffix="%"
          icon="bar-chart-2"
          color="success"
          [loading]="facade.isLoading()"
          data-llm-description="Porcentaje de asistencia de la semana visible"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Asistencia total"
          [value]="facade.pctAsistenciaTotal()"
          suffix="%"
          icon="trending-up"
          [loading]="facade.isLoading()"
          data-llm-description="Porcentaje de asistencia acumulada del curso"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Sesiones canceladas"
          [value]="facade.sesionesCanceladas()"
          icon="ban"
          color="warning"
          [loading]="facade.isLoading()"
          data-llm-description="Sesiones canceladas por feriados u otras razones"
        />
      </div>
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

    <!-- ═══ Firma Semanal ═══ -->
    @if (facade.selectedCursoId()) {
      <section class="mt-8">
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <app-icon name="pen-line" [size]="16" color="var(--ds-brand)" />
            <h2 class="text-sm font-semibold text-primary">Firma semanal de asistencia teórica</h2>
            <span class="text-xs text-muted ml-1">{{ facade.weekLabel() }}</span>
          </div>
          @if (!facade.isLoadingFirmas()) {
            <span class="text-xs font-medium text-secondary">
              {{ facade.firmasSemanaCount().firmaron }}/{{ facade.firmasSemanaCount().total }}
              firmaron
            </span>
          }
        </div>

        @if (facade.isLoadingFirmas()) {
          <div class="card p-4 flex flex-col gap-3">
            @for (i of [1, 2, 3]; track i) {
              <app-skeleton-block variant="text" width="100%" height="36px" />
            }
          </div>
        } @else if (facade.firmasSemana().length === 0) {
          <div class="card p-8 text-center">
            <p class="text-sm text-muted">No hay alumnos matriculados en este curso.</p>
          </div>
        } @else {
          <div class="card overflow-hidden">
            <table class="resumen-table w-full">
              <thead>
                <tr>
                  <th class="text-left">Alumno</th>
                  <th class="text-center">% Teoría esta semana</th>
                  <th class="text-center">Estado firma</th>
                  <th class="text-center">
                    @if (facade.firmasSemana().some((a) => a.signatureId === null)) {
                      <label class="flex items-center gap-1 cursor-pointer justify-center">
                        <input
                          type="checkbox"
                          [checked]="allPendingSelected()"
                          (change)="toggleSelectAll()"
                          data-llm-description="Seleccionar todos los alumnos sin firma"
                          class="cursor-pointer"
                        />
                        <span
                          style="font-size: inherit; font-weight: inherit; letter-spacing: inherit; color: inherit;"
                          >Marcar todos</span
                        >
                      </label>
                    }
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (alumno of facade.firmasSemana(); track alumno.enrollmentId) {
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
                    <td class="text-center">
                      @if (
                        alumno.pctTeoriaSemana === 0 &&
                        facade.weekDays()[0]?.theory === null &&
                        facade.weekDays()[1]?.theory === null
                      ) {
                        <span class="text-xs text-muted">Sin sesiones</span>
                      } @else {
                        <span
                          class="pct-badge"
                          [class.pct-ok]="alumno.pctTeoriaSemana >= 75"
                          [class.pct-warn]="
                            alumno.pctTeoriaSemana >= 50 && alumno.pctTeoriaSemana < 75
                          "
                          [class.pct-danger]="alumno.pctTeoriaSemana < 50"
                        >
                          {{ alumno.pctTeoriaSemana }}%
                        </span>
                      }
                    </td>
                    <td class="text-center">
                      @if (alumno.signatureId !== null) {
                        <span class="firma-badge firma-ok">
                          <app-icon name="check-circle" [size]="12" />
                          Firmó {{ formatSignedAt(alumno.signedAt) }}
                        </span>
                      } @else {
                        <span class="firma-badge firma-pending">Sin firma</span>
                      }
                    </td>
                    <td class="text-center">
                      @if (alumno.signatureId === null) {
                        <input
                          type="checkbox"
                          [checked]="isSelected(alumno.enrollmentId)"
                          (change)="toggleSelect(alumno.enrollmentId)"
                          data-llm-action="select-student-for-signature"
                          class="cursor-pointer"
                        />
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            @if (selectedForSign().length > 0) {
              <div
                class="flex items-center justify-between border-t border-border px-4 py-3 bg-surface"
              >
                <span class="text-xs text-secondary">
                  {{ selectedForSign().length }} alumno{{
                    selectedForSign().length > 1 ? 's' : ''
                  }}
                  seleccionado{{ selectedForSign().length > 1 ? 's' : '' }}
                </span>
                <button
                  class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
                  style="background: var(--ds-brand); color: #fff;"
                  [disabled]="facade.isSaving()"
                  (click)="onRegistrarFirmas()"
                  data-llm-action="register-weekly-signatures"
                >
                  <app-icon name="pen-line" [size]="14" />
                  Registrar firma{{ selectedForSign().length > 1 ? 's' : '' }}
                </button>
              </div>
            }
          </div>
        }
      </section>
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

    .firma-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: var(--text-xs);
      font-weight: 600;
    }
    .firma-ok {
      background: color-mix(in srgb, var(--state-success) 12%, transparent);
      color: var(--state-success);
    }
    .firma-pending {
      background: var(--color-bg-surface-elevated, var(--bg-elevated));
      color: var(--text-muted);
    }
  `,
})
export class AdminProfesionalAsistenciaComponent implements OnInit {
  readonly facade = inject(AsistenciaProfesionalFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  readonly skeletonDays = [1, 2, 3, 4, 5, 6];

  // ── Firma semanal — estado de selección local ──────────────────────────────
  readonly selectedForSign = signal<number[]>([]);

  readonly allPendingSelected = computed(() => {
    const pending = this.facade.firmasSemana().filter((a) => a.signatureId === null);
    return (
      pending.length > 0 && pending.every((a) => this.selectedForSign().includes(a.enrollmentId))
    );
  });

  readonly somePendingSelected = computed(() => {
    const sel = this.selectedForSign();
    return sel.length > 0 && !this.allPendingSelected();
  });

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

  constructor() {
    // Recargar firmas cada vez que el usuario navega a otra semana
    effect(() => {
      const _week = this.facade.weekOffset();
      if (this.facade.selectedCursoId()) {
        this.selectedForSign.set([]);
        void this.facade.fetchFirmasSemana();
      }
    });
  }

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
    const tipo = sesion.tipo === 'theory' ? 'Teoría' : 'Práctica';
    const title = `${tipo} — ${this.formatDate(sesion.date)}`;
    this.layoutDrawer.open(AdminSesionDrawerComponent, title, 'clipboard-list');
  }

  closeDrawer(): void {
    this.layoutDrawer.close();
    this.facade.clearSelectedSesion();
  }

  getSessionClasses(session: SesionProfesional): string {
    const today = new Date().toISOString().slice(0, 10);
    if (session.date > today) return 'session-future';
    return `session-${session.status}`;
  }

  // ── Firma semanal ───────────────────────────────────────────────────────────

  isSelected(enrollmentId: number): boolean {
    return this.selectedForSign().includes(enrollmentId);
  }

  toggleSelect(enrollmentId: number): void {
    this.selectedForSign.update((ids) =>
      ids.includes(enrollmentId) ? ids.filter((id) => id !== enrollmentId) : [...ids, enrollmentId],
    );
  }

  toggleSelectAll(): void {
    const pending = this.facade
      .firmasSemana()
      .filter((a) => a.signatureId === null)
      .map((a) => a.enrollmentId);
    this.selectedForSign.set(this.allPendingSelected() ? [] : pending);
  }

  async onRegistrarFirmas(): Promise<void> {
    const ids = this.selectedForSign();
    const ok = await this.facade.registrarFirmas(ids);
    if (ok) this.selectedForSign.set([]);
  }

  formatSignedAt(signedAt: string | null): string {
    if (!signedAt) return '';
    const d = new Date(signedAt);
    const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    return `${dayNames[d.getDay()]} ${d.getDate()}`;
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
