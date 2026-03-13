import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';

import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';

import { AgendaFacade } from '@core/facades/agenda.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import type { AgendableStudent } from '@core/models/ui/agenda.model';

/**
 * AgendaScheduleDrawerComponent — Smart component cargado dinámicamente vía
 * NgComponentOutlet en el LayoutDrawer para agendar una clase práctica.
 *
 * Vive en features/ (no en shared/) porque inyecta AgendaFacade.
 * Es usado por admin-agenda y secretaria-agenda que lo pasan a
 * LayoutDrawerFacadeService.open().
 */
@Component({
  selector: 'app-agenda-schedule-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    IconComponent,
    SkeletonBlockComponent,
    AsyncBtnComponent,
    AnimateInDirective,
  ],
  template: `
    <div class="flex flex-col gap-5 p-1">
      <!-- Slot seleccionado (solo lectura) -->
      @if (slot()) {
        <div class="card card-tinted p-4 flex flex-col gap-2">
          <span class="kpi-label">Horario seleccionado</span>
          <div class="flex items-center gap-2 mt-1">
            <app-icon name="clock" [size]="15" />
            <span class="text-sm font-semibold text-text-primary">
              {{ slot()!.startTime }} – {{ slot()!.endTime }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <app-icon name="user" [size]="14" />
            <span class="text-sm text-text-secondary">{{ slot()!.instructorName }}</span>
          </div>
          <div class="flex items-center gap-2">
            <app-icon name="car" [size]="14" />
            <span class="text-sm text-text-secondary">{{ slot()!.vehiclePlate }}</span>
          </div>
        </div>
      }

      <!-- Selector de alumno -->
      <div class="flex flex-col gap-2">
        <label class="kpi-label" for="student-select"> Alumno a agendar </label>

        @if (facade.studentsLoading()) {
          <app-skeleton-block variant="rect" width="100%" height="40px" />
          <app-skeleton-block variant="rect" width="80%" height="40px" />
          <app-skeleton-block variant="rect" width="90%" height="40px" />
        } @else if (facade.agendableStudents().length === 0) {
          <div class="card p-3 flex items-start gap-2">
            <app-icon name="info" [size]="15" />
            <p class="text-sm text-text-muted m-0">
              No hay alumnos con clases pendientes de agendar en esta sede.
            </p>
          </div>
        } @else {
          <p-select
            inputId="student-select"
            [options]="studentOptions()"
            [(ngModel)]="selectedEnrollmentId"
            optionLabel="label"
            optionValue="value"
            placeholder="Buscar alumno..."
            [style]="{ width: '100%' }"
            [filter]="true"
            filterPlaceholder="Escribe el nombre..."
            [showClear]="true"
            [attr.data-llm-description]="'Selector de alumno para agendar clase práctica'"
          />
        }
      </div>

      <!-- Detalle del alumno seleccionado -->
      @if (selectedStudent()) {
        <div class="card p-3 flex flex-col gap-2" appAnimateIn>
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            {{ selectedStudent()!.courseName }}
          </span>
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-muted">Clases asignadas</span>
            <span class="text-xs font-semibold text-text-primary">
              {{ selectedStudent()!.scheduledSessions }} / {{ selectedStudent()!.totalSessions }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-muted">Cupo restante</span>
            <span class="text-xs font-bold" [style.color]="remainingColor()">
              {{ selectedStudent()!.remainingSessions }} clases
            </span>
          </div>
        </div>
      }

      <!-- Error -->
      @if (facade.error()) {
        <div class="flex items-center gap-2" style="color: var(--state-error)">
          <app-icon name="alert-circle" [size]="14" />
          <p class="text-xs m-0">{{ facade.error() }}</p>
        </div>
      }

      <!-- Acciones -->
      <div class="flex flex-col gap-2 pt-2 border-t">
        <app-async-btn
          label="Confirmar agendamiento"
          icon="check-circle"
          [loading]="facade.isScheduling()"
          [disabled]="!canConfirm()"
          (click)="confirm()"
          data-llm-action="confirm-schedule-class"
        />
        <button
          class="text-sm text-text-muted text-center py-2 hover:text-text-secondary cursor-pointer"
          (click)="cancel()"
          data-llm-action="cancel-schedule"
        >
          Cancelar
        </button>
      </div>
    </div>
  `,
})
export class AgendaScheduleDrawerComponent implements OnInit {
  readonly facade = inject(AgendaFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);

  selectedEnrollmentId: number | null = null;

  readonly slot = this.facade.selectedSlot;

  readonly studentOptions = computed(() =>
    this.facade.agendableStudents().map((s) => ({
      label: `${s.studentName} — ${s.remainingSessions} restante${s.remainingSessions !== 1 ? 's' : ''}`,
      value: s.enrollmentId,
    })),
  );

  readonly selectedStudent = computed<AgendableStudent | undefined>(() =>
    this.facade.agendableStudents().find((s) => s.enrollmentId === this.selectedEnrollmentId),
  );

  readonly canConfirm = computed(
    () =>
      !!this.selectedEnrollmentId &&
      !!this.slot() &&
      !this.facade.isScheduling() &&
      (this.selectedStudent()?.remainingSessions ?? 0) > 0,
  );

  readonly remainingColor = computed(() => {
    const remaining = this.selectedStudent()?.remainingSessions ?? 0;
    return remaining > 3 ? 'var(--state-success)' : 'var(--state-warning)';
  });

  ngOnInit(): void {
    this.facade.loadAgendableStudents();
  }

  async confirm(): Promise<void> {
    const s = this.slot();
    if (!s || !this.selectedEnrollmentId) return;

    const ok = await this.facade.scheduleClass(
      this.selectedEnrollmentId,
      s.id,
      s.instructorId,
      s.vehicleId,
    );

    if (ok) {
      this.drawer.close();
    }
  }

  cancel(): void {
    this.facade.setSelectedSlot(null);
    this.drawer.close();
  }
}
