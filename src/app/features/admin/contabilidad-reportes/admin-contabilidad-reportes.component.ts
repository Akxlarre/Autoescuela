import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ReportesContablesFacade } from '@core/facades/reportes-contables.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ReportesContablesContentComponent } from '@shared/components/reportes-contables-content/reportes-contables-content.component';
import { RegistrarGastoFijoDrawerComponent } from './registrar-gasto-fijo-drawer.component';
import type { FiltrosReporte } from '@core/models/ui/reportes-contables.model';

@Component({
  selector: 'app-admin-contabilidad-reportes',
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
      [gastosFijos]="facade.gastosFijos()"
      [filtros]="facade.filtros()"
      (aplicarFiltros)="onAplicarFiltros($event)"
      (exportRequested)="facade.exportar($event)"
      (registrarGastoClick)="onAbrirRegistrarGasto()"
      (verDetalle)="onVerDetalle($event)"
    />
  `,
})
export class AdminContabilidadReportesComponent implements OnInit {
  protected readonly facade = inject(ReportesContablesFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected async onAplicarFiltros(filtros: FiltrosReporte): Promise<void> {
    await this.facade.aplicarFiltros(filtros);
  }

  protected onAbrirRegistrarGasto(): void {
    this.layoutDrawer.open(RegistrarGastoFijoDrawerComponent, 'Registrar Gasto Fijo', 'receipt');
  }

  protected onVerDetalle(fecha: string): void {
    // TODO: abrir drawer con detalle del día (fecha YYYY-MM-DD)
    console.log('Ver detalle del día:', fecha);
  }
}
