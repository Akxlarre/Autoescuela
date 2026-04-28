import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { LiquidacionesFacade } from '@core/facades/liquidaciones.facade';
import { LiquidacionesContentComponent } from '@shared/components/liquidaciones-content/liquidaciones-content.component';
import type { LiquidacionRow, PagoInstructorPayload } from '@core/models/ui/liquidaciones.model';

@Component({
  selector: 'app-secretaria-contabilidad-liquidaciones',
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
export class SecretariaContabilidadLiquidacionesComponent implements OnInit {
  protected readonly facade = inject(LiquidacionesFacade);

  ngOnInit(): void {
    this.facade.initialize();
  }
}
