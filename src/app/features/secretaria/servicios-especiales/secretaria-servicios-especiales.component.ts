import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ServiciosEspecialesFacade } from '@core/facades/servicios-especiales.facade';
import { ServiciosEspecialesContentComponent } from '@shared/components/servicios-especiales-content/servicios-especiales-content.component';

/**
 * SecretariaServiciosEspecialesComponent — Smart Component (RF-037).
 * Conecta el contenido de Servicios Especiales con la lógica de negocio.
 */
@Component({
  selector: 'app-secretaria-servicios-especiales',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ServiciosEspecialesContentComponent],
  template: `
    <div class="p-6">
      <app-servicios-especiales-content
        [catalogo]="facade.catalogo()"
        [ventas]="facade.ventas()"
        [kpis]="facade.kpis()"
        [isLoading]="facade.isLoading()"
        backRoute="/app/secretaria/dashboard"
        (requestRegistrarVenta)="facade.openRegistrarVentaDrawer($event)"
        (requestNuevoServicio)="facade.openAgregarServicioDrawer()"
        (cobroRegistrado)="facade.registrarCobro($event)"
        (exportarHistorial)="onExportar()"
      />
    </div>
  `,
})
export class SecretariaServiciosEspecialesComponent implements OnInit {
  protected readonly facade = inject(ServiciosEspecialesFacade);

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected onExportar(): void {
    // TODO: implementar exportación CSV/Excel
    console.log('[ServiciosEspeciales] Exportar historial');
  }
}
