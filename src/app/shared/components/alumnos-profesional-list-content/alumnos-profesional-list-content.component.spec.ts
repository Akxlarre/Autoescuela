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
