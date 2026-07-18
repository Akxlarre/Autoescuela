import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { CertificacionClaseBFacade } from '@core/facades/certificacion-clase-b.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { CertificacionClaseBContentComponent } from '@shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component';
import { HistorialEmisionesDrawerComponent } from './drawers/historial-emisiones-drawer.component';
import { GenerarPendientesDrawerComponent } from './drawers/generar-pendientes-drawer.component';
import { EnviarMasivoDrawerComponent } from './drawers/enviar-masivo-drawer.component';

/**
 * AdminCertificacionComponent — Smart component.
 * Ruta: /app/admin/certificacion
 *
 * Reactivo al selector de sede del topbar (BranchFacade.selectedBranchId).
 */
@Component({
  selector: 'app-admin-certificacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CertificacionClaseBContentComponent],
  template: `
    <app-certificacion-clase-b-content
      [alumnos]="facade.alumnos()"
      [kpis]="facade.kpis()"
      [isLoading]="facade.isLoading()"
      [generatingId]="facade.generatingId()"
      [sendingEmailId]="facade.sendingEmailId()"
      [sendingMasivo]="facade.sendingMasivo()"
      [isExporting]="facade.isExporting()"
      [isGeneratingPendientes]="facade.isGeneratingPendientes()"
      [isAdmin]="isAdmin()"
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
export class AdminCertificacionComponent {
  protected readonly facade = inject(CertificacionClaseBFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly isAdmin = computed(() => this.authFacade.currentUser()?.role === 'admin');

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

  protected openHistorialDrawer(): void {
    this.layoutDrawer.open(HistorialEmisionesDrawerComponent, 'Historial de Emisiones', 'scroll');
  }

  protected openGenerarPendientesDrawer(): void {
    this.layoutDrawer.open(GenerarPendientesDrawerComponent, 'Generar Pendientes', 'file-check');
  }

  protected openEnviarMasivoDrawer(): void {
    this.layoutDrawer.open(EnviarMasivoDrawerComponent, 'Enviar Emails Masivo', 'send');
  }
}
