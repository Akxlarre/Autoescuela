import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { StatBoxComponent, StatBoxVariant } from '@shared/components/stat-box/stat-box.component';
import { AdminPromocionEditarDrawerComponent } from './admin-promocion-editar-drawer.component';

const COURSE_COLORS: Record<string, string> = {
  A2: '#3b82f6',
  A3: '#8b5cf6',
  A4: '#f59e0b',
  A5: '#10b981',
};

const STATUS_CONFIG: Record<string, { label: string; variant: StatBoxVariant }> = {
  planned: { label: 'Planificada', variant: 'brand' },
  in_progress: { label: 'En curso', variant: 'success' },
  finished: { label: 'Finalizada', variant: 'surface' },
  cancelled: { label: 'Cancelada', variant: 'error' },
};

@Component({
  selector: 'app-admin-promocion-ver-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, StatBoxComponent],
  template: `
    @if (promo(); as p) {
      <div class="flex flex-col gap-6 p-1">
        <!-- ── Header ──────────────────────────────────────────────── -->
        <div>
          <div class="flex items-center gap-3 mb-2">
            <h2 class="text-lg font-semibold" style="color: var(--text-primary)">
              {{ p.name }}
            </h2>
            <span
              class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              [style.background]="statusPillStyle(p.status).bg"
              [style.color]="statusPillStyle(p.status).color"
            >
              {{ statusCfg(p.status).label }}
            </span>
          </div>
          <div class="flex items-center gap-3 flex-wrap">
            <span
              class="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded"
              style="background: var(--bg-elevated); color: var(--text-muted);"
            >
              {{ p.code }}
            </span>
            <span class="text-xs" style="color: var(--text-muted)">
              {{ formatDate(p.startDate) }} → {{ formatDate(p.endDate) }}
            </span>
          </div>
        </div>

        <!-- ── Status banner ───────────────────────────────────────── -->
        @if (p.status === 'in_progress') {
          <div
            class="rounded-lg p-4"
            style="
              background: color-mix(in srgb, var(--ds-brand) 6%, transparent);
              border: 1px solid color-mix(in srgb, var(--ds-brand) 20%, transparent);
            "
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium" style="color: var(--text-primary)">
                Día de clase {{ p.currentDay }} de 30
              </span>
              <span class="text-sm font-semibold" style="color: var(--ds-brand)">
                {{ progressPercent() }}%
              </span>
            </div>
            <div
              class="w-full rounded-full overflow-hidden"
              style="height: 8px; background: var(--bg-elevated);"
            >
              <div
                class="h-full rounded-full"
                style="background: var(--ds-brand);"
                [style.width.%]="progressPercent()"
              ></div>
            </div>
          </div>
        }

        @if (p.status === 'finished') {
          <div
            class="rounded-lg p-4 flex items-center gap-3"
            style="
              background: color-mix(in srgb, var(--state-success) 6%, transparent);
              border: 1px solid color-mix(in srgb, var(--state-success) 20%, transparent);
            "
          >
            <app-icon name="check-circle" [size]="20" color="var(--state-success)" />
            <div>
              <p class="text-sm font-medium" style="color: var(--text-primary)">
                Promoción completada
              </p>
              <p class="text-xs" style="color: var(--text-muted)">
                Esta promoción finalizó el {{ formatDate(p.endDate) }}. Se completaron los 30 días
                de clase (lun-sáb) con {{ p.totalEnrolled }} alumnos inscritos.
              </p>
            </div>
          </div>
        }

        <!-- ── Info general ────────────────────────────────────────── -->
        <div>
          <h3 class="text-xs font-bold uppercase tracking-widest mb-3" style="color: var(--text-muted)">
            Información general
          </h3>
          <div class="grid grid-cols-2 gap-3">
            <app-stat-box label="Código" [value]="p.code" variant="surface" [compact]="true" [useMono]="true" />
            <app-stat-box
              label="Estado"
              [value]="statusCfg(p.status).label"
              [variant]="statusCfg(p.status).variant"
              [compact]="true"
            />
            <app-stat-box label="Inicio" [value]="formatDate(p.startDate)" variant="surface" [compact]="true" />
            <app-stat-box label="Fin" [value]="formatDate(p.endDate)" variant="surface" [compact]="true" />
            <app-stat-box
              label="Duración"
              value="30 días"
              suffix="clase"
              variant="surface"
              [compact]="true"
              class="col-span-2"
            />
            <app-stat-box
              label="Alumnos"
              [value]="p.totalEnrolled"
              [suffix]="'/ ' + p.maxStudents"
              [variant]="p.totalEnrolled >= p.maxStudents ? 'error' : 'success'"
              [compact]="true"
              class="col-span-2"
            />
          </div>
        </div>

        <!-- ── Alumnos por categoría ───────────────────────────────── -->
        <div>
          <h3 class="text-xs font-bold uppercase tracking-widest mb-3" style="color: var(--text-muted)">
            Alumnos por categoría
          </h3>
          <div class="grid grid-cols-2 gap-3">
            @for (curso of p.cursos; track curso.id) {
              <app-stat-box
                [label]="curso.courseCode"
                [value]="curso.enrolledStudents"
                [suffix]="'/ ' + curso.maxStudents"
                [variant]="curso.enrolledStudents >= curso.maxStudents ? 'error' : 'default'"
                [compact]="true"
              />
            }
          </div>
        </div>

        <!-- ── Cursos de la promoción ──────────────────────────────── -->
        <div>
          <h3 class="text-sm font-semibold mb-3" style="color: var(--text-primary)">
            Cursos de la promoción
          </h3>
          <div class="flex flex-col gap-3">
            @for (curso of p.cursos; track curso.id) {
              <div
                class="rounded-lg p-4"
                [style.borderLeft]="'3px solid ' + courseColor(curso.courseCode)"
                style="border: 1px solid var(--border-subtle);"
              >
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex items-center justify-center min-w-[26px] px-1.5 py-0.5 rounded text-[11px] font-bold text-white"
                      [style.background]="courseColor(curso.courseCode)"
                    >
                      {{ curso.courseCode }}
                    </span>
                    <span class="text-sm" style="color: var(--text-muted)">
                      {{ curso.courseName }}
                    </span>
                  </div>
                </div>

                <!-- Relatores -->
                <div class="mb-3">
                  <p class="text-[10px] font-semibold mb-1.5" style="color: var(--ds-brand)">
                    Relatores
                  </p>
                  @if (curso.relatores.length > 0) {
                    @for (rel of curso.relatores; track rel.id) {
                      <div class="flex items-center gap-2 mb-1.5">
                        <div
                          class="flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold shrink-0"
                          style="
                            background: var(--color-primary-tint);
                            color: var(--color-primary);
                          "
                        >
                          {{ rel.initials }}
                        </div>
                        <div>
                          <span class="text-sm" style="color: var(--text-primary)">
                            {{ rel.nombre }}
                          </span>
                          @if (rel.role) {
                            <span
                              class="text-[10px] ml-1 px-1.5 py-0.5 rounded"
                              style="background: var(--bg-elevated); color: var(--text-muted);"
                            >
                              {{ roleLabel(rel.role) }}
                            </span>
                          }
                        </div>
                      </div>
                    }
                  } @else {
                    <p class="text-xs italic" style="color: var(--text-muted)">
                      Sin relator asignado
                    </p>
                  }
                </div>

                <!-- Alumnos bar + expandable list -->
                <div>
                  <button
                    class="students-toggle"
                    (click)="toggleStudents(curso.id)"
                    data-llm-action="toggle-alumnos-curso"
                  >
                    <div class="flex items-center gap-1.5">
                      <app-icon name="users" [size]="12" color="var(--ds-brand)" />
                      <span class="text-[11px] font-semibold" style="color: var(--ds-brand)">
                        Alumnos
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs" style="color: var(--text-secondary)">
                        {{ curso.enrolledStudents }} / {{ curso.maxStudents }}
                      </span>
                      <app-icon
                        [name]="isExpanded(curso.id) ? 'chevron-up' : 'chevron-down'"
                        [size]="14"
                        color="var(--text-muted)"
                      />
                    </div>
                  </button>

                  <div
                    class="w-full rounded-full overflow-hidden mb-2"
                    style="height: 6px; background: var(--bg-elevated);"
                  >
                    <div
                      class="h-full rounded-full"
                      [style.background]="courseColor(curso.courseCode)"
                      [style.width.%]="enrollPercent(curso)"
                    ></div>
                  </div>

                  @if (isExpanded(curso.id)) {
                    <div class="student-list">
                      @if (facade.isLoadingStudents()) {
                        @for (i of [1, 2, 3]; track i) {
                          <div class="flex items-center gap-2 py-2">
                            <app-skeleton-block variant="circle" width="28px" height="28px" />
                            <div class="flex-1">
                              <app-skeleton-block variant="text" width="70%" height="12px" />
                              <app-skeleton-block
                                variant="text"
                                width="40%"
                                height="10px"
                                style="margin-top: 4px"
                              />
                            </div>
                          </div>
                        }
                      } @else {
                        @if (getStudents(curso.id).length === 0) {
                          <p
                            class="text-xs italic py-2 text-center"
                            style="color: var(--text-muted)"
                          >
                            Sin alumnos inscritos en este curso
                          </p>
                        } @else {
                          @for (alumno of getStudents(curso.id); track alumno.enrollmentId) {
                            <div
                              class="flex items-center gap-2.5 py-2"
                              style="border-bottom: 1px solid var(--border-subtle);"
                            >
                              <div
                                class="flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold shrink-0"
                                style="
                                  background: var(--bg-elevated);
                                  color: var(--text-secondary);
                                "
                              >
                                {{ alumno.initials }}
                              </div>
                              <div class="flex-1 min-w-0">
                                <p
                                  class="text-xs font-medium truncate"
                                  style="color: var(--text-primary)"
                                >
                                  {{ alumno.nombre }}
                                </p>
                                <p class="text-[10px] font-mono" style="color: var(--text-muted)">
                                  {{ alumno.rut }}
                                </p>
                              </div>
                              <span
                                class="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                                [style.background]="enrollStatusBg(alumno.enrollmentStatus)"
                                [style.color]="enrollStatusColor(alumno.enrollmentStatus)"
                              >
                                {{ enrollStatusLabel(alumno.enrollmentStatus) }}
                              </span>
                            </div>
                          }
                        }
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- ── Acciones ────────────────────────────────────────────── -->
        <div
          class="flex items-center gap-3 pt-4"
          style="border-top: 1px solid var(--border-subtle);"
        >
          <button
            class="btn-outline flex items-center gap-2"
            (click)="editar()"
            data-llm-action="editar-promocion"
          >
            <app-icon name="edit" [size]="14" />
            Editar promoción
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .btn-outline {
      padding: 7px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-family: inherit;
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .btn-outline:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
    }

    .students-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0;
      margin-bottom: 6px;
      border: none;
      background: none;
      cursor: pointer;
      font-family: inherit;
    }
    .students-toggle:hover {
      opacity: 0.8;
    }

    .student-list {
      padding: 4px 0 0;
      max-height: 240px;
      overflow-y: auto;
    }
  `,
})
export class AdminPromocionVerDrawerComponent {
  protected readonly facade = inject(PromocionesFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly promo = this.facade.selectedPromocion;

  // ── Expand/collapse state per course ────────────────────────────────────
  private readonly _expandedCourses = signal<Set<number>>(new Set());

  protected readonly progressPercent = computed(() => {
    const p = this.promo();
    if (!p) return 0;
    return Math.round((p.currentDay / 30) * 100);
  });

  protected isExpanded(cursoId: number): boolean {
    return this._expandedCourses().has(cursoId);
  }

  protected toggleStudents(cursoId: number): void {
    const current = new Set(this._expandedCourses());
    if (current.has(cursoId)) {
      current.delete(cursoId);
    } else {
      current.add(cursoId);
    }
    this._expandedCourses.set(current);
  }

  protected getStudents(cursoId: number) {
    return this.facade.cursoStudents()[cursoId] ?? [];
  }

  protected statusCfg(status: string): { label: string; variant: StatBoxVariant } {
    return STATUS_CONFIG[status] ?? STATUS_CONFIG['planned'];
  }

  protected statusPillStyle(status: string): { bg: string; color: string } {
    const cfg = this.statusCfg(status);
    if (cfg.variant === 'surface') {
      return { bg: 'var(--bg-elevated)', color: 'var(--text-muted)' };
    }
    return {
      bg: `color-mix(in srgb, var(--state-${cfg.variant}) 12%, transparent)`,
      color: `var(--state-${cfg.variant})`,
    };
  }

  protected courseColor(code: string): string {
    return COURSE_COLORS[code] ?? '#6b7280';
  }

  protected enrollPercent(curso: { enrolledStudents: number; maxStudents: number }): number {
    return curso.maxStudents > 0
      ? Math.round((curso.enrolledStudents / curso.maxStudents) * 100)
      : 0;
  }

  protected roleLabel(role: string): string {
    const labels: Record<string, string> = {
      theory: 'Teoría',
      practice: 'Práctica',
      both: 'Teoría y práctica',
    };
    return labels[role] ?? '';
  }

  protected enrollStatusLabel(status: string): string {
    const map: Record<string, string> = {
      active: 'Activo',
      completed: 'Completado',
      inactive: 'Inactivo',
      pending_payment: 'Pago pendiente',
    };
    return map[status] ?? status;
  }

  protected enrollStatusBg(status: string): string {
    const map: Record<string, string> = {
      active: 'color-mix(in srgb, var(--state-success) 12%, transparent)',
      completed: 'var(--bg-elevated)',
      inactive: 'color-mix(in srgb, var(--state-error) 12%, transparent)',
      pending_payment: 'color-mix(in srgb, var(--state-warning) 12%, transparent)',
    };
    return map[status] ?? 'var(--bg-elevated)';
  }

  protected enrollStatusColor(status: string): string {
    const map: Record<string, string> = {
      active: 'var(--state-success)',
      completed: 'var(--text-muted)',
      inactive: 'var(--state-error)',
      pending_payment: 'var(--state-warning)',
    };
    return map[status] ?? 'var(--text-muted)';
  }

  protected formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  protected editar(): void {
    this.layoutDrawer.open(AdminPromocionEditarDrawerComponent, 'Editar promoción', 'edit');
  }
}
