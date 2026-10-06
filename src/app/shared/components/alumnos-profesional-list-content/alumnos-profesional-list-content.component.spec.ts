import { TestBed } from '@angular/core/testing';
import { AlumnosProfesionalListContentComponent } from './alumnos-profesional-list-content.component';

/**
 * fix-328-m (D1): el botón "Pre-inscritos" del hero embebía el módulo completo (bloqueado en el
 * piloto por fix-256-m) dentro de la Base Profesional, saltándose el guard de su ruta.
 */
describe('AlumnosProfesionalListContentComponent — acciones del hero (fix-328-m)', () => {
  function create(): any {
    TestBed.overrideComponent(AlumnosProfesionalListContentComponent, { set: { template: '' } });
    return TestBed.createComponent(AlumnosProfesionalListContentComponent).componentInstance as any;
  }

  // fix-329-m (D2): en Profesional solo hay matrículas activas; un filtro de estado con una única
  // opción ("Activo") no filtra nada, y "Inactivo"/"Retirado" nunca tenían datos.
  it('no ofrece filtro de estado (no hay estados que filtrar)', () => {
    const c = create();
    expect(c.estadoOptions).toBeUndefined();
    c.searchTerm = '';
    c.selectedClase = '';
    expect(c.hasActiveFilters()).toBe(false);
  });

  // fix-331-m (D10): una fila por matrícula (un alumno con A2 y A4 sale dos veces), así que el
  // total cuenta matrículas y debe decirlo.
  it('el chip y el KPI de total cuentan matrículas, no alumnos', () => {
    const c = create();
    // En JIT los signal inputs no se pueden escribir: se sustituye el input requerido.
    Object.defineProperty(c, 'alumnos', { value: () => [] });
    expect(c.heroChips()[0].label).toBe('0 matrículas');
    const kpis = c.heroKpis() as { id: string; label: string }[];
    expect(kpis.find((k) => k.id === 'total')?.label).toBe('Matrículas');
    expect(kpis.find((k) => k.id === 'activos')?.label).toBe('Activas');
  });

  // fix-332-m (D12): asistencia y módulos salen de Asistencia/Evaluaciones Profesional, bloqueados
  // en el piloto: siempre "Sin datos" y 0/7. Se ocultan en vez de mostrarse vacíos.
  it('en el piloto no tiene columnas Módulos ni Asistencia, ni el KPI "En riesgo"', () => {
    const c = create();
    Object.defineProperty(c, 'alumnos', { value: () => [] });
    const cols = (c.sortColumns as { value: string }[]).map((col) => col.value);
    expect(cols).not.toContain('modulos');
    expect(cols).not.toContain('asistencia');
    expect(cols).toContain('promocion');
    expect((c.heroKpis() as { id: string }[]).map((k) => k.id)).not.toContain('riesgo');
  });

  it('en el piloto no ofrece "Pre-inscritos"; sí la Papelera', () => {
    const ids = (create().heroActions() as { id: string }[]).map((a) => a.id);
    expect(ids).not.toContain('preinscritos');
    expect(ids).toContain('papelera');
  });
});

// fix-335-m (H02 / S17): sin `?enrollment=` la ficha abre la matrícula más reciente; a una persona
// con una Clase B posterior le abría la B (y "volver" llevaba a la Base B). Igual que la Base B
// desde fix-272-m, la fila dice sobre qué matrícula se hizo clic.
// fix-338-m (F07 / S14): si la carga falla y no hay filas, no es "no hay alumnos · Limpiar
// filtros": es un error con "Reintentar" (patrón de app-alumnos-list-content, hotfix-113-m).
describe('AlumnosProfesionalListContentComponent — error de carga (fix-338-m)', () => {
  function create(error: string | null, alumnos: unknown[]): any {
    TestBed.overrideComponent(AlumnosProfesionalListContentComponent, { set: { template: '' } });
    const c = TestBed.createComponent(AlumnosProfesionalListContentComponent)
      .componentInstance as any;
    Object.defineProperty(c, 'alumnos', { value: () => alumnos });
    Object.defineProperty(c, 'error', { value: () => error });
    return c;
  }

  it('con error y sin filas muestra el error, no la lista vacía', () => {
    expect(create('Error al cargar alumnos profesionales', []).showLoadError()).toBe(true);
  });

  it('sin error, una lista vacía sigue siendo lista vacía', () => {
    expect(create(null, []).showLoadError()).toBe(false);
  });

  it('si hay filas (datos previos), un error de refresco no las tapa', () => {
    expect(create('Error', [{ id: '1' }]).showLoadError()).toBe(false);
  });

  it('"Reintentar" pide recargar', () => {
    const c = create('Error', []);
    const spy = vi.fn();
    c.refreshRequested.subscribe(spy);
    c.retryLoad();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// Los tests de template están excluidos de Vitest (ver vitest.config.ts): se prueba la decisión;
// el binding del template se verifica en navegador (fix.md).
describe('AlumnosProfesionalListContentComponent — "Ver ficha" (fix-335-m)', () => {
  it('"Ver ficha" manda la matrícula de la fila (2 filas de la misma persona → 2 matrículas)', () => {
    TestBed.overrideComponent(AlumnosProfesionalListContentComponent, { set: { template: '' } });
    const c = TestBed.createComponent(AlumnosProfesionalListContentComponent)
      .componentInstance as any;

    expect(c.fichaQueryParams({ id: '7334', enrollmentId: 6982 })).toEqual({ enrollment: 6982 });
    expect(c.fichaQueryParams({ id: '7334', enrollmentId: 6983 })).toEqual({ enrollment: 6983 });
  });
});
