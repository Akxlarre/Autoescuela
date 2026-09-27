import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { StudentStageCounts } from '@core/models/ui/executive-dashboard.model';
import { IconComponent } from '../icon/icon.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';

interface StageRow {
  id: string;
  label: string;
  hint: string;
  icon: string;
  value: number;
}

/**
 * Estado de los alumnos Clase B + aprobación de ensayos (spec 0044-b, AC17/AC18).
 * "Nuevos" es del período elegido; el resto es la foto del momento.
 */
@Component({
  selector: 'app-student-stages-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent],
  template: `
    <div class="flex items-center gap-2 mb-3 shrink-0">
      <app-icon name="graduation-cap" [size]="16" class="text-text-secondary" />
      <h2 class="item-title m-0">Estado de alumnos</h2>
    </div>

    @if (loading() || !stages()) {
      <div class="flex flex-col gap-3">
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <app-skeleton-block variant="text" width="100%" height="22px" />
        }
      </div>
    } @else {
      <ul class="m-0 p-0 list-none flex flex-col divide-y divide-border-subtle">
        @for (s of rows(); track s.id) {
          <li class="flex items-center justify-between gap-3 py-2">
            <div class="flex items-center gap-2 min-w-0">
              <app-icon [name]="s.icon" [size]="14" class="text-text-muted shrink-0" />
              <div class="min-w-0">
                <p class="m-0 text-sm text-text-primary truncate">{{ s.label }}</p>
                <p class="m-0 text-2xs text-text-muted truncate">{{ s.hint }}</p>
              </div>
            </div>
            <span class="text-lg font-semibold text-text-primary tabular-nums">{{ s.value }}</span>
          </li>
        }
      </ul>

      <div
        class="mt-auto pt-3 border-t border-border-subtle flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="micro-label m-0">Aprobación de ensayos</p>
          <p class="m-0 text-2xs text-text-muted">Ensayos de examen del período</p>
        </div>
        <span class="text-lg font-semibold text-text-primary tabular-nums">{{
          passRateLabel()
        }}</span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        height: 100%;
      }
    `,
  ],
})
export class StudentStagesPanelComponent {
  readonly stages = input<StudentStageCounts | null>(null);
  /** % de ensayos aprobados; `null` sin ensayos en el período. */
  readonly examPassRate = input<number | null>(null);
  readonly loading = input<boolean>(false);

  protected readonly rows = computed<StageRow[]>(() => {
    const s = this.stages();
    if (!s) return [];
    return [
      {
        id: 'nuevos',
        label: 'Nuevos',
        hint: 'Matriculados en el período',
        icon: 'user-plus',
        value: s.nuevos,
      },
      {
        id: 'curso',
        label: 'En curso',
        hint: 'Clases prácticas en progreso',
        icon: 'car',
        value: s.enCurso,
      },
      {
        id: 'examen',
        label: 'Pendientes de examen municipal',
        hint: 'Curso terminado, certificado habilitado',
        icon: 'clipboard-check',
        value: s.pendienteExamen,
      },
      {
        id: 'fin',
        label: 'Finalizados',
        hint: 'Matrícula completada',
        icon: 'badge-check',
        value: s.finalizados,
      },
      {
        id: 'saldo',
        label: 'Con saldo pendiente',
        hint: 'Deben parte del curso',
        icon: 'wallet',
        value: s.conSaldo,
      },
    ];
  });

  protected readonly passRateLabel = computed(() => {
    const r = this.examPassRate();
    return r === null ? '—' : `${String(r).replace('.', ',')}%`;
  });
}
