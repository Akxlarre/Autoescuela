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
  host: {
    class: 'flex flex-col h-full',
  },
  template: `
    <div class="flex flex-col h-full">
      <!-- Contenido Principal -->
      <div class="flex-1 flex flex-col gap-6 p-1">
        <!-- Slot seleccionado (solo lectura) -->
        @if (slot(); as s) {
          <div class="slot-hero card p-0 overflow-hidden" appAnimateIn>
            <!-- Franja de disponibilidad -->
            <div class="slot-hero-badge">
              <app-icon name="check-circle" [size]="12" />
              <span>Cupo disponible</span>
            </div>
            <!-- Horario -->
            <div class="slot-hero-body">
              <span class="kpi-label">Horario seleccionado</span>
              <div class="slot-hero-time">{{ s.startTime }} – {{ s.endTime }}</div>
            </div>
            <!-- Instructor + Vehículo -->
            <div class="slot-hero-meta">
              <div class="slot-meta-row" style="border-bottom: 1px solid var(--color-border)">
                <div class="slot-meta-icon"><app-icon name="user" [size]="14" /></div>
                <div class="slot-meta-body">
                  <span class="slot-meta-label">Instructor</span>
                  <span class="slot-meta-value">{{ s.instructorName }}</span>
                </div>
              </div>
              <div class="slot-meta-row">
                <div class="slot-meta-icon"><app-icon name="car" [size]="14" /></div>
                <div class="slot-meta-body">
                  <span class="slot-meta-label">Vehículo</span>
                  <span class="slot-meta-value">{{ s.vehiclePlate }}</span>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Selector de alumno -->
        <div class="flex flex-col gap-2.5">
          <label class="kpi-label" for="student-select"> Alumno a agendar </label>

          @if (facade.studentsLoading()) {
            <div class="flex flex-col gap-2">
              <app-skeleton-block variant="rect" width="100%" height="45px" />
              <div class="flex gap-2">
                <app-skeleton-block variant="rect" width="60%" height="20px" />
                <app-skeleton-block variant="rect" width="30%" height="20px" />
              </div>
            </div>
          } @else if (facade.agendableStudents().length === 0) {
            <div class="card p-4 flex items-start gap-3 bg-subtle border-none">
              <app-icon name="info" [size]="18" class="text-text-muted mt-0.5" />
              <p class="text-sm text-text-secondary m-0 leading-relaxed">
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
              styleClass="premium-select"
              [filter]="true"
              filterPlaceholder="Escribe el nombre..."
              [showClear]="true"
              [attr.data-llm-description]="'Selector de alumno para agendar clase práctica'"
            />
          }
        </div>

        <!-- Detalle del alumno seleccionado -->
        @if (selectedStudent()) {
          <div class="card p-4 flex flex-col gap-3" appAnimateIn>
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-brand"></div>
              <span class="text-xs font-bold text-text-primary uppercase tracking-wider">
                {{ selectedStudent()!.courseName }}
              </span>
            </div>

            <div class="flex flex-col gap-2 pt-1">
              <div class="flex items-center justify-between">
                <span class="text-xs text-text-muted">Clases agendadas</span>
                <span class="text-xs font-semibold text-text-primary">
                  {{ selectedStudent()!.scheduledSessions }} de {{ selectedStudent()!.totalSessions }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-text-muted">Estado de disponibilidad</span>
                <span class="text-xs font-bold px-2 py-0.5 rounded-md bg-surface border"
                      [style.color]="remainingColor()"
                      [style.borderColor]="remainingColor().replace(')', ', 0.2)')">
                  {{ selectedStudent()!.remainingSessions }} cupos libres
                </span>
              </div>
            </div>
          </div>
        }

        <!-- Error -->
        @if (facade.error()) {
          <div class="flex items-start gap-2 p-3 rounded-lg bg-[var(--state-error-bg)]/50 border border-[var(--state-error)]" style="color: var(--state-error)">
            <app-icon name="circle-alert" [size]="16" class="mt-0.5" />
            <p class="text-xs font-medium m-0 leading-tight">{{ facade.error() }}</p>
          </div>
        }
      </div>

      <!-- Acciones (Sticky Footer) -->
      <div class="flex items-center justify-between gap-4 pt-6 pb-4 border-t mt-auto sticky bottom-0 bg-surface z-10"
           style="border-color: var(--border-subtle);">
        <button
          class="cancel-btn-text"
          (click)="cancel()"
          data-llm-action="cancel-schedule"
        >
          Cancelar reservación
        </button>

        <app-async-btn
          label="Confirmar agendamiento"
          icon="check-circle"
          [loading]="facade.isScheduling()"
          [disabled]="!canConfirm()"
          (click)="confirm()"
          data-llm-action="confirm-schedule-class"
        />
      </div>
    </div>
  `,
  styles: `
    /* ── Slot hero card ── */

    .slot-hero {
      border-radius: var(--radius-lg);
    }

    .slot-hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin: 0.75rem 0.75rem 0;
      padding: 3px 9px;
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--state-success);
      background: color-mix(in srgb, var(--state-success) 12%, var(--bg-surface));
      align-self: flex-start;
    }

    .slot-hero-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 0.5rem 1rem 0.75rem;
    }

    .slot-hero-time {
      font-size: 1.5rem;
      font-weight: var(--font-bold);
      color: var(--text-primary);
      letter-spacing: -0.02em;
      line-height: 1.2;
    }

    .slot-hero-meta {
      border-top: 1px solid var(--color-border);
    }

    .slot-meta-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
    }

    .slot-meta-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-md);
      background: var(--bg-elevated);
      color: var(--text-secondary);
      flex-shrink: 0;
    }

    .slot-meta-body {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .slot-meta-label {
      font-size: var(--text-xs);
      color: var(--text-muted);
    }

    .slot-meta-value {
      font-size: 0.875rem;
      font-weight: var(--font-semibold);
      color: var(--text-primary);
    }

    .cancel-btn-text {
      padding: 0.625rem 0.5rem;
      border-radius: var(--radius-lg);
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-muted);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      cursor: pointer;
      transition: all var(--duration-standard) var(--ease-standard);

      &:hover {
        background: var(--bg-subtle);
        color: var(--text-secondary);
      }
    }

    /* Custom styles for PrimeNG Select in drawer */
    :host ::ng-deep .premium-select {
        border-radius: var(--radius-lg) !important;
        background: var(--bg-subtle) !important;
        border-color: var(--border-subtle) !important;
    }
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
      this.drawer.back();
    }
  }

  cancel(): void {
    this.facade.setSelectedSlot(null);
    this.drawer.back();
  }
}
