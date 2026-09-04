import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { PagosFacade } from '@core/facades/pagos.facade';
import { CuadraturaContentComponent } from '@shared/components/cuadratura-content/cuadratura-content.component';
import { RegistrarPagoDrawerComponent } from '@features/admin/pagos/registrar-pago-drawer.component';
import { RegistrarEgresoDrawerComponent } from '@features/admin/contabilidad-cuadratura/registrar-egreso-drawer.component';
import { ArqueoCierreDrawerComponent } from '@features/admin/contabilidad-cuadratura/arqueo-cierre-drawer.component';
import type { IngresoRow, EgresoRow } from '@core/models/ui/cuadratura.model';

import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';

@Component({
  selector: 'app-secretaria-contabilidad-cuadratura',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CuadraturaContentComponent],
  template: `
    <app-cuadratura-content
      [pagosHoy]="facade.pagosHoy()"
      [gastosHoy]="facade.gastosHoy()"
      [fondoInicial]="facade.fondoInicial()"
      [ingresosEfectivoHoy]="facade.ingresosEfectivoHoy()"
      [totalIngresosHoy]="facade.totalIngresosHoy()"
      [totalEgresosHoy]="facade.totalEgresosHoy()"
      [totalEgresosEfectivoHoy]="facade.totalEgresosEfectivoHoy()"
      [saldoTeorico]="facade.saldoTeoricoEfectivo()"
      [cajaYaCerrada]="facade.cajaYaCerrada()"
      [isLoading]="facade.isLoading()"
      [isExporting]="facade.isExporting()"
      [isDrawerOpen]="layoutDrawer.isOpen()"
      [colorDiferencia]="facade.colorDiferenciaArqueo()"
      (abrirArqueo)="abrirDrawerArqueo()"
      (abrirIngreso)="abrirDrawerIngreso()"
      (abrirEgreso)="abrirDrawerEgreso()"
      (eliminarIngreso)="onEliminarIngreso($event)"
      (eliminarEgreso)="onEliminarEgreso($event)"
      (exportRequested)="facade.exportar($event)"
    />
  `,
})
export class SecretariaContabilidadCuadraturaComponent implements OnInit {
  protected readonly facade = inject(CuadraturaFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly pagosFacade = inject(PagosFacade);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.facade.destroyRealtime());
    this.facade.initialize();
  }

  /** Ancho reducido (spec 0004-i, feedback visual) — ver mismo comentario en el wrapper admin. */
  protected abrirDrawerArqueo(): void {
    this.layoutDrawer.open(
      ArqueoCierreDrawerComponent,
      'Arqueo y Cierre Operativo',
      'wallet',
      undefined,
      440,
    );
  }

  protected abrirDrawerIngreso(): void {
    this.pagosFacade.seleccionarParaPago(null);
    // Sin initialize(), alumnosConDeuda() está vacío y el drawer en modo global no puede
    // poblar el <select> de alumno (fix-080-m).
    void this.pagosFacade.initialize();
    this.layoutDrawer.open(RegistrarPagoDrawerComponent, 'Registrar Ingreso', 'trending-up');
  }

  protected abrirDrawerEgreso(): void {
    this.layoutDrawer.open(RegistrarEgresoDrawerComponent, 'Registrar Egreso', 'trending-down');
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
