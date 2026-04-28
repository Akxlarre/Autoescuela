import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import { StudentPaymentFacade } from '@core/facades/student-payment.facade';
import { formatCLP } from '@core/utils/date.utils';
import type { TimeSlot, WeekDay } from '@core/models/ui/enrollment-assignment.model';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';

/** Agrupa un array de días por semana (lunes como inicio). */
function groupByWeek(days: WeekDay[]): WeekDay[][] {
  if (!days.length) return [];
  const map = new Map<string, WeekDay[]>();
  for (const day of days) {
    const d = new Date(day.date + 'T12:00:00Z');
    const dow = d.getUTCDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + diff);
    const key = monday.toISOString().split('T')[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(day);
  }
  return [...map.values()];
}

/**
 * AlumnoPagarComponent — Wizard de pago de segunda mitad Clase B.
 *
 * Step 1: Resumen del saldo pendiente + instructor asignado
 * Step 2: Selección de 6 horarios con el instructor asignado
 * Step 3: Confirmación de slots y botón "Pagar con Webpay"
 *
 * Smart Component: inyecta StudentPaymentFacade.
 */
@Component({
  selector: 'app-alumno-pagar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeroComponent, IconComponent, AsyncBtnComponent, SkeletonBlockComponent, BentoGridLayoutDirective],
  template: `
    <div class="bento-grid" appBentoGridLayout style="padding-bottom: 5rem;">
      <!-- ── Cabecera ── -->
      <div class="bento-banner">
        <app-section-hero
          title="Agendar y Pagar"
          subtitle="Completa el pago de tu matrícula y agenda tus clases restantes"
          icon="calendar-check"
          [actions]="[]"
        />
      </div>

      <!-- ── Stepper ── -->
      <div class="bento-banner card px-6 py-4">
        <div class="flex items-center">
          @for (s of steps; track s.n; let last = $last) {
            <!-- Nodo del paso -->
            <div class="flex flex-col items-center gap-1.5 shrink-0">
              <div
                class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                [style.background]="
                  facade.step() > s.n
                    ? 'var(--color-success)'
                    : facade.step() === s.n
                      ? 'var(--ds-brand)'
                      : 'var(--bg-surface)'
                "
                [style.color]="facade.step() >= s.n ? 'white' : 'var(--text-muted)'"
                [style.border]="facade.step() < s.n ? '2px solid var(--color-border)' : 'none'"
              >
                @if (facade.step() > s.n) {
                  <app-icon name="check" [size]="14" />
                } @else {
                  {{ s.n }}
                }
              </div>
              <span
                class="text-xs font-semibold tracking-wide uppercase"
                [style.color]="facade.step() === s.n ? 'var(--ds-brand)' : 'var(--text-muted)'"
              >
                {{ s.label }}
              </span>
            </div>
            <!-- Conector entre pasos -->
            @if (!last) {
              <div
                class="flex-1 h-0.5 mx-3 mb-5 transition-all"
                [style.background]="
                  facade.step() > s.n ? 'var(--color-success)' : 'var(--color-border)'
                "
              ></div>
            }
          }
        </div>
      </div>

      <!-- ── Error global ── -->
      @if (facade.error()) {
        <div
          class="bento-banner flex items-start gap-3 p-4 rounded-lg"
          style="background: var(--color-error-muted)"
          role="alert"
        >
          <app-icon
            name="alert-circle"
            [size]="16"
            class="shrink-0 mt-0.5"
            style="color: var(--color-error)"
          />
          <p class="text-sm flex-1" style="color: var(--color-error)">{{ facade.error() }}</p>
          <button
            class="shrink-0 cursor-pointer"
            (click)="facade.resetError()"
            aria-label="Cerrar error"
          >
            <app-icon name="x" [size]="14" style="color: var(--color-error)" />
          </button>
        </div>
      }

      <!-- ════════════════════════════════════
           STEP 1 — Resumen
           ════════════════════════════════════ -->
      @if (facade.step() === 1) {
        @if (facade.isLoading()) {
          <div class="bento-banner card p-6 flex flex-col gap-4">
            <app-skeleton-block variant="text" width="60%" height="24px" />
            <app-skeleton-block variant="text" width="100%" height="16px" />
            <app-skeleton-block variant="text" width="100%" height="16px" />
            <app-skeleton-block variant="rect" width="100%" height="80px" />
          </div>
        } @else if (facade.status()?.hasPaymentPending === false) {
          <div class="bento-banner card p-8 flex flex-col items-center gap-4 text-center">
            <div
              class="w-14 h-14 rounded-full flex items-center justify-center"
              style="background: var(--color-success-muted)"
            >
              <app-icon name="check-circle" [size]="28" style="color: var(--color-success)" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-text-primary">Tu matrícula está al día</h2>
              <p class="text-sm text-text-muted mt-1">
                No tienes saldo pendiente. Todas tus clases están agendadas.
              </p>
            </div>
          </div>
        } @else if (facade.enrollment(); as enroll) {
          <div class="bento-banner grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <!-- Columna izquierda: monto + detalles -->
            <div class="flex flex-col gap-4">
              <div class="card-tinted rounded-xl p-6 flex flex-col gap-1 text-center">
                <span class="kpi-label">Saldo pendiente de pago</span>
                <span
                  class="kpi-value"
                  data-llm-description="pending balance amount to pay in Chilean pesos"
                >
                  {{ clp(enroll.pendingBalance) }}
                </span>
                <span class="text-xs text-text-muted mt-1">
                  Total del curso: {{ clp(enroll.basePrice) }} · Ya pagado:
                  {{ clp(enroll.totalPaid) }}
                </span>
              </div>

              <div class="card p-5 flex flex-col gap-3">
                <div class="flex items-center gap-3">
                  <app-icon name="graduation-cap" [size]="16" class="text-text-muted shrink-0" />
                  <div class="flex-1 flex justify-between items-center gap-2">
                    <span class="text-xs text-text-muted uppercase tracking-wide">Curso</span>
                    <span class="text-sm font-medium text-text-primary">{{
                      enroll.courseName
                    }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <app-icon name="building-2" [size]="16" class="text-text-muted shrink-0" />
                  <div class="flex-1 flex justify-between items-center gap-2">
                    <span class="text-xs text-text-muted uppercase tracking-wide">Sede</span>
                    <span class="text-sm font-medium text-text-primary">{{
                      enroll.branchName
                    }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <app-icon name="hash" [size]="16" class="text-text-muted shrink-0" />
                  <div class="flex-1 flex justify-between items-center gap-2">
                    <span class="text-xs text-text-muted uppercase tracking-wide">Matrícula</span>
                    <span class="text-sm font-medium text-text-primary"
                      >N° {{ enroll.number }}</span
                    >
                  </div>
                </div>
              </div>
            </div>

            <!-- Columna derecha: instructor + CTA -->
            <div class="flex flex-col gap-4">
              @if (facade.instructor(); as instructor) {
                <div class="card p-5 flex flex-col gap-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style="background: var(--bg-surface-elevated, var(--bg-surface))"
                    >
                      <app-icon name="user" [size]="18" style="color: var(--ds-brand)" />
                    </div>
                    <div>
                      <p class="text-xs text-text-muted uppercase tracking-wide">Tu instructor</p>
                      <p class="text-sm font-semibold text-text-primary">{{ instructor.name }}</p>
                    </div>
                  </div>
                  <p class="text-xs text-text-muted">
                    Agendarás las 6 clases restantes con este instructor. Para cambiar de
                    instructor, comunícate con la secretaría.
                  </p>
                </div>
              } @else {
                <div
                  class="flex items-start gap-3 p-4 rounded-lg"
                  style="background: var(--color-warning-muted)"
                >
                  <app-icon
                    name="alert-circle"
                    [size]="16"
                    class="shrink-0 mt-0.5"
                    style="color: var(--color-warning)"
                  />
                  <p class="text-sm text-text-muted">
                    No se pudo determinar tu instructor asignado. Contacta a la secretaría para
                    continuar.
                  </p>
                </div>
              }

              <button
                class="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer"
                [disabled]="!facade.instructor() || facade.isLoading()"
                (click)="facade.goToSchedule()"
                data-llm-action="go-to-schedule-selection"
              >
                <app-icon name="calendar-days" [size]="16" />
                Elegir mis 6 horarios
              </button>
            </div>
          </div>
        }
      }

      <!-- ════════════════════════════════════
           STEP 2 — Selección de horarios
           ════════════════════════════════════ -->
      @if (facade.step() === 2) {
        <div class="bento-banner flex flex-col gap-4">
          <!-- Subencabezado + contador -->
          <div class="flex items-center justify-between">
            <p class="text-sm text-text-muted">
              Instructor:
              <span class="font-medium text-text-primary">{{ facade.instructor()?.name }}</span>
              · Máximo 1 clase por día
            </p>
            <div
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
              [style.background]="
                facade.selectionComplete() ? 'var(--color-success-muted)' : 'var(--bg-surface)'
              "
              [style.color]="
                facade.selectionComplete() ? 'var(--color-success)' : 'var(--text-muted)'
              "
              [style.border]="
                '1px solid ' +
                (facade.selectionComplete() ? 'var(--color-success)' : 'var(--color-border)')
              "
            >
              <app-icon
                [name]="facade.selectionComplete() ? 'check-circle' : 'calendar-days'"
                [size]="14"
              />
              {{ facade.selectedCount() }} / {{ facade.requiredCount }}
            </div>
          </div>

          @if (facade.isLoading()) {
            <div class="card p-4 flex flex-col gap-3">
              <app-skeleton-block variant="text" width="40%" height="20px" />
              <div class="flex gap-2">
                @for (i of [1, 2, 3, 4, 5]; track i) {
                  <app-skeleton-block variant="rect" width="80px" height="40px" />
                }
              </div>
              @for (i of [1, 2, 3, 4]; track i) {
                <app-skeleton-block variant="text" width="100%" height="52px" />
              }
            </div>
          } @else if (!facade.scheduleGrid()) {
            <div class="card p-8 text-center">
              <p class="text-text-muted text-sm">
                No hay disponibilidad horaria para las próximas semanas. Contacta a la secretaría.
              </p>
            </div>
          } @else {
            <div class="card p-5 flex flex-col gap-5">
              <!-- Navegación de semana -->
              <div class="flex items-center justify-between gap-4">
                <button
                  class="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1 cursor-pointer"
                  [disabled]="currentWeekIndex() === 0"
                  (click)="prevWeek()"
                  aria-label="Semana anterior"
                >
                  <app-icon name="chevron-left" [size]="14" />
                  Anterior
                </button>
                <span class="text-sm font-semibold text-text-primary">{{ weekIndicator() }}</span>
                <button
                  class="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1 cursor-pointer"
                  [disabled]="currentWeekIndex() === weeks().length - 1"
                  (click)="nextWeek()"
                  aria-label="Semana siguiente"
                >
                  Siguiente
                  <app-icon name="chevron-right" [size]="14" />
                </button>
              </div>

              <!-- Tabs de días -->
              <div class="flex gap-2 overflow-x-auto pb-1">
                @for (day of currentWeekDays(); track day.date; let i = $index) {
                  <button
                    class="flex flex-col items-center px-4 py-2.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer"
                    [style.background]="
                      selectedDayIndex() === i ? 'var(--ds-brand)' : 'var(--bg-surface)'
                    "
                    [style.color]="selectedDayIndex() === i ? 'white' : 'var(--text-secondary)'"
                    [style.border]="
                      '1.5px solid ' +
                      (selectedDayIndex() === i ? 'var(--ds-brand)' : 'var(--color-border)')
                    "
                    (click)="selectedDayIndex.set(i)"
                  >
                    <span class="capitalize">{{ day.dayOfWeek }}</span>
                    <span class="text-sm font-bold mt-0.5">{{ day.label.split(' ')[1] }}</span>
                  </button>
                }
              </div>

              <!-- Slots del día seleccionado -->
              <div class="flex flex-col gap-2">
                @if (slotsForDay().length === 0) {
                  <p class="text-xs text-text-muted text-center py-6">
                    Sin disponibilidad este día
                  </p>
                }
                @for (slot of slotsForDay(); track slot.id) {
                  @if (slot.status === 'occupied') {
                    <div
                      class="flex items-center justify-between px-4 py-3 rounded-lg cursor-not-allowed"
                      style="background: var(--bg-surface); border: 1.5px solid var(--color-border); opacity: 0.45"
                      aria-disabled="true"
                    >
                      <span class="text-sm text-text-muted"
                        >{{ slot.startTime }} – {{ slot.endTime }}</span
                      >
                      <span class="text-xs text-text-muted font-medium">Ocupado</span>
                    </div>
                  } @else {
                    @let selected = facade.selectedSlotIds().includes(slot.id);
                    @let selectable = facade.isSlotSelectable(slot.id);
                    <button
                      class="flex items-center justify-between px-4 py-3 rounded-lg transition-all text-left w-full cursor-pointer"
                      [disabled]="!selectable && !selected"
                      [style.background]="
                        selected
                          ? 'var(--color-success-muted)'
                          : selectable
                            ? 'var(--bg-base)'
                            : 'var(--bg-base)'
                      "
                      [style.border]="
                        selected
                          ? '2px solid var(--color-success)'
                          : '1.5px solid var(--color-border)'
                      "
                      [style.opacity]="!selectable && !selected ? '0.35' : '1'"
                      (click)="handleToggleSlot(slot.id)"
                      [attr.aria-pressed]="selected"
                      [attr.aria-label]="
                        slot.startTime + ' a ' + slot.endTime + (selected ? ' (seleccionado)' : '')
                      "
                      [attr.data-llm-action]="'toggle-slot-' + slot.startTime.replace(':', '')"
                    >
                      <span
                        class="text-sm font-medium"
                        [style.color]="selected ? 'var(--color-success)' : 'var(--text-primary)'"
                      >
                        {{ slot.startTime }} – {{ slot.endTime }}
                      </span>
                      @if (selected) {
                        <app-icon
                          name="check-circle"
                          [size]="16"
                          style="color: var(--color-success)"
                        />
                      }
                    </button>
                  }
                }
              </div>
            </div>
          }

          <!-- Resumen de clases seleccionadas -->
          @if (facade.selectedCount() > 0) {
            <div class="card overflow-hidden">
              <div
                class="flex items-center justify-between px-4 py-2.5 border-b"
                style="background: var(--bg-surface-elevated); border-color: var(--color-border)"
              >
                <span class="text-xs font-bold uppercase tracking-widest text-text-muted">
                  Clases seleccionadas
                </span>
                <span
                  class="text-xs font-black px-2 py-0.5 rounded-full"
                  [style.background]="
                    facade.selectionComplete()
                      ? 'var(--color-success-muted)'
                      : 'var(--color-warning-muted)'
                  "
                  [style.color]="
                    facade.selectionComplete() ? 'var(--color-success)' : 'var(--color-warning)'
                  "
                >
                  {{ facade.selectedCount() }} / {{ facade.requiredCount }}
                </span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 p-3">
                @for (slot of selectedSlotsDisplay(); track slot.label) {
                  <div
                    class="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style="background: var(--color-success-muted)"
                  >
                    <app-icon
                      name="calendar-check"
                      [size]="12"
                      style="color: var(--color-success)"
                      class="shrink-0"
                    />
                    <span class="text-xs font-medium" style="color: var(--color-success)">{{
                      slot.label
                    }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Acciones step 2 -->
          <div class="flex gap-3">
            <button
              class="btn-secondary flex items-center gap-2 cursor-pointer"
              (click)="facade.backToSummary()"
            >
              <app-icon name="arrow-left" [size]="14" />
              Volver
            </button>
            <app-async-btn
              class="flex-1"
              label="Confirmar horarios"
              [loading]="facade.isSubmitting()"
              [disabled]="!facade.selectionComplete()"
              (click)="facade.reserveSlotsAndAdvance()"
              data-llm-action="confirm-slot-selection"
            />
          </div>
        </div>
      }

      <!-- ════════════════════════════════════
           STEP 3 — Confirmación y pago
           ════════════════════════════════════ -->
      @if (facade.step() === 3) {
        <div class="bento-banner flex flex-col gap-4">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <!-- Horarios seleccionados -->
            <div class="card p-5 flex flex-col gap-3">
              <p class="text-xs text-text-muted uppercase tracking-wide font-semibold">
                Horarios seleccionados ({{ facade.requiredCount }} clases)
              </p>
              @for (slot of selectedSlotsDisplay(); track slot.label) {
                <div class="flex items-center gap-3 py-1">
                  <app-icon
                    name="calendar-check"
                    [size]="14"
                    style="color: var(--color-success)"
                    class="shrink-0"
                  />
                  <span class="text-sm text-text-primary">{{ slot.label }}</span>
                </div>
              }
            </div>

            <!-- Resumen de pago + CTA -->
            <div class="flex flex-col gap-4">
              <div class="card-tinted rounded-xl p-5 flex flex-col gap-3">
                @if (facade.enrollment(); as enroll) {
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-text-muted">Instructor</span>
                    <span class="text-sm font-medium text-text-primary">{{
                      facade.instructor()?.name
                    }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-text-muted">Clases a agendar</span>
                    <span class="text-sm font-medium text-text-primary">6 clases prácticas</span>
                  </div>
                  <div class="border-t pt-3" style="border-color: var(--color-border)">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-text-primary">Total a pagar</span>
                      <span
                        class="text-lg font-bold"
                        style="color: var(--ds-brand)"
                        data-llm-description="total amount to pay via Webpay"
                      >
                        {{ clp(enroll.pendingBalance) }}
                      </span>
                    </div>
                  </div>
                }
              </div>

              <div
                class="flex items-start gap-3 p-3 rounded-lg text-xs text-text-muted"
                style="background: var(--bg-surface)"
              >
                <app-icon name="credit-card" [size]="14" class="shrink-0 mt-0.5" />
                <span
                  >Serás redirigido al portal seguro de Transbank (Webpay Plus) para completar el
                  pago con tarjeta de débito o crédito.</span
                >
              </div>

              <div class="flex gap-3">
                <button
                  class="btn-secondary flex items-center gap-2 cursor-pointer"
                  [disabled]="facade.isSubmitting()"
                  (click)="facade.backToSchedule()"
                >
                  <app-icon name="arrow-left" [size]="14" />
                  Volver
                </button>
                <app-async-btn
                  class="flex-1"
                  [label]="payLabel()"
                  icon="credit-card"
                  [loading]="facade.isSubmitting()"
                  (click)="facade.initiatePayment()"
                  data-llm-action="initiate-webpay-payment"
                />
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AlumnoPagarComponent implements OnInit {
  protected readonly facade = inject(StudentPaymentFacade);
  protected readonly clp = formatCLP;

  // ─── State local del grid ───
  protected readonly selectedDayIndex = signal(0);
  protected readonly currentWeekIndex = signal(0);

  protected readonly steps = [
    { n: 1, label: 'Resumen' },
    { n: 2, label: 'Horarios' },
    { n: 3, label: 'Pago' },
  ];

  protected readonly weeks = computed<WeekDay[][]>(() => {
    const days = this.facade.scheduleGrid()?.week.days ?? [];
    return groupByWeek(days);
  });

  protected readonly currentWeekDays = computed<WeekDay[]>(
    () => this.weeks()[this.currentWeekIndex()] ?? [],
  );

  protected readonly weekIndicator = computed(
    () => `Semana ${this.currentWeekIndex() + 1} de ${this.weeks().length}`,
  );

  protected readonly payLabel = computed(() => {
    const balance = this.facade.enrollment()?.pendingBalance;
    return balance != null ? `Pagar ${formatCLP(balance)} con Webpay` : 'Pagar con Webpay';
  });

  protected readonly slotsForDay = computed<TimeSlot[]>(() => {
    const grid = this.facade.scheduleGrid();
    const day = this.currentWeekDays()[this.selectedDayIndex()];
    if (!grid || !day) return [];
    return grid.slots.filter((s: TimeSlot) => s.date === day.date);
  });

  /** Muestra legible de los slots seleccionados para el paso de confirmación. */
  protected readonly selectedSlotsDisplay = computed(() => {
    const grid = this.facade.scheduleGrid();
    const ids = this.facade.selectedSlotIds();
    if (!grid) return ids.map((id) => ({ label: id }));

    return ids
      .map((id) => {
        const slot = grid.slots.find((s: TimeSlot) => s.id === id);
        if (!slot) return { id, label: id };
        // Formatear: "Lun 15/04 · 08:00 – 08:45"
        const date = new Date(id + (id.includes('T') ? '' : 'T12:00:00Z'));
        const dayLabel = date.toLocaleDateString('es-CL', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          timeZone: 'America/Santiago',
        });
        return { id, label: `${dayLabel} · ${slot.startTime} – ${slot.endTime}` };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  });

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected prevWeek(): void {
    if (this.currentWeekIndex() > 0) {
      this.currentWeekIndex.update((n) => n - 1);
      this.selectedDayIndex.set(0);
    }
  }

  protected nextWeek(): void {
    if (this.currentWeekIndex() < this.weeks().length - 1) {
      this.currentWeekIndex.update((n) => n + 1);
      this.selectedDayIndex.set(0);
    }
  }

  /** Wrapper que llama al facade y avanza al siguiente día si se añadió un slot. */
  protected handleToggleSlot(slotId: string): void {
    const countBefore = this.facade.selectedCount();
    this.facade.toggleSlot(slotId);
    if (this.facade.selectedCount() > countBefore) {
      setTimeout(() => this.advanceToNextAvailableDay(), 450);
    }
  }

  private advanceToNextAvailableDay(): void {
    const weekDays = this.currentWeekDays();
    const grid = this.facade.scheduleGrid();
    for (let i = this.selectedDayIndex() + 1; i < weekDays.length; i++) {
      const hasAvailable = grid?.slots.some(
        (s) => s.date === weekDays[i].date && s.status !== 'occupied',
      );
      if (hasAvailable) {
        this.selectedDayIndex.set(i);
        return;
      }
    }
    if (this.currentWeekIndex() < this.weeks().length - 1) {
      this.currentWeekIndex.update((n) => n + 1);
      this.selectedDayIndex.set(0);
    }
  }
}
