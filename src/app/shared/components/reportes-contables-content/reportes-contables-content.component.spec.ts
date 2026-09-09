import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { ReportesContablesContentComponent } from './reportes-contables-content.component';

/**
 * activeTab() / tabOptions() sin renderizar el template.
 *
 * fix-242-m: "Detalle Diario" se eliminó (grano diario = Cuadratura Diaria) y
 * "Categorías" pasó de fila fija a tab por defecto. Gastos Fijos sigue filtrado
 * por isAdmin() (fixed_expenses es RLS admin-only).
 */
describe('ReportesContablesContentComponent — tabs', () => {
  let component: ReportesContablesContentComponent;

  function setIsAdmin(value: boolean) {
    (component as unknown as { isAdmin: unknown }).isAdmin = signal(value);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    component = TestBed.runInInjectionContext(() => new ReportesContablesContentComponent());
  });

  it('la tab activa por defecto es "categorias"', () => {
    expect(component['activeTab']()).toBe('categorias');
  });

  it('setActiveTab actualiza la tab activa', () => {
    component['setActiveTab']('evolucion');
    expect(component['activeTab']()).toBe('evolucion');

    component['setActiveTab']('rentabilidad');
    expect(component['activeTab']()).toBe('rentabilidad');

    component['setActiveTab']('gastos-fijos');
    expect(component['activeTab']()).toBe('gastos-fijos');
  });

  it('admin ve 4 tabs, con Categorías primero y Gastos Fijos al final', () => {
    setIsAdmin(true);
    const ids = component['tabOptions']().map((t: { id: string }) => t.id);
    expect(ids).toEqual(['categorias', 'evolucion', 'rentabilidad', 'gastos-fijos']);
  });

  it('secretaria (no admin) ve solo 3 tabs, sin Gastos Fijos', () => {
    setIsAdmin(false);
    const ids = component['tabOptions']().map((t: { id: string }) => t.id);
    expect(ids).toEqual(['categorias', 'evolucion', 'rentabilidad']);
  });

  it('no existe la tab "detalle" (Detalle Diario eliminado en fix-242-m)', () => {
    setIsAdmin(true);
    const ids = component['tabOptions']().map((t: { id: string }) => t.id);
    expect(ids).not.toContain('detalle');
  });
});

// ── spec 0015-m: selector de rango dependiente de la pestaña ──────────────────

describe('ReportesContablesContentComponent — selector por pestaña (spec 0015-m)', () => {
  let component: ReportesContablesContentComponent;

  function setFiltros(rango = 'mes_actual') {
    (component as unknown as { filtros: unknown }).filtros = signal({
      rango,
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
  }
  function setRangoEvolucion(value = 'ultimos_6_meses') {
    (component as unknown as { rangoEvolucion: unknown }).rangoEvolucion = signal(value);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    component = TestBed.runInInjectionContext(() => new ReportesContablesContentComponent());
    setFiltros();
    setRangoEvolucion();
  });

  it('en la pestaña Evolución el selector ofrece SOLO las opciones de Evolución (AC1)', () => {
    component['setActiveTab']('evolucion');
    const values = component['selectOptions']().map((o) => o.value);
    expect(values).toEqual(['ultimos_6_meses', 'ultimos_12_meses', 'anio_actual', 'anio_anterior']);
    expect(values).not.toContain('mes_actual');
    expect(values).not.toContain('personalizado');
  });

  it('en las otras pestañas el selector mantiene las opciones generales (AC2)', () => {
    component['setActiveTab']('categorias');
    const values = component['selectOptions']().map((o) => o.value);
    expect(values).toContain('mes_actual');
    expect(values).toContain('personalizado');
    expect(values).not.toContain('ultimos_12_meses');
  });

  it('cambiar el selector en Evolución emite aplicarRangoEvolucion y NO aplicarFiltros', () => {
    component['setActiveTab']('evolucion');
    const evo: string[] = [];
    const gral: unknown[] = [];
    component.aplicarRangoEvolucion.subscribe((v) => evo.push(v));
    component.aplicarFiltros.subscribe((v) => gral.push(v));

    component['onSelectChange']('anio_anterior');

    expect(evo).toEqual(['anio_anterior']);
    expect(gral).toEqual([]);
    expect(component['localRangoEvolucion']()).toBe('anio_anterior');
  });

  it('cambiar el selector fuera de Evolución emite aplicarFiltros y NO aplicarRangoEvolucion', () => {
    component['setActiveTab']('categorias');
    const evo: unknown[] = [];
    const gral: unknown[] = [];
    component.aplicarRangoEvolucion.subscribe((v) => evo.push(v));
    component.aplicarFiltros.subscribe((v) => gral.push(v));

    component['onSelectChange']('mes_anterior');

    expect(gral).toHaveLength(1);
    expect(evo).toEqual([]);
  });

  it('cada eje conserva su propio rango al cambiar de pestaña (AC8)', () => {
    component['setActiveTab']('evolucion');
    component['onSelectChange']('ultimos_12_meses');
    expect(component['selectValue']()).toBe('ultimos_12_meses');

    component['setActiveTab']('categorias');
    expect(component['selectValue']()).toBe('mes_actual'); // el general no se tocó

    component['setActiveTab']('evolucion');
    expect(component['selectValue']()).toBe('ultimos_12_meses'); // el de evolución se conservó
  });

  it('la etiqueta de la ventana refleja la opción elegida', () => {
    component['setActiveTab']('evolucion');
    component['onSelectChange']('ultimos_12_meses');
    expect(component['evolucionRangoLabel']()).toBe('últimos 12 meses');
    component['onSelectChange']('anio_anterior');
    expect(component['evolucionRangoLabel']()).toBe(`año ${new Date().getFullYear() - 1}`);
  });
});
