import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AdminHorariosFacade } from '@core/facades/admin-horarios.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { SelectModule } from 'primeng/select';

interface Turno {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  blockDuration: number;
  breakDuration: number;
}

interface HorarioBlock {
  from: string;
  to: string;
  turnoName: string;
  active: boolean;
}

@Component({
  selector: 'app-configurador-horarios-drawer',
  standalone: true,
  imports: [FormsModule, IconComponent, SkeletonBlockComponent, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
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
  `,
  template: `
    <div class="flex h-full flex-col bg-surface text-text-primary overflow-hidden">
      <!-- Header -->
      <div class="shrink-0 border-b border-border-subtle p-5">
        <h2 class="text-lg font-bold text-text-primary">Configuración de Grilla Horaria</h2>
        <p class="mt-1 text-sm text-text-muted">
          Define las reglas base para la disponibilidad de clases prácticas.
        </p>
      </div>

      <!-- Scrollable content -->
      <div class="flex-1 overflow-y-auto p-5 space-y-6">
        <!-- Warning Alert -->
        <div class="rounded-lg border border-warning/30 bg-warning/10 p-3 flex gap-3 items-start">
          <app-icon name="alert-triangle" [size]="16" class="text-warning mt-0.5 shrink-0" />
          <div class="text-xs text-text-secondary leading-relaxed">
            <strong class="text-text-primary block mb-1">Cuidado con cambios radicales</strong>
            Cambiar la grilla base afectará de inmediato la disponibilidad para
            <strong>nuevas matrículas</strong>. Las clases agendadas previamente mantendrán su hora
            real en base de datos, pero podrían verse descuadradas en la vista semanal de la agenda
            si ya no encajan en los nuevos bloques.
          </div>
        </div>

        <!-- Courses Selection -->
        <section class="space-y-3">
          <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
            <app-icon name="book-open" [size]="16" class="text-brand" />
            1. Selecciona los Cursos a afectar
          </h3>
          <p class="text-xs text-text-muted">
            Los cambios se aplicarán solo a los cursos seleccionados de la sede que elijas.
          </p>

          @if (branchFacade.selectedBranchId() === null) {
            <div class="mb-4 p-3 rounded-lg border border-border-default bg-surface/50 space-y-2">
              <label class="block text-xs font-bold text-text-secondary">Sede a Configurar</label>
              <p-select
                styleClass="w-full"
                [ngModel]="localBranchId()"
                (ngModelChange)="localBranchId.set($event)"
                [options]="branchFacade.branches()"
                optionLabel="name"
                optionValue="id"
                placeholder="Selecciona una sede..."
              ></p-select>
            </div>
          }

          <div class="space-y-2">
            @if (facade.isLoading()) {
              <app-skeleton-block height="40px" />
              <app-skeleton-block height="40px" />
            } @else if (localBranchId() === null) {
              <div
                class="p-3 border border-border-default rounded-lg bg-base text-sm text-text-muted text-center"
              >
                Selecciona una sede arriba para cargar sus cursos.
              </div>
            } @else if (facade.courses().length === 0) {
              <div
                class="p-3 border border-border-default rounded-lg bg-base text-sm text-text-muted text-center"
              >
                No hay cursos disponibles para esta sede.
              </div>
            } @else {
              @for (course of facade.courses(); track course.id) {
                <label
                  class="flex items-center gap-3 p-3 rounded-lg border border-border-default bg-base cursor-pointer hover:border-brand transition-colors"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-border-default text-brand focus:ring-brand focus:ring-offset-base bg-surface"
                    [checked]="selectedCourseIds().includes(course.id)"
                    (change)="toggleCourseSelection(course.id)"
                  />
                  <div class="flex-1">
                    <div class="text-sm font-semibold text-text-primary">{{ course.name }}</div>
                  </div>
                </label>
              }
            }
          </div>
        </section>

        <!-- Turnos Builder -->
        <section class="space-y-3">
          <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
            <app-icon name="clock" [size]="16" class="text-brand" />
            2. Define los Turnos
          </h3>

          <div class="space-y-4">
            @for (turno of turnos(); track turno.id; let i = $index) {
              <div class="p-4 rounded-xl border border-border-default bg-base relative group">
                <button
                  type="button"
                  class="absolute top-3 right-3 text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                  (click)="removeTurno(turno.id)"
                >
                  <app-icon name="trash-2" [size]="14" />
                </button>

                <input
                  type="text"
                  [(ngModel)]="turno.name"
                  class="text-sm font-bold bg-transparent border-none outline-none focus:ring-0 p-0 text-text-primary w-full sm:w-48 mb-3"
                  placeholder="Nombre del Turno"
                />

                <div class="flex flex-col sm:flex-row gap-3 mb-3">
                  <!-- Start Time -->
                  <div class="flex flex-col gap-1.5 flex-1 min-w-[120px]">
                    <label
                      class="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center h-4"
                    >
                      Hora Inicio
                    </label>
                    <div class="flex items-center gap-1.5">
                      <p-select
                        class="flex-1"
                        [options]="hoursOptions"
                        optionLabel="label"
                        optionValue="value"
                        [ngModel]="getHour(turno.startTime)"
                        (ngModelChange)="setStartTimeHour(turno, $event)"
                        styleClass="w-full"
                        placeholder="HH"
                      ></p-select>
                      <span class="text-text-muted font-bold">:</span>
                      <p-select
                        class="flex-1"
                        [options]="minutesOptions"
                        optionLabel="label"
                        optionValue="value"
                        [ngModel]="getMinute(turno.startTime)"
                        (ngModelChange)="setStartTimeMinute(turno, $event)"
                        styleClass="w-full"
                        placeholder="MM"
                      ></p-select>
                    </div>
                  </div>
                  <!-- End Time -->
                  <div class="flex flex-col gap-1.5 flex-1 min-w-[120px]">
                    <label
                      class="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center justify-between h-4"
                    >
                      <span>Hora Fin</span>
                      <app-icon name="clock" [size]="12" class="text-text-muted" />
                    </label>
                    <div class="flex items-center gap-1.5">
                      <p-select
                        class="flex-1"
                        [options]="hoursOptions"
                        optionLabel="label"
                        optionValue="value"
                        [ngModel]="getHour(turno.endTime)"
                        (ngModelChange)="setEndTimeHour(turno, $event)"
                        styleClass="w-full"
                        placeholder="HH"
                      ></p-select>
                      <span class="text-text-muted font-bold">:</span>
                      <p-select
                        class="flex-1"
                        [options]="minutesOptions"
                        optionLabel="label"
                        optionValue="value"
                        [ngModel]="getMinute(turno.endTime)"
                        (ngModelChange)="setEndTimeMinute(turno, $event)"
                        styleClass="w-full"
                        placeholder="MM"
                      ></p-select>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] font-semibold text-text-muted mb-1"
                      >Duración Bloque (min)</label
                    >
                    <input type="number" [(ngModel)]="turno.blockDuration" class="field-input" />
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-text-muted mb-1"
                      >Descanso (min)</label
                    >
                    <input type="number" [(ngModel)]="turno.breakDuration" class="field-input" />
                  </div>
                </div>
              </div>
            }

            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-brand/50 rounded-lg text-brand text-xs font-semibold hover:bg-brand-muted transition-colors cursor-pointer"
              (click)="addTurno()"
            >
              <app-icon name="plus" [size]="14" />
              Añadir Turno
            </button>
          </div>

          <button type="button" class="btn-primary w-full py-2.5 mt-2" (click)="generateGrid()">
            <app-icon name="zap" [size]="14" />
            Generar Grilla
          </button>
        </section>

        <!-- Preview -->
        @if (generatedBlocks().length > 0) {
          <section class="space-y-4 pt-4 border-t border-border-subtle">
            <div class="flex items-center justify-between pb-1">
              <div class="space-y-0.5">
                <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
                  <app-icon name="layout-list" [size]="16" class="text-success" />
                  3. Vista Previa de la Grilla
                </h3>
                <p class="text-[11px] text-text-muted">
                  Bloques resultantes: <strong>{{ activeBlocksCount() }} activos</strong>.
                  Deshabilita las excepciones (ej. bloque de colación largo).
                </p>
              </div>
            </div>

            <div class="space-y-4">
              @for (group of groupedBlocks(); track group.turnoName) {
                <div class="space-y-2">
                  <!-- Cabecera del Turno -->
                  <div class="flex items-center gap-2">
                    <span
                      class="text-[10px] font-bold uppercase tracking-wider text-text-secondary"
                    >
                      {{ group.turnoName }}
                    </span>
                    <div class="h-px flex-1 bg-border-subtle"></div>
                  </div>

                  <!-- Cuadrícula Compacta de Bloques -->
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    @for (block of group.blocks; track block.from) {
                      <div
                        class="flex flex-col items-center justify-center p-2 rounded border transition-all cursor-pointer relative group overflow-hidden"
                        [class.border-success]="block.active"
                        [class.bg-success/10]="block.active"
                        [class.text-success]="block.active"
                        [class.hover:bg-error/10]="block.active"
                        [class.hover:border-error/30]="block.active"
                        [class.hover:text-error]="block.active"
                        [class.border-dashed]="!block.active"
                        [class.border-border-default]="!block.active"
                        [class.bg-base]="!block.active"
                        [class.text-text-muted]="!block.active"
                        [class.hover:bg-brand-muted]="!block.active"
                        [class.hover:border-brand]="!block.active"
                        [class.hover:text-brand]="!block.active"
                        (click)="toggleBlock(block)"
                        [title]="block.active ? 'Deshabilitar bloque' : 'Restaurar bloque'"
                      >
                        <span
                          class="text-xs font-bold font-mono transition-all"
                          [class.line-through]="!block.active"
                        >
                          {{ block.from }} - {{ block.to }}
                        </span>

                        <!-- Mini status overlay for disabled items -->
                        @if (!block.active) {
                          <span
                            class="text-[8px] uppercase font-bold text-error mt-0.5 tracking-widest opacity-80"
                            >Omitido</span
                          >
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            @if (generatedBlocks().length === 0) {
              <div
                class="text-center py-6 border border-dashed border-border-default rounded-xl bg-base"
              >
                <app-icon
                  name="calendar-x"
                  [size]="24"
                  class="text-text-muted mx-auto mb-2 opacity-50"
                />
                <p class="text-sm text-text-muted">No hay bloques generados.</p>
              </div>
            }
          </section>
        }
      </div>

      <!-- Footer -->
      <div class="shrink-0 border-t border-border-subtle p-4 flex justify-end gap-3 bg-surface">
        <button
          type="button"
          class="btn-secondary"
          (click)="close()"
          [disabled]="facade.isSaving()"
        >
          Cancelar
        </button>
        <button type="button" class="btn-primary" [disabled]="!canSave()" (click)="save()">
          <app-icon name="save" [size]="14" />
          {{ facade.isSaving() ? 'Guardando...' : 'Aplicar Cambios' }}
        </button>
      </div>
    </div>
  `,
})
export class ConfiguradorHorariosDrawerComponent {
  protected readonly facade = inject(AdminHorariosFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  protected readonly branchFacade = inject(BranchFacade); // Made protected to use in template

  protected readonly localBranchId = signal<number | null>(null);
  protected readonly selectedCourseIds = signal<number[]>([]);

  protected readonly turnos = signal<Turno[]>([
    {
      id: '1',
      name: 'Turno Mañana',
      startTime: '08:30',
      endTime: '13:25',
      blockDuration: 45,
      breakDuration: 5,
    },
    {
      id: '2',
      name: 'Turno Tarde',
      startTime: '15:00',
      endTime: '20:45',
      blockDuration: 45,
      breakDuration: 5,
    },
  ]);

  protected readonly generatedBlocks = signal<HorarioBlock[]>([]);

  // Opciones para selectores de hora
  protected readonly hoursOptions = Array.from({ length: 24 }, (_, i) => ({
    label: i.toString().padStart(2, '0'),
    value: i.toString().padStart(2, '0'),
  }));

  protected readonly minutesOptions = Array.from({ length: 12 }, (_, i) => {
    // Saltos de 5 minutos: 0, 5, 10...
    const min = i * 5;
    return {
      label: min.toString().padStart(2, '0'),
      value: min.toString().padStart(2, '0'),
    };
  });

  constructor() {
    // Inicializar el localBranchId con el global
    this.localBranchId.set(this.branchFacade.selectedBranchId());

    // Reaccionar a los cambios de la sede local
    effect(() => {
      const branchId = this.localBranchId();
      if (branchId) {
        void this.facade.loadCourses(branchId);
      } else {
        // Si vuelve a ser null, limpiamos la selección
        this.selectedCourseIds.set([]);
      }
    });

    // Auto-select all courses when loaded
    effect(
      () => {
        const courses = this.facade.courses();
        if (courses.length > 0 && this.selectedCourseIds().length === 0) {
          this.selectedCourseIds.set(courses.map((c) => c.id));
        }
      },
      { allowSignalWrites: true },
    );
  }

  protected toggleCourseSelection(id: number): void {
    this.selectedCourseIds.update((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );
  }

  protected addTurno(): void {
    this.turnos.update((t) => [
      ...t,
      {
        id: Date.now().toString(),
        name: 'Nuevo Turno',
        startTime: '10:00',
        endTime: '12:00',
        blockDuration: 45,
        breakDuration: 5,
      },
    ]);
  }

  protected removeTurno(id: string): void {
    this.turnos.update((t) => t.filter((x) => x.id !== id));
  }

  protected generateGrid(): void {
    const blocks: HorarioBlock[] = [];

    // Helper para parsear tiempo
    const parseTime = (timeStr: string) => {
      const parts = timeStr.split(':');
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    const formatTime = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    for (const turno of this.turnos()) {
      let currentMins = parseTime(turno.startTime);
      const endMins = parseTime(turno.endTime);

      while (currentMins + turno.blockDuration <= endMins) {
        const blockEnd = currentMins + turno.blockDuration;
        blocks.push({
          from: formatTime(currentMins),
          to: formatTime(blockEnd),
          turnoName: turno.name,
          active: true,
        });
        currentMins = blockEnd + turno.breakDuration;
      }
    }

    this.generatedBlocks.set(blocks);
  }

  protected toggleBlock(blockToToggle: HorarioBlock): void {
    this.generatedBlocks.update((blocks) =>
      blocks.map((b) => (b.from === blockToToggle.from ? { ...b, active: !b.active } : b)),
    );
  }

  protected activeBlocksCount = computed(() => {
    return this.generatedBlocks().filter((b) => b.active).length;
  });

  protected groupedBlocks = computed(() => {
    const blocks = this.generatedBlocks();
    const groups: { turnoName: string; blocks: HorarioBlock[] }[] = [];

    for (const block of blocks) {
      let group = groups.find((g) => g.turnoName === block.turnoName);
      if (!group) {
        group = { turnoName: block.turnoName, blocks: [] };
        groups.push(group);
      }
      group.blocks.push(block);
    }

    return groups;
  });

  protected canSave = computed(() => {
    return (
      this.selectedCourseIds().length > 0 && this.activeBlocksCount() > 0 && !this.facade.isSaving()
    );
  });

  protected async save(): Promise<void> {
    if (!this.canSave()) return;

    const success = await this.facade.updateScheduleBlocks(
      this.selectedCourseIds(),
      this.generatedBlocks()
        .filter((b) => b.active)
        .map((b) => ({ from: b.from, to: b.to })),
    );

    if (success) {
      this.close();
    }
  }

  protected close(): void {
    this.layoutDrawer.back(); // Use back() to return to previous drawer (Ajustes) or close
  }

  // --- Helpers para selectores de hora (p-select) ---
  protected getHour(time: string): string {
    return time ? time.split(':')[0] : '00';
  }

  protected getMinute(time: string): string {
    return time ? time.split(':')[1] : '00';
  }

  protected setStartTimeHour(turno: Turno, hour: string): void {
    const min = this.getMinute(turno.startTime);
    turno.startTime = `${hour}:${min}`;
  }

  protected setStartTimeMinute(turno: Turno, min: string): void {
    const hour = this.getHour(turno.startTime);
    turno.startTime = `${hour}:${min}`;
  }

  protected setEndTimeHour(turno: Turno, hour: string): void {
    const min = this.getMinute(turno.endTime);
    turno.endTime = `${hour}:${min}`;
  }

  protected setEndTimeMinute(turno: Turno, min: string): void {
    const hour = this.getHour(turno.endTime);
    turno.endTime = `${hour}:${min}`;
  }
}
