import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AdminStatsPanelComponent } from './admin-ex-alumnos-stats.component';

/**
 * Drawer de solo lectura para "Tasas de Aprobación". Reutiliza
 * `AdminStatsPanelComponent` tal cual (ya es un panel autocontenido con su
 * propio `.bento-card`) — sin envoltorio extra, para no duplicar el borde.
 * Lee directo de `ExAlumnosFacade` (self-sufficient): no requiere inputs del componente
 * que lo abre.
 */
@Component({
  selector: 'app-admin-ex-alumnos-tasas-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    AlertCardComponent,
    EmptyStateComponent,
    IconComponent,
    AdminStatsPanelComponent,
  ],
  template: `
    <app-drawer-content-loader>
      <ng-template #skeletons>
        <div class="flex flex-col gap-4 p-1">
          <app-skeleton-block variant="text" width="60%" height="16px" />
          @for (_ of [1, 2, 3]; track $index) {
            <div class="flex flex-col gap-2">
              <app-skeleton-block variant="text" width="100%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="8px" />
            </div>
          }
          <app-skeleton-block variant="rect" width="100%" height="120px" />
        </div>
      </ng-template>
      <ng-template #content>
        <div class="h-full min-h-0 flex flex-col p-1">
          @if (facade.statsRefreshFailed()) {
            <div class="mb-3 shrink-0" role="alert">
              <app-alert-card severity="error" title="No se pudieron actualizar las tasas">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span class="text-compact text-text-secondary">
                    Los datos mostrados pueden no estar actualizados.
                  </span>
                  <button
                    type="button"
                    class="btn-secondary flex items-center gap-2 shrink-0"
                    data-llm-action="reintentar-tasas"
                    [disabled]="facade.isLoading()"
                    (click)="facade.reintentarStats()"
                  >
                    <app-icon name="refresh-cw" [size]="14" />
                    Reintentar
                  </button>
                </div>
              </app-alert-card>
            </div>
          }
          @if (facade.statsError() && !facade.statsRefreshFailed()) {
            <div class="flex-1 flex items-center justify-center" role="alert">
              <app-empty-state
                icon="circle-alert"
                [message]="facade.statsError()!"
                subtitle="No se pudieron calcular las estadísticas. Revisa tu conexión e inténtalo de nuevo."
                actionLabel="Reintentar"
                actionIcon="refresh-cw"
                (action)="facade.reintentarStats()"
              />
            </div>
          } @else {
            <app-admin-stats-panel
              [municipalRate]="facade.municipalApprovalRate()"
              [psychoRate]="facade.psychoApprovalRate()"
              [totalExams]="facade.totalExamenes()"
              [egresadosTotal]="facade.annualEgresadosTotal()"
              [licensesTotal]="facade.annualLicensesTotal()"
              [successRate]="facade.successConversionRate()"
            />
          }
        </div>
      </ng-template>
    </app-drawer-content-loader>
  `,
})
export class AdminExAlumnosTasasDrawerComponent {
  protected readonly facade = inject(ExAlumnosFacade);
}
