import { TestBed } from '@angular/core/testing';
import { PromocionDetalleContentComponent } from './promocion-detalle-content.component';

/**
 * fix-326-m: contenido de "Ver promoción" extraído para reutilizarlo en Archivo. Se prueban las
 * decisiones del componente (no los bindings): expandir/colapsar alumnos, porcentaje de cupo y
 * traducción de estados.
 */
describe('PromocionDetalleContentComponent (fix-326-m)', () => {
  function create(): any {
    TestBed.overrideComponent(PromocionDetalleContentComponent, { set: { template: '' } });
    return TestBed.createComponent(PromocionDetalleContentComponent).componentInstance as any;
  }

  it('expande y colapsa la lista de alumnos de cada curso por separado', () => {
    const c = create();
    expect(c.isExpanded(10)).toBe(false);
    c.toggleStudents(10);
    expect(c.isExpanded(10)).toBe(true);
    expect(c.isExpanded(11)).toBe(false);
    c.toggleStudents(10);
    expect(c.isExpanded(10)).toBe(false);
  });

  it('porcentaje de cupo redondeado, 0 si el curso no tiene cupo', () => {
    const c = create();
    expect(c.enrollPercent({ enrolledStudents: 5, maxStudents: 25 })).toBe(20);
    expect(c.enrollPercent({ enrolledStudents: 3, maxStudents: 0 })).toBe(0);
  });

  it('traduce el estado de la matrícula (completado en promociones finalizadas)', () => {
    const c = create();
    expect(c.enrollStatusLabel('active')).toBe('Activo');
    expect(c.enrollStatusLabel('completed')).toBe('Completado');
  });

  it('estado de la promoción: finalizada se muestra como "Finalizada"', () => {
    const c = create();
    expect(c.statusCfg('finished').label).toBe('Finalizada');
    expect(c.statusCfg('desconocido').label).toBe('Planificada');
  });
});
