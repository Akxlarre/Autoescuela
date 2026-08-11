import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EvaluacionesProfesionalContentComponent } from './evaluaciones-profesional-content.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import type {
  FilaEvaluacion,
  GrillaEvaluacion,
  PromocionConCursos,
} from '@core/models/ui/evaluaciones-profesional.model';

function makePromo(over: Partial<PromocionConCursos> = {}): PromocionConCursos {
  return {
    id: 1,
    name: 'Promoción 1',
    code: 'P1',
    status: 'in_progress',
    cursos: [],
    totalAlumnos: 0,
    cursosConfirmados: 0,
    ...over,
  };
}

function makeFila(over: Partial<FilaEvaluacion> = {}): FilaEvaluacion {
  return {
    enrollmentId: 1,
    nombre: 'Juan Perez',
    rut: '11.111.111-1',
    initials: 'JP',
    notas: Array.from({ length: 7 }, () => ({
      grade: null,
      passed: null,
      status: 'draft' as const,
      gradeId: null,
      dirty: false,
    })),
    promedio: null,
    promedioAprobado: null,
    ...over,
  };
}

function makeGrilla(over: Partial<GrillaEvaluacion> = {}): GrillaEvaluacion {
  return {
    promotionCourseId: 1,
    promotionName: 'Promoción 1',
    courseName: 'Curso A2',
    licenseClass: 'A2',
    moduleNames: Array.from({ length: 7 }, (_, i) => `Módulo ${i + 1}`),
    totalAlumnos: 1,
    filas: [makeFila()],
    confirmed: false,
    ...over,
  };
}

describe('EvaluacionesProfesionalContentComponent', () => {
  let component: EvaluacionesProfesionalContentComponent;
  let confirmModal: { confirm: ReturnType<typeof vi.fn> };

  /** Signal inputs no son escribibles directo en JIT — se stubean con signal() locales. */
  const stubInput = <T>(name: string, initial: T) => {
    const s = signal<T>(initial);
    Object.defineProperty(component, name, { value: s });
    return s;
  };

  let grillaSig: ReturnType<typeof stubInput<GrillaEvaluacion | null>>;
  let landingSig: ReturnType<typeof stubInput<PromocionConCursos[]>>;
  let isDesktopLayoutSig: ReturnType<typeof stubInput<boolean>>;

  beforeEach(() => {
    confirmModal = { confirm: vi.fn() };
    TestBed.configureTestingModule({
      imports: [EvaluacionesProfesionalContentComponent],
      providers: [
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
        { provide: ConfirmModalService, useValue: confirmModal },
      ],
    });
    component = TestBed.createComponent(EvaluacionesProfesionalContentComponent).componentInstance;
    landingSig = stubInput<PromocionConCursos[]>('landing', []);
    stubInput('landingLoaded', true);
    grillaSig = stubInput<GrillaEvaluacion | null>('grilla', null);
    stubInput<number | null>('selectedCursoId', null);
    isDesktopLayoutSig = stubInput('isDesktopLayout', true);
    stubInput('isLoading', false);
    stubInput('isSaving', false);
    stubInput('hayDirty', false);
  });

  describe('skeletonPromoGroups — cantidad de placeholders del skeleton de aterrizaje', () => {
    it('layout compacto: usa el default de 3 cuando no hay landing cacheado (primera carga real)', () => {
      isDesktopLayoutSig.set(false);
      expect((component as any).skeletonPromoGroups().length).toBe(3);
    });

    it('layout compacto: replica la cantidad exacta cuando ya hay landing cacheado (revisita con SWR)', () => {
      isDesktopLayoutSig.set(false);
      landingSig.set([
        makePromo({ id: 1 }),
        makePromo({ id: 2 }),
        makePromo({ id: 3 }),
        makePromo({ id: 4 }),
      ]);
      expect((component as any).skeletonPromoGroups().length).toBe(4);
    });

    it('layout desktop: nunca más de promoPageSize (2), aunque haya más cacheadas', () => {
      isDesktopLayoutSig.set(true);
      landingSig.set([
        makePromo({ id: 1 }),
        makePromo({ id: 2 }),
        makePromo({ id: 3 }),
        makePromo({ id: 4 }),
      ]);
      expect((component as any).skeletonPromoGroups().length).toBe(2);
    });

    it('layout desktop: usa promoPageSize (2) como default sin landing cacheado', () => {
      isDesktopLayoutSig.set(true);
      expect((component as any).skeletonPromoGroups().length).toBe(2);
    });

    it('replica incluso 1 sola promoción cacheada, no el default', () => {
      landingSig.set([makePromo({ id: 1 })]);
      expect((component as any).skeletonPromoGroups().length).toBe(1);
    });
  });

  describe('visibleLanding — paginación del aterrizaje por layout', () => {
    const promos = [
      makePromo({ id: 1 }),
      makePromo({ id: 2 }),
      makePromo({ id: 3 }),
      makePromo({ id: 4 }),
      makePromo({ id: 5 }),
    ];

    it('desktop: pagina de a 2 (promoPageSize), primera página', () => {
      landingSig.set(promos);
      isDesktopLayoutSig.set(true);
      expect((component as any).visibleLanding().map((p: any) => p.id)).toEqual([1, 2]);
    });

    it('desktop: avanzar de página muestra el siguiente bloque de 2', () => {
      landingSig.set(promos);
      isDesktopLayoutSig.set(true);
      (component as any).onPromoPageChange({ page: 1 });
      expect((component as any).visibleLanding().map((p: any) => p.id)).toEqual([3, 4]);
    });

    it('desktop: última página parcial muestra el resto (5 items / 2 por página → 1 en la última)', () => {
      landingSig.set(promos);
      isDesktopLayoutSig.set(true);
      (component as any).onPromoPageChange({ page: 2 });
      expect((component as any).visibleLanding().map((p: any) => p.id)).toEqual([5]);
    });

    it('layout compacto (drawer abierto): muestra TODAS sin paginar, aunque haya más de 2', () => {
      landingSig.set(promos);
      isDesktopLayoutSig.set(false);
      expect((component as any).visibleLanding().length).toBe(5);
    });

    it('safePromoPage se acota si el layout cambia a uno con menos páginas totales', () => {
      landingSig.set(promos);
      isDesktopLayoutSig.set(true);
      (component as any).onPromoPageChange({ page: 2 }); // última página (5 items → 3 páginas)
      landingSig.set([makePromo({ id: 1 }), makePromo({ id: 2 })]); // ahora solo 1 página
      expect((component as any).visibleLanding().map((p: any) => p.id)).toEqual([1, 2]);
    });
  });

  describe('promedioVariant', () => {
    it('default cuando no hay grilla / promedio null', () => {
      expect((component as any).promedioVariant()).toBe('default');
    });

    it('success cuando el promedio del curso es >= 75 (GRADE_PASS)', () => {
      grillaSig.set(makeGrilla({ filas: [makeFila({ promedio: 80, promedioAprobado: true })] }));
      expect((component as any).promedioVariant()).toBe('success');
    });

    it('error cuando el promedio del curso es < 75', () => {
      grillaSig.set(makeGrilla({ filas: [makeFila({ promedio: 60, promedioAprobado: false })] }));
      expect((component as any).promedioVariant()).toBe('error');
    });
  });

  describe('hero computed', () => {
    it('sin grilla: title/subtitle/contextLine por defecto, sin chips', () => {
      expect((component as any).heroTitle()).toBe('Evaluaciones');
      expect((component as any).heroSubtitle()).toContain('Registro de notas por módulo');
      expect((component as any).heroContextLine()).toBe('');
      expect((component as any).heroChips()).toEqual([]);
    });

    it('con grilla no confirmada: título = nombre del curso, chip "En edición"', () => {
      grillaSig.set(makeGrilla({ courseName: 'Curso A2', confirmed: false }));
      expect((component as any).heroTitle()).toBe('Curso A2');
      expect((component as any).heroChips()).toEqual([
        { label: 'En edición', icon: 'edit-3', style: 'warning' },
      ]);
    });

    it('con grilla no confirmada y cambios sin guardar: agrega chip extra', () => {
      grillaSig.set(makeGrilla({ confirmed: false }));
      stubInput('hayDirty', true);
      expect((component as any).heroChips()).toEqual([
        { label: 'En edición', icon: 'edit-3', style: 'warning' },
        { label: 'Cambios sin guardar', icon: 'circle', style: 'warning' },
      ]);
    });

    it('con grilla confirmada: chip "Confirmadas"', () => {
      grillaSig.set(makeGrilla({ confirmed: true }));
      expect((component as any).heroChips()).toEqual([
        { label: 'Confirmadas', icon: 'lock', style: 'success' },
      ]);
    });
  });

  describe('estadoBadge* (tarjetas del aterrizaje)', () => {
    it('confirmada → success / check-circle / "Confirmada"', () => {
      expect((component as any).estadoBadgeVariant('confirmada')).toBe('success');
      expect((component as any).estadoBadgeIcon('confirmada')).toBe('check-circle');
      expect((component as any).estadoBadgeLabel('confirmada')).toBe('Confirmada');
    });

    it('en_edicion → warning / edit-3 / "En edición"', () => {
      expect((component as any).estadoBadgeVariant('en_edicion')).toBe('warning');
      expect((component as any).estadoBadgeIcon('en_edicion')).toBe('edit-3');
      expect((component as any).estadoBadgeLabel('en_edicion')).toBe('En edición');
    });

    it('sin_iniciar → neutral / clock / "Sin iniciar"', () => {
      expect((component as any).estadoBadgeVariant('sin_iniciar')).toBe('neutral');
      expect((component as any).estadoBadgeIcon('sin_iniciar')).toBe('clock');
      expect((component as any).estadoBadgeLabel('sin_iniciar')).toBe('Sin iniciar');
    });
  });

  describe('promoStatus*', () => {
    it('in_progress → brand / "En curso"', () => {
      expect((component as any).promoStatusVariant('in_progress')).toBe('brand');
      expect((component as any).promoStatusLabel('in_progress')).toBe('En curso');
    });

    it('cualquier otro estado → neutral / "Planificada"', () => {
      expect((component as any).promoStatusVariant('planned')).toBe('neutral');
      expect((component as any).promoStatusLabel('planned')).toBe('Planificada');
    });
  });

  describe('clases de celda de nota', () => {
    it('getInputClasses: null → clase neutra', () => {
      expect((component as any).getInputClasses(null)).toContain('bg-surface');
    });

    it('getInputClasses: >= GRADE_PASS → clase success', () => {
      expect((component as any).getInputClasses(80)).toContain('success');
    });

    it('getInputClasses: < GRADE_PASS → clase error', () => {
      expect((component as any).getInputClasses(60)).toContain('error');
    });

    it('getReadonlyClasses: passed true/false/null', () => {
      expect((component as any).getReadonlyClasses(true)).toContain('success');
      expect((component as any).getReadonlyClasses(false)).toContain('error');
      expect((component as any).getReadonlyClasses(null)).toContain('bg-surface');
    });

    it('promedioBadgeVariant: passed true/false/null', () => {
      expect((component as any).promedioBadgeVariant(true)).toBe('success');
      expect((component as any).promedioBadgeVariant(false)).toBe('error');
      expect((component as any).promedioBadgeVariant(null)).toBe('neutral');
    });
  });

  describe('todasConNota', () => {
    it('false si no hay grilla', () => {
      expect((component as any).todasConNota()).toBe(false);
    });

    it('false si alguna nota está sin registrar', () => {
      grillaSig.set(
        makeGrilla({
          filas: [
            makeFila({
              notas: [{ grade: null, passed: null, status: 'draft', gradeId: null, dirty: false }],
            }),
          ],
        }),
      );
      expect((component as any).todasConNota()).toBe(false);
    });

    it('true si todas las notas de todas las filas tienen grade', () => {
      grillaSig.set(
        makeGrilla({
          filas: [
            makeFila({
              notas: Array.from({ length: 7 }, () => ({
                grade: 80,
                passed: true,
                status: 'draft' as const,
                gradeId: null,
                dirty: false,
              })),
            }),
          ],
        }),
      );
      expect((component as any).todasConNota()).toBe(true);
    });
  });

  describe('onGradeChange — normalización de input', () => {
    it('emite gradeChanged con number cuando llega un number', () => {
      const spy = vi.fn();
      component.gradeChanged.subscribe(spy);
      (component as any).onGradeChange(1, 0, 85);
      expect(spy).toHaveBeenCalledWith({ enrollmentId: 1, moduleIndex: 0, value: 85 });
    });

    it('normaliza string numérico a number', () => {
      const spy = vi.fn();
      component.gradeChanged.subscribe(spy);
      (component as any).onGradeChange(1, 0, '85');
      expect(spy).toHaveBeenCalledWith({ enrollmentId: 1, moduleIndex: 0, value: 85 });
    });

    it('normaliza "" y null a null', () => {
      const spy = vi.fn();
      component.gradeChanged.subscribe(spy);
      (component as any).onGradeChange(1, 0, '');
      (component as any).onGradeChange(1, 0, null);
      expect(spy).toHaveBeenNthCalledWith(1, { enrollmentId: 1, moduleIndex: 0, value: null });
      expect(spy).toHaveBeenNthCalledWith(2, { enrollmentId: 1, moduleIndex: 0, value: null });
    });

    it('un string no numérico se normaliza a null', () => {
      const spy = vi.fn();
      component.gradeChanged.subscribe(spy);
      (component as any).onGradeChange(1, 0, 'abc');
      expect(spy).toHaveBeenCalledWith({ enrollmentId: 1, moduleIndex: 0, value: null });
    });
  });

  describe('acciones — emiten output, no llaman Facade (Dumb puro)', () => {
    it('onCursoSelect emite cursoSelected con el promotionCourseId', () => {
      const spy = vi.fn();
      component.cursoSelected.subscribe(spy);
      (component as any).onCursoSelect(42);
      expect(spy).toHaveBeenCalledWith(42);
    });

    it('voltearAterrizaje emite volverAterrizaje', () => {
      const spy = vi.fn();
      component.volverAterrizaje.subscribe(spy);
      (component as any).voltearAterrizaje();
      expect(spy).toHaveBeenCalled();
    });

    it('guardarBorrador emite guardarBorradorRequested', () => {
      const spy = vi.fn();
      component.guardarBorradorRequested.subscribe(spy);
      (component as any).guardarBorrador();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('confirmarNotas — gate del ConfirmModalService', () => {
    it('emite confirmarNotasRequested solo si el usuario confirma', async () => {
      confirmModal.confirm.mockResolvedValue(true);
      const spy = vi.fn();
      component.confirmarNotasRequested.subscribe(spy);
      await (component as any).confirmarNotas();
      expect(spy).toHaveBeenCalled();
    });

    it('no emite nada si el usuario cancela', async () => {
      confirmModal.confirm.mockResolvedValue(false);
      const spy = vi.fn();
      component.confirmarNotasRequested.subscribe(spy);
      await (component as any).confirmarNotas();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
