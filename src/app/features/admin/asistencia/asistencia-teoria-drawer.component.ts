import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { todayIso } from '@core/utils/date.utils';
import type {
  TeoriaAlumnoAsistencia,
  TeoriaAsistenciaStatus,
} from '@core/models/ui/asistencia-clase-b.model';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';

type LocalStatus = TeoriaAsistenciaStatus;

/**
 * AsistenciaTeoriaDrawerComponent — Smart.
 * Abierto desde AdminAsistenciaComponent / SecretariaAsistenciaComponent
 * via LayoutDrawerFacadeService cuando el usuario hace click en "Ver Lista"
 * en la tabla de clases teóricas.
 *
 * Permite:
 *  - Ver/editar el estado de asistencia de cada alumno (presente/ausente/justificado)
 *  - Registrar/actualizar el enlace Zoom de la sesión
 *  - Guardar todos los cambios en un solo click
 */
@Component({
  selector: 'app-asistencia-teoria-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, SkeletonBlockComponent, DrawerContentLoaderComponent],
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
    .status-btn {
      flex: 1;
      padding: 5px 8px;
      border-radius: var(--radius-sm);
      font-size: 11px;
      font-weight: 600;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s;
      text-align: center;
    }
    .status-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
  template: `
    <app-drawer-content-loader>
      <ng-template #skeletons>
        <div class="flex flex-col gap-4">
          <app-skeleton-block variant="text" width="100%" height="80px" />
          <app-skeleton-block variant="rect" width="100%" height="52px" />
          <app-skeleton-block variant="rect" width="100%" height="52px" />
          <app-skeleton-block variant="rect" width="100%" height="52px" />
        </div>
      </ng-template>
      <ng-template #content>
        <!-- ── Info de la sesión ──────────────────────────────────────────────── -->
        <div class="flex flex-col gap-4 p-5 border-b" style="border-color: var(--border-subtle)">
          @if (clase()) {
            <!-- Tema editable -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label">Tema</label>
              <input
                type="text"
                class="field-input"
                placeholder="Ej: Legislación de Tránsito"
                [ngModel]="localTema()"
                (ngModelChange)="localTema.set($event)"
                data-llm-description="Tema de la clase teórica"
              />
            </div>

            <!-- Horas editable -->
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <label class="field-label">Hora inicio</label>
                <input
                  type="time"
                  class="field-input"
                  [ngModel]="localHoraInicio()"
                  (ngModelChange)="localHoraInicio.set($event)"
                  data-llm-description="Hora de inicio de la clase teórica"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="field-label">Hora fin</label>
                <input
                  type="time"
                  class="field-input"
                  [ngModel]="localHoraFin()"
                  (ngModelChange)="localHoraFin.set($event)"
                  [style.border-color]="endTimeError() ? 'var(--state-error)' : ''"
                  data-llm-description="Hora de fin de la clase teórica"
                />
                @if (endTimeError()) {
                  <p class="text-xs font-medium" style="color: var(--state-error)">
                    Debe ser posterior a la hora de inicio.
                  </p>
                }
              </div>
            </div>

            <!-- Botón guardar info + instructor -->
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs" style="color: var(--text-muted)">
                <app-icon name="user" [size]="12" style="display:inline;vertical-align:middle" />
                {{ clase()!.instructorName }}
              </p>
              @if (infoChanged()) {
                <button
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  style="background: var(--ds-brand); color: #fff; border: none; cursor: pointer"
                  [disabled]="!canSaveInfo() || facade.isSaving()"
                  data-llm-action="save-teoria-info"
                  (click)="onSaveInfo()"
                >
                  @if (facade.isSaving()) {
                    <app-icon name="loader-circle" [size]="12" class="animate-spin" />
                  } @else if (infoSavedOk()) {
                    <app-icon name="check" [size]="12" />
                  }
                  Guardar cambios
                </button>
              }
            </div>

            <!-- Enlace Zoom -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label">Enlace Zoom</label>
              <div class="flex gap-2">
                <input
                  type="url"
                  class="field-input"
                  placeholder="https://zoom.us/j/..."
                  [ngModel]="zoomLink()"
                  (ngModelChange)="zoomLink.set($event)"
                  data-llm-description="URL del enlace Zoom para la clase teórica"
                />
                <button
                  class="px-3 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5"
                  style="background: var(--ds-brand); color: #fff; border: none; cursor: pointer"
                  [disabled]="!zoomLink().trim() || facade.isSaving()"
                  data-llm-action="save-zoom-link"
                  (click)="onSaveZoom()"
                >
                  @if (facade.isSaving()) {
                    <app-icon name="loader-circle" [size]="12" class="animate-spin" />
                  }
                  {{ zoomSaveLabel() }}
                </button>
              </div>

              <!-- Banner resultado email -->
              @if (zoomEmailSent()) {
                @if (facade.emailResult(); as result) {
                  <div
                    class="flex items-center gap-2 px-3 py-2.5 rounded-xl mt-1"
                    [style.background]="
                      result.errors.length === 0
                        ? 'color-mix(in srgb, var(--state-success) 12%, transparent)'
                        : 'color-mix(in srgb, var(--state-warning) 12%, transparent)'
                    "
                  >
                    <app-icon
                      [name]="result.errors.length === 0 ? 'mail-check' : 'mail-warning'"
                      [size]="14"
                      [style.color]="
                        result.errors.length === 0 ? 'var(--state-success)' : 'var(--state-warning)'
                      "
                    />
                    <span
                      class="text-xs font-medium"
                      [style.color]="
                        result.errors.length === 0 ? 'var(--state-success)' : 'var(--state-warning)'
                      "
                    >
                      @if (result.errors.length === 0) {
                        Enlace guardado · Correos con enlace Zoom enviados a
                        {{ result.sent }} alumno{{ result.sent !== 1 ? 's' : '' }}.
                      } @else {
                        Enlace guardado · {{ result.sent }} correo{{
                          result.sent !== 1 ? 's' : ''
                        }}
                        enviado{{ result.sent !== 1 ? 's' : '' }},
                        {{ result.errors.length }} fallido{{
                          result.errors.length !== 1 ? 's' : ''
                        }}.
                      }
                    </span>
                  </div>
                }
              }
            </div>
          }
        </div>

        <!-- ── Lista de alumnos ──────────────────────────────────────────────── -->
        <div class="flex-1 overflow-y-auto p-5">
          @if (isFutureDate()) {
            <div
              class="flex items-center gap-2 px-4 py-3 rounded-xl mb-3"
              style="background: color-mix(in srgb, var(--state-warning) 10%, transparent); border: 1px solid color-mix(in srgb, var(--state-warning) 25%, transparent)"
            >
              <app-icon name="clock" [size]="15" style="color: var(--state-warning); shrink-0" />
              <span class="text-xs font-medium" style="color: var(--state-warning)">
                Clase futura — la asistencia se podrá registrar el día de la clase.
              </span>
            </div>
          }

          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-semibold" style="color: var(--text-primary)">
              Asistencia
              @if (!facade.isLoadingTeoriaAlumnos()) {
                <span class="font-normal text-xs" style="color: var(--text-muted)">
                  ({{ presentCount() }}/{{ localAlumnos().length }} presentes)
                </span>
              }
            </p>
            @if (!facade.isLoadingTeoriaAlumnos() && localAlumnos().length > 0 && !isFutureDate()) {
              <button
                class="text-xs font-medium"
                style="color: var(--color-primary); background: none; border: none; cursor: pointer"
                [disabled]="facade.isSaving()"
                (click)="markAllPresente()"
              >
                Todos presentes
              </button>
            }
          </div>

          @if (facade.isLoadingTeoriaAlumnos()) {
            <div class="flex flex-col gap-2">
              @for (_ of [1, 2, 3, 4, 5]; track $index) {
                <app-skeleton-block variant="rect" width="100%" height="52px" />
              }
            </div>
          } @else if (localAlumnos().length === 0) {
            <p class="text-sm text-center py-8" style="color: var(--text-muted)">
              No hay alumnos inscritos en esta sesión.
            </p>
          } @else {
            <div class="flex flex-col gap-2">
              @for (alumno of localAlumnos(); track alumno.studentId) {
                <div
                  class="rounded-xl border p-3 flex flex-col gap-2"
                  [style.border-color]="statusBorderColor(alumno.status)"
                  [style.background]="statusBg(alumno.status)"
                >
                  <!-- Nombre + badge de estado -->
                  <div class="flex items-center justify-between gap-2 min-w-0">
                    <div class="min-w-0">
                      <p class="text-sm font-medium truncate" style="color: var(--text-primary)">
                        {{ alumno.alumnoName }}
                      </p>
                      <p class="text-xs truncate" style="color: var(--text-muted)">
                        {{ alumno.email }}
                      </p>
                    </div>
                    <!-- Badge del estado guardado (visible cuando ya está marcado) -->
                    @if (alumno.status !== 'pendiente') {
                      <span
                        class="shrink-0 text-xs font-semibold px-2 py-1 rounded-full"
                        [style.background]="statusBadgeBg(alumno.status)"
                        [style.color]="statusBadgeColor(alumno.status)"
                      >
                        {{ statusLabel(alumno.status) }}
                      </span>
                    }
                  </div>

                  <!-- Botones para marcar/cambiar estado (solo en fecha actual o pasada) -->
                  @if (!isFutureDate()) {
                    @if (alumno.status === 'pendiente') {
                      <!-- Sin marcar: mostrar los 3 botones -->
                      <div class="flex gap-1.5">
                        <button
                          class="status-btn"
                          style="background: transparent; color: var(--state-success); border-color: var(--state-success)"
                          [disabled]="facade.isSaving()"
                          data-llm-action="mark-presente-teoria"
                          (click)="setStatus(alumno.studentId, 'presente')"
                        >
                          Presente
                        </button>
                        <button
                          class="status-btn"
                          style="background: transparent; color: var(--state-error); border-color: var(--state-error)"
                          [disabled]="facade.isSaving()"
                          data-llm-action="mark-ausente-teoria"
                          (click)="setStatus(alumno.studentId, 'ausente')"
                        >
                          Ausente
                        </button>
                        <button
                          class="status-btn"
                          style="background: transparent; color: var(--state-warning); border-color: var(--state-warning)"
                          [disabled]="facade.isSaving()"
                          data-llm-action="mark-justificado-teoria"
                          (click)="setStatus(alumno.studentId, 'justificado')"
                        >
                          Justificado
                        </button>
                      </div>
                    } @else {
                      <!-- Ya marcado: botones compactos para cambiar -->
                      <div class="flex gap-1.5">
                        @if (alumno.status !== 'presente') {
                          <button
                            class="status-btn"
                            style="background: transparent; color: var(--state-success); border-color: var(--state-success)"
                            [disabled]="facade.isSaving()"
                            data-llm-action="mark-presente-teoria"
                            (click)="setStatus(alumno.studentId, 'presente')"
                          >
                            Cambiar a Presente
                          </button>
                        }
                        @if (alumno.status !== 'ausente') {
                          <button
                            class="status-btn"
                            style="background: transparent; color: var(--state-error); border-color: var(--state-error)"
                            [disabled]="facade.isSaving()"
                            data-llm-action="mark-ausente-teoria"
                            (click)="setStatus(alumno.studentId, 'ausente')"
                          >
                            Cambiar a Ausente
                          </button>
                        }
                        @if (alumno.status !== 'justificado') {
                          <button
                            class="status-btn"
                            style="background: transparent; color: var(--state-warning); border-color: var(--state-warning)"
                            [disabled]="facade.isSaving()"
                            data-llm-action="mark-justificado-teoria"
                            (click)="setStatus(alumno.studentId, 'justificado')"
                          >
                            Justificar
                          </button>
                        }
                      </div>
                    }

                    <!-- Campo justificación (solo si justificado) -->
                    @if (alumno.status === 'justificado') {
                      <input
                        type="text"
                        class="field-input text-xs"
                        placeholder="Motivo de justificación..."
                        [value]="alumno.justificacion ?? ''"
                        (input)="setJustificacion(alumno.studentId, $any($event.target).value)"
                        data-llm-description="Motivo de justificación de inasistencia teórica"
                      />
                    }
                  }
                </div>
              }
            </div>
          }

          <!-- Banner éxito -->
          @if (savedOk()) {
            <div
              class="flex items-center gap-2 px-4 py-3 rounded-xl mt-4"
              style="background: color-mix(in srgb, var(--state-success) 12%, transparent)"
            >
              <app-icon name="check-circle" [size]="16" style="color: var(--state-success)" />
              <span class="text-sm font-medium" style="color: var(--state-success)">
                Asistencia guardada correctamente.
              </span>
            </div>
          }
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
            data-llm-action="cerrar-teoria-drawer"
          >
            Cerrar
          </button>
          @if (!isFutureDate()) {
            <button
              class="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
              style="background: var(--ds-brand); color: #fff; border: none; cursor: pointer"
              [disabled]="facade.isSaving() || facade.isLoadingTeoriaAlumnos()"
              data-llm-action="guardar-asistencia-teoria"
              (click)="onSaveAsistencia()"
            >
              @if (facade.isSaving()) {
                <app-icon name="loader-circle" [size]="14" class="animate-spin" />
              }
              Guardar Asistencia
            </button>
          }
        </div>
      </ng-template>
    </app-drawer-content-loader>
  `,
})
export class AsistenciaTeoriaDrawerComponent implements OnInit {
  protected readonly facade = inject(AsistenciaClaseBFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly clase = this.facade.teoriaDrawerClase;
  protected readonly zoomLink = signal('');
  protected readonly savedOk = signal(false);
  protected readonly zoomEmailSent = signal(false);
  protected readonly infoSavedOk = signal(false);

  // Editable info fields
  protected readonly localTema = signal('');
  protected readonly localHoraInicio = signal('');
  protected readonly localHoraFin = signal('');

  protected readonly endTimeError = computed(
    () =>
      this.localHoraInicio().length > 0 &&
      this.localHoraFin().length > 0 &&
      this.localHoraFin() <= this.localHoraInicio(),
  );

  protected readonly infoChanged = computed(() => {
    const c = this.clase();
    if (!c) return false;
    return (
      this.localTema().trim() !== c.tema ||
      this.localHoraInicio() !== c.horaInicio ||
      this.localHoraFin() !== c.horaFin
    );
  });

  protected readonly canSaveInfo = computed(
    () => this.infoChanged() && this.localTema().trim().length > 0 && !this.endTimeError(),
  );

  protected readonly zoomSaveLabel = computed(() =>
    this.facade.teoriaAlumnos().length > 0 ? 'Guardar y enviar' : 'Guardar',
  );

  private readonly todayIsoVal = todayIso();

  /** true cuando la fecha de la sesión seleccionada es posterior a hoy → modo solo lectura */
  protected readonly isFutureDate = computed(() => this.facade.selectedDate() > this.todayIsoVal);

  /**
   * Copia local editable de los alumnos del drawer.
   * Se sincroniza reactivamente via effect() cuando el facade termina de cargar.
   * Sin guard condicional: si la sesión tiene 0 alumnos, resetea correctamente a vacío.
   */
  protected readonly localAlumnos = signal<TeoriaAlumnoAsistencia[]>([]);

  protected readonly presentCount = computed(
    () => this.localAlumnos().filter((a) => a.status === 'presente').length,
  );

  private successTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      // B2: sin guard `if (loaded.length > 0)` — sincroniza siempre, incluso con array vacío
      const loaded = this.facade.teoriaAlumnos();
      this.localAlumnos.set(loaded.map((a) => ({ ...a })));
    });
  }

  ngOnInit(): void {
    const c = this.clase();
    if (c?.zoomLink) this.zoomLink.set(c.zoomLink);
    if (c) {
      this.localTema.set(c.tema);
      this.localHoraInicio.set(c.horaInicio);
      this.localHoraFin.set(c.horaFin);
    }
  }

  protected async onSaveInfo(): Promise<void> {
    const c = this.clase();
    if (!c || !this.canSaveInfo()) return;
    const ok = await this.facade.updateTeoriaInfo(
      c.id,
      this.localTema().trim(),
      this.localHoraInicio(),
      this.localHoraFin(),
    );
    if (ok) {
      this.infoSavedOk.set(true);
      setTimeout(() => this.infoSavedOk.set(false), 2000);
    }
  }

  protected setStatus(studentId: number, status: LocalStatus): void {
    this.localAlumnos.update((rows) =>
      rows.map((r) =>
        r.studentId === studentId
          ? { ...r, status, justificacion: status !== 'justificado' ? null : r.justificacion }
          : r,
      ),
    );
  }

  protected setJustificacion(studentId: number, justificacion: string): void {
    this.localAlumnos.update((rows) =>
      rows.map((r) => (r.studentId === studentId ? { ...r, justificacion } : r)),
    );
  }

  protected markAllPresente(): void {
    this.localAlumnos.update((rows) =>
      rows.map((r) => ({ ...r, status: 'presente' as const, justificacion: null })),
    );
  }

  protected async onSaveZoom(): Promise<void> {
    const c = this.clase();
    if (!c || !this.zoomLink().trim()) return;
    this.facade.clearEmailResult();
    this.zoomEmailSent.set(false);
    await this.facade.saveTeoriaZoomLink(c.id, this.zoomLink().trim());
    this.zoomEmailSent.set(true);
    setTimeout(() => this.zoomEmailSent.set(false), 4000);
  }

  protected async onSaveAsistencia(): Promise<void> {
    const c = this.clase();
    if (!c) return;
    const registros = this.localAlumnos().map((a) => ({
      studentId: a.studentId,
      status: a.status,
      justificacion: a.justificacion ?? undefined,
    }));
    // B1: usa el boolean retornado por el facade para determinar el éxito real
    const ok = await this.facade.saveTeoriaAsistencia(c.id, registros);
    if (ok) {
      this.savedOk.set(true);
      // B3: guardar handle y cancelar si el componente se destruye antes del timeout
      this.successTimeoutHandle = setTimeout(() => {
        this.successTimeoutHandle = null;
        this.savedOk.set(false);
        this.onClose();
      }, 1500);
      this.destroyRef.onDestroy(() => {
        if (this.successTimeoutHandle !== null) {
          clearTimeout(this.successTimeoutHandle);
        }
      });
    }
  }

  protected onClose(): void {
    this.facade.closeTeoriaDrawer();
    this.layoutDrawer.close();
  }

  // ── Style helpers ─────────────────────────────────────────────────────────

  protected statusBorderColor(status: LocalStatus): string {
    switch (status) {
      case 'presente':
        return 'var(--state-success)';
      case 'ausente':
        return 'var(--state-error)';
      case 'justificado':
        return 'var(--state-warning)';
      default:
        return 'var(--border-subtle)';
    }
  }

  protected statusBg(status: LocalStatus): string {
    switch (status) {
      case 'presente':
        return 'color-mix(in srgb, var(--state-success) 6%, transparent)';
      case 'ausente':
        return 'color-mix(in srgb, var(--state-error) 6%, transparent)';
      case 'justificado':
        return 'color-mix(in srgb, var(--state-warning) 6%, transparent)';
      default:
        return 'transparent';
    }
  }

  protected statusLabel(status: LocalStatus): string {
    switch (status) {
      case 'presente':
        return 'Presente';
      case 'ausente':
        return 'Ausente';
      case 'justificado':
        return 'Justificado';
      default:
        return 'Pendiente';
    }
  }

  protected statusBadgeBg(status: LocalStatus): string {
    switch (status) {
      case 'presente':
        return 'color-mix(in srgb, var(--state-success) 15%, transparent)';
      case 'ausente':
        return 'color-mix(in srgb, var(--state-error) 15%, transparent)';
      case 'justificado':
        return 'color-mix(in srgb, var(--state-warning) 15%, transparent)';
      default:
        return 'color-mix(in srgb, var(--text-muted) 15%, transparent)';
    }
  }

  protected statusBadgeColor(status: LocalStatus): string {
    switch (status) {
      case 'presente':
        return 'var(--state-success)';
      case 'ausente':
        return 'var(--state-error)';
      case 'justificado':
        return 'var(--state-warning)';
      default:
        return 'var(--text-muted)';
    }
  }
}
