import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { CertificacionProfesionalFacade } from '@core/facades/certificacion-profesional.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { CertificacionProfesionalContentComponent } from '@shared/components/certificacion-profesional-content/certificacion-profesional-content.component';
import { HistorialEmisionesProfDrawerComponent } from './drawers/historial-emisiones-prof-drawer.component';
import { GenerarPendientesProfDrawerComponent } from './drawers/generar-pendientes-prof-drawer.component';
import { EnviarMasivoProfDrawerComponent } from './drawers/enviar-masivo-prof-drawer.component';

/**
 * AdminProfesionalCertificadosComponent — Smart component.
 * Ruta: /app/admin/clase-profesional/certificados
 *
 * Reactivo al selector de sede del topbar (BranchFacade.selectedBranchId).
 * Activa el filtro de sedes profesionales mientras está montado.
 */
@Component({
  selector: 'app-admin-profesional-certificados',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CertificacionProfesionalContentComponent],
  template: `
    <app-certificacion-profesional-content
      [promociones]="facade.promociones()"
      [cursos]="facade.cursos()"
      [selectedPromocionId]="facade.selectedPromocionId()"
      [selectedCursoId]="facade.selectedCursoId()"
      [alumnos]="facade.alumnos()"
      [kpis]="facade.kpis()"
      [isLoading]="facade.isLoading()"
      [isLoadingAlumnos]="facade.isLoadingAlumnos()"
      [generatingId]="facade.generatingId()"
      [sendingEmailId]="facade.sendingEmailId()"
      [sendingMasivo]="facade.sendingMasivo()"
      [isExporting]="facade.isExporting()"
      [isGeneratingPendientes]="facade.isGeneratingPendientes()"
      (promocionSelected)="facade.selectPromocion($event)"
      (cursoSelected)="facade.selectCurso($event)"
      (generarCertificado)="facade.generarCertificado($event)"
      (verCertificado)="facade.verCertificado($event.storagePath, $event.nombre)"
      (enviarEmail)="facade.enviarEmail($event)"
      (abrirHistorialDrawer)="openHistorialDrawer()"
      (abrirGenerarPendientesDrawer)="openGenerarPendientesDrawer()"
      (abrirEnviarMasivoDrawer)="openEnviarMasivoDrawer()"
      (exportar)="facade.exportar()"
    />
  `,
})
export class AdminProfesionalCertificadosComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(CertificacionProfesionalFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  constructor() {
    let previousBranchId: number | null | undefined = undefined;

    effect(() => {
      const branchId = this.branchFacade.selectedBranchId();

      if (previousBranchId === undefined) {
        void this.facade.initialize();
      } else if (previousBranchId !== branchId) {
        void this.facade.reload();
      }
      previousBranchId = branchId;
    });
  }

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  protected openHistorialDrawer(): void {
    this.layoutDrawer.open(
      HistorialEmisionesProfDrawerComponent,
      'Historial de Emisiones',
      'scroll',
    );
  }

  protected openGenerarPendientesDrawer(): void {
    this.layoutDrawer.open(
      GenerarPendientesProfDrawerComponent,
      'Generar Pendientes',
      'file-check',
    );
  }

  protected openEnviarMasivoDrawer(): void {
    this.layoutDrawer.open(EnviarMasivoProfDrawerComponent, 'Enviar Emails Masivo', 'send');
  }
}
