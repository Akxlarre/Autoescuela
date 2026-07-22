import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { SesionProfesional, WeekDay } from '@core/models/ui/sesion-profesional.model';

/**
 * Matriz semanal compacta (Dumb, colocated) — refinamiento owner spec 0033-b.
 * Transpone el mapa: columnas = días Lun-Sáb, filas = Teoría / Práctica.
 * Cada celda es un chip clickeable (dot de estado + asistencia) que abre el
 * drawer de sesión. Reemplaza a las day-cards (~290px → ~130px de banda).
 */
@Component({
  selector: 'app-week-matrix',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="week-matrix" role="grid" aria-label="Sesiones de la semana">
      <!-- Fila 1: cabecera de días -->
      <div class="row-label" aria-hidden="true"></div>
      @for (day of days(); track day.date) {
        <div class="day-head" [class.is-today]="day.isToday">
          <span
            class="day-name"
            [style.color]="day.isToday ? 'var(--ds-brand)' : 'var(--text-muted)'"
          >
            {{ day.dayLabel }}
          </span>
          <span
            class="day-date"
            [style.color]="day.isToday ? 'var(--text-primary)' : 'var(--text-secondary)'"
          >
            {{ day.label }}
          </span>
        </div>
      }

      <!-- Fila 2: Teoría -->
      <div class="row-label">
        <app-icon name="book-open" [size]="13" color="var(--text-muted)" />
        <span>Teoría</span>
      </div>
      @for (day of days(); track day.date) {
        @if (day.theory; as session) {
          <button
            type="button"
            class="cell"
            [class.cell-today]="day.isToday"
            [attr.title]="getStatusLabel(session)"
            (click)="selectSession.emit(session)"
            data-llm-action="open-theory-session"
          >
            <span class="dot" [style.background]="getStatusColor(session)"></span>
            @if (session.status !== 'cancelled') {
              <span class="count"
                >{{ session.attendanceCount
                }}<span class="count-total">/{{ session.enrolledCount }}</span></span
              >
            } @else {
              <app-icon name="ban" [size]="12" color="var(--state-error)" />
            }
          </button>
        } @else {
          <div class="cell cell-empty">—</div>
        }
      }

      <!-- Fila 3: Práctica -->
      <div class="row-label">
        <app-icon name="wrench" [size]="13" color="var(--text-muted)" />
        <span>Práctica</span>
      </div>
      @for (day of days(); track day.date) {
        @if (day.practice; as session) {
          <button
            type="button"
            class="cell"
            [class.cell-today]="day.isToday"
            [attr.title]="getStatusLabel(session)"
            (click)="selectSession.emit(session)"
            data-llm-action="open-practice-session"
          >
            <span class="dot" [style.background]="getStatusColor(session)"></span>
            @if (session.status !== 'cancelled') {
              <span class="count"
                >{{ session.attendanceCount
                }}<span class="count-total">/{{ session.enrolledCount }}</span></span
              >
            } @else {
              <app-icon name="ban" [size]="12" color="var(--state-error)" />
            }
          </button>
        } @else {
          <div class="cell cell-empty">—</div>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .week-matrix {
      display: grid;
      grid-template-columns: max-content repeat(6, minmax(0, 1fr));
      gap: 6px 8px;
      align-items: stretch;
    }

    .row-label {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-right: 6px;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    /* Columna apilada (nombre arriba, fecha abajo) — NO en línea: a contenedor
       angosto (drawer de sesión abierto, ~524px de <main>) cada columna del
       grid mide ~39-70px y "Lun 27 Jul" en una sola línea se desborda de su
       celda y se solapa visualmente con la columna vecina. Apilar reduce el
       ancho requerido al más largo de los dos textos, no a la suma. */
    .day-head {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      padding-bottom: 2px;
      min-width: 0;
    }
    .day-name {
      font-size: var(--text-2xs, 0.625rem);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }
    .day-date {
      font-size: var(--text-2xs, 0.625rem);
      font-weight: 700;
      white-space: nowrap;
    }
    .day-head.is-today {
      border-bottom: 2px solid var(--ds-brand);
    }

    .cell {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 32px;
      padding: 4px 6px;
      border-radius: 8px;
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      cursor: pointer;
      transition:
        background 0.15s ease,
        border-color 0.15s ease,
        transform 0.15s ease;
    }
    .cell:hover {
      background: var(--bg-subtle);
      border-color: var(--border-default);
      transform: translateY(-1px);
    }
    .cell-today {
      border-color: color-mix(in srgb, var(--ds-brand) 45%, transparent);
      background: color-mix(in srgb, var(--ds-brand) 4%, var(--bg-base));
    }

    .cell-empty {
      color: var(--text-muted);
      background: transparent;
      border: 1px dashed var(--border-subtle);
      cursor: default;
      opacity: 0.55;
      font-size: var(--text-xs);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .count {
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
    }
    .count-total {
      color: var(--text-muted);
      font-weight: 500;
    }
  `,
})
export class WeekMatrixComponent {
  readonly days = input.required<WeekDay[]>();
  readonly selectSession = output<SesionProfesional>();

  private readonly todayIso = new Date().toISOString().slice(0, 10);

  getStatusColor(session: SesionProfesional): string {
    if (session.date > this.todayIso) return 'var(--text-muted)';

    switch (session.status) {
      case 'completed':
        return 'var(--state-success)';
      case 'in_progress':
        return 'var(--ds-brand)';
      case 'cancelled':
        return 'var(--state-error)';
      case 'scheduled':
        return 'var(--text-secondary)';
      default:
        return 'var(--border-subtle)';
    }
  }

  getStatusLabel(session: SesionProfesional): string {
    const tipo = session.tipo === 'theory' ? 'Teoría' : 'Práctica';
    switch (session.status) {
      case 'completed':
        return `${tipo} — Finalizada (${session.attendanceCount}/${session.enrolledCount})`;
      case 'in_progress':
        return `${tipo} — En curso`;
      case 'scheduled':
        return `${tipo} — Pendiente`;
      case 'cancelled':
        return `${tipo} — Cancelada`;
      default:
        return tipo;
    }
  }
}
