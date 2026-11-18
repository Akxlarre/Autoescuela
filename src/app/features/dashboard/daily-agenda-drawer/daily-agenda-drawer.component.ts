import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { LiveClassesPanelComponent } from '@shared/components/live-classes-panel/live-classes-panel.component';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { LiveClassModel } from '@core/models/ui/dashboard.model';
import {
  liveClassToAgendaSlot,
  resolveLiveClassActionPlan,
} from '@core/utils/live-class-action.utils';
import { AgendaSlotDetailDrawerComponent } from '@features/agenda/agenda-slot-detail-drawer.component';

/**
 * Drawer "Agenda de Hoy" — vista completa de las clases del día actual.
 * Reutiliza `app-live-classes-panel` sin budget (fix-111): mismas filas que
 * "Clases Actuales" del dashboard, sin el recorte por densidad adaptativa.
 */
@Component({
  selector: 'app-daily-agenda-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertCardComponent,
    DrawerFormComponent,
    EmptyStateComponent,
    IconComponent,
    LiveClassesPanelComponent,
  ],
  template: `
    <app-drawer-form [hasFooter]="false">
      @if (loadError()) {
        <div class="h-full flex items-center justify-center" role="alert">
          <app-empty-state
            icon="triangle-alert"
            message="No se pudo cargar la agenda de hoy"
            subtitle="Revisa tu conexión y vuelve a intentarlo."
            actionLabel="Reintentar"
            actionIcon="refresh-cw"
            (action)="retry()"
          />
        </div>
      } @else {
        <app-live-classes-panel
          class="h-full"
          [classes]="classes()"
          [loading]="loading()"
          [maxItems]="null"
          [showViewAllFooter]="false"
          (actionClick)="handleClassAction($event)"
        >
          @if (refreshFailed()) {
            <div liveClassesNotice class="shrink-0">
              <app-alert-card severity="warning" title="No se pudo actualizar la agenda">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span class="text-compact text-text-secondary">
                    Las clases mostradas pueden no estar actualizadas.
                  </span>
                  <button
                    type="button"
                    class="btn-secondary flex items-center gap-2 shrink-0"
                    data-llm-action="reintentar-agenda-hoy"
                    [disabled]="refreshing()"
                    (click)="retry()"
                  >
                    <app-icon name="refresh-cw" [size]="14" />
                    Reintentar
                  </button>
                </div>
              </app-alert-card>
            </div>
          }
        </app-live-classes-panel>
      }
    </app-drawer-form>
  `,
})
export class DailyAgendaDrawerComponent {
  private readonly dashboardFacade = inject(DashboardFacade);
  private readonly asistenciaFacade = inject(AsistenciaClaseBFacade);
  private readonly agendaFacade = inject(AgendaFacade);
  private readonly drawer = inject(LayoutDrawerFacadeService);

  readonly classes = computed(() => this.dashboardFacade.data()?.liveClasses ?? []);
  readonly loading = this.dashboardFacade.loading;
  readonly loadError = computed(() =>
    !this.loading() && !this.dashboardFacade.data() ? this.dashboardFacade.error() : null,
  );
  readonly refreshFailed = computed(() => this.dashboardFacade.refreshFailed());
  readonly refreshing = computed(() => this.dashboardFacade.refreshing());

  retry(): void {
    void this.dashboardFacade.reintentar();
  }

  async handleClassAction(cls: LiveClassModel): Promise<void> {
    const plan = resolveLiveClassActionPlan(cls);

    if (plan.flow === 'iniciar') {
      this.asistenciaFacade.selectPractica(plan.row as any);
      const { AdminIniciarClaseDrawerComponent } =
        await import('../../admin/asistencia/admin-iniciar-clase-drawer.component');
      this.drawer.push(AdminIniciarClaseDrawerComponent, 'Iniciar Clase Práctica', 'play');
    } else if (plan.flow === 'finalizar') {
      this.asistenciaFacade.selectPractica(plan.row as any);
      const { AdminFinalizarClaseDrawerComponent } =
        await import('../../admin/asistencia/admin-finalizar-clase-drawer.component');
      this.drawer.push(AdminFinalizarClaseDrawerComponent, 'Finalizar Clase', 'flag');
    } else {
      this.agendaFacade.setSelectedSlot(liveClassToAgendaSlot(cls) as any);
      const title = cls.studentName ? `Clase: ${cls.studentName}` : 'Detalle de clase';
      this.drawer.push(AgendaSlotDetailDrawerComponent, title, 'calendar-clock');
    }
  }
}
