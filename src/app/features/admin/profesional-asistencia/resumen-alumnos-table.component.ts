import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import type { ResumenAlumnoAsistencia } from '@core/models/ui/sesion-profesional.model';

/**
 * Tabla de resumen de asistencia acumulada por alumno (Dumb, colocated).
 * Solo lectura: conteos y porcentajes de teoría/práctica sobre sesiones completadas.
 */
@Component({
  selector: 'app-resumen-alumnos-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, SkeletonBlockComponent],
  template: `
    @if (isLoading()) {
      <div class="p-4 flex flex-col gap-3">
        @for (i of [1, 2, 3]; track i) {
          <app-skeleton-block variant="text" width="100%" height="36px" />
        }
      </div>
    } @else if (alumnos().length === 0) {
      <div class="p-8 text-center">
        <p class="text-sm text-text-muted">No hay alumnos matriculados en este curso.</p>
      </div>
    } @else {
      <table class="resumen-table w-full">
        <thead>
          <tr>
            <th class="text-left">Alumno</th>
            <th class="text-center">Teoría</th>
            <th class="text-center">% Teoría</th>
            <th class="text-center">Práctica</th>
            <th class="text-center">% Práctica</th>
          </tr>
        </thead>
        <tbody>
          @for (alumno of alumnos(); track alumno.studentId) {
            <tr>
              <td>
                <div class="flex items-center gap-2">
                  <div class="initials-avatar">{{ alumno.initials }}</div>
                  <div>
                    <p class="text-sm font-medium text-text-primary">{{ alumno.nombre }}</p>
                    <p class="text-xs text-text-muted">{{ alumno.rut }}</p>
                  </div>
                </div>
              </td>
              <td class="text-center text-sm text-text-secondary">
                {{ alumno.teoriaAsistida }}/{{ alumno.teoriaTotal }}
              </td>
              <td class="text-center">
                <app-badge [variant]="pctVariant(alumno.pctTeoria)">
                  {{ alumno.pctTeoria }}%
                </app-badge>
              </td>
              <td class="text-center text-sm text-text-secondary">
                {{ alumno.practicaAsistida }}/{{ alumno.practicaTotal }}
              </td>
              <td class="text-center">
                <app-badge [variant]="pctVariant(alumno.pctPractica)">
                  {{ alumno.pctPractica }}%
                </app-badge>
              </td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .resumen-table {
      border-collapse: collapse;
    }
    .resumen-table th {
      padding: 10px 16px;
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-elevated);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .resumen-table td {
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .resumen-table tr:last-child td {
      border-bottom: none;
    }
    .resumen-table tr:hover td {
      background: var(--bg-elevated);
    }

    .initials-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
      background: var(--color-primary-tint);
      color: var(--color-primary);
    }
  `,
})
export class ResumenAlumnosTableComponent {
  readonly alumnos = input.required<ResumenAlumnoAsistencia[]>();
  readonly isLoading = input(false);

  pctVariant(pct: number): 'success' | 'warning' | 'error' {
    if (pct >= 75) return 'success';
    if (pct >= 50) return 'warning';
    return 'error';
  }
}
