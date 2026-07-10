import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { AssignmentComponent } from '@shared/components/matricula-steps/assignment/assignment.component';
import type { EnrollmentAssignmentData } from '@core/models/ui/enrollment-assignment.model';

/**
 * AdminReagendarHorariosDrawerComponent — Smart / Drawer. Paso 2 de 2.
 *
 * RF-053: reutiliza EXACTAMENTE el mismo componente/flujo de agendamiento del
 * wizard de Matrícula (`app-assignment-step` + `app-schedule-grid`, Step 2) para
 * que la secretaria elija un instructor y agende, de una sola vez, tantas clases
 * como se hayan marcado en el Paso 1 (`facade.reagendarSeleccion()`). No hay
 * inputs por fila — es la grilla masiva de disponibilidad, igual que al matricular.
 */
@Component({
  selector: 'app-admin-reagendar-horarios-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AssignmentComponent],
  template: `
    <div class="flex flex-col h-full bg-surface">
      <div class="flex-1 overflow-y-auto p-5">
        <app-assignment-step
          [data]="assignmentData()"
          [loading]="isSaving()"
          [hidePaymentMode]="true"
          nextLabel="Guardar Reagendamiento"
          (dataChange)="onDataChange($event)"
          (next)="onSave()"
          (back)="onBack()"
        />
      </div>
      @if (saveError()) {
        <p class="text-sm text-error px-5 pb-4">{{ saveError() }}</p>
      }
    </div>
  `,
})
export class AdminReagendarHorariosDrawerComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly sanitizer = inject(ErrorSanitizerService);

  protected readonly instructorId = signal<number | null>(null);
  protected readonly selectedSlotIds = signal<string[]>([]);
  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  /** Reconstruye el modelo compuesto del Step 2 de matrícula a partir del estado local + facade. */
  protected readonly assignmentData = computed<EnrollmentAssignmentData>(() => {
    const alumno = this.facade.alumno();
    const requiredCount = this.facade.reagendarSeleccion().length;
    const slots = this.selectedSlotIds();

    return {
      view: 'class-b',
      studentSummary: {
        initials: '',
        fullName: alumno?.nombre ?? '',
        courseLabel: alumno?.curso ?? '',
      },
      // Irrelevante para este flujo (oculto via hidePaymentMode) — fijo para no bloquear canContinue().
      paymentMode: 'total',
      totalSessions: requiredCount,
      instructorId: this.instructorId(),
      instructors: this.facade.instructores(),
      scheduleGrid: this.facade.scheduleGrid(),
      scheduleLoading: this.facade.isLoadingSchedule(),
      slotSelection: {
        selectedSlotIds: slots,
        requiredCount,
        currentCount: slots.length,
        // Mismo tope que el wizard admin/secretaria (vs 1 en el flujo público).
        maxClassesPerDay: 3,
        isComplete: slots.length === requiredCount,
      },
      promotionId: null,
      promotionGroups: [],
      convalidatesSimultaneously: false,
      convalidatedLicense: null,
    };
  });

  ngOnInit(): void {
    void this.facade.loadInstructores();
  }

  protected onDataChange(data: EnrollmentAssignmentData): void {
    if (data.instructorId !== this.instructorId()) {
      this.instructorId.set(data.instructorId);
      this.selectedSlotIds.set([]);
      if (data.instructorId !== null) void this.facade.loadScheduleGrid(data.instructorId);
      return;
    }
    this.selectedSlotIds.set(data.slotSelection.selectedSlotIds);
  }

  protected async onSave(): Promise<void> {
    const enrollmentId = this.facade.alumno()?.enrollmentId;
    const instructorId = this.instructorId();
    if (!enrollmentId || !instructorId || this.selectedSlotIds().length === 0) return;

    this.isSaving.set(true);
    this.saveError.set(null);
    try {
      await this.facade.reagendarClasesPenalizadas({
        enrollmentId,
        instructorId,
        selectedSlotIds: this.selectedSlotIds(),
      });
      this.layoutDrawer.close();
    } catch (err) {
      this.saveError.set(
        err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error al guardar.',
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  /** Vuelve al checklist del Paso 1 (conserva la selección ya marcada en el historial del drawer). */
  protected onBack(): void {
    this.layoutDrawer.back();
  }
}
