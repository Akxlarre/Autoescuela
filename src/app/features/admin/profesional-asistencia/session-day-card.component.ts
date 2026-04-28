import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { SesionProfesional, WeekDay } from '@core/models/ui/sesion-profesional.model';

@Component({
  selector: 'app-session-day-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent],
  template: `
    <div
      class="flex flex-col h-full rounded-2xl transition-all duration-300 relative overflow-hidden"
      [class.p-3]="true"
      [style.background]="day().isToday ? 'var(--bg-surface)' : 'transparent'"
      [style.border]="day().isToday ? '1px solid var(--ds-brand)' : '1px solid var(--border-subtle)'"
      [style.box-shadow]="day().isToday ? '0 4px 12px -4px rgba(0,0,0,0.05)' : 'none'"
    >
      <!-- Hoy indicator -->
      @if (day().isToday) {
        <div class="absolute top-0 left-0 w-full h-1 bg-brand" style="background: var(--ds-brand)"></div>
      }

      <!-- Cabecera del Día -->
      <div class="mb-4 mt-1 text-center">
        <span class="block text-[10px] font-bold tracking-widest uppercase mb-0.5"
              [style.color]="day().isToday ? 'var(--ds-brand)' : 'var(--text-muted)'">
          {{ day().dayLabel }}
        </span>
        <span class="block text-base font-bold"
              [style.color]="day().isToday ? 'var(--text-primary)' : 'var(--text-secondary)'">
          {{ day().label }}
        </span>
      </div>

      <!-- Contenedor de Sesiones -->
      <div class="flex flex-col gap-2.5 flex-1">
        <!-- Teoría -->
        @if (day().theory; as session) {
          <button
            class="session-row w-full relative flex items-center justify-between p-2.5 rounded-xl transition-all group overflow-hidden"
            [style.background]="session.status === 'completed' ? 'var(--bg-surface)' : 'var(--bg-base)'"
            [style.border]="session.status === 'completed' ? '1px solid var(--border-default)' : '1px solid transparent'"
            (click)="selectSession.emit(session)"
            data-llm-action="open-theory-session"
          >
            <!-- Línea indicadora izquierda -->
            <div class="absolute left-0 top-0 bottom-0 w-1 transition-colors" 
                 [style.background]="getStatusColor(session)"></div>
            
            <div class="flex items-center gap-2.5 pl-1.5">
              <div class="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                   [style.background]="getStatusBgColor(session)" 
                   [style.color]="getStatusColor(session)">
                <app-icon name="book-open" [size]="14" />
              </div>
              <div class="flex flex-col items-start text-left">
                <span class="text-xs font-semibold" style="color: var(--text-primary)">Teoría</span>
                <span class="text-[10px] uppercase font-bold tracking-wider mt-0.5" 
                      [style.color]="getStatusColor(session)">
                  {{ getStatusShortLabel(session.status) }}
                </span>
              </div>
            </div>

            <div class="flex flex-col items-end pl-2">
              @if (session.status !== 'cancelled') {
                <span class="text-xs font-bold" style="color: var(--text-primary)">
                  {{ session.attendanceCount }}<span class="text-muted font-medium">/{{ session.enrolledCount }}</span>
                </span>
              } @else {
                <app-icon name="ban" [size]="14" color="var(--state-error)" class="opacity-70" />
              }
            </div>
          </button>
        }

        <!-- Práctica -->
        @if (day().practice; as session) {
          <button
            class="session-row w-full relative flex items-center justify-between p-2.5 rounded-xl transition-all group overflow-hidden mt-auto"
            [style.background]="session.status === 'completed' ? 'var(--bg-surface)' : 'var(--bg-base)'"
            [style.border]="session.status === 'completed' ? '1px solid var(--border-default)' : '1px solid transparent'"
            (click)="selectSession.emit(session)"
            data-llm-action="open-practice-session"
          >
            <!-- Línea indicadora izquierda -->
            <div class="absolute left-0 top-0 bottom-0 w-1 transition-colors" 
                 [style.background]="getStatusColor(session)"></div>
            
            <div class="flex items-center gap-2.5 pl-1.5">
              <div class="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                   [style.background]="getStatusBgColor(session)" 
                   [style.color]="getStatusColor(session)">
                <app-icon name="wrench" [size]="14" />
              </div>
              <div class="flex flex-col items-start text-left">
                <span class="text-xs font-semibold" style="color: var(--text-primary)">Práctica</span>
                <span class="text-[10px] uppercase font-bold tracking-wider mt-0.5" 
                      [style.color]="getStatusColor(session)">
                  {{ getStatusShortLabel(session.status) }}
                </span>
              </div>
            </div>

            <div class="flex flex-col items-end pl-2">
              @if (session.status !== 'cancelled') {
                <span class="text-xs font-bold" style="color: var(--text-primary)">
                  {{ session.attendanceCount }}<span class="text-muted font-medium">/{{ session.enrolledCount }}</span>
                </span>
              } @else {
                <app-icon name="ban" [size]="14" color="var(--state-error)" class="opacity-70" />
              }
            </div>
          </button>
        }

        <!-- Empty State -->
        @if (!day().theory && !day().practice) {
          <div class="flex flex-col items-center justify-center py-6 px-2 opacity-50 flex-1">
             <div class="w-8 h-8 rounded-full flex items-center justify-center mb-2" style="background: var(--bg-surface); border: 1px dashed var(--border-subtle)">
               <app-icon name="minus" [size]="14" color="var(--text-muted)" />
             </div>
             <p class="text-center text-[11px] uppercase tracking-widest text-muted font-semibold">Sin carga</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    
    .session-row {
      cursor: pointer;
    }
    
    .session-row:hover {
      background: var(--bg-surface-hover) !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px -4px rgba(0,0,0,0.06);
    }
  `,
})
export class SessionDayCardComponent {
  readonly day = input.required<WeekDay>();
  readonly selectSession = output<SesionProfesional>();

  private readonly todayIso = new Date().toISOString().slice(0, 10);

  getStatusColor(session: SesionProfesional): string {
    if (session.date > this.todayIso) return 'var(--text-muted)';
    
    switch (session.status) {
      case 'completed': return 'var(--state-success)';
      case 'in_progress': return 'var(--ds-brand)';
      case 'cancelled': return 'var(--state-error)';
      case 'scheduled': return 'var(--text-secondary)';
      default: return 'var(--border-subtle)';
    }
  }

  getStatusBgColor(session: SesionProfesional): string {
    if (session.date > this.todayIso) return 'var(--bg-surface)';
    
    switch (session.status) {
      case 'completed': return 'var(--state-success-bg)';
      case 'in_progress': return 'color-mix(in srgb, var(--ds-brand) 10%, transparent)';
      case 'cancelled': return 'var(--state-error-bg)';
      case 'scheduled': return 'var(--bg-surface)';
      default: return 'transparent';
    }
  }

  getStatusShortLabel(status: string): string {
    switch (status) {
      case 'completed': return 'Finalizada';
      case 'in_progress': return 'En curso';
      case 'scheduled': return 'Pendiente';
      case 'cancelled': return 'Cancelada';
      default: return '';
    }
  }
}
