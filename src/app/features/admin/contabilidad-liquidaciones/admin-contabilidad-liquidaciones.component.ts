import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { LiquidacionesFacade } from '@core/facades/liquidaciones.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { PagoInstructorModalComponent } from '@shared/components/pago-instructor-modal/pago-instructor-modal.component';
import { LiquidacionesContentComponent } from '@shared/components/liquidaciones-content/liquidaciones-content.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import type { LiquidacionRow } from '@core/models/ui/liquidaciones.model';
import { AnticiposFacade } from '@core/facades/anticipos.facade';
import { RegistrarAnticipoDrawerComponent } from '../contabilidad-anticipos/registrar-anticipo-drawer.component';

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
      [error]="facade.error()"
      [refreshFailed]="facade.refreshFailed()"
      [reintentando]="facade.reintentando()"
      [puedeRegistrarPago]="facade.puedeRegistrarPago()"
      (reintentar)="facade.reintentar()"
      [mesActual]="facade.mesActual()"
      [anioActual]="facade.anioActual()"
      [isDrawerOpen]="layoutDrawer.isOpen()"
      (mesAnterior)="facade.mesAnterior()"
      [puedeAvanzarMes]="facade.puedeAvanzarMes()"
      (mesSiguiente)="facade.mesSiguiente()"
      (deshacer)="facade.deshacerPago($event)"
      (pagar)="onPagar($event)"
      (darAnticipo)="onDarAnticipo($event)"
      (exportRequested)="facade.exportar($event)"
    />
  `,
})
export class AdminContabilidadLiquidacionesComponent {
  protected readonly facade = inject(LiquidacionesFacade);
  private readonly branchFacade = inject(BranchFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly anticiposFacade = inject(AnticiposFacade);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.destroyRef.onDestroy(() => this.facade.destroyRealtime());

    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }

  protected onPagar(row: LiquidacionRow): void {
    this.facade.seleccionarParaPago(row);
    this.layoutDrawer.open(PagoInstructorModalComponent, 'Registrar Pago Instructor', 'banknote');
  }

  /**
   * spec 0012-i AC16: el drawer de anticipo arma su select con `AnticiposFacade.instructores()`, así
   * que el facade se inicializa antes (SWR: si ya cargó, solo refresca en segundo plano).
   */
  protected async onDarAnticipo(row: LiquidacionRow): Promise<void> {
    await this.anticiposFacade.initialize();
    this.anticiposFacade.selectInstructor(row.instructorId);
    this.layoutDrawer.open(RegistrarAnticipoDrawerComponent, 'Registrar Anticipo', 'banknote');
  }
}
