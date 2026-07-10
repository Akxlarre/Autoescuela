import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RelatoresFacade } from '@core/facades/relatores.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { StatBoxComponent } from '@shared/components/stat-box/stat-box.component';
import { AdminRelatorEditarDrawerComponent } from './admin-relator-editar-drawer.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

const SPEC_COLORS: Record<string, string> = {
  A2: '#3b82f6',
  A3: '#8b5cf6',
  A4: '#f59e0b',
  A5: '#10b981',
};

const SPEC_LABELS: Record<string, string> = {
  A2: 'Taxis y colectivos',
  A3: 'Buses',
  A4: 'Carga simple',
  A5: 'Carga profesional',
};

@Component({
  selector: 'app-admin-relator-ver-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    StatBoxComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
  ],
  template: `
    @if (facade.selectedRelator(); as rel) {
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-5">
            <div class="flex items-center gap-4">
              <app-skeleton-block variant="circle" width="56px" height="56px" />
              <div class="flex flex-col gap-2 flex-1">
                <app-skeleton-block variant="text" width="70%" height="18px" />
                <app-skeleton-block variant="text" width="40%" height="13px" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <app-skeleton-block variant="text" width="100%" height="60px" />
              <app-skeleton-block variant="text" width="100%" height="60px" />
              <app-skeleton-block variant="text" width="100%" height="60px" class="col-span-2" />
            </div>
            <app-skeleton-block variant="text" width="100%" height="80px" />
          </div>
        </ng-template>
        <ng-template #content>
          <app-drawer-form>
            <!-- ── Avatar + nombre ─────────────────────────────────────────────── -->
            <div class="flex items-center gap-4 mb-6">
              <div
                class="flex items-center justify-center w-14 h-14 rounded-full shrink-0 text-base font-bold bg-brand-tint text-brand"
              >
                {{ rel.initials }}
              </div>
              <div>
                <h2 class="text-base font-semibold text-text-primary">
                  {{ rel.nombre }}
                </h2>
                <p class="text-xs mt-0.5 text-text-muted">{{ rel.rut }}</p>
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                  @for (spec of rel.specializations; track spec) {
                    <span class="spec-badge" [style.background]="specColor(spec)">{{ spec }}</span>
                  }
                  @if (rel.estado === 'activo') {
                    <app-badge variant="success">
                      <app-icon name="check-circle" [size]="10" />
                      Activo
                    </app-badge>
                  } @else {
                    <app-badge variant="neutral">Inactivo</app-badge>
                  }
                </div>
              </div>
            </div>

            <!-- ── Información personal ───────────────────────────────────────── -->
            <h3 class="section-title">Información Personal</h3>
            <div class="grid grid-cols-2 gap-3 mb-6">
              <app-stat-box
                label="RUT"
                [value]="rel.rut"
                variant="surface"
                [compact]="true"
                icon="id-card"
              />
              <app-stat-box
                label="TELÉFONO"
                [value]="rel.phone || '—'"
                variant="surface"
                [compact]="true"
                icon="phone"
              />
              <app-stat-box
                label="CORREO ELECTRÓNICO"
                [value]="rel.email || '—'"
                variant="surface"
                [compact]="true"
                icon="at-sign"
                class="col-span-2"
              />
            </div>

            <!-- ── Especialidades ─────────────────────────────────────────────── -->
            <h3 class="section-title">Especialidades</h3>
            <div class="flex flex-col gap-2 mb-6">
              @for (spec of rel.specializations; track spec) {
                <div
                  class="flex items-center gap-3 p-3 rounded-lg bg-elevated border border-border-subtle"
                >
                  <span class="spec-badge" [style.background]="specColor(spec)">{{ spec }}</span>
                  <span class="text-sm text-text-primary">{{ specLabel(spec) }}</span>
                </div>
              } @empty {
                <p class="text-sm text-text-muted">Sin especialidades registradas.</p>
              }
            </div>

            <!-- ── Info registro ───────────────────────────────────────────────── -->
            @if (rel.registrationDate) {
              <div
                class="flex items-center gap-2 p-3 rounded-lg mb-6 bg-elevated border border-border-subtle"
              >
                <app-icon name="calendar" [size]="14" color="var(--text-muted)" />
                <span class="text-xs text-text-muted">
                  Fecha de registro: {{ rel.registrationDate }}
                </span>
              </div>
            }

            <!-- ── Cursos asignados ───────────────────────────────────────────── -->
            <h3 class="section-title">
              Cursos asignados
              @if (!facade.isLoadingCursos() && facade.cursosAsignados().length > 0) {
                <app-badge variant="brand" class="ml-2">{{
                  facade.cursosAsignados().length
                }}</app-badge>
              }
            </h3>

            @if (facade.isLoadingCursos()) {
              <div class="flex flex-col gap-3 mb-6">
                @for (_ of [1, 2]; track $index) {
                  <div class="flex items-center gap-3 p-3 rounded-lg border border-border-subtle">
                    <app-skeleton-block variant="rect" width="28px" height="22px" />
                    <div class="flex-1 flex flex-col gap-1.5">
                      <app-skeleton-block variant="text" width="160px" height="13px" />
                      <app-skeleton-block variant="text" width="100px" height="11px" />
                    </div>
                    <app-skeleton-block variant="rect" width="60px" height="20px" />
                  </div>
                }
              </div>
            } @else if (facade.cursosAsignados().length === 0) {
              <div
                class="flex items-center gap-2 p-4 rounded-lg mb-6 bg-elevated border border-border-subtle"
              >
                <app-icon name="calendar-x" [size]="15" color="var(--text-muted)" />
                <span class="text-sm text-text-muted"> Sin cursos asignados actualmente. </span>
              </div>
            } @else {
              <!-- Cabecera tabla -->
              <div class="courses-header mb-1">
                <span>PROMOCIÓN</span>
                <span>CURSO</span>
                <span>ALUMNOS</span>
                <span>ESTADO</span>
              </div>
              <div
                class="flex flex-col mb-6 border border-border-subtle overflow-hidden"
                style="border-radius: var(--radius-md)"
              >
                @for (curso of facade.cursosAsignados(); track curso.id; let last = $last) {
                  <div
                    class="courses-row"
                    [style.border-bottom]="last ? 'none' : '1px solid var(--border-subtle)'"
                  >
                    <!-- Promoción -->
                    <div class="flex flex-col min-w-0">
                      <span class="text-xs font-semibold truncate text-text-primary">
                        {{ curso.promotionName }}
                      </span>
                      <span class="text-xs text-text-muted">
                        Código: {{ curso.promotionCode }}
                      </span>
                    </div>

                    <!-- Curso badge -->
                    <div class="flex flex-col gap-0.5">
                      <span class="spec-badge" [style.background]="specColor(curso.courseCode)">
                        {{ curso.courseCode }}
                      </span>
                      @if (curso.role) {
                        <span class="text-xs text-text-muted whitespace-nowrap">
                          {{ roleLabel(curso.role) }}
                        </span>
                      }
                    </div>

                    <!-- Alumnos -->
                    <span class="text-xs text-text-secondary">
                      {{ curso.enrolledStudents }} / {{ curso.maxStudents }}
                    </span>

                    <!-- Estado -->
                    <span
                      class="status-badge"
                      [class]="'status-badge--' + (curso.status ?? 'planned')"
                    >
                      {{ statusLabel(curso.status) }}
                    </span>
                  </div>
                }
              </div>
            }

            <!-- ── Acciones ───────────────────────────────────────────────────── -->
            <ng-container ngProjectAs="[drawer-form-footer]">
              <button
                class="btn-primary flex items-center gap-2"
                (click)="editar()"
                data-llm-action="editar-relator"
              >
                <app-icon name="edit" [size]="15" />
                Editar relator
              </button>
            </ng-container>
          </app-drawer-form>
        </ng-template>
      </app-drawer-content-loader>
    }
  `,
  styles: `
    .section-title {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .spec-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      color: white;
    }

    .courses-header {
      display: grid;
      grid-template-columns: 1fr 52px 52px auto;
      gap: 8px;
      padding: 0 12px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .courses-row {
      display: grid;
      grid-template-columns: 1fr 52px 52px auto;
      gap: 8px;
      align-items: center;
      padding: 10px 12px;
      background: var(--bg-base);
      transition: background var(--duration-fast);
    }
    .courses-row:hover {
      background: var(--bg-elevated);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .status-badge--planned {
      background: color-mix(in srgb, var(--ds-brand) 10%, transparent);
      color: var(--ds-brand);
    }
    .status-badge--in_progress {
      background: color-mix(in srgb, var(--state-success) 12%, transparent);
      color: var(--state-success);
    }
    .status-badge--finished {
      background: var(--bg-elevated);
      color: var(--text-muted);
    }
    .status-badge--cancelled {
      background: color-mix(in srgb, var(--state-error) 10%, transparent);
      color: var(--state-error);
    }
    .status-badge--active {
      background: color-mix(in srgb, var(--state-success) 12%, transparent);
      color: var(--state-success);
    }
    .status-badge--inactive {
      background: var(--bg-elevated);
      color: var(--text-muted);
    }
  `,
})
export class AdminRelatorVerDrawerComponent {
  protected readonly facade = inject(RelatoresFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected specColor(spec: string): string {
    return SPEC_COLORS[spec] ?? '#6b7280';
  }

  protected specLabel(spec: string): string {
    return SPEC_LABELS[spec] ?? spec;
  }

  protected roleLabel(role: string | null): string {
    const labels: Record<string, string> = {
      theory: 'Teoría',
      practice: 'Práctica',
      both: 'Teoría y práctica',
    };
    return role ? (labels[role] ?? role) : '';
  }

  protected statusLabel(status: string | null): string {
    const labels: Record<string, string> = {
      active: 'Activa',
      inactive: 'Inactiva',
      planned: 'Planificada',
      in_progress: 'En curso',
      finished: 'Finalizada',
      cancelled: 'Cancelada',
    };
    return status ? (labels[status] ?? status) : '—';
  }

  protected editar(): void {
    this.layoutDrawer.push(AdminRelatorEditarDrawerComponent, 'Editar relator', 'edit');
  }
}
