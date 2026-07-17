import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { Button } from 'primeng/button';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AdminInasistenciaDrawerComponent } from '../inasistencia-drawer/admin-inasistencia-drawer.component';

/**
 * AdminInasistenciasDrawerComponent — Smart / Drawer (Fase 2 app-like).
 *
 * Contenido movido tal cual desde el banner "Inasistencias Registradas" que
 * vivía inline en el bento-grid de la ficha del alumno (Fase 1 lo apagó con
 * `showLegacyPanels`). Incluye también el micro-flujo de justificación de
 * inasistencias Clase B (RF-053), que antes era un modal fixed en el
 * componente padre — ahora vive acá, cohesionado con el resto del feature.
 *
 * Abierto vía `layoutDrawer.open(AdminInasistenciasDrawerComponent, ...)`:
 * hereda backdrop, header (título + X) y scroll lock del sistema de drawers
 * app-like ya existente (LayoutDrawerComponent) — no reimplementa nada de eso.
 */
@Component({
  selector: 'app-admin-inasistencias-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipModule, Button, IconComponent],
  template: `
    <div class="flex-1 overflow-y-auto flex flex-col gap-4">
      @if (facade.alumno(); as alumno) {
        <div
          class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-warning-subtle border border-warning-border"
        >
          <div class="flex items-center gap-4">
            <div
              class="w-10 h-10 rounded-xl bg-surface border border-warning-border flex items-center justify-center text-warning shadow-sm shrink-0"
            >
              <app-icon name="alert-triangle" [size]="20" />
            </div>
            <div class="flex flex-col">
              <span class="font-bold text-text-primary">Inasistencias Registradas</span>
              <span class="text-xs text-text-secondary">
                @if (alumno.licenseGroup === 'class_b') {
                  @if (facade.inasistenciasClaseB().length > 0) {
                    Se han detectado {{ facade.inasistenciasClaseB().length }} inasistencias en
                    clases prácticas.
                  } @else {
                    No hay inasistencias registradas hasta la fecha.
                  }
                } @else {
                  @if (facade.inasistencias().length > 0) {
                    Se han detectado {{ facade.inasistencias().length }} registros que requieren
                    seguimiento.
                  } @else {
                    No hay inasistencias registradas hasta la fecha.
                  }
                }
              </span>
            </div>
          </div>
          @if (alumno.licenseGroup !== 'class_b') {
            <p-button
              label="Registrar Nueva"
              icon="pi pi-plus"
              size="small"
              severity="warn"
              (onClick)="openInasistenciaDrawer()"
            />
          }
        </div>

        @if (alumno.licenseGroup === 'class_b') {
          @if (facade.inasistenciasClaseB().length > 0) {
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
              @for (item of facade.inasistenciasClaseB(); track item.id) {
                <div
                  class="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border-subtle shadow-sm transition-all hover:shadow-md"
                >
                  <div class="inas-date-pill border-none! bg-elevated!">
                    <span class="text-2xs font-bold text-text-secondary">{{ item.fecha }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-xs font-bold text-text-primary truncate m-0 font-display uppercase tracking-tight"
                    >
                      Clase #{{ item.claseNumero ?? '—' }}
                    </p>
                    <p class="text-2xs text-text-muted truncate m-0 italic">
                      {{ item.instructor ?? 'Sin instructor' }}
                    </p>
                  </div>
                  <div class="flex flex-col items-end gap-0.5 shrink-0">
                    <div class="flex items-center gap-1">
                      @if (item.reagendada) {
                        <span
                          class="inas-status-badge"
                          data-status="reagendada"
                          [pTooltip]="'Esta inasistencia ya fue reagendada'"
                          tooltipPosition="top"
                          data-llm-description="indica que la clase asociada a esta inasistencia ya fue reagendada"
                          >Reagendada</span
                        >
                      }
                      @if (item.justificada) {
                        <span class="inas-status-badge" data-status="approved">Justificado</span>
                      }
                    </div>
                    @if (item.justificada) {
                      @if (item.justificacion) {
                        <span
                          class="text-2xs text-text-muted italic truncate max-w-32 cursor-help"
                          [pTooltip]="'Motivo: ' + item.justificacion"
                          tooltipPosition="top"
                          data-llm-description="motivo de la justificación de la inasistencia"
                        >
                          Motivo: {{ item.justificacion }}
                        </span>
                      }
                    } @else {
                      <button
                        type="button"
                        class="text-xs font-semibold text-brand hover:underline shrink-0"
                        data-llm-action="justificar-inasistencia-clase-b"
                        (click)="openJustificarClaseB(item.id)"
                      >
                        Justificar
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        } @else {
          @if (facade.inasistencias().length > 0) {
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
              @for (item of facade.inasistencias(); track item.id) {
                <div
                  class="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border-subtle shadow-sm transition-all hover:shadow-md"
                >
                  <div class="inas-date-pill border-none! bg-elevated!">
                    <span class="text-2xs font-bold text-text-secondary">{{ item.fecha }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-xs font-bold text-text-primary truncate m-0 font-display uppercase tracking-tight"
                    >
                      {{ item.documentType }}
                    </p>
                    <p class="text-2xs text-text-muted truncate m-0 italic">
                      {{ item.description || 'Sin descripción' }}
                    </p>
                  </div>
                  <span class="inas-status-badge" [attr.data-status]="item.status">
                    {{ statusLabel(item.status) }}
                  </span>
                </div>
              }
            </div>
          }
        }
      }
    </div>

    <!-- Modal de justificación de inasistencia Clase B (RF-053) — movido tal cual
         desde el componente padre. Sigue usando position:fixed sobre el viewport
         completo (encima del drawer, que ya vive en su propio stacking context). -->
    @if (justificarClaseBOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        (click)="closeJustificarClaseB()"
      >
        <div
          class="surface-glass rounded-2xl p-6 w-full max-w-md flex flex-col gap-4"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          aria-label="Justificar inasistencia"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-text-primary">Justificar Inasistencia</h3>
            <button
              class="p-1 rounded-md text-text-muted hover:text-text-primary"
              aria-label="Cerrar"
              (click)="closeJustificarClaseB()"
            >
              <app-icon name="x" [size]="18" />
            </button>
          </div>
          <p class="text-sm text-text-secondary">
            Ingresa el motivo de la justificación para registrar en el historial del alumno.
          </p>
          <textarea
            class="w-full rounded-lg border p-3 text-sm text-text-primary bg-surface resize-none focus:outline-none"
            style="border-color: var(--border-subtle)"
            rows="3"
            placeholder="Ej: Certificado médico presentado..."
            data-llm-description="textarea for absence justification reason"
            [value]="justificarClaseBReason()"
            (input)="justificarClaseBReason.set($any($event.target).value)"
          ></textarea>
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" (click)="closeJustificarClaseB()">
              Cancelar
            </button>
            <button
              class="btn-primary"
              [disabled]="!justificarClaseBReason().trim()"
              data-llm-action="submit-justificacion-clase-b"
              (click)="submitJustificarClaseB()"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .inas-status-badge {
      flex-shrink: 0;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      background: var(--bg-elevated);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
    }
    .inas-status-badge[data-status='pending'] {
      color: var(--state-warning);
      background: var(--state-warning-bg);
      border-color: var(--state-warning-border);
    }
    .inas-status-badge[data-status='approved'],
    .inas-status-badge[data-status='revisado'] {
      color: var(--state-success);
      background: var(--state-success-bg);
      border-color: var(--state-success-border);
    }
    .inas-status-badge[data-status='rejected'] {
      color: var(--state-error);
      background: var(--state-error-bg);
      border-color: var(--state-error-border);
    }
    .inas-status-badge[data-status='reagendada'] {
      color: var(--state-info);
      background: var(--state-info-bg);
      border-color: var(--state-info-border);
    }
  `,
})
export class AdminInasistenciasDrawerComponent {
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly justificarClaseBOpen = signal(false);
  protected readonly justificarClaseBId = signal<number | null>(null);
  protected readonly justificarClaseBReason = signal('');

  protected statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      revisado: 'Revisado',
      rejected: 'Rechazado',
    };
    return map[status?.toLowerCase()] ?? status ?? 'Pendiente';
  }

  /** Registro de inasistencia (Profesional) — navega dentro del mismo drawer (push/back). */
  protected openInasistenciaDrawer(): void {
    this.layoutDrawer.push(
      AdminInasistenciaDrawerComponent,
      'Registrar Inasistencia',
      'alert-triangle',
    );
  }

  protected openJustificarClaseB(attendanceId: number): void {
    this.justificarClaseBId.set(attendanceId);
    this.justificarClaseBReason.set('');
    this.justificarClaseBOpen.set(true);
  }

  protected closeJustificarClaseB(): void {
    this.justificarClaseBOpen.set(false);
    this.justificarClaseBId.set(null);
    this.justificarClaseBReason.set('');
  }

  protected submitJustificarClaseB(): void {
    const id = this.justificarClaseBId();
    const reason = this.justificarClaseBReason().trim();
    if (id === null || !reason) return;
    void this.facade.justificarInasistenciaClaseB(id, reason);
    this.closeJustificarClaseB();
  }
}
