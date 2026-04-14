import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import type { TeoriaAlumnoElegible } from '@core/models/ui/asistencia-clase-b.model';

/**
 * AgendarTeoriaDrawerComponent — Smart.
 * Abierto desde AdminAsistenciaComponent / SecretariaAsistenciaComponent
 * cuando el usuario hace click en "Agendar nueva clase".
 *
 * Permite:
 *  - Seleccionar sede (si admin con "Todas las escuelas")
 *  - Elegir fecha, hora inicio/fin, tema
 *  - Seleccionar alumnos de la sede
 *  - Opcionalmente agregar enlace Zoom
 */
@Component({
  selector: 'app-agendar-teoria-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, SkeletonBlockComponent],
  styles: `
    .field-label {
      display: block;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .field-input {
      width: 100%;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
    }
    .field-select {
      width: 100%;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
      appearance: auto;
    }
    .field-select:focus {
      border-color: var(--ds-brand);
    }
  `,
  template: `
    <div class="flex flex-col h-full" style="background: var(--bg-surface)">
      <!-- ── Formulario ──────────────────────────────────────────────────── -->
      <div class="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        <!-- Sede (solo si admin sin sede fija) -->
        @if (showBranchSelector()) {
          <div class="flex flex-col gap-1.5">
            <label class="field-label">Sede</label>
            <select
              class="field-select"
              [ngModel]="selectedBranchId()"
              (ngModelChange)="onBranchChange($event)"
              data-llm-description="Selector de sede para la clase teórica"
            >
              <option [ngValue]="null" disabled>Selecciona una sede</option>
              @for (branch of branches(); track branch.id) {
                <option [ngValue]="branch.id">{{ branch.name }}</option>
              }
            </select>
          </div>
        }

        <!-- Fecha -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label">Fecha</label>
          <input
            type="date"
            class="field-input"
            [ngModel]="scheduledDate()"
            (ngModelChange)="scheduledDate.set($event)"
            data-llm-description="Fecha de la clase teórica"
          />
        </div>

        <!-- Hora inicio / fin -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="field-label">Hora inicio</label>
            <input
              type="time"
              class="field-input"
              [ngModel]="startTime()"
              (ngModelChange)="startTime.set($event)"
              data-llm-description="Hora de inicio de la clase teórica"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="field-label">Hora fin</label>
            <input
              type="time"
              class="field-input"
              [ngModel]="endTime()"
              (ngModelChange)="endTime.set($event)"
              data-llm-description="Hora de fin de la clase teórica"
            />
          </div>
        </div>

        <!-- Tema -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label">Tema</label>
          <input
            type="text"
            class="field-input"
            placeholder="Ej: Legislación de Tránsito"
            [ngModel]="topic()"
            (ngModelChange)="topic.set($event)"
            data-llm-description="Tema de la clase teórica"
          />
        </div>

        <!-- Zoom link (opcional) -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label">Enlace Zoom (opcional)</label>
          <input
            type="url"
            class="field-input"
            placeholder="https://zoom.us/j/..."
            [ngModel]="zoomLink()"
            (ngModelChange)="zoomLink.set($event)"
            data-llm-description="URL del enlace Zoom (opcional)"
          />
        </div>

        <!-- Alumnos -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="field-label mb-0">Alumnos</label>
            @if (!facade.isLoadingElegibles() && localAlumnos().length > 0) {
              <button
                class="text-xs font-medium"
                style="color: var(--color-primary); background: none; border: none; cursor: pointer"
                (click)="toggleAll()"
              >
                {{ allSelected() ? 'Desmarcar todos' : 'Marcar todos' }}
              </button>
            }
          </div>

          @if (!selectedBranchId()) {
            <p class="text-xs py-4 text-center" style="color: var(--text-muted)">
              Selecciona una sede para ver alumnos disponibles.
            </p>
          } @else if (facade.isLoadingElegibles()) {
            <div class="flex flex-col gap-2">
              @for (_ of [1, 2, 3]; track $index) {
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              }
            </div>
          } @else if (localAlumnos().length === 0) {
            <p class="text-xs py-4 text-center" style="color: var(--text-muted)">
              No hay alumnos con matrícula activa en esta sede.
            </p>
          } @else {
            <div
              class="flex flex-col gap-1 max-h-64 overflow-y-auto rounded-lg border p-2"
              [style.border-color]="'var(--border-subtle)'"
            >
              @for (alumno of localAlumnos(); track alumno.enrollmentId) {
                <label
                  class="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors hover:bg-surface-elevated"
                >
                  <input
                    type="checkbox"
                    [checked]="alumno.selected"
                    (change)="toggleAlumno(alumno.enrollmentId)"
                    class="accent-[var(--ds-brand)]"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium truncate" style="color: var(--text-primary)">
                      {{ alumno.alumnoName }}
                    </p>
                    <p class="text-xs truncate" style="color: var(--text-muted)">
                      {{ alumno.email }}
                    </p>
                  </div>
                </label>
              }
            </div>
            <p class="text-xs" style="color: var(--text-muted)">
              {{ selectedCount() }} de {{ localAlumnos().length }} seleccionados
            </p>
          }
        </div>
      </div>

      <!-- ── Footer ─────────────────────────────────────────────────────────── -->
      <div
        class="p-4 border-t flex items-center justify-end gap-2"
        style="border-color: var(--border-subtle); background: var(--bg-subtle)"
      >
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium"
          style="background: transparent; color: var(--text-muted); border: none; cursor: pointer"
          (click)="onClose()"
          data-llm-action="cerrar-agendar-teoria-drawer"
        >
          Cancelar
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
          style="background: var(--ds-brand); color: #fff; border: none; cursor: pointer"
          [disabled]="!canSave() || facade.isSaving()"
          data-llm-action="guardar-nueva-clase-teoria"
          (click)="onSave()"
        >
          @if (facade.isSaving()) {
            <app-icon name="loader" [size]="14" />
          }
          Agendar Clase
        </button>
      </div>
    </div>
  `,
})
export class AgendarTeoriaDrawerComponent implements OnInit {
  protected readonly facade = inject(AsistenciaClaseBFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  /** If a fixed branchId is provided (secretaria), skip the branch selector. */
  readonly fixedBranchId = input<number | null>(null);

  // Form state
  protected readonly selectedBranchId = signal<number | null>(null);
  protected readonly scheduledDate = signal(todayIso());
  protected readonly startTime = signal('18:00');
  protected readonly endTime = signal('19:30');
  protected readonly topic = signal('');
  protected readonly zoomLink = signal('');
  protected readonly localAlumnos = signal<TeoriaAlumnoElegible[]>([]);

  // Derived
  protected readonly branches = this.branchFacade.branches;
  protected readonly showBranchSelector = computed(() => this.fixedBranchId() === null);

  protected readonly allSelected = computed(
    () => this.localAlumnos().length > 0 && this.localAlumnos().every((a) => a.selected),
  );

  protected readonly selectedCount = computed(
    () => this.localAlumnos().filter((a) => a.selected).length,
  );

  protected readonly canSave = computed(() => {
    return (
      this.selectedBranchId() !== null &&
      this.scheduledDate().length > 0 &&
      this.startTime().length > 0 &&
      this.endTime().length > 0 &&
      this.topic().trim().length > 0
    );
  });

  constructor() {
    // Sync local alumnos when facade loads them
    effect(() => {
      const elegibles = this.facade.alumnosElegibles();
      this.localAlumnos.set(elegibles.map((a) => ({ ...a })));
    });
  }

  ngOnInit(): void {
    const fixed = this.fixedBranchId();
    if (fixed !== null) {
      this.selectedBranchId.set(fixed);
      void this.facade.loadAlumnosElegibles(fixed);
    } else {
      // If admin already has a branch selected, use it
      const currentBranch = this.branchFacade.selectedBranchId();
      if (currentBranch !== null) {
        this.selectedBranchId.set(currentBranch);
        void this.facade.loadAlumnosElegibles(currentBranch);
      }
    }
  }

  protected onBranchChange(branchId: number): void {
    this.selectedBranchId.set(branchId);
    void this.facade.loadAlumnosElegibles(branchId);
  }

  protected toggleAlumno(enrollmentId: number): void {
    this.localAlumnos.update((rows) =>
      rows.map((r) => (r.enrollmentId === enrollmentId ? { ...r, selected: !r.selected } : r)),
    );
  }

  protected toggleAll(): void {
    const newVal = !this.allSelected();
    this.localAlumnos.update((rows) => rows.map((r) => ({ ...r, selected: newVal })));
  }

  protected async onSave(): Promise<void> {
    const branchId = this.selectedBranchId();
    if (!branchId) return;

    const enrollmentIds = this.localAlumnos()
      .filter((a) => a.selected)
      .map((a) => a.enrollmentId);

    const success = await this.facade.crearClaseTeorica({
      branchId,
      scheduledDate: this.scheduledDate(),
      startTime: this.startTime(),
      endTime: this.endTime(),
      topic: this.topic().trim(),
      zoomLink: this.zoomLink().trim() || undefined,
      enrollmentIds,
    });

    if (success) {
      this.facade.clearElegibles();
      this.layoutDrawer.close();
    }
  }

  protected onClose(): void {
    this.facade.clearElegibles();
    this.layoutDrawer.close();
  }
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
