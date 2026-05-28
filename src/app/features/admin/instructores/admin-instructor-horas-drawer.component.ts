import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { InstructoresFacade } from '@core/facades/instructores.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

@Component({
  selector: 'app-admin-instructor-horas-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IconComponent, SkeletonBlockComponent],
  template: `
    <div class="flex flex-col gap-6">
      <!-- ── Navegación de mes ───────────────────────────────────────────────── -->
      <div class="flex items-center justify-between">
        <button
          class="nav-btn"
          (click)="facade.navHorasAnterior()"
          data-llm-action="mes-anterior"
          title="Mes anterior"
        >
          <app-icon name="chevron-left" [size]="18" />
        </button>

        <div class="flex flex-col items-center gap-0.5">
          <span class="text-base font-semibold text-text-primary">
            {{ periodoLabel() }}
          </span>
          @if (facade.isHorasCurrentMonth()) {
            <span class="text-xs font-medium text-brand" >Mes actual</span>
          }
        </div>

        <button
          class="nav-btn"
          [class.nav-btn--disabled]="facade.isHorasCurrentMonth()"
          [disabled]="facade.isHorasCurrentMonth()"
          (click)="facade.navHorasSiguiente()"
          data-llm-action="mes-siguiente"
          title="Mes siguiente"
        >
          <app-icon name="chevron-right" [size]="18" />
        </button>
      </div>

      <!-- ── Tabla de horas ─────────────────────────────────────────────────── -->
      <div class="horas-table-wrap">
        <table class="horas-table">
          <thead>
            <tr>
              <th>Instructor</th>
              <th class="text-right">Clases</th>
              <th class="text-right">Horas equiv.</th>
            </tr>
          </thead>
          <tbody>
            @if (facade.isLoadingHoras()) {
              @for (_ of skeletonRows; track $index) {
                <tr>
                  <td>
                    <div class="flex items-center gap-3">
                      <app-skeleton-block variant="circle" width="32px" height="32px" />
                      <app-skeleton-block variant="text" width="120px" height="14px" />
                    </div>
                  </td>
                  <td class="text-right">
                    <app-skeleton-block variant="text" width="40px" height="14px" />
                  </td>
                  <td class="text-right">
                    <app-skeleton-block variant="text" width="50px" height="14px" />
                  </td>
                </tr>
              }
            } @else if (facade.horasMensuales().length === 0) {
              <tr>
                <td colspan="3">
                  <div class="py-10 flex flex-col items-center gap-2">
                    <app-icon name="calendar-x" [size]="32" color="var(--text-muted)" />
                    <p class="text-sm text-text-muted">Sin clases registradas para este período.</p>
                  </div>
                </td>
              </tr>
            } @else {
              @for (row of facade.horasMensuales(); track row.instructorId) {
                <tr>
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="avatar">{{ row.initials }}</div>
                      <span class="text-sm font-medium text-text-primary">
                        {{ row.nombre }}
                      </span>
                    </div>
                  </td>
                  <td class="text-right">
                    <span class="text-sm text-text-secondary">
                      {{ row.practicalSessions }}
                      {{ row.practicalSessions === 1 ? 'clase' : 'clases' }}
                    </span>
                  </td>
                  <td class="text-right">
                    <span class="hours-chip">{{ row.totalEquivalent | number: '1.1-1' }} h</span>
                  </td>
                </tr>
              }
            }
          </tbody>
          @if (!facade.isLoadingHoras() && facade.horasMensuales().length > 0) {
            <tfoot>
              <tr>
                <td>
                  <span class="text-xs font-semibold uppercase text-text-muted">
                    Total — {{ facade.horasMensuales().length }}
                    {{ facade.horasMensuales().length === 1 ? 'instructor' : 'instructores' }}
                  </span>
                </td>
                <td class="text-right">
                  <span class="text-sm font-semibold text-text-primary">
                    {{ totales().clases }}
                    {{ totales().clases === 1 ? 'clase' : 'clases' }}
                  </span>
                </td>
                <td class="text-right">
                  <span class="text-sm font-bold text-brand" >
                    {{ totales().horas | number: '1.1-1' }} h
                  </span>
                </td>
              </tr>
            </tfoot>
          }
        </table>
      </div>
    </div>
  `,
  styles: `
    .nav-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .nav-btn:hover:not(.nav-btn--disabled) {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
    }
    .nav-btn--disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .horas-table-wrap {
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .horas-table {
      width: 100%;
      border-collapse: collapse;
    }
    .horas-table th {
      padding: 10px 16px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-subtle);
    }
    .horas-table td {
      padding: 12px 16px;
      vertical-align: middle;
      border-bottom: 1px solid var(--border-subtle);
    }
    .horas-table tbody tr:last-child td {
      border-bottom: none;
    }
    .horas-table tfoot td {
      padding: 12px 16px;
      background: var(--bg-subtle);
      border-top: 1px solid var(--border-default);
    }

    .avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
      background: color-mix(in srgb, var(--ds-brand) 12%, transparent);
      color: var(--ds-brand);
    }

    .hours-chip {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      background: color-mix(in srgb, var(--ds-brand) 8%, transparent);
      color: var(--ds-brand);
    }
  `,
})
export class AdminInstructorHorasDrawerComponent implements OnInit {
  protected readonly facade = inject(InstructoresFacade);

  protected readonly skeletonRows = [1, 2, 3, 4];

  protected readonly periodoLabel = computed(() => {
    const month = this.facade.horasMonth();
    const year = this.facade.horasYear();
    return `${MONTH_NAMES[month - 1]} ${year}`;
  });

  protected readonly totales = computed(() => {
    const rows = this.facade.horasMensuales();
    return {
      clases: rows.reduce((s, r) => s + r.practicalSessions, 0),
      horas: rows.reduce((s, r) => s + r.totalEquivalent, 0),
    };
  });

  ngOnInit(): void {
    this.facade.loadHorasMensuales();
  }
}
