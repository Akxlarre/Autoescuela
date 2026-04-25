import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
  computed,
  effect,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsistenciaProfesionalFacade } from '@core/facades/asistencia-profesional.facade';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { StatBoxComponent } from '@shared/components/stat-box/stat-box.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { AsistenciaStatus } from '@core/models/ui/sesion-profesional.model';

@Component({
  selector: 'app-admin-sesion-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SkeletonBlockComponent, IconComponent, AsyncBtnComponent, StatBoxComponent],
  template: `
    @if (facade.selectedSesion(); as sesion) {
      <!-- ═══ Header de la sesión ═══ -->
      <div class="mb-4 rounded-lg border border-border bg-surface p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <app-icon [name]="sesion.tipo === 'theory' ? 'book-open' : 'wrench'" [size]="20" />
            <span class="text-sm font-semibold text-primary">
              {{ sesion.tipo === 'theory' ? 'Sesión Teórica' : 'Sesión Práctica' }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              [style.background]="statusColor(sesion.status)"
              [style.color]="'white'"
            >
              {{ sesion.statusLabel }}
            </span>
            @if (sesion.status !== 'cancelled') {
              <button
                class="cancel-btn flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
                style="border-color: var(--state-error); color: var(--state-error)"
                (click)="cancelarSesion()"
                data-llm-action="cancel-session"
              >
                <app-icon name="ban" [size]="11" />
                Cancelar
              </button>
            } @else {
              <button
                class="cancel-btn flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
                style="border-color: var(--state-success); color: var(--state-success)"
                (click)="reactivarSesion()"
                data-llm-action="reactivate-session"
              >
                <app-icon name="rotate-ccw" [size]="11" />
                Reactivar
              </button>
            }
          </div>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-3">
          <app-stat-box
            label="Curso"
            [value]="sesion.courseCode"
            variant="surface"
            [compact]="true"
          />
          <app-stat-box
            label="Asistencia"
            [value]="sesion.attendanceCount + '/' + sesion.enrolledCount"
            variant="surface"
            [compact]="true"
            [useMono]="true"
          />
        </div>

        @if (sesion.zoomLink) {
          <div class="mt-2">
            <span class="text-xs text-muted">Zoom</span>
            <p class="truncate text-xs text-primary">{{ sesion.zoomLink }}</p>
          </div>
        }
      </div>

      <!-- ═══ Toggle modo ═══ -->
      <div class="mb-4 flex gap-2">
        <button
          class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border"
          [class]="mode() === 'attendance' && !isFuture() ? 'bg-brand/10 border-brand text-brand' : 'bg-surface border-border text-secondary hover:bg-surface-elevated hover:text-primary'"
          [class.opacity-50]="isFuture()"
          [disabled]="isFuture()"
          (click)="!isFuture() && mode.set('attendance')"
          data-llm-action="switch-to-attendance-mode"
        >
          <app-icon name="clipboard-check" [size]="14" />
          Asistencia
        </button>
        <button
          class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border"
          [class]="mode() === 'edit' ? 'bg-brand/10 border-brand text-brand' : 'bg-surface border-border text-secondary hover:bg-surface-elevated hover:text-primary'"
          (click)="mode.set('edit')"
          data-llm-action="switch-to-edit-mode"
        >
          <app-icon name="pencil" [size]="14" />
          Editar sesión
        </button>
      </div>

      <!-- ═══ Modo Asistencia ═══ -->
      @if (mode() === 'attendance') {
        @if (sesion.status === 'cancelled') {
          <div class="py-10 text-center">
            <app-icon name="ban" [size]="36" color="var(--state-error)" />
            <p class="mt-3 text-sm font-medium text-primary">Sesión cancelada</p>
            <p class="mt-1 text-xs text-muted">
              No se puede registrar asistencia en una sesión cancelada. Usa "Reactivar" para
              habilitarla.
            </p>
          </div>
        } @else if (isFuture()) {
          <div class="py-10 text-center">
            <app-icon name="clock" [size]="36" color="var(--color-text-muted)" />
            <p class="mt-3 text-sm font-medium text-primary">Sesión aún no disponible</p>
            <p class="mt-1 text-xs text-muted">
              El registro de asistencia estará habilitado a partir del
              {{ formatDateDisplay(facade.selectedSesion()!.date) }}.
            </p>
          </div>
        } @else if (facade.isLoadingAsistencia()) {
          <div class="space-y-3">
            @for (i of skeletonRows; track i) {
              <div class="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
                <app-skeleton-block variant="circle" width="32px" height="32px" />
                <div class="flex-1">
                  <app-skeleton-block variant="text" width="70%" height="14px" />
                  <app-skeleton-block variant="text" width="40%" height="12px" />
                </div>
                <app-skeleton-block variant="rect" width="120px" height="28px" />
              </div>
            }
          </div>
        } @else {
          <!-- Bulk actions -->
          @if (facade.asistenciaAlumnos().length > 0) {
            <div class="mb-3 flex items-center justify-between rounded-lg bg-surface-elevated p-2">
              <span class="text-xs text-secondary">
                {{ facade.asistenciaAlumnos().length }} alumnos
              </span>
              <div class="flex gap-2">
                <button
                  class="bulk-btn flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:border-success hover:text-success"
                  (click)="marcarTodos('present')"
                  data-llm-action="mark-all-present"
                >
                  <app-icon name="check" [size]="12" />
                  Todos presentes
                </button>
                <button
                  class="bulk-btn flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:border-error hover:text-error"
                  (click)="marcarTodos('absent')"
                  data-llm-action="mark-all-absent"
                >
                  <app-icon name="x" [size]="12" />
                  Todos ausentes
                </button>
              </div>
            </div>
          }

          <!-- Student list -->
          <div class="space-y-2">
            @for (alumno of facade.asistenciaAlumnos(); track alumno.studentId) {
              <div class="rounded-lg border border-border bg-surface p-3 transition-colors">
                <!-- Fila superior: avatar + nombre -->
                <div class="flex items-center gap-3 mb-3">
                  <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style="background: color-mix(in srgb, var(--ds-brand) 15%, transparent); color: var(--ds-brand)"
                  >
                    {{ alumno.initials }}
                  </div>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-primary">{{ alumno.nombre }}</p>
                    <p class="text-xs text-muted">{{ alumno.rut }}</p>
                  </div>
                </div>

                <!-- Fila inferior: botones de asistencia -->
                <div class="flex gap-2">
                  <button
                    class="status-btn flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-semibold transition-all"
                    [class.border-success]="localStatus()[alumno.studentId] === 'present'"
                    [class.bg-success]="localStatus()[alumno.studentId] === 'present'"
                    [class.text-white]="localStatus()[alumno.studentId] === 'present'"
                    [class.border-border]="localStatus()[alumno.studentId] !== 'present'"
                    [class.text-secondary]="localStatus()[alumno.studentId] !== 'present'"
                    (click)="setStatus(alumno.studentId, 'present')"
                    data-llm-action="mark-present"
                  >
                    <app-icon name="check" [size]="14" />
                    Presente
                  </button>
                  <button
                    class="status-btn flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-semibold transition-all"
                    [class.border-error]="localStatus()[alumno.studentId] === 'absent'"
                    [class.bg-error]="localStatus()[alumno.studentId] === 'absent'"
                    [class.text-white]="localStatus()[alumno.studentId] === 'absent'"
                    [class.border-border]="localStatus()[alumno.studentId] !== 'absent'"
                    [class.text-secondary]="localStatus()[alumno.studentId] !== 'absent'"
                    (click)="setStatus(alumno.studentId, 'absent')"
                    data-llm-action="mark-absent"
                  >
                    <app-icon name="x" [size]="14" />
                    Ausente
                  </button>
                  <button
                    class="status-btn flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-semibold transition-all"
                    [class.border-warning]="localStatus()[alumno.studentId] === 'excused'"
                    [class.bg-warning]="localStatus()[alumno.studentId] === 'excused'"
                    [class.text-white]="localStatus()[alumno.studentId] === 'excused'"
                    [class.border-border]="localStatus()[alumno.studentId] !== 'excused'"
                    [class.text-secondary]="localStatus()[alumno.studentId] !== 'excused'"
                    (click)="setStatus(alumno.studentId, 'excused')"
                    data-llm-action="mark-excused"
                  >
                    <app-icon name="file-check" [size]="14" />
                    Justificado
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Save button -->
          @if (facade.asistenciaAlumnos().length > 0) {
            <div class="mt-4">
              <app-async-btn
                label="Guardar asistencia"
                icon="check"
                [loading]="facade.isSaving()"
                [disabled]="!hasChanges()"
                (click)="guardar()"
                data-llm-action="save-attendance"
              />
            </div>
          }

          @if (facade.asistenciaAlumnos().length === 0) {
            <div class="py-8 text-center">
              <app-icon name="users" [size]="32" color="var(--color-text-muted)" />
              <p class="mt-2 text-sm text-muted">No hay alumnos inscritos en este curso</p>
            </div>
          }
        }
      }

      <!-- ═══ Modo Editar Sesión ═══ -->
      @if (mode() === 'edit') {
        <div class="space-y-4">
          <!-- Fecha -->
          <div>
            <label class="mb-1 block text-xs font-medium text-secondary">Fecha</label>
            <input
              type="date"
              class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
              [ngModel]="editDate()"
              (ngModelChange)="editDate.set($event)"
              data-llm-description="input for session date change"
            />
          </div>

          <!-- Notas -->
          <div>
            <label class="mb-1 block text-xs font-medium text-secondary">Notas</label>
            <textarea
              class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
              rows="3"
              placeholder="Notas opcionales..."
              [ngModel]="editNotes()"
              (ngModelChange)="editNotes.set($event)"
              data-llm-description="input for session notes"
            ></textarea>
          </div>

          <app-async-btn
            label="Guardar cambios"
            icon="check"
            [loading]="facade.isSaving()"
            [disabled]="!hasEditChanges()"
            (click)="guardarEdicion()"
            data-llm-action="save-session-edit"
          />
        </div>
      }
    }
  `,
  styles: `
    .bg-success {
      background: var(--color-success);
    }
    .bg-error {
      background: var(--color-error);
    }
    .bg-warning {
      background: var(--color-warning);
    }
    .border-brand {
      border-color: var(--ds-brand);
    }

    .tab-btn,
    .bulk-btn,
    .status-btn,
    .cancel-btn {
      cursor: pointer;
    }

    .hover\:border-success:hover {
      border-color: var(--color-success);
    }
    .hover\:text-success:hover {
      color: var(--color-success);
    }
    .hover\:border-error:hover {
      border-color: var(--color-error);
    }
    .hover\:text-error:hover {
      color: var(--color-error);
    }

    :host {
      display: block;
    }
  `,
})
export class AdminSesionDrawerComponent implements OnInit {
  readonly facade = inject(AsistenciaProfesionalFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  readonly closed = output();

  readonly mode = signal<'attendance' | 'edit'>('attendance');
  readonly localStatus = signal<Record<number, AsistenciaStatus>>({});
  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly isFuture = computed(() => {
    const s = this.facade.selectedSesion();
    if (!s) return false;
    const today = new Date().toISOString().slice(0, 10);
    return s.date > today;
  });

  // Edit mode state
  readonly editDate = signal('');
  readonly editNotes = signal('');

  private originalDate = '';
  private originalNotes = '';

  readonly hasChanges = computed(() => {
    const alumnos = this.facade.asistenciaAlumnos();
    const statuses = this.localStatus();
    return alumnos.some((a) => {
      const local = statuses[a.studentId];
      return local && local !== a.status;
    });
  });

  readonly hasEditChanges = computed(() => {
    return this.editDate() !== this.originalDate || this.editNotes() !== this.originalNotes;
  });

  constructor() {
    effect(() => {
      const alumnos = this.facade.asistenciaAlumnos();
      if (alumnos.length === 0) return;
      const statuses: Record<number, AsistenciaStatus> = {};
      for (const a of alumnos) {
        if (a.status) statuses[a.studentId] = a.status;
      }
      this.localStatus.set(statuses);
    });

    effect(() => {
      const sesion = this.facade.selectedSesion();
      if (!sesion) return;
      this.editDate.set(sesion.date);
      this.editNotes.set(sesion.notes ?? '');
      this.originalDate = sesion.date;
      this.originalNotes = sesion.notes ?? '';
    });
  }

  ngOnInit(): void {
    // Effects handle sync
  }

  setStatus(studentId: number, status: AsistenciaStatus): void {
    this.localStatus.update((prev) => ({ ...prev, [studentId]: status }));
  }

  marcarTodos(status: AsistenciaStatus): void {
    const alumnos = this.facade.asistenciaAlumnos();
    const statuses: Record<number, AsistenciaStatus> = {};
    for (const a of alumnos) {
      statuses[a.studentId] = status;
    }
    this.localStatus.set(statuses);
  }

  async guardar(): Promise<void> {
    const alumnos = this.facade.asistenciaAlumnos();
    const statuses = this.localStatus();

    const registros = alumnos
      .filter((a) => statuses[a.studentId])
      .map((a) => ({
        enrollmentId: a.enrollmentId,
        studentId: a.studentId,
        status: statuses[a.studentId],
        attendanceId: a.attendanceId,
      }));

    if (registros.length === 0) return;
    await this.facade.guardarAsistencia(registros);
  }

  async guardarEdicion(): Promise<void> {
    const sesion = this.facade.selectedSesion();
    if (!sesion) return;

    const payload: { date?: string; notes?: string } = {};
    if (this.editDate() !== this.originalDate) payload.date = this.editDate();
    if (this.editNotes() !== this.originalNotes) payload.notes = this.editNotes();

    await this.facade.editarSesion(sesion, payload);
  }

  async cancelarSesion(): Promise<void> {
    const sesion = this.facade.selectedSesion();
    if (!sesion) return;

    const confirmed = await this.facade.confirm({
      title: 'Cancelar sesión',
      message:
        'Esta sesión no contará para el cálculo de asistencia. ¿Estás segura de que deseas cancelarla?',
      confirmLabel: 'Sí, cancelar sesión',
      cancelLabel: 'Volver',
      severity: 'danger',
    });

    if (!confirmed) return;
    await this.facade.editarSesion(sesion, { status: 'cancelled' });
    this.layoutDrawer.close();
  }

  async reactivarSesion(): Promise<void> {
    const sesion = this.facade.selectedSesion();
    if (!sesion) return;
    const success = await this.facade.editarSesion(sesion, { status: 'scheduled' });
    if (success) {
      // Buscar la sesión actualizada (status ya es 'scheduled') y recargar asistencia
      const updatedSesion = this.facade
        .sesiones()
        .find((s) => s.id === sesion.id && s.tipo === sesion.tipo);
      await this.facade.selectSesion(updatedSesion ?? { ...sesion, status: 'scheduled' });
      this.mode.set('attendance');
    }
  }

  formatDateDisplay(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  statusColor(status: string): string {
    const colors: Record<string, string> = {
      scheduled: 'var(--color-text-secondary)',
      in_progress: 'var(--ds-brand)',
      completed: 'var(--color-success)',
      cancelled: 'var(--color-error)',
    };
    return colors[status] ?? 'var(--color-text-secondary)';
  }
}
