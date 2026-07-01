import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DashboardAlertsFacade } from '@core/facades/dashboard-alerts.facade';
import type { AlertModel } from '@core/models/ui/dashboard.model';

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2, success: 3 };

@Component({
  selector: 'app-alerts-drawer',
  standalone: true,
  imports: [IconComponent, SkeletonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full">
      <!-- ── Header ─────────────────────────────────────────────────── -->
      <div class="px-5 pt-5 pb-4 flex items-center gap-3 border-b border-border-subtle shrink-0">
        <div
          class="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-warning-subtle text-warning"
        >
          <app-icon name="bell" [size]="18" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="m-0 text-sm font-semibold text-text-primary leading-tight">
            Alertas del sistema
          </h2>
          <p class="m-0 text-xs text-text-muted mt-0.5">
            @if (isLoading()) {
              Verificando condiciones...
            } @else {
              {{ alertCount() }} alerta{{ alertCount() !== 1 ? 's' : '' }} activa{{
                alertCount() !== 1 ? 's' : ''
              }}
            }
          </p>
        </div>
      </div>

      <!-- ── Scrollable body ────────────────────────────────────────── -->
      <div class="flex-1 overflow-y-auto alerts-scroll px-4 py-3 flex flex-col gap-2">
        <!-- Skeleton mientras carga las 17 promesas -->
        @if (isLoading()) {
          @for (i of SKELETON_ROWS; track i) {
            <div
              class="card flex items-start gap-3 p-3"
              [style.border-left-width.px]="3"
              style="border-left-color: var(--border-default)"
            >
              <app-skeleton-block variant="circle" width="32px" height="32px" />
              <div class="flex-1 flex flex-col gap-2 py-0.5">
                <app-skeleton-block variant="text" width="58%" height="13px" />
                <app-skeleton-block variant="text" width="83%" height="11px" />
              </div>
            </div>
          }

          <!-- Empty state positivo -->
        } @else if (sortedAlerts().length === 0) {
          <div class="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div
              class="w-14 h-14 rounded-full bg-success-subtle flex items-center justify-center text-success"
            >
              <app-icon name="check-circle" [size]="28" />
            </div>
            <div>
              <p class="m-0 text-sm font-semibold text-text-primary">Todo al día</p>
              <p class="m-0 text-xs text-text-muted mt-1 max-w-48 mx-auto leading-relaxed">
                Sin alertas activas. El sistema opera con normalidad.
              </p>
            </div>
          </div>

          <!-- Lista de alertas ordenadas por severidad -->
        } @else {
          @for (alert of sortedAlerts(); track alert.id) {
            <div
              class="card flex gap-3 p-3 transition-[border-color] duration-200"
              [style.border-left-width.px]="3"
              [style.border-left-color]="getSeverityColor(alert.severity)"
              role="listitem"
            >
              <!-- Ícono de severidad -->
              <div
                class="shrink-0 flex items-center justify-center w-8 h-8 rounded-full mt-0.5"
                [class]="getSeverityIconClass(alert.severity)"
              >
                <app-icon [name]="getSeverityIcon(alert.severity)" [size]="15" />
              </div>

              <!-- Contenido -->
              <div class="flex-1 min-w-0 flex flex-col gap-1.5">
                <!-- Título + dismiss -->
                <div class="flex items-start justify-between gap-2">
                  <p class="m-0 text-sm font-medium text-text-primary leading-snug">
                    {{ alert.title }}
                  </p>
                  <button
                    class="shrink-0 w-5 h-5 rounded flex items-center justify-center
                           border-none bg-transparent cursor-pointer text-text-muted
                           hover:bg-subtle hover:text-text-primary transition-colors"
                    (click)="dismiss(alert.id)"
                    title="Descartar alerta"
                    data-llm-action="dismiss-alert"
                  >
                    <app-icon name="x" [size]="11" />
                  </button>
                </div>

                <!-- Descripción -->
                <p class="m-0 text-xs text-text-secondary leading-relaxed">
                  {{ alert.description }}
                </p>

                <!-- Footer: badge de conteo + botón de acción -->
                @if (alert.count || alert.action) {
                  <div class="flex items-center gap-2 flex-wrap mt-0.5">
                    @if (alert.count && alert.count > 0) {
                      <span
                        class="inline-flex items-center text-xs font-medium"
                        [class]="'badge-' + alert.severity"
                      >
                        {{ alert.count }} registro{{ alert.count !== 1 ? 's' : '' }}
                      </span>
                    }
                    @if (alert.action) {
                      <button
                        class="ml-auto btn-ghost flex items-center gap-1.5 text-xs
                               px-2.5 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        [disabled]="isProcessing(alert.id)"
                        (click)="handleAction(alert)"
                        [attr.data-llm-action]="'execute-alert-action-' + alert.action.type"
                      >
                        @if (isProcessing(alert.id)) {
                          <span class="inline-flex animate-spin">
                            <app-icon name="loader-circle" [size]="12" />
                          </span>
                          <span>Procesando...</span>
                        } @else {
                          <app-icon [name]="getActionIcon(alert.action.type)" [size]="12" />
                          <span>{{ alert.action.label }}</span>
                        }
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .alerts-scroll {
        scrollbar-width: thin;
        scrollbar-color: var(--border-muted) transparent;
      }
      .alerts-scroll::-webkit-scrollbar {
        width: 4px;
      }
      .alerts-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      .alerts-scroll::-webkit-scrollbar-thumb {
        background: var(--border-muted);
        border-radius: 4px;
      }
      .alerts-scroll::-webkit-scrollbar-thumb:hover {
        background: var(--border-default);
      }
    `,
  ],
})
export class AlertsDrawerComponent {
  private readonly facade = inject(DashboardAlertsFacade);
  private readonly router = inject(Router);

  readonly isLoading = this.facade.isLoading;
  readonly alertCount = this.facade.alertCount;
  readonly SKELETON_ROWS = [1, 2, 3, 4] as const;

  /** Alertas ordenadas: error → warning → info → success */
  readonly sortedAlerts = computed(() =>
    [...this.facade.activeAlerts()].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4),
    ),
  );

  /** Set de alert IDs con acción en curso */
  private readonly _processing = signal(new Set<string>());

  isProcessing(id: string): boolean {
    return this._processing().has(id);
  }

  dismiss(id: string): void {
    this.facade.dismissAlert(id);
  }

  async handleAction(alert: AlertModel): Promise<void> {
    if (!alert.action || this.isProcessing(alert.id)) return;

    const { type, enrollmentIds } = alert.action;

    if (type === 'clear-schedule') {
      this._processing.update((s) => new Set([...s, alert.id]));
      try {
        await Promise.all(
          (enrollmentIds ?? []).map((id) => this.facade.clearScheduleForEnrollment(id)),
        );
      } finally {
        this._processing.update((s) => {
          const next = new Set(s);
          next.delete(alert.id);
          return next;
        });
      }
    } else if (type === 'navigate') {
      this.routeForAlert(alert.id);
    }
  }

  private routeForAlert(alertId: string): void {
    const alertRoutes: Record<string, string[]> = {
      'alert-cash-not-closed': ['/app/admin/cuadratura'],
    };
    const route = alertRoutes[alertId];
    if (route) void this.router.navigate(route);
  }

  getSeverityIcon(severity: string): string {
    const icons: Record<string, string> = {
      error: 'circle-alert',
      warning: 'triangle-alert',
      success: 'check-circle',
      info: 'info',
    };
    return icons[severity] ?? 'info';
  }

  getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      error: 'var(--state-error)',
      warning: 'var(--state-warning)',
      success: 'var(--state-success)',
      info: 'var(--state-info)',
    };
    return colors[severity] ?? 'var(--state-info)';
  }

  getSeverityIconClass(severity: string): string {
    const classes: Record<string, string> = {
      error: 'bg-error-subtle text-error',
      warning: 'bg-warning-subtle text-warning',
      success: 'bg-success-subtle text-success',
      info: 'bg-info-subtle text-info',
    };
    return classes[severity] ?? 'bg-info-subtle text-info';
  }

  getActionIcon(type: string): string {
    const icons: Record<string, string> = {
      'clear-schedule': 'calendar-x',
      navigate: 'arrow-right',
      'close-cash': 'lock',
    };
    return icons[type] ?? 'arrow-right';
  }
}
