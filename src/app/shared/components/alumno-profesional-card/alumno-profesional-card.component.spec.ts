import { TestBed } from '@angular/core/testing';
import { AlumnoProfesionalCardComponent } from './alumno-profesional-card.component';

describe('AlumnoProfesionalCardComponent', () => {
  // fix-335-m (H02 / S17): sin `?enrollment=` la ficha abre la matrícula más reciente, que para
  // una persona con Clase B posterior es la B — y "volver" lleva a la Base B.
  // Los tests de template están excluidos de Vitest (ver vitest.config.ts): se prueba la decisión;
  // el binding del template se verifica en navegador (fix.md).
  it('"Ver ficha" manda la matrícula de la tarjeta', () => {
    TestBed.overrideComponent(AlumnoProfesionalCardComponent, { set: { template: '' } });
    const c = TestBed.createComponent(AlumnoProfesionalCardComponent).componentInstance as any;
    // En JIT los signal inputs no se pueden escribir: se sustituye el input requerido.
    Object.defineProperty(c, 'alumno', { value: () => ({ id: '7335', enrollmentId: 6984 }) });

    expect(c.fichaQueryParams()).toEqual({ enrollment: 6984 });
  });
});
