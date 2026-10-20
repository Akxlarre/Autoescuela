import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { CertificacionProfesionalFacade } from '@core/facades/certificacion-profesional.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { CertificacionProfesionalContentComponent } from '@shared/components/certificacion-profesional-content/certificacion-profesional-content.component';
import { HistorialEmisionesProfDrawerComponent } from '@features/admin/profesional-certificados/drawers/historial-emisiones-prof-drawer.component';
import { GenerarPendientesProfDrawerComponent } from '@features/admin/profesional-certificados/drawers/generar-pendientes-prof-drawer.component';
import { EnviarMasivoProfDrawerComponent } from '@features/admin/profesional-certificados/drawers/enviar-masivo-prof-drawer.component';

/**
 * SecretariaProfesionalCertificadosComponent — Smart component.
 * Ruta: /app/secretaria/profesional/certificados
 *
 * La secretaria siempre ve su propia sede (branchId del usuario autenticado,
 * ya filtrado en BranchFacade por defecto).
 */
@Component({
  selector: 'app-secretaria-profesional-certificados',
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
export class SecretariaProfesionalCertificadosComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(CertificacionProfesionalFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  constructor() {
    // hotfix-161-m: una secretaria con acceso a ambas sedes tiene selector; se recarga al cambiarlo.
    let previousBranchId: number | null | undefined = undefined;

    effect(() => {
      const branchId = this.branchFacade.selectedBranchId();

      if (previousBranchId === undefined) {
        untracked(() => void this.facade.initialize());
      } else if (previousBranchId !== branchId) {
        untracked(() => void this.facade.reload());
      }
      previousBranchId = branchId;
    });
  }

  ngOnInit(): void {
    // fix-028: con grant, la secretaria se comporta como admin → fuerza sede con profesional.
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
