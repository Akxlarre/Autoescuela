import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { PagosFacade } from '@core/facades/pagos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { CuadraturaContentComponent } from '@shared/components/cuadratura-content/cuadratura-content.component';
import { RegistrarPagoDrawerComponent } from '@features/admin/pagos/registrar-pago-drawer.component';
import { RegistrarEgresoDrawerComponent } from './registrar-egreso-drawer.component';
import type {
  CierrePayload,
  IngresoRow,
  EgresoRow,
} from '@core/models/ui/cuadratura.model';

@Component({
  selector: 'app-admin-contabilidad-cuadratura',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CuadraturaContentComponent],
  template: `
    <app-cuadratura-content
      [pagosHoy]="facade.pagosHoy()"
      [gastosHoy]="facade.gastosHoy()"
      [fondoInicial]="facade.fondoInicial()"
      [totalIngresosHoy]="facade.totalIngresosHoy()"
      [totalEgresosHoy]="facade.totalEgresosHoy()"
      [saldoTeorico]="facade.saldoTeoricoEfectivo()"
      [cajaYaCerrada]="facade.cajaYaCerrada()"
      [isLoading]="facade.isLoading()"
      [isSaving]="facade.isSaving()"
      (guardarCierre)="onGuardarCierre($event)"
      (abrirIngreso)="abrirDrawerIngreso()"
      (abrirEgreso)="abrirDrawerEgreso()"
      (eliminarIngreso)="onEliminarIngreso($event)"
      (eliminarEgreso)="onEliminarEgreso($event)"
    />
  `,
})
export class AdminContabilidadCuadraturaComponent implements OnInit {
  protected readonly facade = inject(CuadraturaFacade);
  private readonly pagosFacade = inject(PagosFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected async onGuardarCierre(payload: CierrePayload): Promise<void> {
    await this.facade.cerrarCaja(payload);
  }

  protected abrirDrawerIngreso(): void {
    void this.pagosFacade.seleccionarParaPago(null);
    this.layoutDrawer.open(RegistrarPagoDrawerComponent, 'Registrar Ingreso', 'trending-up');
  }

  protected abrirDrawerEgreso(): void {
    this.layoutDrawer.open(RegistrarEgresoDrawerComponent, 'Registrar Egreso', 'trending-down');
  }

  protected async onEliminarIngreso(row: IngresoRow): Promise<void> {
    await this.facade.eliminarIngreso(row);
  }

  protected async onEliminarEgreso(row: EgresoRow): Promise<void> {
    await this.facade.eliminarEgreso(row);
  }
}
