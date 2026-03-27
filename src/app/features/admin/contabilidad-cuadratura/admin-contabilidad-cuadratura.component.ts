import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
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
  imports: [CuadraturaContentComponent, EgresoModalComponent, RegistrarPagoDrawerComponent],
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
      (abrirIngreso)="ingresoDrawerOpen.set(true)"
      (abrirEgreso)="egresoModalOpen.set(true)"
      (eliminarIngreso)="onEliminarIngreso($event)"
      (eliminarEgreso)="onEliminarEgreso($event)"
    />

    <!-- ── Drawer: Registrar Pago (modo global, sin alumno preseleccionado) ── -->
    <app-registrar-pago-drawer
      [isOpen]="ingresoDrawerOpen()"
      [enrollmentId]="null"
      alumnoNombre=""
      [saldoPendiente]="0"
      [pagadoActual]="0"
      (closed)="ingresoDrawerOpen.set(false)"
      (saved)="onPagoGuardado()"
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

  protected readonly ingresoDrawerOpen = signal(false);
  protected readonly egresoModalOpen = signal(false);

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected async onGuardarCierre(payload: CierrePayload): Promise<void> {
    await this.facade.cerrarCaja(payload);
  }

  protected async onPagoGuardado(): Promise<void> {
    // El pago fue guardado vía PagosFacade — refrescamos cuadratura para actualizar saldos
    await this.facade.refresh();
    this.ingresoDrawerOpen.set(false);
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
