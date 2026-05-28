import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { InstructoresFacade } from '@core/facades/instructores.facade';
import type { InstructorHorarioSession } from '@core/models/ui/instructor-table.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';

// ── Helpers de fecha ──────────────────────────────────────────────────────────

const SAN_TZ = 'America/Santiago';

function toDateKey(isoString: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SAN_TZ }).format(new Date(isoString));
}

function toDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const sessionDay = new Date(y, m - 1, d);
  const today = new Date();
  const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrowNorm = new Date(todayNorm);
  tomorrowNorm.setDate(todayNorm.getDate() + 1);

  if (sessionDay.getTime() === todayNorm.getTime()) return 'Hoy';
  if (sessionDay.getTime() === tomorrowNorm.getTime()) return 'Mañana';

  const label = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(sessionDay);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function toTimeLabel(isoString: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SAN_TZ,
    hour12: false,
  }).format(new Date(isoString));
}

function isToday(dateKey: string): boolean {
  return toDayLabel(dateKey) === 'Hoy';
}
function isTomorrow(dateKey: string): boolean {
  return toDayLabel(dateKey) === 'Mañana';
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DayGroup {
  dateKey: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  sessions: InstructorHorarioSession[];
}

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-admin-instructor-horario-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent],
  template: `
    <div class="flex flex-col gap-5">
      <!-- ── Cabecera con nombre del instructor ─────────────────────────────── -->
      @if (facade.selectedInstructor(); as inst) {
        <div
          class="flex items-center gap-3 pb-4"
          style="border-bottom: 1px solid var(--border-subtle)"
        >
          <div class="avatar-sm">{{ inst.initials }}</div>
          <div>
            <p class="text-sm font-semibold text-text-primary">
              {{ inst.nombre }}
            </p>
            <p class="text-xs text-text-muted">
              Próximas {{ totalSessions() }}
              {{ totalSessions() === 1 ? 'clase' : 'clases' }} agendadas
            </p>
          </div>
        </div>
      }

      <!-- ── Skeleton ───────────────────────────────────────────────────────── -->
      @if (facade.isLoadingHorario()) {
        <div class="flex flex-col gap-5">
          @for (_ of [1, 2]; track $index) {
            <div class="flex flex-col gap-3">
              <app-skeleton-block variant="text" width="120px" height="13px" />
              @for (__ of [1, 2, 3]; track $index) {
                <div class="session-card-skeleton">
                  <app-skeleton-block variant="text" width="48px" height="22px" />
                  <div class="flex flex-col gap-1.5 flex-1">
                    <app-skeleton-block variant="text" width="60%" height="14px" />
                    <app-skeleton-block variant="text" width="40%" height="11px" />
                  </div>
                  <app-skeleton-block variant="rect" width="54px" height="20px" />
                </div>
              }
            </div>
          }
        </div>

        <!-- ── Estado vacío ───────────────────────────────────────────────────── -->
      } @else if (dayGroups().length === 0) {
        <div class="flex flex-col items-center gap-3 py-10">
          <div class="empty-icon-wrap">
            <app-icon name="calendar-check" [size]="28" color="var(--text-muted)" />
          </div>
          <div class="text-center">
            <p class="text-sm font-medium text-text-secondary">Sin clases agendadas</p>
            <p class="text-xs mt-1 text-text-muted">
              No hay clases pendientes para este instructor.
            </p>
          </div>
        </div>

        <!-- ── Grupos por día ─────────────────────────────────────────────────── -->
      } @else {
        @for (group of dayGroups(); track group.dateKey) {
          <div class="flex flex-col gap-2">
            <!-- Encabezado del día -->
            <div class="flex items-center gap-2">
              <span
                class="day-pill"
                [class.day-pill--today]="group.isToday"
                [class.day-pill--tomorrow]="group.isTomorrow"
              >
                {{ group.label }}
              </span>
              <span class="text-xs text-text-muted">
                {{ group.sessions.length }}
                {{ group.sessions.length === 1 ? 'clase' : 'clases' }}
              </span>
            </div>

            <!-- Sesiones del día -->
            @for (session of group.sessions; track session.id) {
              <div class="session-card">
                <!-- Hora -->
                <div class="time-block" [class.time-block--today]="group.isToday">
                  <span class="time-label">{{ timeLabel(session.scheduledAt) }}</span>
                  <span class="duration-label">{{ session.durationMin }} min</span>
                </div>

                <!-- Info alumno -->
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <div class="student-avatar">{{ session.studentInitials }}</div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-medium truncate text-text-primary">
                      {{ session.studentName }}
                    </span>
                    @if (session.vehiclePlate) {
                      <span class="text-xs truncate text-text-muted">
                        <app-icon name="car" [size]="11" />
                        {{ session.vehiclePlate }}
                      </span>
                    }
                  </div>
                </div>

                <!-- Badge clase N° -->
                @if (session.classNumber !== null) {
                  <span class="class-badge">Clase {{ session.classNumber }}</span>
                }
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .avatar-sm {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 13px;
      font-weight: 700;
      flex-shrink: 0;
      background: color-mix(in srgb, var(--ds-brand) 12%, transparent);
      color: var(--ds-brand);
    }

    .day-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      background: var(--bg-elevated);
      color: var(--text-secondary);
    }
    .day-pill--today {
      background: color-mix(in srgb, var(--ds-brand) 12%, transparent);
      color: var(--ds-brand);
    }
    .day-pill--tomorrow {
      background: color-mix(in srgb, var(--state-warning) 10%, transparent);
      color: var(--state-warning);
    }

    .session-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
      background: var(--bg-base);
      transition:
        border-color var(--duration-fast),
        box-shadow var(--duration-fast);
    }
    .session-card:hover {
      border-color: var(--border-default);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    }

    .session-card-skeleton {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
    }

    .time-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 48px;
      padding: 4px 0;
      border-right: 2px solid var(--border-subtle);
      margin-right: 4px;
    }
    .time-block--today {
      border-right-color: var(--ds-brand);
    }
    .time-label {
      font-size: 15px;
      font-weight: 700;
      line-height: 1.1;
      color: var(--text-primary);
    }
    .duration-label {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .student-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
      background: var(--bg-elevated);
      color: var(--text-secondary);
    }

    .class-badge {
      flex-shrink: 0;
      font-size: 10px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      background: var(--bg-elevated);
      color: var(--text-muted);
      white-space: nowrap;
    }

    .empty-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--bg-elevated);
    }
  `,
})
export class AdminInstructorHorarioDrawerComponent implements OnInit {
  protected readonly facade = inject(InstructoresFacade);

  protected readonly totalSessions = computed(() => this.facade.horario().length);

  protected readonly dayGroups = computed((): DayGroup[] => {
    const map = new Map<string, InstructorHorarioSession[]>();
    for (const s of this.facade.horario()) {
      const key = toDateKey(s.scheduledAt);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([dateKey, sessions]) => ({
      dateKey,
      label: toDayLabel(dateKey),
      isToday: isToday(dateKey),
      isTomorrow: isTomorrow(dateKey),
      sessions,
    }));
  });

  protected timeLabel(isoString: string): string {
    return toTimeLabel(isoString);
  }

  ngOnInit(): void {
    const inst = this.facade.selectedInstructor();
    if (inst) this.facade.loadHorario(inst.id);
  }
}
