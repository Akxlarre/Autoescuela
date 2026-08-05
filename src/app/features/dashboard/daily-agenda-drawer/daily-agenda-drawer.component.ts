import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { LiveClassesPanelComponent } from '@shared/components/live-classes-panel/live-classes-panel.component';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { LiveClassModel } from '@core/models/ui/dashboard.model';
import { to24hTime, addMinutesToTime } from '@core/utils/date.utils';
import { resolveLiveClassActionPlan } from '@core/utils/live-class-action.utils';
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
  imports: [DrawerFormComponent, LiveClassesPanelComponent],
  template: `
    <app-drawer-form [hasFooter]="false">
      <app-live-classes-panel
        class="h-full"
        [classes]="classes()"
        [loading]="loading()"
        [maxItems]="null"
        [showViewAllFooter]="false"
        (actionClick)="handleClassAction($event)"
      />
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
      const startTime = to24hTime(cls.scheduledAt);
      const slot: any = {
        id: cls.id,
        date: cls.scheduledAt.split('T')[0],
        startTime,
        endTime: addMinutesToTime(startTime, 45),
        status: cls.status,
        instructorId: 0,
        instructorName: cls.instructorName,
        vehicleId: 0,
        vehiclePlate: cls.vehicle || '',
        studentName: cls.studentName,
        classNumber: 0,
      };

      this.agendaFacade.setSelectedSlot(slot);
      const title = cls.studentName ? `Clase: ${cls.studentName}` : 'Detalle de clase';
      this.drawer.push(AgendaSlotDetailDrawerComponent, title, 'calendar-clock');
    }
  }
}
