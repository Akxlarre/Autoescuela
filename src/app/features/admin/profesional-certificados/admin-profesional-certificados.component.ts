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
import { CertificacionProfesionalContentComponent } from '@shared/components/certificacion-profesional-content/certificacion-profesional-content.component';

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
      [log]="facade.log()"
      [isLoading]="facade.isLoading()"
      [isLoadingAlumnos]="facade.isLoadingAlumnos()"
      [generatingId]="facade.generatingId()"
      (promocionSelected)="facade.selectPromocion($event)"
      (cursoSelected)="facade.selectCurso($event)"
      (generarCertificado)="facade.generarCertificado($event)"
      (verCertificado)="facade.verCertificado($event.storagePath, $event.nombre)"
      (enviarEmail)="facade.enviarEmail($event)"
      (generarPendientes)="facade.generarPendientes()"
      (enviarEmailsMasivo)="facade.enviarEmailsMasivo()"
      (exportar)="facade.exportar()"
    />
  `,
})
export class AdminProfesionalCertificadosComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(CertificacionProfesionalFacade);
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

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }
}
