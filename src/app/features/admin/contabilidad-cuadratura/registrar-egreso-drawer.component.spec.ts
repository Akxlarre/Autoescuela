import { TestBed } from '@angular/core/testing';
import { RegistrarEgresoDrawerComponent } from './registrar-egreso-drawer.component';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { FlotaFacade } from '@core/facades/flota.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { signal } from '@angular/core';

// ─── fix-006-i: vehicleOptions() + preset de tipo consumido al montar ─────────

describe('RegistrarEgresoDrawerComponent', () => {
  function createComponent(vehicles: any[], preset: string | null = null) {
    const egresoTipoPreset = signal<string | null>(preset);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CuadraturaFacade,
          useValue: { egresoTipoPreset, registrarEgreso: vi.fn() },
        },
        { provide: FlotaFacade, useValue: { vehicles: () => vehicles, initialize: vi.fn() } },
        { provide: LayoutDrawerFacadeService, useValue: { close: vi.fn() } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
      ],
    });
    return TestBed.createComponent(RegistrarEgresoDrawerComponent).componentInstance;
  }

  it('vehicleOptions() muestra el instructor asignado cuando existe', () => {
    const component = createComponent([
      {
        id: 1,
        brand: 'Toyota',
        model: 'Yaris',
        licensePlate: 'ABC-123',
        instructorName: 'Juan Pérez',
      },
    ]);
    expect(component['vehicleOptions']()[0].label).toBe(
      'Toyota Yaris - ABC-123 (Asignado a: Juan Pérez)',
    );
  });

  it('vehicleOptions() muestra "Sin instructor asignado" cuando instructorName es null', () => {
    const component = createComponent([
      { id: 2, brand: 'Nissan', model: 'Versa', licensePlate: 'XYZ-987', instructorName: null },
    ]);
    expect(component['vehicleOptions']()[0].label).toBe(
      'Nissan Versa - XYZ-987 (Sin instructor asignado)',
    );
  });

  it('precarga el tipo "combustible" desde egresoTipoPreset() y lo consume una sola vez', () => {
    const component = createComponent([], 'combustible');
    expect(component['form'].get('tipo')?.value).toBe('combustible');
  });

  it('isCombustible() es true cuando el tipo seleccionado es "combustible"', () => {
    const component = createComponent([], 'combustible');
    expect(component['isCombustible']()).toBe(true);
  });

  it('isCombustible() es false para otros tipos', () => {
    const component = createComponent([]);
    component['form'].patchValue({ tipo: 'gasto' });
    expect(component['isCombustible']()).toBe(false);
  });
});
