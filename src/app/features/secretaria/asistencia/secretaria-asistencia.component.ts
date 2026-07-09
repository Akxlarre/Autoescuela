import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { CiclosTeoricosFacade } from '@core/facades/ciclos-teoricos.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { AsistenciaClaseBContentComponent } from '@shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component';
import { AdminIniciarClaseDrawerComponent } from '../../admin/asistencia/admin-iniciar-clase-drawer.component';
import { AdminFinalizarClaseDrawerComponent } from '../../admin/asistencia/admin-finalizar-clase-drawer.component';
import type {
  ClasePracticaRow,
  ClasePracticaStatus,
} from '@core/models/ui/asistencia-clase-b.model';

/**
 * SecretariaAsistenciaComponent — Smart component.
 * Ruta: /app/secretaria/asistencia
 *
 * La secretaria siempre ve la asistencia y los ciclos de su propia sede.
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
      [clasesPracticas]="facade.clasesPracticas()"
      [alertas]="facade.alertas()"
      [instructores]="facade.instructores()"
      [selectedDate]="facade.selectedDate()"
      [isLoading]="facade.isLoading()"
      [isSaving]="facade.isSaving() || ciclos.isSaving()"
      [cycles]="ciclos.cycles()"
      [selectedCycleId]="ciclos.selectedCycleId()"
      [clasesCiclo]="ciclos.clases()"
      [rosterCiclo]="ciclos.roster()"
      [addableStudents]="ciclos.addableStudents()"
      [isLoadingCiclos]="ciclos.isLoading()"
      [isLoadingCycle]="ciclos.isLoadingCycle()"
      (markAttendance)="onMarkAttendance($event)"
      (justifyAbsence)="facade.justifyAbsence($event.sessionId, $event.reason)"
      (removeSchedule)="facade.removeSchedule($event)"
      (reactivateSchedule)="facade.reactivateSchedule($event)"
      (sendReminder)="facade.sendReminder($event)"
      (dateChange)="facade.setDate($event)"
      (refreshRequested)="onRefresh()"
      (iniciarClase)="openIniciarClaseDrawer($event)"
      (finalizarClase)="openFinalizarClaseDrawer($event)"
      (selectCycle)="ciclos.selectCycle($event)"
      (saveCicloZoomLink)="ciclos.saveZoomLink($event.classId, $event.link)"
      (updateCicloTopic)="ciclos.updateTopic($event.classId, $event.tema)"
      (sendCicloZoom)="ciclos.sendZoomEmail($event.classId, $event.recipientEnrollmentIds)"
      (moveCicloStudent)="ciclos.moveStudentToCycle($event.enrollmentId, $event.targetCycleId)"
      (requestAddable)="ciclos.loadAddableStudents()"
      (addCicloStudent)="onAddStudent($event)"
    />
  `,
})
export class SecretariaAsistenciaComponent implements OnInit {
  protected readonly facade = inject(AsistenciaClaseBFacade);
  protected readonly ciclos = inject(CiclosTeoricosFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly confirmModal = inject(ConfirmModalService);

  private get branchId(): number | null {
    return this.authFacade.currentUser()?.branchId ?? null;
  }

  ngOnInit(): void {
    const branchId = this.branchId;
    this.facade.setBranchFilter(branchId);
    this.ciclos.setBranchFilter(branchId);
    void this.facade.initialize();
    void this.ciclos.loadCycles();
  }

  protected openIniciarClaseDrawer(row: ClasePracticaRow): void {
    this.facade.selectPractica(row);
    this.layoutDrawer.open(
      AdminIniciarClaseDrawerComponent,
      `Iniciar Clase — ${row.alumnoName ?? 'Alumno'}`,
      'play',
    );
  }

  protected openFinalizarClaseDrawer(row: ClasePracticaRow): void {
    this.facade.selectPractica(row);
    this.layoutDrawer.open(
      AdminFinalizarClaseDrawerComponent,
      `Finalizar Clase — ${row.alumnoName ?? 'Alumno'}`,
      'flag',
    );
  }

  protected async onRefresh(): Promise<void> {
    await Promise.all([this.facade.reload(), this.ciclos.loadCycles()]);
  }

  protected async onMarkAttendance(event: {
    sessionId: number;
    status: ClasePracticaStatus;
  }): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Marcar inasistencia',
      message:
        '¿Confirmas que el alumno no asistió a esta clase? Esta acción queda registrada en su historial de asistencia.',
      severity: 'danger',
      confirmLabel: 'Marcar ausente',
    });
    if (!confirmed) return;
    this.facade.markAttendance(event.sessionId, event.status);
  }

  /** Override: traer un alumno de otro ciclo al ciclo actualmente seleccionado. */
  protected onAddStudent(enrollmentId: number): void {
    const target = this.ciclos.selectedCycleId();
    if (target !== null) void this.ciclos.moveStudentToCycle(enrollmentId, target);
  }
}
