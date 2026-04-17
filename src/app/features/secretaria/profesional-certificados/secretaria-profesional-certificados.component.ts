import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CertificacionProfesionalFacade } from '@core/facades/certificacion-profesional.facade';
import { CertificacionProfesionalContentComponent } from '@shared/components/certificacion-profesional-content/certificacion-profesional-content.component';

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
export class SecretariaProfesionalCertificadosComponent implements OnInit {
  protected readonly facade = inject(CertificacionProfesionalFacade);

  ngOnInit(): void {
    void this.facade.initialize();
  }
}
