import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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
    '[class.cursor-pointer]': 'slot().status === "available"',
    '[attr.role]': 'slot().status === "available" ? "button" : null',
    '[attr.tabindex]': 'slot().status === "available" ? "0" : null',
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
            <app-icon name="plus" [size]="10" />
            <span class="slot-time">{{ slot().startTime }}</span>
          </div>
          <span class="slot-instructor">{{ slot().instructorName }}</span>
        }
        @case ('scheduled') {
          <span class="slot-time">{{ slot().startTime }}</span>
          <span class="slot-student">{{ slot().studentName }}</span>
          @if (slot().classNumber) {
            <span class="slot-badge">Clase {{ slot().classNumber }}</span>
          }
        }
        @case ('in_progress') {
          <div class="flex items-center gap-1">
            <app-icon name="play-circle" [size]="10" />
            <span class="slot-time">{{ slot().startTime }}</span>
          </div>
          <span class="slot-student">{{ slot().studentName }}</span>
        }
        @case ('completed') {
          <div class="flex items-center gap-1">
            <app-icon name="check-circle" [size]="10" />
            <span class="slot-time">{{ slot().startTime }}</span>
          </div>
          <span class="slot-student">{{ slot().studentName }}</span>
        }
        @case ('no_show') {
          <span class="slot-time line-through">{{ slot().startTime }}</span>
          <span class="slot-student line-through">{{ slot().studentName }}</span>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .slot-block {
      border-radius: var(--radius-sm, 6px);
      padding: 3px 6px;
      font-size: 0.68rem;
      line-height: 1.3;
      min-height: 40px;
      display: flex;
      flex-direction: column;
      gap: 1px;
      transition:
        background 120ms ease,
        border-color 120ms ease;
    }

    .slot-block--available {
      border: 1px dashed var(--color-border-strong, var(--color-border));
      background: transparent;
      color: var(--text-muted);

      &:hover {
        border-color: var(--ds-brand);
        background: color-mix(in srgb, var(--ds-brand) 8%, transparent);
        color: var(--ds-brand);
      }
    }

    .slot-block--scheduled {
      background: color-mix(in srgb, var(--ds-brand) 12%, var(--bg-surface));
      border: 1px solid color-mix(in srgb, var(--ds-brand) 35%, transparent);
      color: var(--text-primary);
    }

    .slot-block--in_progress {
      background: color-mix(in srgb, var(--ds-brand) 22%, var(--bg-surface));
      border: 1px solid var(--ds-brand);
      color: var(--ds-brand);
    }

    .slot-block--completed {
      background: color-mix(in srgb, var(--state-success) 10%, var(--bg-surface));
      border: 1px solid color-mix(in srgb, var(--state-success) 40%, transparent);
      color: var(--state-success);
    }

    .slot-block--cancelled,
    .slot-block--no_show {
      background: var(--bg-surface);
      border: 1px solid var(--color-border);
      color: var(--text-muted);
      opacity: 0.55;
    }

    .slot-time {
      font-weight: 600;
      font-size: 0.65rem;
    }

    .slot-student {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .slot-instructor {
      font-size: 0.62rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .slot-badge {
      font-size: 0.58rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      opacity: 0.75;
    }
  `,
})
export class AgendaSlotComponent {
  slot = input.required<AgendaSlot>();
  slotClicked = output<AgendaSlot>();

  statusClass = computed(() => `slot-block slot-block--${this.slot().status}`);

  ariaLabel = computed(() => {
    const s = this.slot();
    if (s.status === 'available') {
      return `Slot disponible ${s.startTime} — ${s.instructorName}. Clic para agendar.`;
    }
    return `${s.studentName ?? 'Clase'} ${s.startTime} — ${s.instructorName}`;
  });

  handleClick(): void {
    if (this.slot().status === 'available') {
      this.slotClicked.emit(this.slot());
    }
  }
}
