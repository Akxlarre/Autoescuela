import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { CiclosTeoricosFacade } from '@core/facades/ciclos-teoricos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { AsistenciaClaseBContentComponent } from '@shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component';
import { AdminIniciarClaseDrawerComponent } from './admin-iniciar-clase-drawer.component';
import { AdminFinalizarClaseDrawerComponent } from './admin-finalizar-clase-drawer.component';
import type {
  ClasePracticaRow,
  ClasePracticaStatus,
} from '@core/models/ui/asistencia-clase-b.model';

/**
 * AdminAsistenciaComponent — Smart component.
 * Ruta: /app/admin/asistencia
 *
 * Coordina dos dominios bajo pestañas:
 *  - Prácticas (AsistenciaClaseBFacade)
 *  - Ciclos Teóricos (CiclosTeoricosFacade) — Spec 0001
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
      [clasesPracticas]="facade.clasesPracticas()"
      [alertas]="facade.alertas()"
      [instructores]="facade.instructores()"
      [selectedDate]="facade.selectedDate()"
      [isLoading]="facade.isLoading()"
      [isSaving]="facade.isSaving() || ciclos.isSaving()"
      [maxVisible]="maxVisible()"
      [cycles]="ciclos.cycles()"
      [selectedCycleId]="ciclos.selectedCycleId()"
      [clasesCiclo]="ciclos.clases()"
      [rosterCiclo]="ciclos.roster()"
      [addableStudents]="ciclos.addableStudents()"
      [isLoadingCiclos]="ciclos.isLoading()"
      [isLoadingCycle]="ciclos.isLoadingCycle()"
      [sendingClassId]="ciclos.sendingClassId()"
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
export class AdminAsistenciaComponent {
  protected readonly facade = inject(AsistenciaClaseBFacade);
  protected readonly ciclos = inject(CiclosTeoricosFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutService = inject(LayoutService);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly confirmModal = inject(ConfirmModalService);

  // Densidad adaptativa (spec 0028/0030): sin límite en desktop, 6 filas +
  // "Cargar más" en tablet/mobile o con el drawer lateral abierto (tier por contenedor).
  protected readonly maxVisible = computed(() =>
    this.layoutService.tier() === 'desktop' ? null : 6,
  );

  constructor() {
    let previousBranchId: number | null | undefined = undefined;
    let previousBranchesCount = 0;

    effect(() => {
      const branchId = this.branchFacade.selectedBranchId();
      const branchesCount = this.branchFacade.branches().length;
      this.facade.setBranchFilter(branchId);
      this.ciclos.setBranchFilter(branchId);

      if (previousBranchId === undefined) {
        // First run on component creation — SWR (no skeleton if already cached)
        void this.facade.initialize();
        void this.ciclos.loadCycles();
      } else if (previousBranchId !== branchId) {
        // Branch actually changed — force full reload with skeleton
        void this.facade.reload();
        void this.ciclos.loadCycles();
      } else if (branchId === null && previousBranchesCount === 0 && branchesCount > 0) {
        // "Todas las sedes" cargó antes de que BranchFacade.loadBranches() resolviera:
        // los ciclos quedaron con branchName "Sin sede". Reintenta ahora que ya hay sedes.
        void this.ciclos.loadCycles();
      }
      previousBranchId = branchId;
      previousBranchesCount = branchesCount;
    });
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

  /** Override: traer un alumno de otro ciclo al ciclo actualmente seleccionado. */
  protected onAddStudent(enrollmentId: number): void {
    const target = this.ciclos.selectedCycleId();
    if (target !== null) void this.ciclos.moveStudentToCycle(enrollmentId, target);
  }
}
