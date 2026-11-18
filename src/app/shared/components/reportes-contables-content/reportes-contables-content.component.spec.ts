import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { ReporteKpis } from '@core/models/ui/reportes-contables.model';
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

// ── spec 0060-b: una lectura que falla no se ve como "no hay nada" ────────────

describe('ReportesContablesContentComponent — lecturas fallidas (spec 0060-b)', () => {
  const FILTROS = { rango: 'mes_actual', desde: '2026-11-01', hasta: '2026-11-30' } as const;
  const KPIS = {
    totalIngresos: 1000,
    totalGastos: 100,
    totalNeto: 900,
    margenGanancia: 90,
  } as ReporteKpis;

  /** Los hijos quedan como elementos sin compilar: sus inputs se leen como propiedades. */
  type Hijo = HTMLElement & Record<string, unknown>;

  function render(inputs: Record<string, unknown>) {
    TestBed.configureTestingModule({
      imports: [ReportesContablesContentComponent],
      providers: [{ provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } }],
    }).overrideComponent(ReportesContablesContentComponent, {
      set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
    });
    const fixture = TestBed.createComponent(ReportesContablesContentComponent);
    for (const [name, value] of Object.entries({ filtros: FILTROS, ...inputs })) {
      Object.defineProperty(fixture.componentInstance, name, { value: signal(value) });
    }
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, emptyState: () => el.querySelector('app-empty-state') as Hijo | null };
  }

  it('caso A: el error reemplaza el contenido, sin KPIs, y deja cambiar el período', () => {
    const { fixture, el, emptyState } = render({
      error: 'No se pudo cargar el reporte contable.',
    });
    const reintentos: unknown[] = [];
    fixture.componentInstance.reintentar.subscribe(() => reintentos.push(true));

    expect(el.textContent).not.toContain('Ingresos por Categoría');
    expect((el.querySelector('app-section-hero') as Hijo)['kpis']).toEqual([]);
    expect(el.querySelector('p-select')).not.toBeNull();

    const estado = emptyState()!;
    expect(estado.closest('.bento-fill')).not.toBeNull();
    expect(estado['message']).toBe('No se pudo cargar el reporte contable.');
    expect(estado.getAttribute('actionLabel')).toBe('Reintentar');
    estado.dispatchEvent(new Event('action'));
    expect(reintentos).toHaveLength(1);
  });

  it('caso A: tampoco muestra datos en las otras pestañas', () => {
    const { fixture, el, emptyState } = render({
      error: 'No se pudo cargar el reporte contable.',
    });
    fixture.componentInstance['setActiveTab']('rentabilidad');
    fixture.detectChanges();
    expect(el.querySelector('app-rentabilidad-cursos')).toBeNull();
    expect(emptyState()?.['message']).toBe('No se pudo cargar el reporte contable.');
  });

  it('caso B: el aviso va dentro de la celda .bento-fill y los datos se quedan', () => {
    const { fixture, el } = render({ kpis: KPIS, refreshFailed: true });
    const reintentos: unknown[] = [];
    fixture.componentInstance.reintentar.subscribe(() => reintentos.push(true));
    const aviso = el.querySelector('app-alert-card') as HTMLElement;

    expect(aviso.closest('.bento-fill')).not.toBeNull();
    expect(aviso.parentElement?.classList.contains('bento-grid')).toBe(false);
    expect(el.textContent).toContain('Ingresos por Categoría');

    aviso
      .querySelector<HTMLButtonElement>('[data-llm-action="reintentar-reportes-contables"]')!
      .click();
    expect(reintentos).toHaveLength(1);
  });

  it('caso A: no suma el aviso de refresco, porque no quedan datos a los que referirse', () => {
    const { el, emptyState } = render({
      error: 'No se pudo cargar el reporte contable.',
      refreshFailed: true,
    });
    expect(el.querySelector('app-alert-card')).toBeNull();
    expect(emptyState()).not.toBeNull();
  });

  it('sin fallas no aparece ningún aviso y el vacío real se sigue diciendo', () => {
    const { el, emptyState } = render({ kpis: KPIS });
    expect(el.querySelector('app-alert-card')).toBeNull();
    expect(emptyState()?.getAttribute('message')).toBe('Sin ingresos en este período');
  });

  it('un error solo de Evolución se ve en su pestaña y no en las demás', () => {
    const mensaje = 'No se pudo cargar la evolución mensual.';
    const { fixture, el, emptyState } = render({ kpis: KPIS, evolucionError: mensaje });
    expect(emptyState()?.['message']).not.toBe(mensaje);

    fixture.componentInstance['setActiveTab']('evolucion');
    fixture.detectChanges();
    expect(emptyState()?.['message']).toBe(mensaje);
    expect(emptyState()?.getAttribute('actionLabel')).toBe('Reintentar');
    expect(el.querySelector('app-evolucion-mensual-chart')).toBeNull();
  });

  it('una serie todavía sin cargar no dice "Sin movimientos"', () => {
    const { fixture, el, emptyState } = render({ kpis: KPIS, evolucionMensual: [] });
    fixture.componentInstance['setActiveTab']('evolucion');
    fixture.detectChanges();
    expect(emptyState()).toBeNull();
    expect(el.querySelector('app-skeleton-block')).not.toBeNull();
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

  describe('rango invertido (fix-080-i, H04)', () => {
    it('con Desde posterior a Hasta marca el rango invertido y no emite filtros', () => {
      const gral: unknown[] = [];
      component.aplicarFiltros.subscribe((v) => gral.push(v));
      component['onRangoChange']('personalizado');

      component['onCustomDateChange']('desde', '2026-11-30');
      component['onCustomDateChange']('hasta', '2026-11-01');

      expect(component['rangoInvertido']()).toBe(true);
      expect(gral).toEqual([]);
    });

    it('al corregir las fechas deja de estar invertido y emite los filtros', () => {
      const gral: { desde: string; hasta: string }[] = [];
      component.aplicarFiltros.subscribe((v) => gral.push(v));
      component['onRangoChange']('personalizado');
      component['onCustomDateChange']('desde', '2026-11-30');
      component['onCustomDateChange']('hasta', '2026-11-01');

      component['onCustomDateChange']('desde', '2026-11-01');
      component['onCustomDateChange']('hasta', '2026-11-30');

      expect(component['rangoInvertido']()).toBe(false);
      expect(gral.at(-1)).toEqual(
        expect.objectContaining({ desde: '2026-11-01', hasta: '2026-11-30' }),
      );
    });

    it('fuera de "Personalizado" nunca está invertido', () => {
      expect(component['rangoInvertido']()).toBe(false);
    });
  });

  describe('restablecer filtros (fix-081-i, H22)', () => {
    it('con los valores iniciales no hay nada que restablecer', () => {
      expect(component['filtrosModificados']()).toBe(false);
    });

    it('un período distinto de "Mes actual" activa el botón y restablecer emite mes_actual', () => {
      setFiltros('mes_anterior');
      const gral: { rango: string }[] = [];
      const evo: string[] = [];
      component.aplicarFiltros.subscribe((v) => gral.push(v));
      component.aplicarRangoEvolucion.subscribe((v) => evo.push(v));
      expect(component['filtrosModificados']()).toBe(true);

      component['restablecerFiltros']();

      expect(gral).toHaveLength(1);
      expect(gral[0].rango).toBe('mes_actual');
      expect(evo).toEqual([]); // la ventana de Evolución ya estaba en su valor inicial
      expect(component['localRango']()).toBe('mes_actual');
    });

    it('una ventana de Evolución distinta activa el botón y restablecer emite solo esa', () => {
      setRangoEvolucion('anio_anterior');
      const gral: unknown[] = [];
      const evo: string[] = [];
      component.aplicarFiltros.subscribe((v) => gral.push(v));
      component.aplicarRangoEvolucion.subscribe((v) => evo.push(v));
      expect(component['filtrosModificados']()).toBe(true);

      component['restablecerFiltros']();

      expect(evo).toEqual(['ultimos_6_meses']);
      expect(gral).toEqual([]);
    });

    it('elegir "Personalizado" sin fechas completas ya cuenta como modificado', () => {
      component['onRangoChange']('personalizado');
      expect(component['filtrosModificados']()).toBe(true);
    });
  });

  it('la etiqueta de la ventana refleja la opción elegida', () => {
    component['setActiveTab']('evolucion');
    component['onSelectChange']('ultimos_12_meses');
    expect(component['evolucionRangoLabel']()).toBe('últimos 12 meses');
    component['onSelectChange']('anio_anterior');
    expect(component['evolucionRangoLabel']()).toBe(`año ${new Date().getFullYear() - 1}`);
  });
});
