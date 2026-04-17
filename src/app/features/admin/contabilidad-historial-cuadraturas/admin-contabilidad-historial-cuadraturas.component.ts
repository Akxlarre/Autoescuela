import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { HistorialCuadraturasFacade } from '@core/facades/historial-cuadraturas.facade';
import { HistorialCuadraturasContentComponent } from '@shared/components/historial-cuadraturas-content/historial-cuadraturas-content.component';

@Component({
  selector: 'app-admin-contabilidad-historial-cuadraturas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HistorialCuadraturasContentComponent],
  template: `
    <app-historial-cuadraturas-content
      [cierres]="facade.historialCierres()"
      [isLoading]="facade.isLoadingHistorial()"
      [mesActual]="facade.mesActual()"
      [anioActual]="facade.anioActual()"
      backRoute="../cuadratura"
      backLabel="Cuadratura"
      (mesAnterior)="facade.mesAnterior()"
      (mesSiguiente)="facade.mesSiguiente()"
      (volverAHoy)="facade.volverAHoy()"
      (exportarCSV)="facade.exportarCSV()"
    />
  `,
})
export class AdminContabilidadHistorialCuadraturasComponent implements OnInit {
  protected readonly facade = inject(HistorialCuadraturasFacade);

  ngOnInit(): void {
    this.facade.initialize();
  }
}
