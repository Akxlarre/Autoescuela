import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ScheduleGridComponent } from '@shared/components/schedule-grid/schedule-grid.component';
import type { EnrollmentAssignmentData } from '@core/models/ui/enrollment-assignment.model';

@Component({
  selector: 'app-public-schedule',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, FormsModule, SelectModule, ScheduleGridComponent],
  styles: [
    `
      /* Estilos para el p-select para igualar los inputs premium de la UI */
      :host ::ng-deep .instructor-select.p-select {
        height: 48px;
        border-radius: 0.75rem;
        background: var(--bg-surface);
        border: 1.5px solid var(--border-default);
        align-items: center;
        transition: all 0.2s ease;
      }
      :host ::ng-deep .instructor-select.p-select:hover {
        border-color: var(--border-strong);
      }
      :host ::ng-deep .instructor-select.p-select.p-focus {
        border-color: var(--ds-brand);
        box-shadow: 0 0 0 2px rgba(var(--ds-brand-rgb, 59, 130, 246), 0.2);
      }

      /* --- Diseño Flotante Premium (Tailwind UI / macOS) --- */
      /* El input se mantiene con su radio completo, y al estar abierto o en focus brilla suavemente */
      :host ::ng-deep .instructor-select.p-select.p-select-open {
        border-color: var(--ds-brand);
        box-shadow: 0 0 0 3px rgba(var(--ds-brand-rgb, 59, 130, 246), 0.15);
      }

      /* El panel flotante será una tarjeta separada, elegante y simétrica */
      :host ::ng-deep .instructor-select-panel {
        background: var(--bg-surface) !important;
        border: 1px solid var(--border-subtle) !important;
        border-radius: 0.75rem !important; /* Curvo en los 4 lados */
        box-shadow:
          0 12px 32px -4px rgba(0, 0, 0, 0.08),
          0 4px 12px -4px rgba(0, 0, 0, 0.04) !important; /* Sombra difusa y elegante */
        margin-top: 6px !important; /* Gap intencional */
        padding: 4px !important; /* Espacio interno de respiración */
        transform: none !important;
      }
      /* ----------------------------------------------- */

      :host ::ng-deep .instructor-select .p-select-label {
        font-family: var(--font-body);
        font-size: 0.875rem;
        color: var(--text-primary);
        padding: 0.75rem 1rem;
        display: flex;
        align-items: center;
      }
      :host ::ng-deep .instructor-select .p-select-dropdown {
        color: var(--text-muted);
        width: 2.5rem;
      }
      :host ::ng-deep .p-select-list-container {
        font-family: var(--font-body);
        font-size: 0.875rem;
      }

      /* Opciones del selector (Estilo Islas / Tailwind UI) */
      :host ::ng-deep .instructor-select-panel .p-select-option {
        border-radius: 0.5rem !important; /* Redondeo interior para cada opción */
        margin-bottom: 2px;
        padding: 0.6rem 0.75rem !important;
        font-family: var(--font-body);
        font-size: 0.875rem;
        color: var(--text-secondary);
        transition: all 0.2s ease;
      }
      :host ::ng-deep .instructor-select-panel .p-select-option:last-child {
        margin-bottom: 0;
      }
      :host
        ::ng-deep
        .instructor-select-panel
        .p-select-option:not(.p-select-option-selected):not(.p-disabled):hover {
        background: var(--bg-subtle) !important;
        color: var(--text-primary);
      }
      :host ::ng-deep .instructor-select-panel .p-select-option-selected {
        background: var(--color-primary-muted) !important;
        color: var(--ds-brand) !important;
        font-weight: 600;
      }
    `,
  ],
  template: `
    <div class="space-y-5">
      <div>
        <h2
          class="font-bold mb-1"
          style="font-family: var(--font-display); font-size: 1.3rem; color: var(--text-primary);"
        >
          Elige tu horario
        </h2>
        <p class="text-sm" style="color: var(--text-secondary);">
          Selecciona
          <strong style="color: var(--text-primary);">{{
            data().slotSelection.requiredCount
          }}</strong>
          clases prácticas para comenzar. Máximo {{ data().slotSelection.maxClassesPerDay }} por
          día.
        </p>
      </div>

      <!-- Instructor selector -->
      <div class="flex flex-col gap-1.5">
        <label
          class="text-xs font-semibold"
          style="color: var(--text-secondary);"
          for="pub-instructor"
        >
          Instructor
        </label>
        <p-select
          inputId="pub-instructor"
          [options]="data().instructors"
          optionLabel="name"
          optionValue="id"
          [placeholder]="
            loading() && data().instructors.length === 0
              ? 'Cargando instructores disponibles...'
              : '— Selecciona un instructor —'
          "
          [disabled]="loading() && data().instructors.length === 0"
          [ngModel]="data().instructorId"
          (ngModelChange)="onInstructorChangeNgModel($event)"
          styleClass="w-full instructor-select"
          panelStyleClass="instructor-select-panel"
        />
      </div>

      <!-- Schedule grid -->
      @if (!data().instructorId) {
        <div
          class="flex flex-col items-center gap-3 rounded-xl p-6 text-center"
          style="background: var(--bg-surface); border: 1.5px dashed var(--border-muted);"
        >
          <div
            class="flex h-11 w-11 items-center justify-center rounded-full"
            style="background: var(--color-primary-muted);"
            aria-hidden="true"
          >
            <app-icon name="calendar" [size]="20" color="var(--color-primary)" />
          </div>
          <div>
            <p class="font-semibold text-sm" style="color: var(--text-primary);">
              Selecciona un instructor para ver los horarios
            </p>
            <p class="text-xs mt-1" style="color: var(--text-secondary);">
              Los horarios disponibles aparecerán aquí una vez que elijas tu instructor.
            </p>
          </div>
        </div>
      } @else if (data().scheduleLoading && !data().scheduleGrid) {
        <div
          class="flex flex-col items-center justify-center p-12 text-center rounded-xl"
          style="background: var(--bg-surface); border: 1px dashed var(--border-default);"
        >
          <app-icon
            name="loader"
            class="animate-spin mb-3"
            [size]="32"
            color="var(--text-secondary)"
          />
          <p class="text-sm font-semibold" style="color: var(--text-primary);">
            Cargando horario...
          </p>
          <p class="text-xs mt-1" style="color: var(--text-secondary);">
            Buscando disponibilidad del instructor
          </p>
        </div>
      } @else if (data().scheduleGrid) {
        <app-schedule-grid
          [scheduleGrid]="data().scheduleGrid"
          [slotSelection]="data().slotSelection"
          [scheduleLoading]="data().scheduleLoading"
          (slotsChange)="onSlotsChange($event)"
        />
      } @else if (!data().scheduleLoading) {
        <div
          class="flex items-center gap-3 rounded-xl p-4 text-sm"
          style="background: var(--bg-surface); border: 1px solid var(--border-subtle);"
        >
          <app-icon name="calendar-x" [size]="18" color="var(--text-muted)" />
          <span style="color: var(--text-secondary);">
            No hay disponibilidad para este instructor en este período.
          </span>
        </div>
      }

      <!-- Nav -->
      <div class="flex justify-between pt-2 border-t" style="border-color: var(--border-subtle);">
        <button
          type="button"
          class="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
          style="color: var(--text-secondary);"
          (click)="back.emit()"
        >
          <app-icon name="arrow-left" [size]="16" />
          Volver
        </button>
        <button
          type="button"
          class="btn-primary px-7 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2"
          [disabled]="!selectionComplete() || loading()"
          data-llm-action="confirm-schedule-selection"
          (click)="onNext()"
        >
          @if (loading()) {
            <app-icon name="loader" [size]="16" class="animate-spin" />
            Confirmando...
          } @else {
            Confirmar horario
          }
        </button>
      </div>
    </div>
  `,
})
export class PublicScheduleComponent {
  readonly data = input.required<EnrollmentAssignmentData>();
  readonly loading = input<boolean>(false);
  readonly dataChange = output<EnrollmentAssignmentData>();
  readonly next = output<void>();
  readonly back = output<void>();

  /** Habilita el botón "Confirmar horario" cuando se completó la selección. */
  protected readonly selectionComplete = computed(
    () => this.data().slotSelection.currentCount >= this.data().slotSelection.requiredCount,
  );

  /** Propaga la nueva selección emitida por la grilla compartida. */
  protected onSlotsChange(selectedSlotIds: string[]): void {
    this.dataChange.emit({
      ...this.data(),
      slotSelection: { ...this.data().slotSelection, selectedSlotIds },
    });
  }

  protected onInstructorChangeNgModel(id: number | null): void {
    if (id) {
      this.dataChange.emit({ ...this.data(), instructorId: id });
    }
  }

  protected onNext(): void {
    if (this.selectionComplete()) this.next.emit();
  }
}
