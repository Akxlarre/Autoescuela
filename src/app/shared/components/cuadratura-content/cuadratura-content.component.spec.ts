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
    paymentMethod: 'efectivo',
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

// ─── hotfix-001-i: categoryIcon() — ícono del chip de categoría en MOTIVO ─────

describe('CuadraturaContentComponent.categoryIcon', () => {
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
    paymentMethod: 'efectivo',
  });

  it('mapea "combustible" al ícono "fuel"', () => {
    const component = createComponent();
    expect(component['categoryIcon'](mkEgreso('combustible'))).toBe('fuel');
  });

  it('mapea "gasto" al ícono "receipt"', () => {
    const component = createComponent();
    expect(component['categoryIcon'](mkEgreso('gasto'))).toBe('receipt');
  });

  it('devuelve null cuando category es null (ej. anticipos)', () => {
    const component = createComponent();
    expect(component['categoryIcon'](mkEgreso(null))).toBeNull();
  });

  it('devuelve el ícono genérico "tag" si la categoría no está en el mapa conocido', () => {
    const component = createComponent();
    expect(component['categoryIcon'](mkEgreso('otros'))).toBe('tag');
  });
});

// ─── fix-211-m: saldoComputado no debe verse afectado por egresos no-efectivo ─
//
// La fórmula de saldoComputado (fondoLocal + ingresosEfectivoHoy - totalEgresosEfectivoHoy)
// es idéntica a CuadraturaFacade.saldoTeoricoEfectivo, ya cubierta por
// cuadratura.facade.spec.ts > 'saldoTeoricoEfectivo resta solo egresos en efectivo (fix-211-m)'.
// No se agrega un test separado a nivel de componente: setear inputs signal-based vía
// fixture.componentRef.setInput() en este componente falla con NG0303 en el entorno de test
// actual (misma limitación documentada en alert-card.component.spec.ts — requiere
// @analogjs/vite-plugin-angular para compilar templates con inputs signal).
