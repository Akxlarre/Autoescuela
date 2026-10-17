import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ServiciosEspecialesFacade } from '@core/facades/servicios-especiales.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ServiciosEspecialesContentComponent } from '@shared/components/servicios-especiales-content/servicios-especiales-content.component';

/**
 * SecretariaServiciosEspecialesComponent — Smart Component (RF-037).
 * Conecta el contenido de Servicios Especiales con la lógica de negocio.
 *
 * fix-434-m: la secretaria solo vende. El catálogo es común a las dos sedes y lo administra el
 * admin (decisión M08), así que las acciones del catálogo no se muestran ni se conectan.
 */
@Component({
  selector: 'app-secretaria-servicios-especiales',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ServiciosEspecialesContentComponent],
  template: `
    <app-servicios-especiales-content
      [catalogo]="facade.catalogo()"
      [kpis]="facade.kpis()"
      [isLoading]="facade.isLoading()"
      [loadError]="facade.loadError()"
      (retry)="facade.reintentar()"
      [puedeEditarCatalogo]="false"
      (requestRegistrarVenta)="facade.openRegistrarVentaDrawer($event)"
      (requestVerHistorial)="facade.openHistorialVentasDrawer()"
    />
  `,
})
export class SecretariaServiciosEspecialesComponent {
  protected readonly facade = inject(ServiciosEspecialesFacade);
  private readonly branchFacade = inject(BranchFacade);

  constructor() {
    // fix-441-m: la secretaria con grant multi-sede cambia de sede sin salir de la pantalla
    // (mismo patrón que la del admin). Sin grant, la sede no cambia y esto corre una sola vez.
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }
}
