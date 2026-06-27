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

import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';

@Component({
  selector: 'app-secretaria-contabilidad-cuadratura',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CuadraturaContentComponent, EgresoModalComponent],
  template: `
    <app-cuadratura-content
      [pagosHoy]="facade.pagosHoy()"
      [gastosHoy]="facade.gastosHoy()"
      [fondoInicial]="facade.fondoInicial()"
      [ingresosEfectivoHoy]="facade.ingresosEfectivoHoy()"
      [totalIngresosHoy]="facade.totalIngresosHoy()"
      [totalEgresosHoy]="facade.totalEgresosHoy()"
      [saldoTeorico]="facade.saldoTeoricoEfectivo()"
      [cajaYaCerrada]="facade.cajaYaCerrada()"
      [isLoading]="facade.isLoading()"
      [isSaving]="facade.isSaving()"
      [isExporting]="facade.isExporting()"
      [isDrawerOpen]="layoutDrawer.isOpen()"
      (fondoInicialChange)="facade.fondoInicial.set($event)"
      (guardarCierre)="onGuardarCierre($event)"
      (abrirIngreso)="openIngresoDrawer()"
      (abrirEgreso)="egresoModalOpen.set(true)"
      (eliminarIngreso)="onEliminarIngreso($event)"
      (eliminarEgreso)="onEliminarEgreso($event)"
      (exportRequested)="facade.exportar($event)"
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
export class SecretariaContabilidadCuadraturaComponent implements OnInit {
  protected readonly facade = inject(CuadraturaFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly confirmModal = inject(ConfirmModalService);

  protected readonly egresoModalOpen = signal(false);

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected async onGuardarCierre(payload: CierrePayload): Promise<void> {
    await this.facade.cerrarCaja(payload);
  }

  protected openIngresoDrawer(): void {
    this.layoutDrawer.open(RegistrarPagoDrawerComponent, 'Registrar Pago', 'plus');
  }

  protected async onEgresoGuardado(datos: EgresoFormData): Promise<void> {
    const ok = await this.facade.registrarEgreso(datos);
    if (ok) {
      this.egresoModalOpen.set(false);
    }
  }

  protected async onEliminarIngreso(row: IngresoRow): Promise<void> {
    const ref = row.nBoleta ? `boleta ${row.nBoleta}` : `ingreso #${row.id}`;
    const confirmed = await this.confirmModal.confirm({
      title: `Eliminar ${ref}`,
      message: 'Los saldos del día se recalcularán. Esta acción no se puede deshacer.',
      severity: 'danger',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    await this.facade.eliminarIngreso(row);
  }

  protected async onEliminarEgreso(row: EgresoRow): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Eliminar egreso',
      message: `Se eliminará "${row.descripcion}". Esta acción no se puede deshacer.`,
      severity: 'danger',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    await this.facade.eliminarEgreso(row);
  }
}
