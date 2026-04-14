import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ReportesContablesFacade } from '@core/facades/reportes-contables.facade';
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
      [filtros]="facade.filtros()"
      (aplicarFiltros)="onAplicarFiltros($event)"
      (exportarExcel)="facade.exportarExcel()"
      (exportarPDF)="facade.exportarPDF()"
      (verDetalle)="onVerDetalle($event)"
    />
  `,
})
export class SecretariaContabilidadReportesComponent implements OnInit {
  protected readonly facade = inject(ReportesContablesFacade);

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected async onAplicarFiltros(filtros: FiltrosReporte): Promise<void> {
    await this.facade.aplicarFiltros(filtros);
  }

  protected onVerDetalle(fecha: string): void {
    // TODO: abrir drawer con detalle del día (fecha YYYY-MM-DD)
    console.log('Ver detalle del día:', fecha);
  }
}
