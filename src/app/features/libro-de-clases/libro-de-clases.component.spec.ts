import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LibroDeClasesComponent } from './libro-de-clases.component';
import { LibroDeClasesFacade } from '@core/facades/libro-de-clases.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SemanaAsistencia } from '@core/models/ui/libro-de-clases.model';

// Paginación de "Control de Asistencia (Firma Diaria)" por semana (spec 0005-i, AC3): reemplaza
// el listado de todas las semanas apiladas. Estado de UI puro en el Smart Component — no toca el
// Facade, así que estos tests instancian el componente directo con `runInInjectionContext` (mismo
// patrón que `admin-contabilidad-cuadratura.component.spec.ts`) para no depender del template
// completo (PrimeNG + varios Dumb components no compilan en el pipeline de Vitest del proyecto).
function buildSemana(weekStartDate: string, weekLabel: string): SemanaAsistencia {
  return {
    weekStartDate,
    weekLabel,
    dias: [],
    alumnos: [],
  } as unknown as SemanaAsistencia;
}

describe('LibroDeClasesComponent — paginación de Asistencia por semana (spec 0005-i)', () => {
  let asistenciaSemanalSignal: ReturnType<typeof signal<SemanaAsistencia[]>>;

  function setup(semanas: SemanaAsistencia[]) {
    asistenciaSemanalSignal = signal(semanas);

    const facadeMock = {
      cabecera: () => null,
      asistenciaSemanal: asistenciaSemanalSignal,
      reset: vi.fn(),
      initialize: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: LibroDeClasesFacade, useValue: facadeMock },
        { provide: BranchFacade, useValue: { setProfessionalOnly: vi.fn() } },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
      ],
    });

    const component = TestBed.runInInjectionContext(() => new LibroDeClasesComponent());
    TestBed.tick();
    return component;
  }

  it('visibleWeek() devuelve la semana correcta según selectedWeekIndex()', () => {
    const semanas = [
      buildSemana('2026-08-03', 'Semana 1'),
      buildSemana('2026-08-10', 'Semana 2'),
      buildSemana('2026-08-17', 'Semana 3'),
    ];
    const component = setup(semanas);

    expect(component.visibleWeek()?.weekLabel).toBe('Semana 1');

    component['selectedWeekIndex'].set(2);
    TestBed.tick();
    expect(component.visibleWeek()?.weekLabel).toBe('Semana 3');
  });

  it('visibleWeek() y totalWeeks() manejan con gracia 0 semanas', () => {
    const component = setup([]);

    expect(component.totalWeeks()).toBe(0);
    expect(component.visibleWeek()).toBeNull();
  });

  it('weekNext()/weekPrev() no se salen de rango en los bordes', () => {
    const semanas = [buildSemana('2026-08-03', 'Semana 1'), buildSemana('2026-08-10', 'Semana 2')];
    const component = setup(semanas);

    // Borde inferior: weekPrev() en la primera semana no baja de 0.
    component.weekPrev();
    expect(component['selectedWeekIndex']()).toBe(0);

    // Avanza al final y confirma que no se pasa del último índice válido.
    component.weekNext();
    expect(component['selectedWeekIndex']()).toBe(1);
    component.weekNext();
    expect(component['selectedWeekIndex']()).toBe(1);
  });

  it('selectedWeekIndex() se resetea a 0 si cambian los datos de asistencia', () => {
    const semanasA = [
      buildSemana('2026-08-03', 'Semana 1'),
      buildSemana('2026-08-10', 'Semana 2'),
      buildSemana('2026-08-17', 'Semana 3'),
    ];
    const component = setup(semanasA);

    component['selectedWeekIndex'].set(2);
    TestBed.tick();
    expect(component['selectedWeekIndex']()).toBe(2);

    // Simula un cambio de curso/promoción: el Facade entrega un nuevo array de semanas.
    const semanasB = [buildSemana('2026-09-01', 'Semana 1 (otro curso)')];
    asistenciaSemanalSignal.set(semanasB);
    TestBed.tick();

    expect(component['selectedWeekIndex']()).toBe(0);
    expect(component.visibleWeek()?.weekLabel).toBe('Semana 1 (otro curso)');
  });
});
