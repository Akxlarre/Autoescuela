import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { mondayOfIso } from '@core/utils/chile-time.utils';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import {
  AdminAlumnoDetalleFacade,
  RAZON_REAGENDAMIENTO_OPTIONS,
} from '@core/facades/admin-alumno-detalle.facade';
import { isRazonReagendamientoCompleta } from '@core/utils/reagendamiento.utils';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { TimeSlot, WeekDay } from '@core/models/ui/enrollment-assignment.model';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { vehicleDocWarningLabelGeneric } from '@core/utils/vehicle-document-status.utils';

@Component({
  selector: 'app-admin-reprogramar-clase-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, TooltipModule, FormsModule, SelectModule],
  template: `
    <div class="flex flex-col h-full bg-surface">
      <!-- ── Body ── -->
      <div class="flex-1 overflow-y-auto p-5 space-y-6">
        <!-- Clase target banner -->
        <div
          class="flex items-center gap-3 p-3 rounded-xl border bg-elevated border-border-default"
        >
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-brand bg-brand/10"
          >
            <app-icon name="calendar-clock" [size]="18" />
          </div>
          <div class="flex flex-col">
            <span class="item-title">
              Clase #{{ facade.reprogramarTarget()?.claseNumero }} —
              {{ facade.alumno()?.nombre }}
            </span>
            <span class="text-xs text-text-muted"> Selecciona instructor y nuevo horario </span>
          </div>
        </div>

        <!-- ── Razón (fix-279-m): mover una clase que ya tenía sesión queda en el historial ── -->
        @if (requiereRazon()) {
          <div class="space-y-3">
            <label
              for="razon-reprogramacion"
              class="block text-xs font-bold uppercase tracking-widest text-brand"
            >
              Razón del reagendamiento <span class="text-error">*</span>
            </label>
            <p-select
              inputId="razon-reprogramacion"
              [options]="razonOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccionar razón..."
              styleClass="w-full"
              [ngModel]="razon()"
              (ngModelChange)="razon.set($event)"
              data-llm-description="Razón por la que se reprograma esta clase"
            />
            @if (razon() === 'otro') {
              <input
                type="text"
                class="w-full h-9 px-3 text-sm rounded-lg border border-border-default bg-surface text-text-primary outline-none"
                placeholder="Especifica el motivo..."
                [ngModel]="razonOtro()"
                (ngModelChange)="razonOtro.set($event)"
                data-llm-description="Detalle del motivo cuando la razón es Otro"
              />
            }
          </div>
        }

        <!-- ── 1. Instructor ── -->
        <div class="space-y-3">
          <span class="text-xs font-bold uppercase tracking-widest text-brand">1. Instructor</span>

          @if (facade.isLoadingSchedule() && facade.instructores().length === 0) {
            <div class="flex flex-col gap-2">
              @for (i of skeletonRows; track i) {
                <div
                  class="flex items-center gap-3 p-3 border-2 border-border-default rounded-xl w-full"
                >
                  <app-skeleton-block
                    variant="circle"
                    width="36px"
                    height="36px"
                    class="shrink-0"
                  />
                  <div class="flex-1 min-w-0 flex flex-col gap-1.5">
                    <app-skeleton-block variant="text" width="60%" height="14px" />
                    <app-skeleton-block variant="text" width="40%" height="12px" />
                  </div>
                </div>
              }
            </div>
          } @else if (facade.instructores().length === 0) {
            <div
              class="p-6 rounded-xl border flex flex-col items-center gap-2 text-center bg-base border-border-default"
            >
              <app-icon name="user-x" [size]="24" class="text-text-muted" />
              <p class="text-sm text-text-muted">No hay instructores disponibles.</p>
            </div>
          } @else {
            <div class="flex flex-col gap-2">
              @for (instructor of facade.instructores(); track instructor.id) {
                <button
                  type="button"
                  (click)="selectInstructor(instructor.id)"
                  class="flex items-center gap-3 p-3 border-2 rounded-xl transition-all text-left w-full cursor-pointer"
                  [class.border-brand]="selectedInstructorId() === instructor.id"
                  [class.bg-brand-muted]="selectedInstructorId() === instructor.id"
                  [class.border-border-default]="selectedInstructorId() !== instructor.id"
                  data-llm-action="seleccionar-instructor-reprogramar"
                >
                  <div
                    class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
                    [class.bg-brand]="selectedInstructorId() === instructor.id"
                    [class.text-surface]="selectedInstructorId() === instructor.id"
                    [class.bg-subtle]="selectedInstructorId() !== instructor.id"
                    [class.text-text-muted]="selectedInstructorId() !== instructor.id"
                  >
                    <app-icon name="user" [size]="16" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-bold truncate"
                      [class.text-brand]="selectedInstructorId() === instructor.id"
                      [class.text-text-primary]="selectedInstructorId() !== instructor.id"
                    >
                      {{ instructor.name }}
                    </p>
                    <p class="text-xs text-text-muted truncate">
                      {{ instructor.vehicleDescription }} · {{ instructor.plate }}
                    </p>
                  </div>
                  @if (selectedInstructorId() === instructor.id) {
                    <app-icon name="check-circle" [size]="16" class="text-brand shrink-0" />
                  }
                </button>
              }
            </div>
          }
        </div>

        <!-- ── 2. Horario — visible solo al seleccionar instructor ── -->
        @if (selectedInstructorId()) {
          <div class="space-y-3">
            <span class="text-xs font-bold uppercase tracking-widest text-brand"
              >2. Selecciona el nuevo horario</span
            >

            @if (facade.isLoadingSchedule()) {
              <div
                class="h-40 rounded-2xl flex items-center justify-center gap-2 bg-base border border-border-default"
              >
                <app-icon name="loader-circle" [size]="16" class="animate-spin text-text-muted" />
                <span class="text-sm text-text-muted">Cargando disponibilidad...</span>
              </div>
            } @else if (!facade.scheduleGrid() || daysFromGrid().length === 0) {
              <div
                class="p-8 rounded-2xl flex flex-col items-center gap-2 text-center bg-base border border-border-default"
              >
                <app-icon name="calendar-x" [size]="28" class="text-text-muted" />
                <p class="item-title">Sin disponibilidad</p>
                <p class="text-xs text-text-muted">
                  Este instructor no tiene horarios disponibles en las próximas semanas.
                </p>
              </div>
            } @else {
              <div class="rounded-2xl overflow-hidden bg-base border border-border-default">
                <!-- Navegación semanas -->
                <div
                  class="flex items-center justify-between px-4 py-2.5 border-b bg-elevated border-border-subtle"
                >
                  <button
                    type="button"
                    aria-label="Semana anterior"
                    (click)="prevWeek()"
                    [disabled]="!hasPrevWeek()"
                    class="w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer hover:bg-subtle disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <app-icon name="chevron-left" [size]="16" class="text-text-secondary" />
                  </button>
                  <span class="text-xs font-bold text-text-secondary">{{ weekLabel() }}</span>
                  <button
                    type="button"
                    aria-label="Semana siguiente"
                    (click)="nextWeek()"
                    [disabled]="!hasNextWeek()"
                    class="w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer hover:bg-subtle disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <app-icon name="chevron-right" [size]="16" class="text-text-secondary" />
                  </button>
                </div>

                <!-- Tabs días -->
                <div class="flex overflow-x-auto border-b bg-elevated border-border-subtle">
                  @for (day of currentWeekDays(); track day.date; let i = $index) {
                    <button
                      type="button"
                      (click)="selectedDayIndex.set(i)"
                      class="flex-1 min-w-14 py-3 px-1 border-b-2 text-center transition-all cursor-pointer"
                      [class.border-brand]="selectedDayIndex() === i"
                      [class.bg-surface]="selectedDayIndex() === i"
                      [class.text-brand]="selectedDayIndex() === i"
                      [class.border-transparent]="selectedDayIndex() !== i"
                      [class.text-text-secondary]="selectedDayIndex() !== i"
                    >
                      <p class="text-2xs font-bold uppercase">{{ day.dayOfWeek }}</p>
                      <p class="text-sm font-black">{{ day.label }}</p>
                    </button>
                  }
                </div>

                <!-- Grid de slots -->
                <div class="p-3 grid grid-cols-2 gap-2">
                  @for (slot of slotsForDay(); track slot.id) {
                    @if (slot.status === 'occupied') {
                      <div
                        class="p-2.5 border rounded-lg flex items-center justify-center gap-1 cursor-not-allowed opacity-50 bg-subtle border-border-default"
                      >
                        <app-icon name="x" [size]="10" class="text-text-muted" />
                        <span class="text-xs text-text-muted"
                          >{{ slot.startTime }} – {{ slot.endTime }}</span
                        >
                      </div>
                    } @else {
                      <button
                        type="button"
                        (click)="selectSlot(slot.id)"
                        class="relative p-2.5 border rounded-lg text-xs font-medium transition-all text-center cursor-pointer"
                        [class.bg-brand]="selectedSlotId() === slot.id"
                        [class.text-surface]="selectedSlotId() === slot.id"
                        [class.border-brand]="selectedSlotId() === slot.id"
                        [class.bg-surface]="selectedSlotId() !== slot.id"
                        [class.text-text-primary]="selectedSlotId() !== slot.id"
                        [class.border-border-default]="selectedSlotId() !== slot.id"
                        data-llm-action="seleccionar-slot-reprogramar"
                      >
                        @if (slot.vehicleDocWarning) {
                          <app-icon
                            name="triangle-alert"
                            [size]="11"
                            color="var(--state-warning)"
                            class="absolute top-0.5 right-0.5"
                            [pTooltip]="vehicleDocWarningLabelGeneric(slot.vehicleDocWarning)"
                            tooltipPosition="top"
                            [attr.data-llm-description]="
                              vehicleDocWarningLabelGeneric(slot.vehicleDocWarning)
                            "
                          />
                        }
                        {{ slot.startTime }} – {{ slot.endTime }}
                      </button>
                    }
                  } @empty {
                    <p class="col-span-2 text-center text-xs text-text-muted py-4 italic">
                      Sin horarios disponibles para este día
                    </p>
                  }
                </div>

                <!-- Leyenda -->
                <div class="px-4 pb-3 flex items-center gap-4 text-xs text-text-muted flex-wrap">
                  <span class="flex items-center gap-1.5">
                    <span class="w-3 h-3 rounded inline-block bg-brand"></span>
                    Seleccionado
                  </span>
                  <span class="flex items-center gap-1.5">
                    <span
                      class="w-3 h-3 rounded border inline-block bg-surface border-border-default"
                    ></span>
                    Disponible
                  </span>
                  <span class="flex items-center gap-1.5">
                    <span class="w-3 h-3 rounded opacity-50 inline-block bg-subtle"></span>
                    Ocupado
                  </span>
                </div>
              </div>
            }
          </div>
        }

        <!-- Error -->
        @if (saveError()) {
          <p class="text-sm text-error">{{ saveError() }}</p>
        }
      </div>

      <!-- ── Footer ── -->
      <div class="p-4 border-t flex gap-3 bg-subtle border-border-subtle">
        <button
          type="button"
          class="btn-secondary flex-1"
          (click)="onCancel()"
          data-llm-action="cancelar-reprogramar-clase"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary flex-2"
          [disabled]="!canConfirm()"
          (click)="onConfirm()"
          data-llm-action="confirmar-reprogramar-clase"
        >
          @if (isSaving()) {
            <app-icon name="loader-circle" [size]="14" class="animate-spin" />
            Guardando...
          } @else {
            <app-icon name="calendar-check" [size]="14" />
            Confirmar Reprogramación
          }
        </button>
      </div>
    </div>
  `,
})
export class AdminReprogramarClaseDrawerComponent implements OnInit {
  private readonly sanitizer = inject(ErrorSanitizerService);
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly vehicleDocWarningLabelGeneric = vehicleDocWarningLabelGeneric;

  protected readonly selectedInstructorId = signal<number | null>(null);
  protected readonly selectedSlotId = signal<string | null>(null);
  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly selectedDayIndex = signal(0);
  protected readonly currentWeekIndex = signal(0);
  protected readonly skeletonRows = [1, 2, 3];

  protected readonly daysFromGrid = computed(() => this.facade.scheduleGrid()?.week.days ?? []);

  protected readonly weeks = computed<WeekDay[][]>(() => {
    const days = this.daysFromGrid();
    if (days.length === 0) return [];
    const map = new Map<string, WeekDay[]>();
    for (const day of days) {
      const key = this.getMondayKey(day.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(day);
    }
    return [...map.values()];
  });

  protected readonly currentWeekDays = computed(() => this.weeks()[this.currentWeekIndex()] ?? []);
  protected readonly hasPrevWeek = computed(() => this.currentWeekIndex() > 0);
  protected readonly hasNextWeek = computed(
    () => this.currentWeekIndex() < this.weeks().length - 1,
  );
  protected readonly weekLabel = computed(
    () => `Semana ${this.currentWeekIndex() + 1} de ${this.weeks().length}`,
  );

  protected readonly slotsForDay = computed(() => {
    const grid = this.facade.scheduleGrid();
    if (!grid) return [];
    const day = this.currentWeekDays()[this.selectedDayIndex()];
    if (!day) return [];
    return grid.slots.filter((s) => s.date === day.date);
  });

  // ── Razón del reagendamiento (fix-279-m) ─────────────────────────────────────
  protected readonly razonOptions = RAZON_REAGENDAMIENTO_OPTIONS;
  protected readonly razon = signal<string | null>(null);
  protected readonly razonOtro = signal('');

  /** Solo se pide al mover una clase que ya tenía sesión: agendar una nueva no es reagendar. */
  protected readonly requiereRazon = computed(
    () => this.facade.reprogramarTarget()?.sessionId != null,
  );

  protected readonly canConfirm = computed(
    () =>
      !!this.selectedInstructorId() &&
      !!this.selectedSlotId() &&
      !this.isSaving() &&
      isRazonReagendamientoCompleta(this.requiereRazon(), this.razon(), this.razonOtro()),
  );

  ngOnInit(): void {
    void this.facade.loadInstructores();
  }

  protected selectInstructor(id: number): void {
    if (this.selectedInstructorId() === id) return;
    this.selectedInstructorId.set(id);
    this.selectedSlotId.set(null);
    this.currentWeekIndex.set(0);
    this.selectedDayIndex.set(0);
    void this.facade.loadScheduleGrid(id);
  }

  protected selectSlot(slotId: string): void {
    this.selectedSlotId.set(this.selectedSlotId() === slotId ? null : slotId);
  }

  protected prevWeek(): void {
    if (this.hasPrevWeek()) {
      this.currentWeekIndex.update((i) => i - 1);
      this.selectedDayIndex.set(0);
    }
  }

  protected nextWeek(): void {
    if (this.hasNextWeek()) {
      this.currentWeekIndex.update((i) => i + 1);
      this.selectedDayIndex.set(0);
    }
  }

  protected async onConfirm(): Promise<void> {
    const instructorId = this.selectedInstructorId();
    const slotId = this.selectedSlotId();
    const target = this.facade.reprogramarTarget();
    if (!instructorId || !slotId || !target) return;

    this.isSaving.set(true);
    this.saveError.set(null);
    try {
      await this.facade.reprogramarClase({
        sessionId: target.sessionId,
        enrollmentId: target.enrollmentId,
        claseNumero: target.claseNumero,
        instructorId,
        scheduledAt: slotId,
        razon: this.requiereRazon() ? this.razon() : null,
        razonOtro: this.razon() === 'otro' ? this.razonOtro().trim() : null,
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

  protected onCancel(): void {
    // fix-279-m: vuelve a la Ficha Técnica desde donde se abrió (o cierra si no hay panel previo).
    this.layoutDrawer.back();
  }

  private getMondayKey(dateStr: string): string {
    return mondayOfIso(dateStr);
  }
}
