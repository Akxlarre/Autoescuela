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

/**
 * fix-354-m: la vista de tarjetas pintaba todas las matrículas (65 → 22.000 px de alto) y la
 * animación de entrada montaba la lista sobre el hero. Ahora muestra de a 6, como la Base B.
 */
describe('AlumnosProfesionalListContentComponent — tarjetas de a 6 (fix-354-m)', () => {
  function create(total: number): any {
    TestBed.overrideComponent(AlumnosProfesionalListContentComponent, { set: { template: '' } });
    const c = TestBed.createComponent(AlumnosProfesionalListContentComponent)
      .componentInstance as any;
    const rows = Array.from({ length: total }, (_, i) => ({
      id: String(i),
      enrollmentId: i,
      nombre: `Nombre${i}`,
      apellido: `Apellido${i}`,
      rut: `${i}-K`,
      nroMatricula: String(i).padStart(4, '0'),
      licenseClass: i % 2 === 0 ? 'A2' : 'A4',
    }));
    Object.defineProperty(c, 'alumnos', { value: () => rows });
    return c;
  }

  it('muestra las primeras 6 y dice cuántas quedan', () => {
    const c = create(20);
    expect(c.visibleCards().length).toBe(6);
    expect(c.remainingCards()).toBe(14);
  });

  it('"Cargar más" suma 6 y nunca pasa del total', () => {
    const c = create(20);
    c.loadMoreCards();
    expect(c.visibleCards().length).toBe(12);
    c.loadMoreCards();
    c.loadMoreCards();
    expect(c.visibleCards().length).toBe(20);
    expect(c.remainingCards()).toBe(0);
  });

  it('con menos de 6 no queda nada por cargar', () => {
    const c = create(4);
    expect(c.visibleCards().length).toBe(4);
    expect(c.remainingCards()).toBe(0);
  });

  it('lo que queda se cuenta sobre la lista filtrada', () => {
    const c = create(20);
    c.selectedClase = 'A2';
    c.resetPagination();
    expect(c.visibleCards().length).toBe(6);
    expect(c.remainingCards()).toBe(4);
  });

  it('buscar, ordenar, limpiar filtros y cambiar a la Papelera vuelven a las primeras 6', () => {
    const c = create(20);
    const reset = [
      () => c.resetPagination(),
      () => c.toggleSort('alumno'),
      () => c.resetFilters(),
      () => c.handleHeroAction('papelera'),
    ];
    for (const action of reset) {
      c.loadMoreCards();
      expect(c.visibleCards().length).toBe(12);
      action();
      expect(c.visibleCards().length).toBe(6);
    }
  });
});

/** hotfix-147-m: textos del chip de total y del estado vacío. */
describe('AlumnosProfesionalListContentComponent — textos (hotfix-147-m)', () => {
  function create(total: number, trash = false): any {
    TestBed.overrideComponent(AlumnosProfesionalListContentComponent, { set: { template: '' } });
    const c = TestBed.createComponent(AlumnosProfesionalListContentComponent)
      .componentInstance as any;
    Object.defineProperty(c, 'alumnos', { value: () => Array.from({ length: total }, () => ({})) });
    Object.defineProperty(c, 'trashView', { value: () => trash });
    return c;
  }

  it('el chip de total usa singular con una sola matrícula', () => {
    expect(create(1).heroChips()[0].label).toBe('1 matrícula');
  });

  it('el chip de total usa plural con varias', () => {
    expect(create(2).heroChips()[0].label).toBe('2 matrículas');
  });

  it('con filtros puestos, la lista vacía ofrece limpiarlos', () => {
    const c = create(0);
    c.searchTerm = 'zzz';
    expect(c.emptyState().message).toBe('No se encontraron alumnos');
    expect(c.emptyState().actionLabel).toBe('Limpiar filtros');
  });

  it('la Papelera vacía lo dice y no ofrece limpiar filtros', () => {
    const c = create(0, true);
    c.searchTerm = '';
    c.selectedClase = '';
    expect(c.emptyState().message).toBe('No hay alumnos archivados');
    expect(c.emptyState().actionLabel).toBeUndefined();
  });

  it('la lista vacía sin filtros no ofrece limpiar filtros', () => {
    const c = create(0);
    c.searchTerm = '';
    c.selectedClase = '';
    expect(c.emptyState().message).toBe('Aún no hay alumnos profesionales');
    expect(c.emptyState().actionLabel).toBeUndefined();
  });
});
