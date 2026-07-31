import { TestBed } from '@angular/core/testing';
import { CuadraturaContentComponent } from './cuadratura-content.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { EgresoRow } from '@core/models/ui/cuadratura.model';

// ─── fix-006-i: categoryLabel() — badge de categoría en la columna MOTIVO ─────

describe('CuadraturaContentComponent.categoryLabel', () => {
  function createComponent() {
    TestBed.configureTestingModule({
      providers: [{ provide: GsapAnimationsService, useValue: { createShimmer: () => {} } }],
    });
    const fixture = TestBed.createComponent(CuadraturaContentComponent);
    return fixture.componentInstance;
  }

  const mkEgreso = (category: string | null): EgresoRow => ({
    id: 1,
    tipo: 'expense',
    category,
    descripcion: 'crn',
    monto: 25_000,
  });

  it('mapea "combustible" a la etiqueta "Combustible"', () => {
    const component = createComponent();
    expect(component['categoryLabel'](mkEgreso('combustible'))).toBe('Combustible');
  });

  it('mapea "gasto" a la etiqueta "Gasto"', () => {
    const component = createComponent();
    expect(component['categoryLabel'](mkEgreso('gasto'))).toBe('Gasto');
  });

  it('devuelve null cuando category es null (ej. anticipos)', () => {
    const component = createComponent();
    expect(component['categoryLabel'](mkEgreso(null))).toBeNull();
  });

  it('devuelve la categoría cruda si no está en el mapa de etiquetas conocidas', () => {
    const component = createComponent();
    expect(component['categoryLabel'](mkEgreso('otros'))).toBe('otros');
  });
});
