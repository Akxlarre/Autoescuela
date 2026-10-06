import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import type { RelatorOption } from '@core/models/ui/promocion-table.model';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import { getCourseColor } from '@core/utils/course-colors';
import { isValidPromotionCode } from '@core/utils/promotion-code.utils';

/** Genera los próximos N lunes disponibles a partir de hoy. */
function generateAvailableMondays(count: number): { date: string }[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);

  if (dayOfWeek === 1) {
    nextMonday.setDate(today.getDate());
  }

  const mondays: { date: string }[] = [];
  const current = new Date(nextMonday);

  while (mondays.length < count) {
    mondays.push({ date: current.toISOString().split('T')[0] });
    current.setDate(current.getDate() + 7);
  }

  return mondays;
}

function formatMondayLabel(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function generatePromoName(startIso: string, code: string): string {
  const d = new Date(startIso + 'T12:00:00');
  const day = d.getDate();
  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  const dateLabel = `${day} de ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  return code ? `Promoción ${code} (${dateLabel})` : `Promoción ${dateLabel}`;
}

@Component({
  selector: 'app-admin-promocion-crear-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    IconComponent,
    BadgeComponent,
    AsyncBtnComponent,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
  ],
  template: `
    <app-drawer-form>
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-5">
            <!-- Fecha de inicio: header + grid de chips (lunes) -->
            <section>
              <app-skeleton-block variant="text" width="35%" height="16px" />
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3 mb-3">
                @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) {
                  <app-skeleton-block variant="rect" width="100%" height="52px" />
                }
              </div>
              <app-skeleton-block variant="text" width="70%" height="12px" />
            </section>

            <!-- Cursos y asignación de relatores: header + subtítulo + N cards -->
            <section>
              <app-skeleton-block variant="text" width="55%" height="16px" />
              <div class="mt-1 mb-3">
                <app-skeleton-block variant="text" width="80%" height="12px" />
              </div>
              <div class="flex flex-col gap-3">
                @for (i of [1, 2, 3, 4]; track i) {
                  <div class="rounded-lg p-4 border border-border-subtle">
                    <div class="flex items-center gap-3 mb-3">
                      <app-skeleton-block variant="text" width="26px" height="20px" />
                      <app-skeleton-block variant="text" width="35%" height="16px" />
                    </div>
                    <app-skeleton-block variant="text" width="30%" height="12px" />
                    <div class="mt-2">
                      <app-skeleton-block variant="rect" width="100%" height="40px" />
                    </div>
                  </div>
                }
              </div>
            </section>
          </div>
        </ng-template>
        <ng-template #content>
          <!-- ── Fecha de inicio (primero — determina nombre y código) ───── -->
          <section>
            <h3 class="font-semibold mb-3 text-text-primary">
              <app-icon name="calendar" [size]="16" color="var(--ds-brand)" />
              Fecha de inicio *
            </h3>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
              @for (monday of availableMondays; track monday.date) {
                <button
                  class="monday-btn"
                  [class.selected]="selectedStartDate() === monday.date"
                  [disabled]="isTaken(monday.date)"
                  [attr.title]="
                    isTaken(monday.date) ? 'Ya hay una promoción que parte este lunes' : null
                  "
                  (click)="selectStartDate(monday.date)"
                  data-llm-action="seleccionar-fecha-inicio"
                >
                  {{ formatMonday(monday.date) }}
                </button>
              }
            </div>

            <p class="text-xs mb-4 text-text-muted">
              <app-icon name="info" [size]="12" />
              Las promociones de la cadencia (cada 2 semanas) se crean solas. Aquí puedes programar
              una en cualquier lunes libre; los lunes que ya tienen promoción aparecen
              deshabilitados.
            </p>

            <!-- Fecha de término -->
            @if (selectedStartDate()) {
              <div class="mb-1">
                <label class="text-xs font-medium mb-1 block text-text-secondary">
                  Fecha de término
                </label>
                <div class="form-input bg-elevated cursor-default flex items-center gap-2">
                  @if (endDateLoading()) {
                    <app-icon name="loader-circle" [size]="14" class="animate-spin" />
                    <span class="text-text-muted">Calculando…</span>
                  } @else {
                    {{ formatMonday(endDate()) }}
                  }
                </div>
                <p class="text-2xs mt-1 text-brand">
                  30 días de clase (lun-sáb) desde el inicio — se extiende automáticamente si hay
                  feriados dentro del rango.
                </p>
                @if (!endDateLoading() && facade.holidaysCheckFailed()) {
                  <p
                    class="text-2xs mt-1.5 flex items-center gap-1.5 text-warning"
                    data-llm-description="advertencia: no se pudo verificar feriados reales para calcular la fecha de término"
                  >
                    <app-icon name="alert-triangle" [size]="12" />
                    No se pudo verificar feriados reales (sin conexión con la API de gobierno). Esta
                    fecha no considera feriados — revísala manualmente si corresponde.
                  </p>
                }
              </div>
            }
          </section>

          <!-- ── Número (obligatorio) y nombre (auto-generado) ──────────────── -->
          <section>
            <h3 class="item-title mb-3">Información de la promoción</h3>
            <div class="mb-4">
              <label class="text-xs font-medium mb-1 block text-text-secondary">
                Código (ID numérico MTT) *
              </label>
              <input
                class="form-input"
                type="text"
                inputmode="numeric"
                [(ngModel)]="codeModel"
                placeholder="Ej: 281"
                data-llm-description="ID numérico MTT de la promoción, obligatorio y único; se propaga a sus cursos como {id}.{licencia}"
              />
              @if (!codeIsValid()) {
                <p class="text-2xs mt-1 text-error">
                  {{
                    code().trim().length > 0
                      ? 'Debe ser solo números (ej: 281).'
                      : 'El número es obligatorio.'
                  }}
                </p>
              }
            </div>
            @if (selectedStartDate()) {
              <div>
                <label class="text-xs font-medium mb-1 block text-text-secondary">
                  Nombre (automático)
                </label>
                <div class="form-input bg-elevated cursor-default">
                  {{ nombre() }}
                </div>
              </div>
              <p class="text-2xs mt-1.5 text-text-muted">
                <app-icon name="info" [size]="10" />
                El nombre se genera a partir del número y la fecha de inicio.
              </p>
            }
          </section>

          <!-- ── Cursos y asignación de relatores ──────────────────────────── -->
          <section>
            <h3 class="item-title mb-1">Cursos y asignación de relatores</h3>
            <p class="text-xs mb-4 text-brand">
              Cada curso admite máximo 25 alumnos. Capacidad total: 100 alumnos.
            </p>

            <div class="flex flex-col gap-3">
              @for (curso of cursoSlots(); track curso.courseId) {
                <div
                  class="rounded-lg p-4"
                  [style.border]="'1px solid ' + courseColor(curso.code)"
                  [style.borderLeftWidth]="'3px'"
                >
                  <div class="flex items-center gap-3 mb-3">
                    <span
                      class="inline-flex items-center justify-center min-w-6.5 px-1.5 py-0.5 rounded text-2xs font-bold text-white"
                      [style.background]="courseColor(curso.code)"
                    >
                      {{ curso.code }}
                    </span>
                    <span class="text-sm font-medium text-text-primary">
                      {{ curso.name }}
                    </span>
                    <span class="ml-auto text-xs text-brand"> Capacidad </span>
                    <span class="item-title"> 25 alumnos </span>
                  </div>

                  <!-- Relatores asignados -->
                  <label class="text-xs font-medium mb-1.5 block text-text-secondary">
                    Relatores asignados
                  </label>

                  @if (curso.selectedRelatores.length > 0) {
                    <div class="flex flex-wrap gap-2 mb-2">
                      @for (rel of curso.selectedRelatores; track rel.id) {
                        <app-badge variant="brand">
                          {{ rel.nombre }}
                          <button
                            class="inline-flex items-center justify-center w-4 h-4 rounded-full hover:opacity-70 bg-transparent border-none cursor-pointer"
                            style="color: inherit"
                            (click)="removeRelator(curso.courseId, rel.id)"
                            [attr.aria-label]="'Quitar relator ' + rel.nombre"
                          >
                            <app-icon name="x" [size]="10" />
                          </button>
                        </app-badge>
                      }
                    </div>
                  }

                  <p-select
                    [options]="getFilteredRelatores(curso.code, curso.courseId)"
                    optionLabel="nombre"
                    optionValue="id"
                    placeholder="Seleccionar relator..."
                    [style]="{ width: '100%' }"
                    (onChange)="addRelator(curso.courseId, $event.value)"
                    [ngModel]="null"
                    data-llm-description="Seleccionar relator para curso"
                  />
                </div>
              }
            </div>
          </section>

          <!-- ── Reglas de negocio (sidebar info) ──────────────────────────── -->
          <section class="rounded-lg p-4 bg-elevated border border-border-subtle">
            <h4 class="text-xs font-semibold mb-2 text-text-primary">
              <app-icon name="info" [size]="12" />
              Reglas de negocio
            </h4>
            <ul class="text-2xs flex flex-col gap-1 text-text-muted">
              <li>
                <strong>30 días de clase</strong> (lun-sáb) — se extiende si hay feriados en el
                rango
              </li>
              <li>Inicio solo en <strong>lunes</strong>, cada 2 semanas</li>
              <li>Máximo <strong>100 alumnos</strong> por promoción (25 por curso)</li>
              <li>4 cursos: A2, A3, A4, A5</li>
              <li>Un curso puede tener múltiples relatores</li>
              <li>Si un feriado cae en inicio, la promoción se marca como iniciada igualmente</li>
            </ul>
          </section>
        </ng-template>
      </app-drawer-content-loader>

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          class="btn-secondary"
          (click)="layoutDrawer.close()"
          data-llm-action="cancelar-crear-promocion"
        >
          Cancelar
        </button>
        <app-async-btn
          label="Crear promoción"
          icon="plus"
          [loading]="facade.isSubmitting()"
          [disabled]="!canSubmit()"
          (click)="submit()"
          data-llm-action="submit-crear-promocion"
        />
      </ng-container>
    </app-drawer-form>
  `,
  styles: `
    .form-input {
      width: 100%;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      outline: none;
    }
    .form-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }

    .monday-btn {
      position: relative;
      padding: 14px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: all var(--duration-fast);
      text-align: center;
    }
    .monday-btn:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
    }
    .monday-btn.selected {
      background: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
      font-weight: 600;
    }
    .monday-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      border-color: var(--border-default);
      color: var(--text-muted);
    }

    .btn-secondary {
      padding: 9px 18px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-family: inherit;
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .btn-secondary:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
    }
  `,
})
export class AdminPromocionCrearDrawerComponent {
  protected readonly facade = inject(PromocionesFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Form state ────────────────────────────────────────────────────────────
  /** Número de la promoción (ID numérico MTT). Obligatorio desde fix-323-m (D6). */
  protected readonly code = signal('');
  protected get codeModel(): string {
    return this.code();
  }
  protected set codeModel(v: string) {
    this.code.set(v);
  }
  protected readonly codeIsValid = computed(() => isValidPromotionCode(this.code()));
  protected readonly selectedStartDate = signal<string | null>(null);
  /** Igual que las promociones automáticas: "Promoción 281 (12 de Octubre 2026)". */
  protected readonly nombre = computed(() => {
    const date = this.selectedStartDate();
    return date ? generatePromoName(date, this.code().trim()) : '';
  });
  protected readonly endDate = signal('');
  protected readonly endDateLoading = signal(false);
  private readonly endDateGuard = createRequestGuard();

  // ── Relatores por curso: Record<courseId, lecturerId[]> ──────────────────────
  protected readonly relatorAssignments = signal<Record<number, number[]>>({});

  // ── Cursos disponibles ────────────────────────────────────────────────────
  protected readonly cursoSlots = computed(() => {
    const courses = this.facade.professionalCourses();
    const assignments = this.relatorAssignments();
    const relatores = this.facade.relatoresDisponibles();

    return courses.map((c) => {
      const assigned = assignments[c.id] ?? [];
      return {
        courseId: c.id,
        code: c.code,
        name: c.name,
        selectedRelatores: assigned
          .map((lid) => relatores.find((r) => r.id === lid))
          .filter((r): r is RelatorOption => !!r),
      };
    });
  });

  // ── Available mondays ─────────────────────────────────────────────────────
  /** Cualquier lunes sirve (D6, fix-323-m); los que ya tienen promoción no se pueden repetir. */
  protected readonly availableMondays = generateAvailableMondays(8);
  private readonly takenDates = computed(
    () => new Set(this.facade.promociones().map((p) => p.startDate)),
  );

  // ── Validation ────────────────────────────────────────────────────────────
  protected readonly canSubmit = computed(() => {
    const date = this.selectedStartDate();
    return (
      this.codeIsValid() &&
      !!date &&
      !this.isTaken(date) &&
      !!this.selectedStartDate() &&
      !!this.endDate() &&
      !this.endDateLoading()
    );
  });

  constructor() {
    // Load relatores and courses when drawer opens
    this.facade.loadRelatoresDisponibles();
    this.facade.loadProfessionalCourses();

    // Precarga el siguiente número; el admin puede cambiarlo.
    this.facade.suggestNextCode().then((next) => {
      if (!this.code()) this.code.set(next);
    });

    // Preview async de la fecha de término real (con recuperación de feriados, AC6) —
    // mismo cálculo que usará crearPromocion(), así el admin ve el valor final antes de guardar.
    effect(() => {
      const date = this.selectedStartDate();
      if (!date) {
        this.endDate.set('');
        return;
      }
      const token = this.endDateGuard.next();
      this.endDateLoading.set(true);
      this.facade.previewEndDate(date).then((end) => {
        if (!this.endDateGuard.isCurrent(token)) return;
        this.endDate.set(end);
        this.endDateLoading.set(false);
      });
    });
  }

  protected selectStartDate(date: string): void {
    if (this.isTaken(date)) return;
    this.selectedStartDate.set(date);
  }

  /** True si ya hay una promoción que parte ese lunes (UNIQUE branch_id, start_date). */
  protected isTaken(date: string): boolean {
    return this.takenDates().has(date);
  }

  protected formatMonday(iso: string): string {
    return formatMondayLabel(iso);
  }

  protected courseColor(code: string): string {
    return getCourseColor(code);
  }

  protected getFilteredRelatores(courseCode: string, courseId: number): RelatorOption[] {
    const all = this.facade.relatoresDisponibles();
    const assigned = this.relatorAssignments()[courseId] ?? [];
    return all.filter((r) => r.specializations.includes(courseCode) && !assigned.includes(r.id));
  }

  protected addRelator(courseId: number, lecturerId: number): void {
    if (!lecturerId) return;
    const current = { ...this.relatorAssignments() };
    const list = [...(current[courseId] ?? [])];
    if (!list.includes(lecturerId)) {
      list.push(lecturerId);
    }
    current[courseId] = list;
    this.relatorAssignments.set(current);
  }

  protected removeRelator(courseId: number, lecturerId: number): void {
    const current = { ...this.relatorAssignments() };
    current[courseId] = (current[courseId] ?? []).filter((id) => id !== lecturerId);
    this.relatorAssignments.set(current);
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;

    const cursos = this.cursoSlots().map((c) => ({
      courseId: c.courseId,
      lecturerIds: this.relatorAssignments()[c.courseId] ?? [],
    }));

    const success = await this.facade.crearPromocion({
      name: this.nombre().trim(),
      code: this.code().trim(),
      startDate: this.selectedStartDate()!,
      endDate: this.endDate(),
      cursos,
    });

    if (success) {
      this.layoutDrawer.close();
      this.facade.initialize(); // Refresh table
    }
  }
}
