import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { pilotPhaseGuard } from './pilot-phase.guard';

describe('pilotPhaseGuard (fix-255-m)', () => {
  let routerSpy: any;

  beforeEach(() => {
    routerSpy = { createUrlTree: vi.fn((cmds: string[]) => ({ __urlTree: cmds })) };
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: routerSpy }],
    });
  });

  function run(module: 'instructor' | 'alumno' | 'inscripcion-publica') {
    return TestBed.runInInjectionContext(() => pilotPhaseGuard(module)({} as any, {} as any));
  }

  it('módulo bloqueado (instructor) → redirige a /modulo-no-disponible', () => {
    const result = run('instructor');
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/modulo-no-disponible']);
    expect(result).toEqual({ __urlTree: ['/modulo-no-disponible'] });
  });

  it('módulo bloqueado (alumno) → redirige a /modulo-no-disponible', () => {
    run('alumno');
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/modulo-no-disponible']);
  });

  it('módulo bloqueado (inscripcion-publica) → redirige a /modulo-no-disponible', () => {
    run('inscripcion-publica');
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/modulo-no-disponible']);
  });
});
