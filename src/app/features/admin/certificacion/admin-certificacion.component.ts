import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { CertificacionClaseBFacade } from '@core/facades/certificacion-clase-b.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { CertificacionClaseBContentComponent } from '@shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component';

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
      [log]="facade.log()"
      [isLoading]="facade.isLoading()"
      [generatingId]="facade.generatingId()"
      (generarCertificado)="facade.generarCertificado($event)"
      (verCertificado)="facade.verCertificado($event.storagePath, $event.nombre)"
      (enviarEmail)="facade.enviarEmail($event)"
      (generarPendientes)="facade.generarPendientes()"
      (enviarEmailsMasivo)="facade.enviarEmailsMasivo()"
      (exportar)="facade.exportar()"
    />
  `,
})
export class AdminCertificacionComponent {
  protected readonly facade = inject(CertificacionClaseBFacade);
  private readonly branchFacade = inject(BranchFacade);

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
}
