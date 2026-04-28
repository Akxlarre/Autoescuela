import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { WeekDay } from '@core/models/ui/enrollment-assignment.model';

@Component({
  selector: 'app-admin-reprogramar-clase-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent],
  template: `
    <div class="flex flex-col h-full" style="background: var(--bg-surface)">
      <!-- ── Body ── -->
      <div class="flex-1 overflow-y-auto p-5 space-y-6">
        <!-- Clase target banner -->
        <div
          class="flex items-center gap-3 p-3 rounded-xl border"
          style="background: var(--bg-elevated); border-color: var(--border-default)"
        >
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style="background: color-mix(in srgb, var(--ds-brand) 10%, transparent); color: var(--ds-brand)"
          >
            <app-icon name="calendar-clock" [size]="18" />
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold" style="color: var(--text-primary)">
              Clase #{{ facade.reprogramarTarget()?.claseNumero }} —
              {{ facade.alumno()?.nombre }}
            </span>
            <span class="text-xs" style="color: var(--text-muted)">
              Selecciona instructor y nuevo horario
            </span>
          </div>
        </div>

        <!-- ── 1. Instructor ── -->
        <div class="space-y-3">
          <span class="text-xs font-bold uppercase tracking-widest" style="color: var(--ds-brand)"
            >1. Instructor</span
          >

          @if (facade.isLoadingSchedule() && facade.instructores().length === 0) {
            <div class="flex flex-col gap-2">
              @for (i of skeletonRows; track i) {
                <app-skeleton-block variant="rect" width="100%" height="60px" />
              }
            </div>
          } @else if (facade.instructores().length === 0) {
            <div
              class="p-6 rounded-xl border flex flex-col items-center gap-2 text-center"
              style="background: var(--bg-base); border-color: var(--border-default)"
            >
              <app-icon name="user-x" [size]="24" style="color: var(--text-muted)" />
              <p class="text-sm" style="color: var(--text-muted)">
                No hay instructores disponibles.
              </p>
            </div>
          } @else {
            <div class="flex flex-col gap-2">
              @for (instructor of facade.instructores(); track instructor.id) {
                <button
                  type="button"
                  (click)="selectInstructor(instructor.id)"
                  class="flex items-center gap-3 p-3 border-2 rounded-xl transition-all text-left w-full"
                  [class.border-brand]="selectedInstructorId() === instructor.id"
                  [class.bg-brand-muted]="selectedInstructorId() === instructor.id"
                  [class.border-border-default]="selectedInstructorId() !== instructor.id"
                  data-llm-action="seleccionar-instructor-reprogramar"
                >
                  <div
                    class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
                    [class.bg-brand]="selectedInstructorId() === instructor.id"
                    [class.text-surface]="selectedInstructorId() === instructor.id"
                    [class.bg-bg-subtle]="selectedInstructorId() !== instructor.id"
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
            <span class="text-xs font-bold uppercase tracking-widest" style="color: var(--ds-brand)"
              >2. Selecciona el nuevo horario</span
            >

            @if (facade.isLoadingSchedule()) {
              <div
                class="h-40 rounded-2xl flex items-center justify-center gap-2"
                style="background: var(--bg-base); border: 1px solid var(--border-default)"
              >
                <app-icon name="loader" [size]="16" class="animate-spin text-text-muted" />
                <span class="text-sm text-text-muted">Cargando disponibilidad...</span>
              </div>
            } @else if (!facade.scheduleGrid() || daysFromGrid().length === 0) {
              <div
                class="p-8 rounded-2xl flex flex-col items-center gap-2 text-center"
                style="background: var(--bg-base); border: 1px solid var(--border-default)"
              >
                <app-icon name="calendar-x" [size]="28" class="text-text-muted" />
                <p class="text-sm font-bold text-text-primary">Sin disponibilidad</p>
                <p class="text-xs text-text-muted">
                  Este instructor no tiene horarios disponibles en las próximas semanas.
                </p>
              </div>
            } @else {
              <div
                class="rounded-2xl overflow-hidden"
                style="background: var(--bg-base); border: 1px solid var(--border-default)"
              >
                <!-- Navegación semanas -->
                <div
                  class="flex items-center justify-between px-4 py-2.5 border-b"
                  style="background: var(--bg-elevated); border-color: var(--border-subtle)"
                >
                  <button
                    type="button"
                    (click)="prevWeek()"
                    [disabled]="!hasPrevWeek()"
                    class="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    style="hover:background: var(--bg-subtle)"
                  >
                    <app-icon name="chevron-left" [size]="16" class="text-text-secondary" />
                  </button>
                  <span class="text-xs font-bold text-text-secondary">{{ weekLabel() }}</span>
                  <button
                    type="button"
                    (click)="nextWeek()"
                    [disabled]="!hasNextWeek()"
                    class="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <app-icon name="chevron-right" [size]="16" class="text-text-secondary" />
                  </button>
                </div>

                <!-- Tabs días -->
                <div
                  class="flex overflow-x-auto border-b"
                  style="background: var(--bg-elevated); border-color: var(--border-subtle)"
                >
                  @for (day of currentWeekDays(); track day.date; let i = $index) {
                    <button
                      type="button"
                      (click)="selectedDayIndex.set(i)"
                      class="flex-1 min-w-14 py-3 px-1 border-b-2 text-center transition-all"
                      [class.border-brand]="selectedDayIndex() === i"
                      [class.bg-surface]="selectedDayIndex() === i"
                      [class.text-brand]="selectedDayIndex() === i"
                      [class.border-transparent]="selectedDayIndex() !== i"
                      [class.text-text-secondary]="selectedDayIndex() !== i"
                    >
                      <p class="text-[10px] font-bold uppercase">{{ day.dayOfWeek }}</p>
                      <p class="text-sm font-black">{{ day.label }}</p>
                    </button>
                  }
                </div>

                <!-- Grid de slots -->
                <div class="p-3 grid grid-cols-2 gap-2">
                  @for (slot of slotsForDay(); track slot.id) {
                    @if (slot.status === 'occupied') {
                      <div
                        class="p-2.5 border rounded-lg flex items-center justify-center gap-1 cursor-not-allowed opacity-50"
                        style="background: var(--bg-subtle); border-color: var(--border-default)"
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
                        class="p-2.5 border rounded-lg text-xs font-medium transition-all text-center"
                        [class.bg-brand]="selectedSlotId() === slot.id"
                        [class.text-surface]="selectedSlotId() === slot.id"
                        [class.border-brand]="selectedSlotId() === slot.id"
                        [class.bg-surface]="selectedSlotId() !== slot.id"
                        [class.text-text-primary]="selectedSlotId() !== slot.id"
                        [class.border-border-default]="selectedSlotId() !== slot.id"
                        data-llm-action="seleccionar-slot-reprogramar"
                      >
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
                    <span
                      class="w-3 h-3 rounded inline-block"
                      style="background: var(--ds-brand)"
                    ></span>
                    Seleccionado
                  </span>
                  <span class="flex items-center gap-1.5">
                    <span
                      class="w-3 h-3 rounded border inline-block"
                      style="background: var(--bg-surface); border-color: var(--border-default)"
                    ></span>
                    Disponible
                  </span>
                  <span class="flex items-center gap-1.5">
                    <span
                      class="w-3 h-3 rounded opacity-50 inline-block"
                      style="background: var(--bg-subtle)"
                    ></span>
                    Ocupado
                  </span>
                </div>
              </div>
            }
          </div>
        }

        <!-- Error -->
        @if (saveError()) {
          <p class="text-sm" style="color: var(--state-error)">{{ saveError() }}</p>
        }
      </div>

      <!-- ── Footer ── -->
      <div
        class="p-4 border-t flex gap-3"
        style="background: var(--bg-subtle); border-color: var(--border-subtle)"
      >
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
          class="btn-primary flex-[2]"
          [disabled]="!canConfirm()"
          (click)="onConfirm()"
          data-llm-action="confirmar-reprogramar-clase"
        >
          @if (isSaving()) {
            <app-icon name="loader" [size]="14" class="animate-spin" />
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
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

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

  protected readonly canConfirm = computed(
    () => !!this.selectedInstructorId() && !!this.selectedSlotId() && !this.isSaving(),
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
      });
      this.layoutDrawer.close();
    } catch (err) {
      this.saveError.set(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      this.isSaving.set(false);
    }
  }

  protected onCancel(): void {
    this.layoutDrawer.close();
  }

  private getMondayKey(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }
}
