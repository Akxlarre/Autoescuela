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

  it('en el piloto no ofrece "Pre-inscritos"; sí la Papelera', () => {
    const ids = (create().heroActions() as { id: string }[]).map((a) => a.id);
    expect(ids).not.toContain('preinscritos');
    expect(ids).toContain('papelera');
  });
});
