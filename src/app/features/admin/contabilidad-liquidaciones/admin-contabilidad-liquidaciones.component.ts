import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { LiquidacionesFacade } from '@core/facades/liquidaciones.facade';
import { LiquidacionesContentComponent } from '@shared/components/liquidaciones-content/liquidaciones-content.component';
import type { LiquidacionRow, PagoInstructorPayload } from '@core/models/ui/liquidaciones.model';

@Component({
  selector: 'app-admin-contabilidad-liquidaciones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LiquidacionesContentComponent],
  template: `
    <div class="page-wide">
      <app-liquidaciones-content
        [liquidaciones]="facade.liquidaciones()"
        [isLoading]="facade.isLoading()"
        [isSaving]="facade.isSaving()"
        [kpis]="facade.kpis()"
        [mesActual]="facade.mesActual()"
        [anioActual]="facade.anioActual()"
        (mesAnterior)="facade.mesAnterior()"
        (mesSiguiente)="facade.mesSiguiente()"
        (pagar)="onPagar($event)"
        (deshacer)="facade.deshacerPago($event)"
      />
    </div>
  `,
})
export class AdminContabilidadLiquidacionesComponent implements OnInit {
  protected readonly facade = inject(LiquidacionesFacade);

  ngOnInit(): void {
    this.facade.cargarLiquidaciones();
  }

  protected onPagar(event: { row: LiquidacionRow; payload: PagoInstructorPayload }): void {
    this.facade.registrarPago(event.row, event.payload);
  }
}
