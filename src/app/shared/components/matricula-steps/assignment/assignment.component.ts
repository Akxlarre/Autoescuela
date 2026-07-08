import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { ScheduleGridComponent } from '@shared/components/schedule-grid/schedule-grid.component';
import { EnrollmentAssignmentData } from '@core/models/ui/enrollment-assignment.model';

@Component({
  selector: 'app-assignment-step',
  imports: [
    FormsModule,
    SelectModule,
    IconComponent,
    AsyncBtnComponent,
    SkeletonBlockComponent,
    ScheduleGridComponent,
  ],
  templateUrl: './assignment.component.html',
  styleUrl: './assignment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentComponent {
  data = input.required<EnrollmentAssignmentData>();
  loading = input<boolean>(false);
  /** Número de paso a mostrar en el encabezado (default: 2 para flujo admin). */
  stepNumber = input<number>(2);
  /** Oculta la sección de modalidad de pago (cuando ya fue elegida en un paso previo). */
  hidePaymentMode = input<boolean>(false);
  /** Texto del botón de acción principal (default: flujo de matrícula). */
  nextLabel = input<string>('Continuar a Documentos');
  dataChange = output<EnrollmentAssignmentData>();
  next = output<void>();
  back = output<void>();

  /** Habilita "Continuar" según la vista activa. */
  readonly canContinue = computed<boolean>(() => {
    const d = this.data();
    if (d.view === 'class-b') return d.slotSelection.isComplete && d.paymentMode !== null;
    if (d.view === 'professional') return d.promotionId !== null;
    return true; // singular
  });

  /** Emite copia con campo actualizado — SIN mutar el input. */
  emitField<K extends keyof EnrollmentAssignmentData>(
    field: K,
    value: EnrollmentAssignmentData[K],
  ): void {
    this.dataChange.emit({ ...this.data(), [field]: value });
  }

  /** Propaga la nueva selección de slots emitida por la grilla compartida. */
  onSlotsChange(selectedSlotIds: string[]): void {
    const current = this.data();
    this.dataChange.emit({
      ...current,
      slotSelection: {
        ...current.slotSelection,
        selectedSlotIds,
        currentCount: selectedSlotIds.length,
        isComplete: selectedSlotIds.length === current.slotSelection.requiredCount,
      },
    });
  }

  /** Cambio de instructor desde el p-select. */
  onInstructorChange(id: number | null): void {
    if (id != null) this.emitField('instructorId', id);
  }

  onNext(): void {
    this.next.emit();
  }

  onBack(): void {
    this.back.emit();
  }
}
