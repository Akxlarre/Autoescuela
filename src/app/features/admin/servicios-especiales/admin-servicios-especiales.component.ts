import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ServiciosEspecialesFacade } from '@core/facades/servicios-especiales.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { ServiciosEspecialesContentComponent } from '@shared/components/servicios-especiales-content/servicios-especiales-content.component';

/**
 * AdminServiciosEspecialesComponent — Smart Component (RF-037).
 * Conecta el contenido de Servicios Especiales con la lógica de negocio para Administradores.
 */
@Component({
  selector: 'app-admin-servicios-especiales',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ServiciosEspecialesContentComponent],
  template: `
    <app-servicios-especiales-content
      [catalogo]="facade.catalogo()"
      [ventas]="facade.ventas()"
      [kpis]="facade.kpis()"
      [isLoading]="facade.isLoading()"
      [isExporting]="facade.isExporting()"
      backRoute="/app/admin/dashboard"
      (requestRegistrarVenta)="facade.openRegistrarVentaDrawer($event)"
      (requestNuevoServicio)="facade.openAgregarServicioDrawer()"
      (exportarHistorial)="onExportar($event)"
      (ventaBorrada)="onBorrarVenta($event)"
      (servicioBorrado)="onBorrarServicio($event)"
      (servicioReactivado)="onReactivarServicio($event)"
      (servicioEliminadoDefinitivo)="onEliminarDefinitivo($event)"
    />
  `,
})
export class AdminServiciosEspecialesComponent {
  protected readonly facade = inject(ServiciosEspecialesFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }

  protected onExportar(format: 'excel' | 'pdf'): void {
    void this.facade.exportarHistorial(format);
  }

  protected async onBorrarVenta(id: number): Promise<void> {
    const { success, blockedReason } = await this.facade.borrarVenta(id);
    if (success) {
      this.toast.success('Venta borrada');
    } else if (blockedReason) {
      this.toast.warning('No se pudo borrar', blockedReason);
    } else {
      this.toast.error('No se pudo borrar la venta');
    }
  }

  protected async onBorrarServicio(id: number): Promise<void> {
    const { success, deactivated } = await this.facade.borrarServicio(id);
    if (success && deactivated) {
      this.toast.warning(
        'Servicio desactivado',
        'Tenía ventas asociadas — se desactivó en vez de borrarse.',
      );
    } else if (success) {
      this.toast.success('Servicio borrado');
    } else {
      this.toast.error('No se pudo borrar el servicio');
    }
  }

  protected async onReactivarServicio(id: number): Promise<void> {
    const { success } = await this.facade.reactivarServicio(id);
    if (success) {
      this.toast.success('Servicio reactivado');
    } else {
      this.toast.error('No se pudo reactivar el servicio');
    }
  }

  protected async onEliminarDefinitivo(id: number): Promise<void> {
    const { success } = await this.facade.borrarServicioDefinitivo(id);
    if (success) {
      this.toast.success('Servicio eliminado definitivamente');
    } else {
      this.toast.error('No se pudo eliminar el servicio');
    }
  }
}
