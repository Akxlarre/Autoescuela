import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { HistorialCuadraturasFacade } from '@core/facades/historial-cuadraturas.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { DetalleCuadraturaModalComponent } from '@shared/components/detalle-cuadratura-modal/detalle-cuadratura-modal.component';
import { HistorialCuadraturasContentComponent } from '@shared/components/historial-cuadraturas-content/historial-cuadraturas-content.component';
import type { HistorialCierre } from '@core/models/ui/historial-cuadraturas.model';

@Component({
  selector: 'app-secretaria-contabilidad-historial-cuadraturas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HistorialCuadraturasContentComponent],
  template: `
    <app-historial-cuadraturas-content
      [cierres]="facade.historialCierres()"
      [isLoading]="facade.isLoadingHistorial()"
      [isExporting]="facade.isExporting()"
      [mesActual]="facade.mesActual()"
      [anioActual]="facade.anioActual()"
      backRoute="../cuadratura"
      backLabel="Cuadratura"
      (mesAnterior)="facade.mesAnterior()"
      (mesSiguiente)="facade.mesSiguiente()"
      (exportarMes)="facade.exportarMes($event)"
      (cierreClicked)="abrirDetalle($event)"
    />
  `,
})
export class SecretariaContabilidadHistorialCuadraturasComponent implements OnInit {
  protected readonly facade = inject(HistorialCuadraturasFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  ngOnInit(): void {
    this.facade.cargarHistorial();
  }

  protected abrirDetalle(cierre: HistorialCierre): void {
    this.facade.seleccionarCierre(cierre);
    const [yyyy, mm, dd] = cierre.fecha.split('-');
    this.layoutDrawer.push(
      DetalleCuadraturaModalComponent,
      `Detalle Cuadratura — ${dd}/${mm}/${yyyy}`,
      'calculator',
    );
  }
}
