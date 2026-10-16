import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SecretariaServiciosEspecialesComponent } from './secretaria-servicios-especiales.component';
import { ServiciosEspecialesFacade } from '@core/facades/servicios-especiales.facade';
import { BranchFacade } from '@core/facades/branch.facade';

/**
 * fix-441-m: la secretaria con grant multi-sede cambia de sede en el topbar sin salir de la
 * pantalla; antes solo el admin tenía el `effect` que recarga, así que se quedaba con los datos de
 * la sede anterior.
 */
describe('SecretariaServiciosEspecialesComponent — cambio de sede (fix-441-m)', () => {
  it('recarga al cambiar la sede del topbar', () => {
    const selectedBranchId = signal<number | null>(1);
    const initialize = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        SecretariaServiciosEspecialesComponent,
        { provide: ServiciosEspecialesFacade, useValue: { initialize } },
        { provide: BranchFacade, useValue: { selectedBranchId } },
      ],
    });
    TestBed.inject(SecretariaServiciosEspecialesComponent);

    TestBed.tick();
    expect(initialize).toHaveBeenCalledTimes(1);

    selectedBranchId.set(2);
    TestBed.tick();
    expect(initialize).toHaveBeenCalledTimes(2);
  });
});
