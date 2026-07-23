import { TestBed } from '@angular/core/testing';
import { AdminExAlumnosComentariosDrawerComponent } from './admin-ex-alumnos-comentarios-drawer.component';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import type { ComentarioMock } from './admin-ex-alumnos-comentarios-drawer.component';

function makeComentarios(n: number): ComentarioMock[] {
  return Array.from({ length: n }, (_, i) => ({
    iniciales: 'AA',
    nombre: `Alumno ${i}`,
    rating: (i % 5) + 1,
    texto: `Comentario número ${i}`,
  }));
}

describe('AdminExAlumnosComentariosDrawerComponent', () => {
  let component: AdminExAlumnosComentariosDrawerComponent;
  let facadeSpy: any;

  function setup(comentarios: ComentarioMock[]): void {
    facadeSpy = {
      surveys: vi.fn().mockReturnValue(comentarios),
      avgSatisfaction: vi.fn().mockReturnValue(4.2),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminExAlumnosComentariosDrawerComponent,
        { provide: ExAlumnosFacade, useValue: facadeSpy },
      ],
    });

    component = TestBed.inject(AdminExAlumnosComentariosDrawerComponent);
  }

  it('should be created', () => {
    setup([]);
    expect(component).toBeTruthy();
  });

  it('muestra solo la primera página (12) cuando hay más opiniones que el paso', () => {
    setup(makeComentarios(30));
    expect((component as any).visibleComentarios().length).toBe(12);
    expect((component as any).hasMore()).toBe(true);
  });

  it('no pagina si hay menos opiniones que el paso', () => {
    setup(makeComentarios(5));
    expect((component as any).visibleComentarios().length).toBe(5);
    expect((component as any).hasMore()).toBe(false);
  });

  it('filtra por nombre', () => {
    setup(makeComentarios(20));
    (component as any).onSearchChange('Alumno 3');
    const results = (component as any).filteredComentarios();
    expect(results.every((c: ComentarioMock) => c.nombre.includes('Alumno 3'))).toBe(true);
  });

  it('filtra por comentario (texto)', () => {
    setup(makeComentarios(20));
    (component as any).onSearchChange('número 7');
    const results = (component as any).filteredComentarios();
    expect(results.length).toBe(1);
    expect(results[0].texto).toContain('número 7');
  });

  it('filtra incluyendo coincidencias por rating (no solo nombre/texto)', () => {
    // rating = (i % 5) + 1; solo i=4 (rating 5) no contiene "5" ni en nombre ni en texto.
    setup([{ iniciales: 'AA', nombre: 'Zzz', rating: 5, texto: 'sin coincidencia' }]);
    (component as any).onSearchChange('5');
    const results = (component as any).filteredComentarios();
    expect(results.length).toBe(1);
    expect(results[0].rating).toBe(5);
  });

  it('resetea la paginación al cambiar la búsqueda', () => {
    setup(makeComentarios(30));
    (component as any).onScroll({
      target: { scrollTop: 1000, clientHeight: 500, scrollHeight: 1200 },
    } as unknown as Event);
    expect((component as any).visibleComentarios().length).toBe(24);

    (component as any).onSearchChange('Alumno 1');
    expect((component as any).visibleComentarios().length).toBeLessThanOrEqual(12);
  });

  it('revela más opiniones al hacer scroll cerca del fondo', () => {
    setup(makeComentarios(30));
    expect((component as any).visibleComentarios().length).toBe(12);

    (component as any).onScroll({
      target: { scrollTop: 1000, clientHeight: 500, scrollHeight: 1200 },
    } as unknown as Event);

    expect((component as any).visibleComentarios().length).toBe(24);
  });

  it('no revela más si el scroll no está cerca del fondo', () => {
    setup(makeComentarios(30));
    (component as any).onScroll({
      target: { scrollTop: 0, clientHeight: 500, scrollHeight: 1200 },
    } as unknown as Event);
    expect((component as any).visibleComentarios().length).toBe(12);
  });

  it('no revela más allá del total filtrado al llegar al final', () => {
    setup(makeComentarios(14));
    (component as any).onScroll({
      target: { scrollTop: 1000, clientHeight: 500, scrollHeight: 1200 },
    } as unknown as Event);
    expect((component as any).visibleComentarios().length).toBe(14);
    expect((component as any).hasMore()).toBe(false);
  });
});
