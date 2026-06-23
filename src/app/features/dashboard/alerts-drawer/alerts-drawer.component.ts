import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { DashboardAlertsFacade } from '@core/facades/dashboard-alerts.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

@Component({
  selector: 'app-alerts-drawer',
  standalone: true,
  imports: [CommonModule, IconComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 h-full flex flex-col gap-6">
      <div class="flex items-center gap-2">
        <app-icon name="bell" [size]="20" class="text-warning" />
        <h2 class="m-0 font-semibold text-lg text-text-primary">Alertas Importantes</h2>
      </div>

      <p class="text-sm text-text-secondary m-0">
        Revisa las notificaciones urgentes del sistema y descártalas una vez atendidas.
      </p>

      <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        @if (alerts().length > 0) {
          <ul class="m-0 p-0 list-none flex flex-col gap-1">
            @for (alert of alerts(); track alert.id) {
              <li class="flex items-start gap-3 py-3 border-b last:border-b-0 border-border-subtle">
                <div
                  class="shrink-0 flex items-center justify-center w-8 h-8 rounded-full mt-1"
                  [style.background]="getAlertBg(alert.severity)"
                  [style.color]="getAlertColor(alert.severity)"
                >
                  <app-icon [name]="getAlertIcon(alert.severity)" [size]="14" />
                </div>
                
                <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div class="flex items-center justify-between gap-2">
                    <p class="m-0 text-sm font-medium text-text-primary truncate">
                      {{ alert.title }}
                    </p>
                    <button 
                      class="shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-none bg-transparent cursor-pointer text-text-muted hover:bg-subtle hover:text-text-primary transition-colors"
                      (click)="dismiss(alert.id)"
                      title="Descartar"
                    >
                      <app-icon name="x" [size]="12" />
                    </button>
                  </div>
                  <p class="m-0 text-xs text-text-secondary">
                    {{ alert.description }}
                  </p>
                </div>
              </li>
            }
          </ul>
        } @else {
          <div class="flex-1 flex flex-col justify-center py-6 h-full">
            <app-empty-state
              icon="bell"
              message="Todo en orden"
              subtitle="No hay alertas importantes por revisar."
            />
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: var(--border-strong);
      border-radius: 4px;
    }
  `]
})
export class AlertsDrawerComponent {
  private readonly facade = inject(DashboardAlertsFacade);
  readonly alerts = this.facade.activeAlerts;

  dismiss(id: string) {
    this.facade.dismissAlert(id);
  }

  getAlertIcon(severity: string): string {
    switch (severity) {
      case 'warning': return 'triangle-alert';
      case 'error': return 'octagon-alert';
      case 'success': return 'check-circle';
      case 'info':
      default: return 'info';
    }
  }

  getAlertColor(severity: string): string {
    switch (severity) {
      case 'warning': return 'var(--state-warning)';
      case 'error': return 'var(--state-error)';
      case 'success': return 'var(--state-success)';
      default: return 'var(--text-primary)';
    }
  }

  getAlertBg(severity: string): string {
    switch (severity) {
      case 'warning': return 'var(--state-warning-bg)';
      case 'error': return 'var(--state-error-bg)';
      case 'success': return 'var(--state-success-bg)';
      default: return 'var(--bg-subtle)';
    }
  }
}
