import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { AdminStatsPanelComponent } from './admin-ex-alumnos-stats.component';

/**
 * Drawer de solo lectura para "Tasas de Aprobación". Reutiliza
 * `AdminStatsPanelComponent` tal cual (ya es un panel autocontenido con su
 * propio `.bento-card`) — sin envoltorio extra, para no duplicar el borde.
 * Lee directo de `ExAlumnosFacade` (self-sufficient, mismo patrón que
 * `AlumnosPorVencerDrawerComponent`): no requiere inputs del componente que lo abre.
 */
@Component({
  selector: 'app-admin-ex-alumnos-tasas-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonBlockComponent, DrawerContentLoaderComponent, AdminStatsPanelComponent],
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
          <app-admin-stats-panel
            [municipalRate]="facade.municipalApprovalRate()"
            [psychoRate]="facade.psychoApprovalRate()"
            [totalExams]="facade.totalExamenes()"
            [egresadosTotal]="facade.annualEgresadosTotal()"
            [licensesTotal]="facade.annualLicensesTotal()"
            [successRate]="facade.successConversionRate()"
          />
        </div>
      </ng-template>
    </app-drawer-content-loader>
  `,
})
export class AdminExAlumnosTasasDrawerComponent {
  protected readonly facade = inject(ExAlumnosFacade);
}
