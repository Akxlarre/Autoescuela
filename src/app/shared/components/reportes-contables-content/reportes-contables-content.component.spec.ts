import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { ReportesContablesContentComponent } from './reportes-contables-content.component';

/**
 * spec 0003-i (T5.1, actualizado 2026-08-25 tras feedback visual) — activeTab() /
 * tabOptions(), sin renderizar el template. Hero, Filtros y Categorías quedan fijos,
 * fuera de este sistema de tabs. Gastos Fijos SÍ es tab (a diferencia de la primera
 * pasada) — se filtra por isAdmin() porque fixed_expenses es RLS admin-only.
 */
describe('ReportesContablesContentComponent — tabs (spec 0003-i)', () => {
  let component: ReportesContablesContentComponent;

  function setIsAdmin(value: boolean) {
    (component as unknown as { isAdmin: unknown }).isAdmin = signal(value);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    component = TestBed.runInInjectionContext(() => new ReportesContablesContentComponent());
  });

  it('la tab activa por defecto es "evolucion"', () => {
    expect(component['activeTab']()).toBe('evolucion');
  });

  it('setActiveTab actualiza la tab activa', () => {
    component['setActiveTab']('detalle');
    expect(component['activeTab']()).toBe('detalle');

    component['setActiveTab']('rentabilidad');
    expect(component['activeTab']()).toBe('rentabilidad');

    component['setActiveTab']('gastos-fijos');
    expect(component['activeTab']()).toBe('gastos-fijos');
  });

  it('admin ve 4 tabs, incluyendo Gastos Fijos al final', () => {
    setIsAdmin(true);
    const ids = component['tabOptions']().map((t: { id: string }) => t.id);
    expect(ids).toEqual(['evolucion', 'detalle', 'rentabilidad', 'gastos-fijos']);
  });

  it('secretaria (no admin) ve solo 3 tabs, sin Gastos Fijos', () => {
    setIsAdmin(false);
    const ids = component['tabOptions']().map((t: { id: string }) => t.id);
    expect(ids).toEqual(['evolucion', 'detalle', 'rentabilidad']);
  });
});
