import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { Router } from '@angular/router';
import { fleetUrl, studentFichaUrl } from '@core/utils/agenda-week.utils';
import {
  vehicleDocWarningApplies,
  vehicleDocWarningLabel,
} from '@core/utils/vehicle-document-status.utils';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { StatBoxComponent, StatBoxVariant } from '@shared/components/stat-box/stat-box.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

type StatusConfig = {
  label: string;
  icon: string;
  variant: StatBoxVariant;
};

/**
 * AgendaSlotDetailDrawerComponent — Smart component cargado dinámicamente en
 * el LayoutDrawer al hacer clic en un slot ocupado (scheduled, in_progress,
 * completed, no_show).
 *
 * Muestra: estado, horario, instructor, vehículo y alumno.
 * No permite acciones de mutación — solo informativo en esta versión.
 */
@Component({
  selector: 'app-agenda-slot-detail-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    SkeletonBlockComponent,
    StatBoxComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
    AlertCardComponent,
  ],
  host: {
    class: 'flex flex-col h-full',
  },
  template: `
    @if (slot(); as s) {
      <app-drawer-form>
        <app-drawer-content-loader class="flex-col h-full flex">
          <ng-template #skeletons>
            <div class="flex flex-col gap-5 py-2">
              <!-- Estado (pill) -->
              <app-skeleton-block variant="rect" width="100px" height="22px" borderRadius="999px" />

              <!-- Horario (stat-box prominente) -->
              <app-skeleton-block variant="rect" width="100%" height="72px" />

              <!-- Instructor + Vehículo -->
              <div class="grid grid-cols-2 gap-3">
                <app-skeleton-block variant="rect" width="100%" height="58px" />
                <app-skeleton-block variant="rect" width="100%" height="58px" />
              </div>

              <!-- Alumno asignado (card) -->
              <div class="card p-4 flex flex-col gap-3">
                <app-skeleton-block variant="text" width="45%" height="11px" />
                <app-skeleton-block variant="text" width="65%" height="16px" />
                <app-skeleton-block variant="rect" width="70px" height="18px" />
              </div>
            </div>
          </ng-template>
          <ng-template #content>
            <div class="flex flex-col gap-5">
              <!-- ── Estado ─────────────────────────────────────────── -->
              <div
                class="status-pill"
                [style.color]="statusPillStyle().color"
                [style.background]="statusPillStyle().bg"
              >
                <app-icon [name]="statusCfg().icon" [size]="12" />
                <span>{{ statusCfg().label }}</span>
              </div>

              <!-- ── Horario (prominente) ───────────────────────────── -->
              <app-stat-box
                [label]="s.status === 'available' ? 'Horario disponible' : 'Horario de clase'"
                [value]="s.startTime + ' – ' + s.endTime"
                variant="brand"
                [useMono]="true"
              />

              <!-- ── Instructor + Vehículo ─────────────────────────── -->
              <div class="grid grid-cols-2 gap-3">
                <app-stat-box
                  label="Instructor"
                  [value]="s.instructorName"
                  variant="surface"
                  [compact]="true"
                  icon="user"
                />
                <app-stat-box
                  label="Vehículo"
                  [value]="s.vehiclePlate"
                  variant="surface"
                  [compact]="true"
                  icon="car"
                />
              </div>

              <!-- fix-251-b: el aviso del vehículo ya no queda solo en el tooltip de la grilla -->
              @if (vehicleDocNotice(); as aviso) {
                <app-alert-card
                  severity="warning"
                  [title]="aviso.title"
                  data-testid="slot-detalle-documentos-vehiculo"
                  data-llm-description="aviso de documentos del vehículo vencidos o por vencer"
                >
                  <div class="flex flex-col gap-3">
                    <span>{{ aviso.body }}</span>
                    <button
                      type="button"
                      class="btn-secondary flex items-center gap-2 self-start"
                      (click)="verFlota()"
                      data-llm-nav="flota-desde-detalle-agenda"
                    >
                      Ver en Flota
                      <app-icon name="arrow-right" [size]="14" />
                    </button>
                  </div>
                </app-alert-card>
              }

              <!-- ── Alumno ────────────────────────────────────────── -->
              @if (s.studentName) {
                <div class="card p-4 flex flex-col gap-3">
                  <span class="micro-label">Alumno asignado</span>
                  <div class="flex flex-col gap-1">
                    <span class="student-name">{{ s.studentName }}</span>
                    @if (s.classNumber) {
                      <div class="flex items-center gap-2 mt-1">
                        <div
                          class="px-1.5 py-0.5 rounded bg-subtle border text-2xs font-bold uppercase tracking-wider text-text-muted"
                        >
                          Clase {{ s.classNumber }}
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- ── Kilometraje (completadas, y en curso desde hotfix-170-b: E05) ── -->
              @if (
                (s.status === 'completed' && (s.kmStart != null || s.kmEnd != null)) ||
                (s.status === 'in_progress' && s.kmStart != null)
              ) {
                <div class="grid grid-cols-2 gap-3">
                  <app-stat-box
                    label="Km inicio"
                    [value]="s.kmStart != null ? s.kmStart + ' km' : '—'"
                    variant="surface"
                    [compact]="true"
                    icon="gauge"
                  />
                  <app-stat-box
                    label="Km fin"
                    [value]="
                      s.status === 'in_progress'
                        ? 'En curso'
                        : s.kmEnd != null
                          ? s.kmEnd + ' km'
                          : '—'
                    "
                    variant="surface"
                    [compact]="true"
                    icon="gauge"
                  />
                </div>
                @if (distanceRecorrida(); as distancia) {
                  <p class="text-xs text-text-muted -mt-2">
                    Distancia recorrida: {{ distancia }} km
                  </p>
                }
              }

              <!-- ── Observaciones del instructor ───────────────────── -->
              @if (s.status === 'completed' && s.notes) {
                <div class="card p-4 flex flex-col gap-2">
                  <span class="micro-label">Observaciones del instructor</span>
                  <p class="text-sm text-text-secondary">{{ s.notes }}</p>
                </div>
              }
            </div>
          </ng-template>
        </app-drawer-content-loader>

        <ng-container ngProjectAs="[drawer-form-footer]">
          <!-- fix-377-m: inasistencia marcada por error -->
          @if (s.status === 'no_show' && s.sessionId) {
            <button
              class="btn-secondary flex items-center justify-center gap-2"
              [disabled]="asistencia.isSaving()"
              (click)="undoAbsence(s.sessionId)"
              data-llm-action="deshacer-inasistencia-detalle"
            >
              <app-icon name="rotate-ccw" [size]="14" />
              Deshacer inasistencia
            </button>
          }
          <!-- hotfix-095-b (E11): atajo a la ficha, donde se reprograma y se ve todo -->
          @if (s.studentId) {
            <button
              class="btn-secondary flex items-center justify-center gap-2"
              (click)="verFicha(s.studentId, s.enrollmentId)"
              data-llm-action="ver-ficha-alumno-detalle"
            >
              <app-icon name="user" [size]="14" />
              Ver ficha del alumno
            </button>
          }
          <button class="btn-secondary" (click)="close()" data-llm-action="close-slot-detail">
            Cerrar detalle
          </button>
        </ng-container>
      </app-drawer-form>
    }
  `,
  styles: `
    /* ── Status pill ── */

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      align-self: flex-start;
    }

    .student-name {
      font-size: 1rem;
      font-weight: var(--font-semibold);
      color: var(--text-primary);
      line-height: 1.3;
    }
  `,
})
export class AgendaSlotDetailDrawerComponent {
  readonly facade = inject(AgendaFacade);
  protected readonly asistencia = inject(AsistenciaClaseBFacade);
  private readonly dashboardFacade = inject(DashboardFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly router = inject(Router);

  /** fix-377-m: deshace la falta (confirmación en el facade) y refresca "Clases Actuales". */
  protected async undoAbsence(sessionId: number): Promise<void> {
    const done = await this.asistencia.undoAbsence(sessionId);
    if (done) {
      void this.dashboardFacade.refreshLiveClassesOnly();
      this.close();
    }
  }

  readonly slot = this.facade.selectedSlot;

  /** fix-251-b: aviso de documentos del vehículo, solo donde el auto todavía va a salir. */
  protected readonly vehicleDocNotice = computed<{ title: string; body: string } | null>(() => {
    const s = this.slot();
    if (!s || !vehicleDocWarningApplies(s.status)) return null;
    const title = vehicleDocWarningLabel(s.vehiclePlate, s.vehicleDocWarning);
    if (!title) return null;
    const body =
      s.status === 'available'
        ? 'El horario se sigue ofreciendo. Regulariza el documento en Flota.'
        : 'La clase no se bloquea. Regulariza el documento antes de salir con el vehículo.';
    return { title, body };
  });

  /** fix-251-b: cierra el detalle (y la Agenda si venía en un drawer) y abre la Flota. */
  protected verFlota(): void {
    this.facade.setSelectedSlot(null);
    this.drawer.close();
    void this.router.navigateByUrl(fleetUrl(this.router.url));
  }

  readonly distanceRecorrida = computed<number | null>(() => {
    const s = this.slot();
    if (!s || s.kmStart == null || s.kmEnd == null) return null;
    return s.kmEnd - s.kmStart;
  });

  readonly statusCfg = computed<StatusConfig>(() => {
    switch (this.slot()?.status) {
      case 'available':
        return {
          label: 'Disponible',
          icon: 'calendar-check',
          variant: 'success',
        };
      case 'scheduled':
        return {
          label: 'Agendada',
          icon: 'calendar-clock',
          variant: 'brand',
        };
      case 'in_progress':
        return {
          label: 'En progreso',
          icon: 'play-circle',
          variant: 'brand',
        };
      case 'completed':
        return {
          label: 'Completada',
          icon: 'check-circle',
          variant: 'success',
        };
      case 'no_show':
        return {
          label: 'No asistió',
          icon: 'user-x',
          variant: 'surface',
        };
      case 'cancelled':
        return {
          label: 'Cancelada',
          icon: 'x-circle',
          variant: 'surface',
        };
      default:
        return {
          label: 'Clase',
          icon: 'calendar-clock',
          variant: 'surface',
        };
    }
  });

  protected statusPillStyle(): { bg: string; color: string } {
    const cfg = this.statusCfg();
    if (cfg.variant === 'surface') {
      return { bg: 'var(--bg-elevated)', color: 'var(--text-secondary)' };
    }
    // hotfix-060-b: `--state-brand` no existe (la pastilla salía sin color); la marca es `--ds-brand`,
    // el mismo color con que la grilla pinta las clases agendadas y en curso.
    const token = cfg.variant === 'brand' ? 'var(--ds-brand)' : `var(--state-${cfg.variant})`;
    return {
      bg: `color-mix(in srgb, ${token} 12%, transparent)`,
      color: token,
    };
  }

  close(): void {
    this.facade.setSelectedSlot(null);
    this.drawer.back();
  }

  /** hotfix-095-b (E11): cierra el detalle (y la Agenda si venía en un drawer) y abre la ficha. */
  protected verFicha(studentId: number, enrollmentId: number | undefined): void {
    const url = studentFichaUrl(this.router.url, studentId, enrollmentId);
    this.facade.setSelectedSlot(null);
    this.drawer.close();
    void this.router.navigateByUrl(url);
  }
}
