import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { LiquidacionesFacade } from '@core/facades/liquidaciones.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { PagoInstructorModalComponent } from '@shared/components/pago-instructor-modal/pago-instructor-modal.component';
import { LiquidacionesContentComponent } from '@shared/components/liquidaciones-content/liquidaciones-content.component';
import type { LiquidacionRow } from '@core/models/ui/liquidaciones.model';

@Component({
  selector: 'app-admin-contabilidad-liquidaciones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LiquidacionesContentComponent],
  template: `
    <app-liquidaciones-content
      [liquidaciones]="facade.liquidaciones()"
      [isLoading]="facade.isLoading()"
      [isExporting]="facade.isExporting()"
      [kpis]="facade.kpis()"
      [mesActual]="facade.mesActual()"
      [anioActual]="facade.anioActual()"
      [isDrawerOpen]="layoutDrawer.isOpen()"
      (mesAnterior)="facade.mesAnterior()"
      (mesSiguiente)="facade.mesSiguiente()"
      (deshacer)="facade.deshacerPago($event)"
      (pagar)="onPagar($event)"
      (exportRequested)="facade.exportar($event)"
    />
  `,
})
export class AdminContabilidadLiquidacionesComponent {
  protected readonly facade = inject(LiquidacionesFacade);
  private readonly branchFacade = inject(BranchFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }

  protected onPagar(row: LiquidacionRow): void {
    this.facade.seleccionarParaPago(row);
    this.layoutDrawer.open(PagoInstructorModalComponent, 'Registrar Pago Instructor', 'banknote');
  }
}
