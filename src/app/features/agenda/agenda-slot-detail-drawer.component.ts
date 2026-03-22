import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { IconComponent } from '@shared/components/icon/icon.component';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

type StatusConfig = {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
};

/**
 * AgendaSlotDetailDrawerComponent — Smart component cargado dinámicamente en
 * el LayoutDrawer al hacer clic en un slot ocupado (scheduled, in_progress,
 * completed, no_show).
 *
 * Muestra: estado, horario, instructor, vehículo y alumno.
 * No permite acciones de mutación — solo informativo en esta versión.
 */
@Component({
  selector: 'app-agenda-slot-detail-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, AnimateInDirective],
  host: {
    class: 'flex flex-col h-full',
  },
  template: `
    @if (slot(); as s) {
      <div class="flex flex-col h-full" appAnimateIn>
        <!-- Contenido -->
        <div class="flex-1 flex flex-col gap-5 py-2">
          <!-- ── Estado ─────────────────────────────────────────── -->
          <div
            class="status-pill"
            [style.color]="statusCfg().color"
            [style.background]="statusCfg().bgColor"
          >
            <app-icon [name]="statusCfg().icon" [size]="12" />
            <span>{{ statusCfg().label }}</span>
          </div>

          <!-- ── Horario (prominente) ───────────────────────────── -->
          <div class="card p-4 flex flex-col gap-1.5">
            <span class="kpi-label">Horario de clase</span>
            <div class="time-display">{{ s.startTime }} – {{ s.endTime }}</div>
          </div>

          <!-- ── Instructor + Vehículo ─────────────────────────── -->
          <div class="info-card card p-0 overflow-hidden shadow-sm">
            <div class="info-row" style="border-bottom: 1px solid var(--color-border)">
              <div class="info-icon">
                <app-icon name="user" [size]="15" />
              </div>
              <div class="info-body">
                <span class="info-label">Instructor</span>
                <span class="info-value">{{ s.instructorName }}</span>
              </div>
            </div>
            <div class="info-row">
              <div class="info-icon">
                <app-icon name="car" [size]="15" />
              </div>
              <div class="info-body">
                <span class="info-label">Vehículo</span>
                <span class="info-value">{{ s.vehiclePlate }}</span>
              </div>
            </div>
          </div>

          <!-- ── Alumno ────────────────────────────────────────── -->
          @if (s.studentName) {
            <div class="card p-4 flex flex-col gap-3">
              <span class="kpi-label">Alumno asignado</span>
              <div class="flex flex-col gap-1">
                <span class="student-name">{{ s.studentName }}</span>
                @if (s.classNumber) {
                  <div class="flex items-center gap-2 mt-1">
                    <div class="px-1.5 py-0.5 rounded bg-bg-subtle border text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Clase {{ s.classNumber }}
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- ── Acción (Sticky Footer) ────────────────────────── -->
        <div class="flex justify-end pt-6 pb-4 border-t mt-auto sticky bottom-0 bg-surface z-10"
             style="border-color: var(--border-subtle);">
          <button class="close-btn" (click)="close()" data-llm-action="close-slot-detail">
            Cerrar detalle
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    /* ── Status pill ── */

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      align-self: flex-start;
    }

    /* ── Horario ── */

    .time-display {
      font-size: 1.5rem;
      font-weight: var(--font-bold);
      color: var(--text-primary);
      letter-spacing: -0.02em;
      line-height: 1.2;
    }

    /* ── Info card ── */

    .info-card {
      border-radius: var(--radius-lg);
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
    }

    .info-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      background: var(--bg-elevated);
      color: var(--text-secondary);
      flex-shrink: 0;
    }

    .info-body {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .info-label {
      font-size: var(--text-xs);
      color: var(--text-muted);
      font-weight: var(--font-medium);
    }

    .info-row:first-child .info-icon {
        color: var(--ds-brand);
    }

    .info-value {
      font-size: 0.875rem;
      font-weight: var(--font-semibold);
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Alumno ── */

    .student-name {
      font-size: 1rem;
      font-weight: var(--font-semibold);
      color: var(--text-primary);
      line-height: 1.3;
    }

    /* ── Close ── */

    .close-btn {
      padding: 0.625rem 1.25rem;
      border-radius: var(--radius-lg);
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-muted);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      cursor: pointer;
      transition: all var(--duration-standard) var(--ease-standard);

      &:hover {
        background: var(--bg-subtle);
        color: var(--text-secondary);
        border-color: var(--border-subtle);
      }
    }
  `,
})
export class AgendaSlotDetailDrawerComponent {
  readonly facade = inject(AgendaFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);

  readonly slot = this.facade.selectedSlot;

  readonly statusCfg = computed<StatusConfig>(() => {
    switch (this.slot()?.status) {
      case 'scheduled':
        return {
          label: 'Agendada',
          icon: 'calendar-clock',
          color: 'var(--ds-brand)',
          bgColor: 'color-mix(in srgb, var(--ds-brand) 12%, var(--bg-surface))',
        };
      case 'in_progress':
        return {
          label: 'En progreso',
          icon: 'play-circle',
          color: 'var(--ds-brand)',
          bgColor: 'color-mix(in srgb, var(--ds-brand) 12%, var(--bg-surface))',
        };
      case 'completed':
        return {
          label: 'Completada',
          icon: 'check-circle',
          color: 'var(--state-success)',
          bgColor: 'color-mix(in srgb, var(--state-success) 12%, var(--bg-surface))',
        };
      case 'no_show':
        return {
          label: 'No asistió',
          icon: 'user-x',
          color: 'var(--text-muted)',
          bgColor: 'var(--bg-elevated)',
        };
      case 'cancelled':
        return {
          label: 'Cancelada',
          icon: 'x-circle',
          color: 'var(--text-disabled)',
          bgColor: 'var(--bg-elevated)',
        };
      default:
        return {
          label: 'Clase',
          icon: 'calendar-clock',
          color: 'var(--text-secondary)',
          bgColor: 'var(--bg-elevated)',
        };
    }
  });

  close(): void {
    this.facade.setSelectedSlot(null);
    this.drawer.back();
  }
}
