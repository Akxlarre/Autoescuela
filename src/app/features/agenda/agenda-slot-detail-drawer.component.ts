import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { StatBoxComponent, StatBoxVariant } from '@shared/components/stat-box/stat-box.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';

type StatusConfig = {
  label: string;
  icon: string;
  variant: StatBoxVariant;
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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, StatBoxComponent, DrawerContentLoaderComponent],
  host: {
    class: 'flex flex-col h-full',
  },
  template: `
    @if (slot(); as s) {
      <app-drawer-content-loader class="flex-col h-full flex">
        <ng-template #skeletons>
        <div class="flex flex-col gap-5 py-2">
          <app-skeleton-block variant="text" width="100px" height="24px" />
          <app-skeleton-block variant="text" width="100%" height="80px" />
          <div class="grid grid-cols-2 gap-3">
            <app-skeleton-block variant="text" width="100%" height="60px" />
            <app-skeleton-block variant="text" width="100%" height="60px" />
          </div>
        </div>
        </ng-template>
        <ng-template #content>
        <div class="flex flex-col h-full w-full">
          <!-- Contenido -->
          <div class="flex-1 flex flex-col gap-5 py-2">
          <!-- ── Estado ─────────────────────────────────────────── -->
          <div
            class="status-pill"
            [style.color]="statusPillStyle().color"
            [style.background]="statusPillStyle().bg"
          >
            <app-icon [name]="statusCfg().icon" [size]="12" />
            <span>{{ statusCfg().label }}</span>
          </div>

          <!-- ── Horario (prominente) ───────────────────────────── -->
          <app-stat-box
            label="Horario de clase"
            [value]="s.startTime + ' – ' + s.endTime"
            variant="brand"
            [useMono]="true"
          />

          <!-- ── Instructor + Vehículo ─────────────────────────── -->
          <div class="grid grid-cols-2 gap-3">
             <app-stat-box
                label="Instructor"
                [value]="s.instructorName"
                variant="surface"
                [compact]="true"
                icon="user"
             />
             <app-stat-box
                label="Vehículo"
                [value]="s.vehiclePlate"
                variant="surface"
                [compact]="true"
                icon="car"
             />
          </div>

          <!-- ── Alumno ────────────────────────────────────────── -->
          @if (s.studentName) {
            <div class="card p-4 flex flex-col gap-3">
              <span class="text-xs font-bold uppercase tracking-widest text-muted">Alumno asignado</span>
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
        </ng-template>
      </app-drawer-content-loader>
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
          variant: 'brand',
        };
      case 'in_progress':
        return {
          label: 'En progreso',
          icon: 'play-circle',
          variant: 'brand',
        };
      case 'completed':
        return {
          label: 'Completada',
          icon: 'check-circle',
          variant: 'success',
        };
      case 'no_show':
        return {
          label: 'No asistió',
          icon: 'user-x',
          variant: 'surface',
        };
      case 'cancelled':
        return {
          label: 'Cancelada',
          icon: 'x-circle',
          variant: 'surface',
        };
      default:
        return {
          label: 'Clase',
          icon: 'calendar-clock',
          variant: 'surface',
        };
    }
  });

  protected statusPillStyle(): { bg: string; color: string } {
    const cfg = this.statusCfg();
    if (cfg.variant === 'surface') {
      return { bg: 'var(--bg-elevated)', color: 'var(--text-secondary)' };
    }
    return {
      bg: `color-mix(in srgb, var(--state-${cfg.variant}) 12%, transparent)`,
      color: `var(--state-${cfg.variant})`,
    };
  }

  close(): void {
    this.facade.setSelectedSlot(null);
    this.drawer.back();
  }
}
