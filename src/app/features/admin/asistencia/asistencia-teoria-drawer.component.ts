import {
  ChangeDetectionStrategy,
  Component,
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
          <div class="flex items-start gap-3 rounded-xl p-3" style="background: var(--bg-elevated)">
            <app-icon
              name="graduation-cap"
              [size]="15"
              style="color: var(--color-primary); margin-top: 2px; shrink-0"
            />
            <div class="min-w-0">
              <p class="text-sm font-semibold" style="color: var(--text-primary)">
                {{ clase()!.tema }}
              </p>
              <p class="text-xs mt-0.5" style="color: var(--text-muted)">
                {{ clase()!.horaInicio }} – {{ clase()!.horaFin }} · {{ clase()!.instructorName }}
              </p>
            </div>
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
                class="px-3 rounded-lg text-xs font-semibold shrink-0"
                style="background: var(--ds-brand); color: #fff; border: none; cursor: pointer"
                [disabled]="!zoomLink().trim() || facade.isSaving()"
                data-llm-action="save-zoom-link"
                (click)="onSaveZoom()"
              >
                Guardar
              </button>
            </div>
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
            @for (alumno of localAlumnos(); track alumno.enrollmentId) {
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
                        data-llm-action="mark-presente-teoria"
                        (click)="setStatus(alumno.enrollmentId, 'presente')"
                      >
                        Presente
                      </button>
                      <button
                        class="status-btn"
                        style="background: transparent; color: var(--state-error); border-color: var(--state-error)"
                        data-llm-action="mark-ausente-teoria"
                        (click)="setStatus(alumno.enrollmentId, 'ausente')"
                      >
                        Ausente
                      </button>
                      <button
                        class="status-btn"
                        style="background: transparent; color: var(--state-warning); border-color: var(--state-warning)"
                        data-llm-action="mark-justificado-teoria"
                        (click)="setStatus(alumno.enrollmentId, 'justificado')"
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
                          data-llm-action="mark-presente-teoria"
                          (click)="setStatus(alumno.enrollmentId, 'presente')"
                        >
                          Cambiar a Presente
                        </button>
                      }
                      @if (alumno.status !== 'ausente') {
                        <button
                          class="status-btn"
                          style="background: transparent; color: var(--state-error); border-color: var(--state-error)"
                          data-llm-action="mark-ausente-teoria"
                          (click)="setStatus(alumno.enrollmentId, 'ausente')"
                        >
                          Cambiar a Ausente
                        </button>
                      }
                      @if (alumno.status !== 'justificado') {
                        <button
                          class="status-btn"
                          style="background: transparent; color: var(--state-warning); border-color: var(--state-warning)"
                          data-llm-action="mark-justificado-teoria"
                          (click)="setStatus(alumno.enrollmentId, 'justificado')"
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
                      (input)="setJustificacion(alumno.enrollmentId, $any($event.target).value)"
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
              <app-icon name="loader" [size]="14" />
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

  protected readonly clase = this.facade.teoriaDrawerClase;
  protected readonly zoomLink = signal('');
  protected readonly savedOk = signal(false);

  private readonly todayIso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  /** true cuando la fecha de la sesión seleccionada es posterior a hoy → modo solo lectura */
  protected readonly isFutureDate = computed(() => this.facade.selectedDate() > this.todayIso);

  /**
   * Copia local editable de los alumnos del drawer.
   * Se sincroniza reactivamente via effect() cuando el facade termina de cargar,
   * porque la carga es async y puede llegar después de que ngOnInit se ejecuta.
   */
  protected readonly localAlumnos = signal<TeoriaAlumnoAsistencia[]>([]);

  protected readonly presentCount = computed(
    () => this.localAlumnos().filter((a) => a.status === 'presente').length,
  );

  constructor() {
    // Sync when facade finishes loading — handles both the case where data
    // arrives before or after this component is created.
    effect(() => {
      const loaded = this.facade.teoriaAlumnos();
      if (loaded.length > 0) {
        this.localAlumnos.set(loaded.map((a) => ({ ...a })));
      }
    });
  }

  ngOnInit(): void {
    const c = this.clase();
    if (c?.zoomLink) this.zoomLink.set(c.zoomLink);
  }

  protected setStatus(enrollmentId: number, status: LocalStatus): void {
    this.localAlumnos.update((rows) =>
      rows.map((r) =>
        r.enrollmentId === enrollmentId
          ? { ...r, status, justificacion: status !== 'justificado' ? null : r.justificacion }
          : r,
      ),
    );
  }

  protected setJustificacion(enrollmentId: number, justificacion: string): void {
    this.localAlumnos.update((rows) =>
      rows.map((r) => (r.enrollmentId === enrollmentId ? { ...r, justificacion } : r)),
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
    await this.facade.saveTeoriaZoomLink(c.id, this.zoomLink().trim());
  }

  protected async onSaveAsistencia(): Promise<void> {
    const c = this.clase();
    if (!c) return;
    const registros = this.localAlumnos().map((a) => ({
      enrollmentId: a.enrollmentId,
      status: a.status,
      justificacion: a.justificacion ?? undefined,
    }));
    await this.facade.saveTeoriaAsistencia(c.id, registros);
    if (!this.facade.error()) {
      this.savedOk.set(true);
      setTimeout(() => {
        this.savedOk.set(false);
        this.onClose();
      }, 1500);
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
