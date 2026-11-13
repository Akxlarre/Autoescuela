import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminCursoSingularCobroDrawerComponent } from './admin-curso-singular-cobro-drawer.component';
import { CursosSingularesFacade } from '@core/facades/cursos-singulares.facade';
import type { InscriptoCursoSingular } from '@core/models/ui/cursos-singulares.model';

/**
 * fix-075-i (S9): "Marcar cobrado" pregunta con qué se pagó antes de registrar el cobro. Sin el
 * medio de pago la Caja Diaria sumaba el cobro al total pero a ninguna columna.
 */
describe('AdminCursoSingularCobroDrawerComponent — cobro con medio de pago (fix-075-i)', () => {
  let component: any;
  let marcar: ReturnType<typeof vi.fn>;
  const alumno = { enrollmentId: 10, montoAPagar: 220000 } as InscriptoCursoSingular;

  beforeEach(() => {
    marcar = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CursosSingularesFacade,
          useValue: {
            marcarEnrollmentPagado: marcar,
            isSaving: signal(false),
            inscriptos: signal([]),
            error: signal(null),
          },
        },
      ],
    });
    component = TestBed.runInInjectionContext(() => new AdminCursoSingularCobroDrawerComponent());
  });

  it('"Marcar cobrado" abre la elección del medio de pago sin registrar nada todavía', () => {
    component.onIniciarCobro(alumno);
    expect(component.cobrandoId()).toBe(10);
    expect(component.metodo()).toBe('efectivo');
    expect(marcar).not.toHaveBeenCalled();
  });

  it('al confirmar registra el cobro con el medio elegido y cierra la elección', async () => {
    component.onIniciarCobro(alumno);
    component.metodo.set('tarjeta');
    await component.onConfirmarCobro(alumno);
    expect(marcar).toHaveBeenCalledWith(10, 'tarjeta');
    expect(component.cobrandoId()).toBeNull();
  });

  it('si el cobro falla (p. ej. caja cerrada) la elección queda abierta para reintentar', async () => {
    marcar.mockResolvedValue(false);
    component.onIniciarCobro(alumno);
    await component.onConfirmarCobro(alumno);
    expect(component.cobrandoId()).toBe(10);
  });

  it('cancelar cierra la elección sin registrar', () => {
    component.onIniciarCobro(alumno);
    component.onCancelarCobro();
    expect(component.cobrandoId()).toBeNull();
    expect(marcar).not.toHaveBeenCalled();
  });
});
