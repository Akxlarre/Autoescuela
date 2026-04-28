import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { LiquidacionesFacade } from '@core/facades/liquidaciones.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LiquidacionesContentComponent } from '@shared/components/liquidaciones-content/liquidaciones-content.component';
import type { LiquidacionRow } from '@core/models/ui/liquidaciones.model';

@Component({
  selector: 'app-admin-contabilidad-liquidaciones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LiquidacionesContentComponent],
  template: `
    <div class="page-wide">
      <app-liquidaciones-content
        [liquidaciones]="facade.liquidaciones()"
        [isLoading]="facade.isLoading()"
        [kpis]="facade.kpis()"
        [mesActual]="facade.mesActual()"
        [anioActual]="facade.anioActual()"
        (mesAnterior)="facade.mesAnterior()"
        (mesSiguiente)="facade.mesSiguiente()"
        (deshacer)="facade.deshacerPago($event)"
      />
    </div>
  `,
})
export class AdminContabilidadLiquidacionesComponent {
  protected readonly facade = inject(LiquidacionesFacade);
  private readonly branchFacade = inject(BranchFacade);

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }
}
