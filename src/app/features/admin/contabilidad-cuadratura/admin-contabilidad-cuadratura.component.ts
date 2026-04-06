import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { PagosFacade } from '@core/facades/pagos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { CuadraturaContentComponent } from '@shared/components/cuadratura-content/cuadratura-content.component';
import { EgresoModalComponent } from '@shared/components/egreso-modal/egreso-modal.component';
import { RegistrarPagoDrawerComponent } from '@features/admin/pagos/registrar-pago-drawer.component';
import type {
  CierrePayload,
  EgresoFormData,
  IngresoRow,
  EgresoRow,
} from '@core/models/ui/cuadratura.model';

@Component({
  selector: 'app-admin-contabilidad-cuadratura',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CuadraturaContentComponent, EgresoModalComponent],
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
      (abrirEgreso)="egresoModalOpen.set(true)"
      (eliminarIngreso)="onEliminarIngreso($event)"
      (eliminarEgreso)="onEliminarEgreso($event)"
    />



    <!-- ── Modal: Registrar Egreso ──────────────────────────────────────────── -->
    <app-egreso-modal
      [isOpen]="egresoModalOpen()"
      [isSaving]="facade.isSaving()"
      (guardar)="onEgresoGuardado($event)"
      (cerrado)="egresoModalOpen.set(false)"
    />
  `,
})
export class AdminContabilidadCuadraturaComponent implements OnInit {
  protected readonly facade = inject(CuadraturaFacade);
  private readonly pagosFacade = inject(PagosFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly egresoModalOpen = signal(false);

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected async onGuardarCierre(payload: CierrePayload): Promise<void> {
    await this.facade.cerrarCaja(payload);
  }

  protected abrirDrawerIngreso(): void {
    void this.pagosFacade.seleccionarParaPago(null);
    this.layoutDrawer.open(RegistrarPagoDrawerComponent, 'Registrar Pago', 'credit-card');
  }

  protected async onPagoGuardado(): Promise<void> {
    await this.facade.refresh();
  }

  protected async onEgresoGuardado(datos: EgresoFormData): Promise<void> {
    const ok = await this.facade.registrarEgreso(datos);
    if (ok) {
      this.egresoModalOpen.set(false);
    }
  }

  protected async onEliminarIngreso(row: IngresoRow): Promise<void> {
    await this.facade.eliminarIngreso(row);
  }

  protected async onEliminarEgreso(row: EgresoRow): Promise<void> {
    await this.facade.eliminarEgreso(row);
  }
}
