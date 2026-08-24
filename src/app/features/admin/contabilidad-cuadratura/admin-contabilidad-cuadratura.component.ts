import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
} from '@angular/core';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { PagosFacade } from '@core/facades/pagos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { CuadraturaContentComponent } from '@shared/components/cuadratura-content/cuadratura-content.component';
import { BranchGateComponent } from '@shared/components/branch-gate/branch-gate.component';
import { RegistrarPagoDrawerComponent } from '@features/admin/pagos/registrar-pago-drawer.component';
import { RegistrarEgresoDrawerComponent } from './registrar-egreso-drawer.component';
import type { CierrePayload, IngresoRow, EgresoRow } from '@core/models/ui/cuadratura.model';

@Component({
  selector: 'app-admin-contabilidad-cuadratura',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CuadraturaContentComponent, BranchGateComponent],
  template: `
    @if (requiresBranchGate()) {
      <div class="h-full flex items-center justify-center p-4 sm:p-8">
        <app-branch-gate
          [branches]="branchFacade.branches()"
          reason="La Caja Diaria es por sede — elige con cuál trabajar hoy."
          (branchSelected)="branchFacade.selectBranch($event)"
        />
      </div>
    } @else {
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
        [isSaving]="facade.isSaving()"
        [isExporting]="facade.isExporting()"
        [isDrawerOpen]="layoutDrawer.isOpen()"
        (fondoInicialChange)="facade.fondoInicial.set($event)"
        (guardarCierre)="onGuardarCierre($event)"
        (abrirIngreso)="abrirDrawerIngreso()"
        (abrirEgreso)="abrirDrawerEgreso()"
        (eliminarIngreso)="onEliminarIngreso($event)"
        (eliminarEgreso)="onEliminarEgreso($event)"
        (exportRequested)="facade.exportar($event)"
      />
    }
  `,
})
export class AdminContabilidadCuadraturaComponent {
  protected readonly facade = inject(CuadraturaFacade);
  protected readonly branchFacade = inject(BranchFacade);
  private readonly auth = inject(AuthFacade);
  private readonly pagosFacade = inject(PagosFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * La caja física es por sede — no existe una "caja consolidada" (fix-212-m). Solo aplica a
   * admin: la secretaria ya está anclada a su propia sede vía resolveBranchScope() y nunca ve
   * selectedBranchId() === null.
   */
  protected readonly requiresBranchGate = computed(
    () =>
      this.auth.currentUser()?.role === 'admin' && this.branchFacade.selectedBranchId() === null,
  );

  constructor() {
    if (this.auth.currentUser()?.role === 'admin') {
      this.branchFacade.setRequiresSpecificBranch(true);
    }
    this.destroyRef.onDestroy(() => {
      this.facade.destroyRealtime();
      this.branchFacade.setRequiresSpecificBranch(false);
    });

    effect(() => {
      const branchId = this.branchFacade.selectedBranchId();
      if (this.auth.currentUser()?.role === 'admin' && branchId === null) return;
      void this.facade.initialize();
    });
  }

  protected async onGuardarCierre(payload: CierrePayload): Promise<void> {
    await this.facade.cerrarCaja(payload);
  }

  protected abrirDrawerIngreso(): void {
    void this.pagosFacade.seleccionarParaPago(null);
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
