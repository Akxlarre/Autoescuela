import { ChangeDetectionStrategy, Component, OnInit, effect, inject } from '@angular/core';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AsistenciaClaseBContentComponent } from '@shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component';
import { AsistenciaTeoriaDrawerComponent } from './asistencia-teoria-drawer.component';
import { AgendarTeoriaDrawerComponent } from './agendar-teoria-drawer.component';
import type { ClaseTeoricoRow } from '@core/models/ui/asistencia-clase-b.model';

/**
 * AdminAsistenciaComponent — Smart component.
 * Ruta: /app/admin/asistencia
 *
 * Reactivo al selector de sede del topbar (BranchFacade.selectedBranchId).
 */
@Component({
  selector: 'app-admin-asistencia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsistenciaClaseBContentComponent],
  template: `
    <app-asistencia-clase-b-content
      [kpis]="facade.kpis()"
      [clasesTeorias]="facade.clasesTeorias()"
      [clasesPracticas]="facade.clasesPracticas()"
      [alertas]="facade.alertas()"
      [instructores]="facade.instructores()"
      [selectedDate]="facade.selectedDate()"
      [isLoading]="facade.isLoading()"
      [isSaving]="facade.isSaving()"
      (markAttendance)="facade.markAttendance($event.sessionId, $event.status)"
      (justifyAbsence)="facade.justifyAbsence($event.sessionId, $event.reason)"
      (removeSchedule)="facade.removeSchedule($event)"
      (reactivateSchedule)="facade.reactivateSchedule($event)"
      (sendReminder)="facade.sendReminder($event)"
      (viewAtendanceList)="openTeoriaDrawer($event)"
      (dateChange)="facade.setDate($event)"
      (exportExcel)="onExportExcel()"
      (refreshRequested)="onRefresh()"
      (scheduleNewClass)="openAgendarDrawer()"
    />
  `,
})
export class AdminAsistenciaComponent implements OnInit {
  protected readonly facade = inject(AsistenciaClaseBFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  constructor() {
    let previousBranchId: number | null | undefined = undefined;

    effect(() => {
      const branchId = this.branchFacade.selectedBranchId();
      this.facade.setBranchFilter(branchId);

      if (previousBranchId === undefined) {
        // First run on component creation — SWR (no skeleton if already cached)
        void this.facade.initialize();
      } else if (previousBranchId !== branchId) {
        // Branch actually changed — force full reload with skeleton
        void this.facade.reload();
      }
      previousBranchId = branchId;
    });
  }

  ngOnInit(): void {}

  protected async openTeoriaDrawer(clase: ClaseTeoricoRow): Promise<void> {
    await this.facade.openTeoriaDrawer(clase);
    this.layoutDrawer.open(
      AsistenciaTeoriaDrawerComponent,
      `${clase.horaInicio} – ${clase.horaFin} · ${clase.tema}`,
      'graduation-cap',
    );
  }

  protected openAgendarDrawer(): void {
    this.layoutDrawer.open(
      AgendarTeoriaDrawerComponent,
      'Agendar nueva clase teórica',
      'calendar-plus',
    );
  }

  protected async onRefresh(): Promise<void> {
    await this.facade.reload();
  }

  protected onExportExcel(): void {
    // TODO: exportación Excel
  }
}
