import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { groupCyclesByStatus } from '@core/utils/ciclo-select-groups.util';
import { formatChileanDate, to24hTime } from '@core/utils/date.utils';
import type {
  CicloAlumno,
  CicloAlumnoMovible,
  CicloClaseRow,
  CicloOption,
} from '@core/models/ui/ciclos-teoricos.model';

/**
 * CiclosTeoricosContentComponent — Dumb (OnPush).
 *
 * Pestaña "Ciclos Teóricos" de Asistencia B (Spec 0001):
 *  - Selector de ciclo (RF-11).
 *  - 6 clases con tema opcional + enlace Zoom (RF-14) y envío con destinatarios
 *    preseleccionables (RF-15/16).
 *  - Roster de la cohorte (RF-12) con reasignación entre ciclos (override).
 *
 * Solo inputs/outputs; el Smart Component coordina CiclosTeoricosFacade.
 */
@Component({
  selector: 'app-ciclos-teoricos-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, IconComponent, SkeletonBlockComponent],
  styles: `
    .field-input {
      width: 100%;
      padding: 8px 12px;
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
    .field-label {
      display: block;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
  `,
  template: `
    <div class="flex flex-col gap-6">
      <!-- ── Selector de ciclo (RF-11) ──────────────────────────────────────── -->
      <section class="bento-banner card p-5 flex flex-wrap items-end justify-between gap-3">
        <div class="flex flex-col gap-1.5 min-w-72">
          <label class="field-label">Ciclo Teórico</label>
          @if (cycles().length === 0) {
            <p class="text-sm text-text-secondary">No hay ciclos en esta sede todavía.</p>
          } @else {
            <p-select
              [options]="cycleSelectGroups()"
              optionLabel="label"
              optionValue="value"
              [group]="true"
              optionGroupLabel="label"
              optionGroupChildren="items"
              [ngModel]="selectedCycleId()"
              (ngModelChange)="selectCycle.emit($event)"
              placeholder="Selecciona un ciclo"
              styleClass="w-full"
              data-llm-description="Selector de ciclo teórico"
            />
          }
        </div>
        @if (selectedCycle(); as c) {
          <div class="flex items-center gap-2">
            <span
              class="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full"
              [style.background]="
                c.status === 'active' ? 'var(--state-success-bg)' : 'var(--bg-elevated)'
              "
              [style.color]="c.status === 'active' ? 'var(--state-success)' : 'var(--text-muted)'"
            >
              <app-icon
                [name]="c.status === 'active' ? 'circle-play' : 'circle-check'"
                [size]="15"
              />
              {{ c.status === 'active' ? 'Activo' : 'Finalizado' }}
            </span>
            <span class="text-sm text-text-muted">{{ roster().length }} alumnos</span>
          </div>
        }
      </section>

      @if (isLoading()) {
        <div class="bento-banner flex flex-col gap-2">
          @for (i of [1, 2, 3]; track i) {
            <app-skeleton-block variant="rect" width="100%" height="64px" />
          }
        </div>
      } @else if (selectedCycleId() !== null) {
        <div class="bento-banner grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- ── Clases del ciclo (RF-14/15/16) ──────────────────────────────── -->
          <section class="lg:col-span-2 card p-5 flex flex-col gap-4">
            <div class="flex items-center gap-2">
              <app-icon name="video" [size]="18" [style.color]="'var(--color-primary)'" />
              <h2 class="text-sm font-semibold text-text-primary">Clases del ciclo (6)</h2>
            </div>

            @if (isLoadingCycle()) {
              <div class="flex flex-col gap-2">
                @for (i of [1, 2, 3]; track i) {
                  <app-skeleton-block variant="rect" width="100%" height="80px" />
                }
              </div>
            } @else {
              @for (clase of clases(); track clase.id) {
                <div
                  class="rounded-xl border p-5 flex flex-col gap-4"
                  [style.border-color]="'var(--border-subtle)'"
                >
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-sm font-semibold text-text-primary">{{ clase.label }}</p>
                    @if (clase.zoomSentAt) {
                      <span
                        class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                        [style.background]="'var(--state-success-bg)'"
                        [style.color]="'var(--state-success)'"
                      >
                        <app-icon name="mail-check" [size]="11" />
                        Enviado el {{ formatSentAt(clase.zoomSentAt) }}
                      </span>
                    }
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1">
                      <label class="field-label">Tema (opcional)</label>
                      <input
                        type="text"
                        class="field-input"
                        placeholder="Ej: Legislación de Tránsito"
                        [ngModel]="clase.tema ?? ''"
                        (ngModelChange)="topicDrafts[clase.id] = $event"
                        data-llm-description="Tema opcional de la clase del ciclo"
                      />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="field-label">Enlace Zoom</label>
                      <input
                        type="url"
                        class="field-input"
                        placeholder="https://zoom.us/j/..."
                        [ngModel]="clase.zoomLink ?? ''"
                        (ngModelChange)="zoomDrafts[clase.id] = $event"
                        data-llm-description="URL del enlace Zoom de la clase"
                      />
                    </div>
                  </div>

                  <div class="flex items-center justify-end gap-2">
                    <button
                      class="btn-secondary text-sm px-4 py-2"
                      [disabled]="isSaving()"
                      data-llm-action="guardar-clase-ciclo"
                      (click)="onSaveClase(clase)"
                    >
                      Guardar
                    </button>
                    <button
                      class="btn-primary text-sm px-4 py-2 flex items-center gap-2"
                      [disabled]="isSaving() || !hasZoom(clase)"
                      data-llm-action="abrir-envio-zoom"
                      (click)="openSendPanel(clase)"
                    >
                      @if (sendingClassId() === clase.id) {
                        <app-icon name="loader-circle" [size]="14" class="animate-spin" />
                        Enviando...
                      } @else {
                        <app-icon [name]="clase.zoomSentAt ? 'refresh-cw' : 'send'" [size]="14" />
                        {{ clase.zoomSentAt ? 'Reenviar enlace' : 'Elegir destinatarios y enviar' }}
                      }
                    </button>
                  </div>

                  <!-- Panel de destinatarios (preseleccionados, des-seleccionables) -->
                  @if (openPanelClassId() === clase.id) {
                    <div
                      class="rounded-lg border p-3 flex flex-col gap-2"
                      [style.border-color]="'var(--ds-brand)'"
                      [style.background]="'color-mix(in srgb, var(--ds-brand) 5%, transparent)'"
                    >
                      <div class="flex items-center justify-between">
                        <p class="text-xs font-semibold text-text-primary">
                          Destinatarios ({{ selectedRecipientCount() }} de {{ roster().length }})
                        </p>
                        <button
                          class="text-xs font-medium text-brand bg-transparent border-none cursor-pointer"
                          (click)="toggleAllRecipients()"
                        >
                          {{ allRecipientsSelected() ? 'Quitar todos' : 'Marcar todos' }}
                        </button>
                      </div>
                      @if (roster().length === 0) {
                        <p class="text-xs text-text-muted py-2">El ciclo no tiene alumnos.</p>
                      } @else {
                        <div class="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          @for (alumno of roster(); track alumno.enrollmentId) {
                            <label
                              class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-elevated"
                            >
                              <input
                                type="checkbox"
                                class="accent-(--ds-brand)"
                                [checked]="isRecipientSelected(alumno.enrollmentId)"
                                (change)="toggleRecipient(alumno.enrollmentId)"
                              />
                              <span class="min-w-0 flex-1">
                                <span class="text-sm text-text-primary block truncate">{{
                                  alumno.nombre
                                }}</span>
                                <span class="text-xs text-text-muted block truncate">{{
                                  alumno.email || 'Sin correo'
                                }}</span>
                              </span>
                            </label>
                          }
                        </div>
                      }
                      <div class="flex items-center justify-end gap-2 pt-1">
                        <button
                          class="btn-secondary text-sm px-4 py-2"
                          [disabled]="sendingClassId() === clase.id"
                          (click)="closeSendPanel()"
                        >
                          Cancelar
                        </button>
                        <button
                          class="btn-primary text-sm px-4 py-2 flex items-center gap-2"
                          [disabled]="
                            isSaving() ||
                            selectedRecipientCount() === 0 ||
                            sendingClassId() === clase.id
                          "
                          data-llm-action="confirmar-envio-zoom"
                          (click)="confirmSend(clase.id)"
                        >
                          @if (sendingClassId() === clase.id) {
                            <app-icon name="loader-circle" [size]="14" class="animate-spin" />
                            Enviando...
                          } @else {
                            Enviar a {{ selectedRecipientCount() }}
                          }
                        </button>
                      </div>
                    </div>
                  }
                </div>
              } @empty {
                <p class="text-sm text-text-secondary text-center py-4">
                  Este ciclo aún no tiene clases generadas.
                </p>
              }
            }
          </section>

          <!-- ── Roster + reasignación (RF-12 + override) ────────────────────── -->
          <section class="card p-5 flex flex-col gap-4 h-full min-h-0">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <app-icon name="users" [size]="20" [style.color]="'var(--color-primary)'" />
                <h2 class="font-semibold text-text-primary">Alumnos del ciclo</h2>
              </div>
              <button
                class="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
                data-llm-action="abrir-incorporar-alumno"
                (click)="openAddPanel()"
              >
                <app-icon name="user-plus" [size]="14" />
                Incorporar
              </button>
            </div>

            @if (isLoadingCycle()) {
              <div class="flex flex-col gap-2">
                @for (i of [1, 2, 3]; track i) {
                  <app-skeleton-block variant="rect" width="100%" height="40px" />
                }
              </div>
            } @else if (roster().length === 0) {
              <p class="text-sm text-text-secondary text-center py-4">Sin alumnos en este ciclo.</p>
            } @else {
              <div class="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
                @for (alumno of roster(); track alumno.enrollmentId) {
                  <div class="flex items-center gap-2 px-2 py-3 rounded-md hover:bg-elevated">
                    <div class="min-w-0 flex-1">
                      <p class="text-text-primary truncate">{{ alumno.nombre }}</p>
                      <p class="text-sm text-text-muted truncate">{{ alumno.email || 'Sin correo' }}</p>
                    </div>
                    @if (movingEnrollmentId() === alumno.enrollmentId) {
                      <p-select
                        [options]="otherCycleOptions()"
                        optionLabel="label"
                        optionValue="value"
                        [ngModel]="moveTargetCycleId()"
                        (ngModelChange)="moveTargetCycleId.set($event)"
                        placeholder="Cambiar a…"
                        styleClass="w-40"
                        data-llm-description="Ciclo destino para cambiar al alumno de ciclo"
                      />
                      <button
                        class="p-1.5 rounded-md cursor-pointer"
                        [style.color]="'var(--state-success)'"
                        [disabled]="moveTargetCycleId() === null || isSaving()"
                        title="Confirmar"
                        data-llm-action="confirmar-mover-alumno"
                        (click)="confirmMove(alumno.enrollmentId)"
                      >
                        <app-icon name="check" [size]="16" />
                      </button>
                      <button
                        class="p-1.5 rounded-md cursor-pointer text-text-muted"
                        title="Cancelar"
                        (click)="cancelMove()"
                      >
                        <app-icon name="x" [size]="16" />
                      </button>
                    } @else {
                      <button
                        class="text-sm font-medium hover:underline cursor-pointer shrink-0"
                        [style.color]="'var(--color-primary)'"
                        [disabled]="otherCycleOptions().length === 0"
                        title="Cambiar de ciclo"
                        data-llm-action="cambiar-alumno-de-ciclo"
                        (click)="startMove(alumno.enrollmentId)"
                      >
                        Cambiar de ciclo
                      </button>
                    }
                  </div>
                }
              </div>
            }

            <!-- Panel: traer alumno de otro ciclo -->
            @if (addPanelOpen()) {
              <div
                class="rounded-lg border p-3 flex flex-col gap-2"
                [style.border-color]="'var(--border-subtle)'"
              >
                <p class="text-xs font-semibold text-text-primary">
                  Incorporar alumno de otro ciclo
                </p>
                @if (addableStudents().length === 0) {
                  <p class="text-xs text-text-muted py-2">
                    No hay alumnos en otros ciclos de esta sede.
                  </p>
                } @else {
                  <div class="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    @for (a of addableStudents(); track a.enrollmentId) {
                      <div class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-elevated">
                        <div class="min-w-0 flex-1">
                          <p class="text-sm text-text-primary truncate">{{ a.nombre }}</p>
                          <p class="text-xs text-text-muted truncate">{{ a.cicloActualLabel }}</p>
                        </div>
                        <button
                          class="text-xs font-medium text-brand hover:underline cursor-pointer"
                          [disabled]="isSaving()"
                          data-llm-action="incorporar-alumno"
                          (click)="addStudent.emit(a.enrollmentId)"
                        >
                          Agregar
                        </button>
                      </div>
                    }
                  </div>
                }
                <div class="flex justify-end">
                  <button class="btn-secondary text-xs px-3 py-1.5" (click)="closeAddPanel()">
                    Cerrar
                  </button>
                </div>
              </div>
            }
          </section>
        </div>
      }
    </div>
  `,
})
export class CiclosTeoricosContentComponent {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  readonly cycles = input<CicloOption[]>([]);
  readonly selectedCycleId = input<number | null>(null);
  readonly clases = input<CicloClaseRow[]>([]);
  readonly roster = input<CicloAlumno[]>([]);
  readonly addableStudents = input<CicloAlumnoMovible[]>([]);
  readonly isLoading = input(false);
  readonly isLoadingCycle = input(false);
  readonly isSaving = input(false);
  /** Id de la clase cuyo envío de Zoom está en curso (facade), o null si ninguno. */
  readonly sendingClassId = input<number | null>(null);

  // ── Outputs ─────────────────────────────────────────────────────────────────
  readonly selectCycle = output<number>();
  readonly saveZoomLink = output<{ classId: number; link: string }>();
  readonly updateTopic = output<{ classId: number; tema: string }>();
  readonly sendZoom = output<{ classId: number; recipientEnrollmentIds: number[] }>();
  readonly moveStudent = output<{ enrollmentId: number; targetCycleId: number }>();
  readonly requestAddable = output<void>();
  readonly addStudent = output<number>();

  // ── Drafts (edición inline sin perder lo tecleado) ───────────────────────────
  protected readonly topicDrafts: Record<number, string> = {};
  protected readonly zoomDrafts: Record<number, string> = {};

  // ── Estado local de paneles ──────────────────────────────────────────────────
  protected readonly openPanelClassId = signal<number | null>(null);
  protected readonly recipientSelection = signal<Set<number>>(new Set());
  protected readonly movingEnrollmentId = signal<number | null>(null);
  protected readonly moveTargetCycleId = signal<number | null>(null);
  protected readonly addPanelOpen = signal(false);
  private previousSendingClassId: number | null = null;

  constructor() {
    // Cierra el panel de destinatarios solo cuando el envío en curso (facade) termina,
    // para que el botón "Enviar a N" pueda mostrar su spinner mientras dura la llamada.
    effect(() => {
      const sendingClassId = this.sendingClassId();
      const openPanelClassId = this.openPanelClassId();
      if (
        openPanelClassId !== null &&
        sendingClassId === null &&
        this.previousSendingClassId === openPanelClassId
      ) {
        this.closeSendPanel();
      }
      this.previousSendingClassId = sendingClassId;
    });
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  protected readonly selectedCycle = computed(
    () => this.cycles().find((c) => c.id === this.selectedCycleId()) ?? null,
  );

  /** Agrupa el selector en Activos / Finalizados para que la lista no se vuelva ilegible con el historial. */
  protected readonly cycleSelectGroups = computed(() => groupCyclesByStatus(this.cycles()));

  /** Ciclos distintos al actual, para mover/traer alumnos. */
  protected readonly otherCycleOptions = computed(() =>
    this.cycles()
      .filter((c) => c.id !== this.selectedCycleId())
      .map((c) => ({ label: c.label, value: c.id })),
  );

  protected readonly selectedRecipientCount = computed(() => this.recipientSelection().size);

  protected readonly allRecipientsSelected = computed(
    () => this.roster().length > 0 && this.recipientSelection().size === this.roster().length,
  );

  // ── Clases: guardar / enviar ──────────────────────────────────────────────────

  protected hasZoom(clase: CicloClaseRow): boolean {
    const draft = this.zoomDrafts[clase.id];
    const val = draft !== undefined ? draft : (clase.zoomLink ?? '');
    return val.trim().length > 0;
  }

  protected formatSentAt(zoomSentAt: string): string {
    return `${formatChileanDate(zoomSentAt, { day: 'numeric', month: 'short' })}, ${to24hTime(zoomSentAt)}`;
  }

  protected onSaveClase(clase: CicloClaseRow): void {
    const tema = this.topicDrafts[clase.id];
    if (tema !== undefined && tema !== (clase.tema ?? '')) {
      this.updateTopic.emit({ classId: clase.id, tema });
    }
    const link = this.zoomDrafts[clase.id];
    if (link !== undefined && link !== (clase.zoomLink ?? '')) {
      this.saveZoomLink.emit({ classId: clase.id, link });
    }
  }

  protected openSendPanel(clase: CicloClaseRow): void {
    // Auto-guarda cambios pendientes de tema/enlace antes de abrir el panel, para
    // que "Enviar a N" nunca despache un enlace desactualizado. El botón de envío
    // queda deshabilitado mientras isSaving() esté activo, evitando la carrera.
    this.onSaveClase(clase);

    this.openPanelClassId.set(clase.id);
    // Preseleccionar toda la cohorte (RF-16) — des-seleccionable.
    this.recipientSelection.set(new Set(this.roster().map((a) => a.enrollmentId)));
  }

  protected closeSendPanel(): void {
    this.openPanelClassId.set(null);
    this.recipientSelection.set(new Set());
  }

  protected isRecipientSelected(enrollmentId: number): boolean {
    return this.recipientSelection().has(enrollmentId);
  }

  protected toggleRecipient(enrollmentId: number): void {
    this.recipientSelection.update((set) => {
      const next = new Set(set);
      if (next.has(enrollmentId)) next.delete(enrollmentId);
      else next.add(enrollmentId);
      return next;
    });
  }

  protected toggleAllRecipients(): void {
    if (this.allRecipientsSelected()) {
      this.recipientSelection.set(new Set());
    } else {
      this.recipientSelection.set(new Set(this.roster().map((a) => a.enrollmentId)));
    }
  }

  protected confirmSend(classId: number): void {
    this.sendZoom.emit({
      classId,
      recipientEnrollmentIds: Array.from(this.recipientSelection()),
    });
    // El panel se cierra solo al terminar el envío (ver effect en el constructor),
    // así el botón "Enviar a N" puede mostrar su estado de carga mientras tanto.
  }

  // ── Roster: mover / traer ──────────────────────────────────────────────────────

  protected startMove(enrollmentId: number): void {
    this.movingEnrollmentId.set(enrollmentId);
    this.moveTargetCycleId.set(null);
  }

  protected cancelMove(): void {
    this.movingEnrollmentId.set(null);
    this.moveTargetCycleId.set(null);
  }

  protected confirmMove(enrollmentId: number): void {
    const target = this.moveTargetCycleId();
    if (target === null) return;
    this.moveStudent.emit({ enrollmentId, targetCycleId: target });
    this.cancelMove();
  }

  protected openAddPanel(): void {
    this.addPanelOpen.set(true);
    this.requestAddable.emit();
  }

  protected closeAddPanel(): void {
    this.addPanelOpen.set(false);
  }
}
