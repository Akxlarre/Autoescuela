import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ReportesContablesFacade } from '@core/facades/reportes-contables.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ReportesContablesContentComponent } from '@shared/components/reportes-contables-content/reportes-contables-content.component';
import type { FiltrosReporte } from '@core/models/ui/reportes-contables.model';

@Component({
  selector: 'app-secretaria-contabilidad-reportes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportesContablesContentComponent],
  template: `
    <app-reportes-contables-content
      [kpis]="facade.kpis()"
      [ingresosCategoria]="facade.ingresosCategoria()"
      [gastosCategoria]="facade.gastosCategoria()"
      [evolucionMensual]="facade.evolucionMensual()"
      [detalleDiario]="facade.detalleDiario()"
      [diasConMovimientos]="facade.diasConMovimientos()"
      [escuela]="facade.escuela()"
      [isLoading]="facade.isLoading()"
      [isExporting]="facade.isExporting()"
      [filtros]="facade.filtros()"
      (aplicarFiltros)="onAplicarFiltros($event)"
      (exportRequested)="facade.exportar($event)"
      (verDetalle)="onVerDetalle($event)"
    />
  `,
})
export class SecretariaContabilidadReportesComponent {
  protected readonly facade = inject(ReportesContablesFacade);
  private readonly branchFacade = inject(BranchFacade);

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }

  protected async onAplicarFiltros(filtros: FiltrosReporte): Promise<void> {
    await this.facade.aplicarFiltros(filtros);
  }

  protected onVerDetalle(fecha: string): void {
    // TODO: abrir drawer con detalle del día (fecha YYYY-MM-DD)
    console.log('Ver detalle del día:', fecha);
  }
}
