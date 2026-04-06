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
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import type { RelatorOption } from '@core/models/ui/promocion-table.model';

const COURSE_COLORS: Record<string, string> = {
  A2: '#3b82f6',
  A3: '#8b5cf6',
  A4: '#f59e0b',
  A5: '#10b981',
};

/**
 * Calcula la fecha de término: sábado de la 5ta semana (30 días clase lun-sáb).
 */
function computeEndDate(startIso: string): string {
  if (!startIso) return '';
  const d = new Date(startIso + 'T12:00:00');
  d.setDate(d.getDate() + 33);
  return d.toISOString().split('T')[0];
}

/** Genera los próximos N lunes disponibles a partir de hoy. */
function generateAvailableMondays(count: number): { date: string; suggested: boolean }[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);

  if (dayOfWeek === 1) {
    nextMonday.setDate(today.getDate());
  }

  const mondays: { date: string; suggested: boolean }[] = [];
  const current = new Date(nextMonday);

  for (let i = 0; mondays.length < count; i++) {
    const iso = current.toISOString().split('T')[0];
    const suggested = i % 2 === 0;
    mondays.push({ date: iso, suggested });
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

function generatePromoCode(startIso: string): string {
  const d = new Date(startIso + 'T12:00:00');
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `PROM-${year}-${month}`;
}

function generatePromoName(startIso: string): string {
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
  return `Promoción ${day} de ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

@Component({
  selector: 'app-admin-promocion-crear-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, IconComponent, AsyncBtnComponent],
  template: `
    <div class="flex flex-col gap-6 p-1">
      <!-- ── Fecha de inicio (primero — determina nombre y código) ───── -->
      <section>
        <h3 class="text-base font-semibold mb-3" style="color: var(--text-primary)">
          <app-icon name="calendar" [size]="16" color="var(--ds-brand)" />
          Fecha de inicio *
        </h3>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
          @for (monday of availableMondays; track monday.date) {
            <button
              class="monday-btn"
              [class.selected]="selectedStartDate() === monday.date"
              [class.suggested]="monday.suggested && selectedStartDate() !== monday.date"
              (click)="selectStartDate(monday.date)"
              data-llm-action="seleccionar-fecha-inicio"
            >
              {{ formatMonday(monday.date) }}
              @if (monday.suggested) {
                <span class="suggested-dot"></span>
              }
            </button>
          }
        </div>

        <p class="text-xs mb-4" style="color: var(--text-muted)">
          <app-icon name="info" [size]="12" />
          Los lunes marcados con punto son las fechas sugeridas (cada 2 semanas). Puede seleccionar
          cualquier lunes si necesita flexibilidad.
        </p>

        <!-- Fecha de término -->
        @if (selectedStartDate()) {
          <div class="mb-1">
            <label class="text-xs font-medium mb-1 block" style="color: var(--text-secondary)">
              Fecha de término
            </label>
            <div class="form-input" style="background: var(--bg-elevated); cursor: default;">
              {{ formatMonday(endDate()) }}
            </div>
            <p class="text-[10px] mt-1" style="color: var(--ds-brand)">
              Calculada automáticamente: sábado de la 5ta semana (30 días de clase, lun-sáb)
            </p>
          </div>
        }
      </section>

      <!-- ── Nombre y código (auto-generados) ──────────────────────────── -->
      @if (selectedStartDate()) {
        <section>
          <h3 class="text-sm font-semibold mb-3" style="color: var(--text-primary)">
            Información de la promoción
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-medium mb-1 block" style="color: var(--text-secondary)">
                Nombre (automático)
              </label>
              <div class="form-input" style="background: var(--bg-elevated); cursor: default;">
                {{ nombre() }}
              </div>
            </div>
            <div>
              <label class="text-xs font-medium mb-1 block" style="color: var(--text-secondary)">
                Código (automático)
              </label>
              <div class="form-input" style="background: var(--bg-elevated); cursor: default;">
                {{ codigo() }}
              </div>
            </div>
          </div>
          <p class="text-[10px] mt-1.5" style="color: var(--text-muted)">
            <app-icon name="info" [size]="10" />
            El nombre y código se generan automáticamente a partir de la fecha de inicio
            seleccionada.
          </p>
        </section>
      }

      <!-- ── Cursos y asignación de relatores ──────────────────────────── -->
      <section>
        <h3 class="text-sm font-semibold mb-1" style="color: var(--text-primary)">
          Cursos y asignación de relatores
        </h3>
        <p class="text-xs mb-4" style="color: var(--ds-brand)">
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
                  class="inline-flex items-center justify-center min-w-[26px] px-1.5 py-0.5 rounded text-[11px] font-bold text-white"
                  [style.background]="courseColor(curso.code)"
                >
                  {{ curso.code }}
                </span>
                <span class="text-sm font-medium" style="color: var(--text-primary)">
                  {{ curso.name }}
                </span>
                <span class="ml-auto text-xs" style="color: var(--ds-brand)"> Capacidad </span>
                <span class="text-sm font-semibold" style="color: var(--text-primary)">
                  25 alumnos
                </span>
              </div>

              <!-- Relatores asignados -->
              <label class="text-xs font-medium mb-1.5 block" style="color: var(--text-secondary)">
                Relatores asignados
              </label>

              @if (curso.selectedRelatores.length > 0) {
                <div class="flex flex-wrap gap-2 mb-2">
                  @for (rel of curso.selectedRelatores; track rel.id) {
                    <span
                      class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
                      style="
                        background: var(--color-primary-tint);
                        color: var(--color-primary);
                      "
                    >
                      {{ rel.nombre }}
                      <button
                        class="inline-flex items-center justify-center w-4 h-4 rounded-full hover:opacity-70"
                        style="background: transparent; border: none; cursor: pointer; color: inherit;"
                        (click)="removeRelator(curso.courseId, rel.id)"
                        [attr.aria-label]="'Quitar relator ' + rel.nombre"
                      >
                        <app-icon name="x" [size]="10" />
                      </button>
                    </span>
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
      <section
        class="rounded-lg p-4"
        style="background: var(--bg-elevated); border: 1px solid var(--border-subtle);"
      >
        <h4 class="text-xs font-semibold mb-2" style="color: var(--text-primary)">
          <app-icon name="info" [size]="12" />
          Reglas de negocio
        </h4>
        <ul class="text-[11px] flex flex-col gap-1" style="color: var(--text-muted)">
          <li>Duración fija: <strong>30 días de clase</strong> (lun-sáb = 5 semanas)</li>
          <li>Inicio solo en <strong>lunes</strong>, cada 2 semanas</li>
          <li>Máximo <strong>100 alumnos</strong> por promoción (25 por curso)</li>
          <li>4 cursos: A2, A3, A4, A5</li>
          <li>Un curso puede tener múltiples relatores</li>
          <li>Si un feriado cae en inicio, la promoción se marca como iniciada igualmente</li>
        </ul>
      </section>

      <!-- ── Acciones ──────────────────────────────────────────────────── -->
      <div class="flex items-center gap-3 pt-2" style="border-top: 1px solid var(--border-subtle);">
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
      </div>
    </div>
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
    .monday-btn.suggested {
      border-color: color-mix(in srgb, var(--ds-brand) 40%, transparent);
    }

    .suggested-dot {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--ds-brand);
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
  protected readonly nombre = signal('');
  protected readonly codigo = signal('');
  protected readonly selectedStartDate = signal<string | null>(null);
  protected readonly endDate = computed(() => {
    const start = this.selectedStartDate();
    return start ? computeEndDate(start) : '';
  });

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
  protected readonly availableMondays = generateAvailableMondays(8);

  // ── Validation ────────────────────────────────────────────────────────────
  protected readonly canSubmit = computed(() => {
    return (
      this.nombre().trim().length > 0 &&
      this.codigo().trim().length > 0 &&
      !!this.selectedStartDate()
    );
  });

  constructor() {
    // Load relatores and courses when drawer opens
    this.facade.loadRelatoresDisponibles();
    this.facade.loadProfessionalCourses();

    // Auto-generate name and code from start date (non-editable)
    effect(() => {
      const date = this.selectedStartDate();
      if (date) {
        this.nombre.set(generatePromoName(date));
        this.codigo.set(generatePromoCode(date));
      }
    });
  }

  protected selectStartDate(date: string): void {
    this.selectedStartDate.set(date);
  }

  protected formatMonday(iso: string): string {
    return formatMondayLabel(iso);
  }

  protected courseColor(code: string): string {
    return COURSE_COLORS[code] ?? '#6b7280';
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
      code: this.codigo().trim(),
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
