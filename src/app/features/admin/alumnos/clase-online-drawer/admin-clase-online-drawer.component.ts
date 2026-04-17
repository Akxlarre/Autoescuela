import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { ClaseOnlineFacade } from '@core/facades/clase-online.facade';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

@Component({
  selector: 'app-admin-clase-online-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, FormsModule],
  template: `
    <div class="flex flex-col h-full bg-surface">
      <div class="flex-1 overflow-y-auto p-5">
        <!-- Sesión info -->
        @if (facade.isLoading()) {
          <app-skeleton-block variant="rect" width="100%" height="60px" />
        } @else if (facade.sesionHoy()) {
          <div
            class="flex items-start gap-3 rounded-xl p-3"
            style="background: var(--bg-elevated);"
          >
            <app-icon
              name="calendar"
              [size]="15"
              style="color: var(--text-muted); margin-top: 2px; shrink-0"
            />
            <div>
              <p class="text-sm font-semibold" style="color: var(--text-primary)">
                {{ facade.sesionHoy()!.topic ?? 'Clase Teórica Clase B' }}
              </p>
              <p class="text-xs mt-0.5" style="color: var(--text-muted)">
                {{ formatDate(facade.sesionHoy()!.scheduledAt) }}
              </p>
            </div>
          </div>
        } @else {
          <div
            class="flex items-start gap-2 rounded-xl p-3"
            style="background: color-mix(in srgb, var(--state-warning) 10%, transparent);"
          >
            <app-icon
              name="circle-alert"
              [size]="15"
              style="color: var(--state-warning); margin-top: 2px;"
            />
            <p class="text-sm" style="color: var(--state-warning)">
              No hay sesión próxima programada. El enlace/asistencia no podrá guardarse.
            </p>
          </div>
        }

        <!-- ─── MODO ZOOM: campos de link y mensaje ───────────────────── -->
        @if (alumnosFacade.drawerMode() === 'zoom') {
          <div class="flex flex-col gap-3 mt-4">
            <div class="flex flex-col gap-1.5">
              <label class="field-label">Enlace Zoom *</label>
              <input
                type="url"
                class="field-input"
                placeholder="https://zoom.us/j/..."
                [(ngModel)]="zoomLink"
                data-llm-description="URL del enlace Zoom para la clase teórica"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="field-label">Mensaje adicional</label>
              <textarea
                class="field-input"
                rows="3"
                placeholder="Mensaje que se incluirá en el correo (opcional)..."
                [(ngModel)]="mensajeZoom"
                style="resize: none;"
              ></textarea>
            </div>
          </div>
        }

        <!-- ─── Lista de alumnos ──────────────────────────────────────── -->
        <div class="flex items-center justify-between mt-6">
          <p class="text-sm font-semibold" style="color: var(--text-primary)">
            Alumnos Clase B&nbsp;
            @if (!facade.isLoading()) {
              <span class="font-normal text-xs" style="color: var(--text-muted)">
                ({{ selectedStudentIds().size }}/{{ facade.alumnos().length }})
              </span>
            }
          </p>
          <button
            class="text-xs font-medium"
            style="color: var(--color-primary); background: none; border: none; cursor: pointer;"
            (click)="toggleSelectAll()"
          >
            {{ allSelected() ? 'Deseleccionar todos' : 'Seleccionar todos' }}
          </button>
        </div>

        <div class="flex flex-col gap-1.5 mt-3">
          @if (facade.isLoading()) {
            @for (_ of [1, 2, 3, 4]; track $index) {
              <div class="flex items-center gap-3 py-2 px-3">
                <app-skeleton-block variant="rect" width="16px" height="16px" />
                <app-skeleton-block variant="text" width="170px" height="13px" />
              </div>
            }
          } @else if (facade.alumnos().length === 0) {
            <p class="text-sm py-4 text-center" style="color: var(--text-muted)">
              No hay alumnos activos de Clase B.
            </p>
          } @else {
            @for (alumno of facade.alumnos(); track alumno.studentId) {
              <label
                class="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer transition-colors"
                [style.background]="
                  selectedStudentIds().has(alumno.studentId)
                    ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)'
                    : 'transparent'
                "
                style="border: 1px solid var(--border-subtle);"
              >
                <input
                  type="checkbox"
                  class="shrink-0 accent-[var(--color-primary)]"
                  [checked]="selectedStudentIds().has(alumno.studentId)"
                  (change)="toggleStudent(alumno.studentId)"
                />
                <div class="flex flex-col gap-0 min-w-0">
                  <span class="text-sm font-medium truncate" style="color: var(--text-primary)">{{
                    alumno.nombre
                  }}</span>
                  <span class="text-xs truncate" style="color: var(--text-muted)">{{
                    alumno.email
                  }}</span>
                </div>
              </label>
            }
          }
        </div>

        <!-- Banner éxito -->
        @if (facade.savedOk()) {
          <div
            class="flex items-center gap-2 px-4 py-3 rounded-xl mt-4"
            style="background: color-mix(in srgb, var(--state-success) 12%, transparent);"
          >
            <app-icon
              name="check-circle"
              [size]="16"
              style="color: var(--state-success); shrink-0"
            />
            <span class="text-sm font-medium" style="color: var(--state-success);">
              {{
                alumnosFacade.drawerMode() === 'zoom'
                  ? 'Enlace guardado correctamente.'
                  : 'Asistencia registrada.'
              }}
            </span>
          </div>
        }

        <!-- Banner error -->
        @if (facade.error()) {
          <div
            class="flex items-center gap-2 px-4 py-3 rounded-xl mt-4"
            style="background: color-mix(in srgb, var(--state-error) 12%, transparent);"
          >
            <app-icon name="circle-alert" [size]="16" style="color: var(--state-error); shrink-0" />
            <span class="text-sm" style="color: var(--state-error);">{{ facade.error() }}</span>
          </div>
        }
      </div>

      <!-- ─── FOOTER ─────────────────────────────────────────────────────── -->
      <div class="p-4 border-t bg-subtle flex items-center justify-end gap-2">
        <button class="btn-ghost" (click)="onClose()" data-llm-action="cancelar-clase-online">
          Cancelar
        </button>
        <button
          class="btn-primary"
          [disabled]="!canSave() || facade.isLoading()"
          (click)="onSave()"
          data-llm-action="guardar-clase-online"
        >
          @if (facade.isLoading()) {
            <app-icon name="loader-2" [size]="14" class="animate-spin" />
          }
          {{ alumnosFacade.drawerMode() === 'zoom' ? 'Guardar enlace' : 'Registrar asistencia' }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .field-label {
      display: block;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    .field-input {
      width: 100%;
      padding: 10px 12px;
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
    .btn-ghost {
      padding: 8px 16px;
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--text-muted);
      font-size: var(--text-sm);
      font-weight: 500;
      border: none;
      cursor: pointer;
    }
  `,
})
export class AdminClaseOnlineDrawerComponent implements OnInit {
  protected readonly facade = inject(ClaseOnlineFacade);
  protected readonly alumnosFacade = inject(AdminAlumnosFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  readonly saved = output<void>();

  protected zoomLink = '';
  protected mensajeZoom = '';
  protected readonly selectedStudentIds = signal<Set<number>>(new Set());

  protected readonly allSelected = computed(() => {
    const total = this.facade.alumnos().length;
    return total > 0 && this.selectedStudentIds().size === total;
  });

  protected readonly canSave = computed(() => {
    if (!this.facade.sesionHoy()) return false;
    if (this.alumnosFacade.drawerMode() === 'zoom') return this.zoomLink.trim().length > 0;
    return this.selectedStudentIds().size > 0;
  });

  ngOnInit(): void {
    this.resetLocal();
    void this.facade.cargarDatos();

    // Pre-rellenar el link si la sesión ya tiene uno guardado
    const sesion = this.facade.sesionHoy();
    if (sesion?.zoomLink && this.alumnosFacade.drawerMode() === 'zoom' && !this.zoomLink) {
      this.zoomLink = sesion.zoomLink;
    }
  }

  protected toggleStudent(studentId: number): void {
    const next = new Set(this.selectedStudentIds());
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    this.selectedStudentIds.set(next);
  }

  protected toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedStudentIds.set(new Set());
    } else {
      this.selectedStudentIds.set(new Set(this.facade.alumnos().map((a) => a.studentId)));
    }
  }

  protected async onSave(): Promise<void> {
    const sesion = this.facade.sesionHoy();
    if (!sesion) return;

    if (this.alumnosFacade.drawerMode() === 'zoom') {
      await this.facade.guardarZoomLink(sesion.id, this.zoomLink.trim());
    } else {
      await this.facade.guardarAsistencia(sesion.id, [...this.selectedStudentIds()]);
    }

    if (!this.facade.error()) {
      this.saved.emit();
      setTimeout(() => this.onClose(), 1200);
    }
  }

  protected onClose(): void {
    this.resetLocal();
    this.layoutDrawer.close();
  }

  private resetLocal(): void {
    this.zoomLink = '';
    this.mensajeZoom = '';
    this.selectedStudentIds.set(new Set());
    this.facade.resetSavedOk();
  }

  protected formatDate(isoString: string): string {
    return new Date(isoString).toLocaleString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
