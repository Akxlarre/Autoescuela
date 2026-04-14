import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AsistenciaClaseBContentComponent } from '@shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component';
import { AsistenciaTeoriaDrawerComponent } from '../../admin/asistencia/asistencia-teoria-drawer.component';
import { AgendarTeoriaDrawerComponent } from '../../admin/asistencia/agendar-teoria-drawer.component';
import type { ClaseTeoricoRow } from '@core/models/ui/asistencia-clase-b.model';

/**
 * SecretariaAsistenciaComponent — Smart component.
 * Ruta: /app/secretaria/asistencia
 *
 * La secretaria siempre ve la asistencia de su propia sede.
 * El branchId viene de AuthFacade.currentUser().branchId (nunca null para secretaria).
 */
@Component({
  selector: 'app-secretaria-asistencia',
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
export class SecretariaAsistenciaComponent implements OnInit {
  protected readonly facade = inject(AsistenciaClaseBFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  private get branchId(): number | null {
    return this.authFacade.currentUser()?.branchId ?? null;
  }

  ngOnInit(): void {
    this.facade.setBranchFilter(this.branchId);
    void this.facade.initialize();
  }

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
    // TODO: implementar exportación Excel
  }
}
