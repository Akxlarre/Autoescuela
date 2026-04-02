import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { RelatoresFacade } from '@core/facades/relatores.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent],
  template: `
    @if (facade.selectedRelator(); as rel) {
      <!-- ── Avatar + nombre ─────────────────────────────────────────────── -->
      <div class="flex items-center gap-4 mb-6">
        <div
          class="flex items-center justify-center w-14 h-14 rounded-full shrink-0 text-base font-bold"
          style="background: var(--color-primary-tint); color: var(--color-primary);"
        >
          {{ rel.initials }}
        </div>
        <div>
          <h2 class="text-base font-semibold" style="color: var(--text-primary)">
            {{ rel.nombre }}
          </h2>
          <p class="text-xs mt-0.5" style="color: var(--text-muted)">{{ rel.rut }}</p>
          <div class="flex items-center gap-2 mt-1.5 flex-wrap">
            @for (spec of rel.specializations; track spec) {
              <span class="spec-badge" [style.background]="specColor(spec)">{{ spec }}</span>
            }
            @if (rel.estado === 'activo') {
              <span
                class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style="background: color-mix(in srgb, var(--state-success) 12%, transparent); color: var(--state-success);"
              >
                <app-icon name="check-circle" [size]="10" />
                Activo
              </span>
            } @else {
              <span
                class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style="background: var(--bg-elevated); color: var(--text-muted);"
              >
                Inactivo
              </span>
            }
          </div>
        </div>
      </div>

      <!-- ── Información personal ───────────────────────────────────────── -->
      <h3 class="section-title">Información Personal</h3>
      <div class="info-grid mb-6">
        <div class="info-item">
          <span class="info-label">
            <app-icon name="id-card" [size]="12" />
            RUT
          </span>
          <span class="info-value">{{ rel.rut }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">
            <app-icon name="phone" [size]="12" />
            TELÉFONO
          </span>
          <span class="info-value">{{ rel.phone || '—' }}</span>
        </div>
        <div class="info-item" style="grid-column: span 2">
          <span class="info-label">
            <app-icon name="at-sign" [size]="12" />
            CORREO ELECTRÓNICO
          </span>
          <span class="info-value">{{ rel.email || '—' }}</span>
        </div>
      </div>

      <!-- ── Especialidades ─────────────────────────────────────────────── -->
      <h3 class="section-title">Especialidades</h3>
      <div class="flex flex-col gap-2 mb-6">
        @for (spec of rel.specializations; track spec) {
          <div
            class="flex items-center gap-3 p-3 rounded-lg"
            style="background: var(--bg-elevated); border: 1px solid var(--border-subtle);"
          >
            <span class="spec-badge" [style.background]="specColor(spec)">{{ spec }}</span>
            <span class="text-sm" style="color: var(--text-primary)">{{ specLabel(spec) }}</span>
          </div>
        } @empty {
          <p class="text-sm" style="color: var(--text-muted)">Sin especialidades registradas.</p>
        }
      </div>

      <!-- ── Info registro ───────────────────────────────────────────────── -->
      @if (rel.registrationDate) {
        <div
          class="flex items-center gap-2 p-3 rounded-lg mb-6"
          style="background: var(--bg-elevated); border: 1px solid var(--border-subtle);"
        >
          <app-icon name="calendar" [size]="14" color="var(--text-muted)" />
          <span class="text-xs" style="color: var(--text-muted)">
            Fecha de registro: {{ rel.registrationDate }}
          </span>
        </div>
      }

      <!-- ── Cursos asignados ───────────────────────────────────────────── -->
      <h3 class="section-title">
        Cursos asignados
        @if (!facade.isLoadingCursos() && facade.cursosAsignados().length > 0) {
          <span
            class="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
            style="background: color-mix(in srgb, var(--ds-brand) 10%, transparent); color: var(--ds-brand);"
          >
            {{ facade.cursosAsignados().length }}
          </span>
        }
      </h3>

      @if (facade.isLoadingCursos()) {
        <div class="flex flex-col gap-3 mb-6">
          @for (_ of [1, 2]; track $index) {
            <div
              class="flex items-center gap-3 p-3 rounded-lg"
              style="border: 1px solid var(--border-subtle);"
            >
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
          class="flex items-center gap-2 p-4 rounded-lg mb-6"
          style="background: var(--bg-elevated); border: 1px solid var(--border-subtle);"
        >
          <app-icon name="calendar-x" [size]="15" color="var(--text-muted)" />
          <span class="text-sm" style="color: var(--text-muted)">
            Sin cursos asignados actualmente.
          </span>
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
          class="flex flex-col mb-6"
          style="border: 1px solid var(--border-subtle); border-radius: var(--radius-md); overflow: hidden;"
        >
          @for (curso of facade.cursosAsignados(); track curso.id; let last = $last) {
            <div
              class="courses-row"
              [style.border-bottom]="last ? 'none' : '1px solid var(--border-subtle)'"
            >
              <!-- Promoción -->
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold truncate" style="color: var(--text-primary)">
                  {{ curso.promotionName }}
                </span>
                <span class="text-xs" style="color: var(--text-muted)">
                  Código: {{ curso.promotionCode }}
                </span>
              </div>

              <!-- Curso badge -->
              <div class="flex flex-col gap-0.5">
                <span class="spec-badge" [style.background]="specColor(curso.courseCode)">
                  {{ curso.courseCode }}
                </span>
                @if (curso.role) {
                  <span class="text-xs" style="color: var(--text-muted); white-space: nowrap;">
                    {{ roleLabel(curso.role) }}
                  </span>
                }
              </div>

              <!-- Alumnos -->
              <span class="text-xs" style="color: var(--text-secondary)">
                {{ curso.enrolledStudents }} / {{ curso.maxStudents }}
              </span>

              <!-- Estado -->
              <span class="status-badge" [class]="'status-badge--' + (curso.status ?? 'planned')">
                {{ statusLabel(curso.status) }}
              </span>
            </div>
          }
        </div>
      }

      <!-- ── Acciones ───────────────────────────────────────────────────── -->
      <div style="border-top: 1px solid var(--border-subtle);" class="pt-4">
        <button class="edit-btn" (click)="editarClicked.emit()" data-llm-action="editar-relator">
          <app-icon name="edit" [size]="15" />
          Editar relator
        </button>
      </div>
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
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .info-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ds-brand);
    }
    .info-value {
      font-size: var(--text-sm);
      color: var(--text-primary);
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
    .edit-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px 14px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-family: inherit;
      cursor: pointer;
      text-align: left;
      transition: all var(--duration-fast);
    }
    .edit-btn:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
      background: color-mix(in srgb, var(--ds-brand) 4%, transparent);
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
  readonly editarClicked = output<void>();

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
}
