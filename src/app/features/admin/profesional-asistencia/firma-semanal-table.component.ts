import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import type { AlumnoFirmaSemana } from '@core/models/ui/sesion-profesional.model';

/**
 * Tabla de firma semanal de asistencia teórica (Dumb, colocated).
 * La selección de alumnos pendientes vive acá como estado UI local y se
 * resetea sola cuando cambia el listado (post-registro o cambio de semana).
 */
@Component({
  selector: 'app-firma-semanal-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, BadgeComponent, SkeletonBlockComponent],
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
      <table class="firma-table w-full">
        <thead>
          <tr>
            <th class="text-left">Alumno</th>
            <th class="text-center">% Teoría esta semana</th>
            <th class="text-center">Estado firma</th>
            <th class="text-center">
              @if (hasPending()) {
                <label class="flex items-center gap-1 cursor-pointer justify-center">
                  <input
                    type="checkbox"
                    [checked]="allPendingSelected()"
                    (change)="toggleSelectAll()"
                    data-llm-description="Seleccionar todos los alumnos sin firma"
                    class="cursor-pointer"
                  />
                  <span>Marcar todos</span>
                </label>
              }
            </th>
          </tr>
        </thead>
        <tbody>
          @for (alumno of alumnos(); track alumno.enrollmentId) {
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
              <td class="text-center">
                @if (alumno.pctTeoriaSemana === 0 && sinSesionesSemana()) {
                  <span class="text-xs text-text-muted">Sin sesiones</span>
                } @else {
                  <app-badge [variant]="pctVariant(alumno.pctTeoriaSemana)">
                    {{ alumno.pctTeoriaSemana }}%
                  </app-badge>
                }
              </td>
              <td class="text-center">
                @if (alumno.signatureId !== null) {
                  <app-badge variant="success">
                    <app-icon name="check-circle" [size]="12" class="mr-1" />
                    Firmó {{ formatSignedAt(alumno.signedAt) }}
                  </app-badge>
                } @else {
                  <app-badge variant="neutral">Sin firma</app-badge>
                }
              </td>
              <td class="text-center">
                @if (alumno.signatureId === null) {
                  <input
                    type="checkbox"
                    [checked]="isSelected(alumno.enrollmentId)"
                    (change)="toggleSelect(alumno.enrollmentId)"
                    data-llm-action="select-student-for-signature"
                    class="cursor-pointer"
                  />
                }
              </td>
            </tr>
          }
        </tbody>
      </table>

      @if (selected().length > 0) {
        <div
          class="firma-footer flex items-center justify-between border-t border-border px-4 py-3 bg-surface"
        >
          <span class="text-xs text-text-secondary">
            {{ selected().length }} alumno{{ selected().length > 1 ? 's' : '' }} seleccionado{{
              selected().length > 1 ? 's' : ''
            }}
          </span>
          <button
            class="btn-primary"
            [disabled]="isSaving()"
            (click)="onRegistrar()"
            data-llm-action="register-weekly-signatures"
          >
            <app-icon name="pen-line" [size]="14" />
            Registrar firma{{ selected().length > 1 ? 's' : '' }}
          </button>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .firma-table {
      border-collapse: collapse;
    }
    .firma-table th {
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
    .firma-table td {
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .firma-table tr:last-child td {
      border-bottom: none;
    }
    .firma-table tr:hover td {
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

    /* El footer de acción queda pegado abajo cuando la tabla scrollea (panel fill) */
    .firma-footer {
      position: sticky;
      bottom: 0;
    }
  `,
})
export class FirmaSemanalTableComponent {
  readonly alumnos = input.required<AlumnoFirmaSemana[]>();
  readonly isLoading = input(false);
  readonly isSaving = input(false);
  /** true cuando la semana visible no tiene sesiones de teoría (Lun/Mar sin carga). */
  readonly sinSesionesSemana = input(false);

  readonly registrarFirmas = output<number[]>();

  /** Selección local de pendientes — se resetea sola al cambiar el listado. */
  readonly selected = linkedSignal<AlumnoFirmaSemana[], number[]>({
    source: this.alumnos,
    computation: () => [],
  });

  readonly hasPending = computed(() => this.alumnos().some((a) => a.signatureId === null));

  readonly allPendingSelected = computed(() => {
    const pending = this.alumnos().filter((a) => a.signatureId === null);
    return pending.length > 0 && pending.every((a) => this.selected().includes(a.enrollmentId));
  });

  isSelected(enrollmentId: number): boolean {
    return this.selected().includes(enrollmentId);
  }

  toggleSelect(enrollmentId: number): void {
    this.selected.update((ids) =>
      ids.includes(enrollmentId) ? ids.filter((id) => id !== enrollmentId) : [...ids, enrollmentId],
    );
  }

  toggleSelectAll(): void {
    const pending = this.alumnos()
      .filter((a) => a.signatureId === null)
      .map((a) => a.enrollmentId);
    this.selected.set(this.allPendingSelected() ? [] : pending);
  }

  onRegistrar(): void {
    this.registrarFirmas.emit(this.selected());
  }

  pctVariant(pct: number): 'success' | 'warning' | 'error' {
    if (pct >= 75) return 'success';
    if (pct >= 50) return 'warning';
    return 'error';
  }

  formatSignedAt(signedAt: string | null): string {
    if (!signedAt) return '';
    const d = new Date(signedAt);
    const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    return `${dayNames[d.getDay()]} ${d.getDate()}`;
  }
}
