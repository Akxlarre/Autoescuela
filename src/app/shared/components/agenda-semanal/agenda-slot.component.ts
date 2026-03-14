import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { AgendaSlot } from '@core/models/ui/agenda.model';

/**
 * AgendaSlotComponent — Átomo: bloque visual de un slot en la grilla de agenda.
 *
 * - available: borde dashed, clickeable para agendar
 * - scheduled/in_progress: fondo brand diluido, muestra alumno + clase N
 * - completed: fondo success, tachado sutil
 * - cancelled/no_show: fondo muted, línea tachada
 */
@Component({
  selector: 'app-agenda-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    class: 'block',
    '[class.cursor-pointer]': 'isInteractive()',
    '[attr.role]': 'isInteractive() ? "button" : null',
    '[attr.tabindex]': 'isInteractive() ? "0" : null',
    '[attr.aria-expanded]': 'isOccupied() ? expanded() : null',
    '[attr.aria-label]': 'ariaLabel()',
    '(click)': 'handleClick()',
    '(keydown.enter)': 'handleClick()',
    '(keydown.space)': 'handleClick(); $event.preventDefault()',
  },
  template: `
    <div
      class="slot-block"
      [class]="statusClass()"
      [attr.data-llm-action]="slot().status === 'available' ? 'schedule-class' : null"
    >
      @switch (slot().status) {
        @case ('available') {
          <div class="flex items-center gap-1">
            <app-icon name="plus" [size]="12" />
            <span class="slot-time">{{ slot().startTime }}</span>
          </div>
          @if (!compact()) {
            <span class="slot-instructor">{{ slot().instructorName }}</span>
          }
        }
        @case ('scheduled') {
          <span class="slot-time">{{ slot().startTime }} – {{ slot().endTime }}</span>
          <span class="slot-student">{{ slot().studentName }}</span>
          @if (slot().classNumber && !compact()) {
            <span class="slot-badge">Clase {{ slot().classNumber }}</span>
          }
        }
        @case ('in_progress') {
          <div class="flex items-center gap-1">
            <app-icon name="play-circle" [size]="12" />
            <span class="slot-time">{{ slot().startTime }} – {{ slot().endTime }}</span>
          </div>
          <span class="slot-student">{{ slot().studentName }}</span>
        }
        @case ('completed') {
          <div class="flex items-center gap-1">
            <app-icon name="check-circle" [size]="12" />
            <span class="slot-time">{{ slot().startTime }} – {{ slot().endTime }}</span>
          </div>
          @if (!compact()) {
            <span class="slot-student">{{ slot().studentName }}</span>
          }
        }
        @case ('no_show') {
          <span class="slot-time line-through">{{ slot().startTime }}</span>
          <span class="slot-student line-through">{{ slot().studentName }}</span>
        }
      }

      <!-- Panel de detalle (solo slots ocupados, al hacer clic) -->
      @if (expanded() && isOccupied()) {
        <div class="slot-detail">
          <div class="slot-detail-row">
            <app-icon name="user" [size]="10" />
            <span>{{ slot().instructorName }}</span>
          </div>
          <div class="slot-detail-row">
            <app-icon name="car" [size]="10" />
            <span>{{ slot().vehiclePlate }}</span>
          </div>
          @if (slot().classNumber) {
            <div class="slot-detail-row">
              <app-icon name="hash" [size]="10" />
              <span>Clase {{ slot().classNumber }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    /* ── Base ─────────────────────────────────────────────── */

    .slot-block {
      border-radius: var(--radius-sm);
      padding: 4px 7px;
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      min-height: 48px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      transition:
        background var(--duration-instant) var(--ease-standard),
        border-color var(--duration-instant) var(--ease-standard),
        box-shadow var(--duration-instant) var(--ease-standard);
    }

    /* ── Available — affordance clara: espacio invitado a ocupar ── */

    .slot-block--available {
      border: 1.5px dashed var(--border-strong);
      background: var(--bg-base);
      color: var(--text-muted);
      position: relative;

      &:hover {
        border-style: solid;
        border-color: var(--ds-brand);
        background: color-mix(in srgb, var(--ds-brand) 8%, var(--bg-surface));
        color: var(--ds-brand);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--ds-brand) 15%, transparent);
      }
    }

    /* ── Scheduled — el estado principal, debe destacar ── */

    .slot-block--scheduled {
      background: color-mix(in srgb, var(--ds-brand) 14%, var(--bg-surface));
      border: 1.5px solid color-mix(in srgb, var(--ds-brand) 55%, transparent);
      border-left: 3px solid var(--ds-brand);
      color: var(--text-primary);
      cursor: default;

      &:hover {
        background: color-mix(in srgb, var(--ds-brand) 20%, var(--bg-surface));
      }
    }

    /* ── In progress — más prominente: fondo sólido brand ── */

    .slot-block--in_progress {
      background: var(--ds-brand);
      border: 1.5px solid var(--color-primary-hover);
      color: var(--color-primary-text);
      cursor: default;

      .slot-time,
      .slot-student {
        color: var(--color-primary-text);
        opacity: 0.95;
      }

      &:hover {
        background: var(--color-primary-hover);
      }
    }

    /* ── Completed — éxito sutil pero legible ── */

    .slot-block--completed {
      background: color-mix(in srgb, var(--state-success) 14%, var(--bg-surface));
      border: 1.5px solid color-mix(in srgb, var(--state-success) 50%, transparent);
      border-left: 3px solid var(--state-success);
      color: var(--text-secondary);
      cursor: default;

      .slot-time {
        color: var(--state-success);
      }

      &:hover {
        background: color-mix(in srgb, var(--state-success) 20%, var(--bg-surface));
      }
    }

    /* ── Compact — reduce layout sin bajar contraste ── */

    .slot-block--compact {
      min-height: 32px;
      padding: 3px 7px;

      /* No opacity: mantiene contraste WCAG */
    }

    /* ── Expanded — detalle visible, leve elevación ── */

    .slot-block--expanded {
      box-shadow: var(--shadow-md);
      z-index: 1;
      position: relative;
    }

    /* ── Cancelled / No show ── */

    .slot-block--cancelled,
    .slot-block--no_show {
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      color: var(--text-disabled);
      cursor: default;
    }

    /* ── Texto ── */

    .slot-time {
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: inherit;
    }

    .slot-student {
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .slot-instructor {
      font-size: var(--text-xs);
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .slot-badge {
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
    }

    /* ── Panel de detalle expandible ── */

    .slot-detail {
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .slot-detail-row {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--text-xs);
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;

      span {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    /* Detalle sobre fondo sólido brand (in_progress) */
    .slot-block--in_progress .slot-detail {
      border-top-color: color-mix(in srgb, var(--color-primary-text) 25%, transparent);
    }

    .slot-block--in_progress .slot-detail-row {
      color: color-mix(in srgb, var(--color-primary-text) 80%, transparent);
    }
  `,
})
export class AgendaSlotComponent {
  slot = input.required<AgendaSlot>();
  /** Modo compacto: oculta nombre instructor en available. */
  compact = input(false);
  slotClicked = output<AgendaSlot>();

  /** Detalle expandido al hacer clic en slots ocupados. */
  readonly expanded = signal(false);

  readonly isOccupied = computed(() => {
    const s = this.slot().status;
    return s === 'scheduled' || s === 'in_progress' || s === 'completed' || s === 'no_show';
  });

  readonly isInteractive = computed(() => this.slot().status === 'available' || this.isOccupied());

  readonly statusClass = computed(() => {
    const base = `slot-block slot-block--${this.slot().status}`;
    const withCompact = this.compact() ? `${base} slot-block--compact` : base;
    return this.expanded() ? `${withCompact} slot-block--expanded` : withCompact;
  });

  readonly ariaLabel = computed(() => {
    const s = this.slot();
    if (s.status === 'available') {
      return `Slot disponible ${s.startTime} — ${s.instructorName}. Clic para agendar.`;
    }
    return `${s.studentName ?? 'Clase'} ${s.startTime} — ${s.instructorName}. Clic para ${this.expanded() ? 'cerrar' : 'ver'} detalle.`;
  });

  handleClick(): void {
    if (this.slot().status === 'available') {
      this.slotClicked.emit(this.slot());
    } else if (this.isOccupied()) {
      this.expanded.update((v) => !v);
    }
  }
}
