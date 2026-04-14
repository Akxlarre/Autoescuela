import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CertificacionClaseBFacade } from '@core/facades/certificacion-clase-b.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { CertificacionClaseBContentComponent } from '@shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component';

/**
 * SecretariaCertificadosComponent — Smart component.
 * Ruta: /app/secretaria/certificados
 *
 * La secretaria siempre ve su propia sede (branchId del usuario autenticado).
 */
@Component({
  selector: 'app-secretaria-certificados',
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
export class SecretariaCertificadosComponent implements OnInit {
  protected readonly facade = inject(CertificacionClaseBFacade);
  private readonly authFacade = inject(AuthFacade);

  ngOnInit(): void {
    void this.facade.initialize();
  }
}
