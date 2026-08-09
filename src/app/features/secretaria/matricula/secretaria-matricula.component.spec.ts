import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { SecretariaMatriculaComponent } from './secretaria-matricula.component';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { EnrollmentFacade } from '@core/facades/enrollment.facade';
import { EnrollmentDocumentsFacade } from '@core/facades/enrollment-documents.facade';
import { EnrollmentPaymentFacade } from '@core/facades/enrollment-payment.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

// Nota: este componente usa `templateUrl`, y el pipeline de Vitest del proyecto no resuelve
// recursos externos (ver comentario en vitest.config.ts). Por eso el test instancia la clase
// directamente vía `runInInjectionContext` (constructor + effects) en vez de `TestBed.createComponent`,
// sin pasar por la compilación de plantilla — suficiente para probar la lógica reactiva del gate.
describe('SecretariaMatriculaComponent — branch-gate reactivity (fix-067)', () => {
  let branchFacade: BranchFacade;
  let enrollmentFacadeSpy: any;
  let component: SecretariaMatriculaComponent;

  beforeEach(async () => {
    enrollmentFacadeSpy = {
      currentStep: vi.fn().mockReturnValue(1),
      personalData: vi.fn().mockReturnValue(null),
      courseOptions: vi.fn().mockReturnValue([]),
      paymentMode: vi.fn().mockReturnValue('full'),
      enrollmentBasePrice: vi.fn().mockReturnValue(0),
      selectedInstructorId: vi.fn().mockReturnValue(null),
      scheduleGrid: vi.fn().mockReturnValue(null),
      activeDrafts: vi.fn().mockReturnValue([]),
      docsComplete: vi.fn().mockReturnValue(true),
      loadCourses: vi.fn().mockResolvedValue(undefined),
      loadInstructors: vi.fn().mockResolvedValue(undefined),
      loadScheduleGrid: vi.fn().mockResolvedValue(undefined),
      loadActiveDrafts: vi.fn().mockResolvedValue([]),
      reset: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: LayoutDrawerFacadeService,
          useValue: { setActions: vi.fn(), setBadge: vi.fn() },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        {
          provide: AuthFacade,
          useValue: {
            currentUser: vi.fn().mockReturnValue({ role: 'admin', branchId: null }),
            whenReady: Promise.resolve(),
          },
        },
        BranchFacade,
        { provide: SupabaseService, useValue: { client: {} } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
        { provide: EnrollmentFacade, useValue: enrollmentFacadeSpy },
        { provide: EnrollmentDocumentsFacade, useValue: { reset: vi.fn() } },
        { provide: EnrollmentPaymentFacade, useValue: { reset: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
      ],
    });

    branchFacade = TestBed.inject(BranchFacade);
    component = TestBed.runInInjectionContext(() => new SecretariaMatriculaComponent());

    component.ngOnInit(); // dispara initWizard() inicial
    TestBed.tick();
    // Deja resolver el `await this.auth.whenReady` + el chequeo de sede dentro de initWizard().
    await Promise.resolve();
    await Promise.resolve();
    TestBed.tick();
  });

  it('llega a branch-gate cuando el admin no tiene sede seleccionada', () => {
    expect(component.viewMode()).toBe('branch-gate');
  });

  it('avanza fuera de branch-gate cuando el topbar cambia la sede seleccionada', () => {
    const initWizardSpy = vi.spyOn(component as any, 'initWizard');

    // Simula el cambio de sede desde el selector del topbar (no desde las tarjetas del gate).
    branchFacade.selectBranch(3);
    TestBed.tick();

    expect(initWizardSpy).toHaveBeenCalled();
  });

  it('mientras el wizard ya está activo, el cambio de sede del topbar sigue recargando cursos (sin regresión)', () => {
    (component as any)._viewMode.set('wizard');
    branchFacade.selectBranch(1);
    TestBed.tick();

    enrollmentFacadeSpy.loadCourses.mockClear();

    branchFacade.selectBranch(2);
    TestBed.tick();

    expect(enrollmentFacadeSpy.loadCourses).toHaveBeenCalledWith(2);
  });
});

// Refuerzo Clase B (6 clases) nunca ofrece pago parcial — spec 0006-m, AC5.
describe('SecretariaMatriculaComponent — Refuerzo Clase B sin pago parcial (spec 0006-m)', () => {
  function setup(personalData: any, paymentMode: string | null) {
    const enrollmentFacadeSpy: any = {
      currentStep: vi.fn().mockReturnValue(2),
      personalData: vi.fn().mockReturnValue(personalData),
      courseOptions: vi.fn().mockReturnValue([]),
      paymentMode: vi.fn().mockReturnValue(paymentMode),
      setPaymentMode: vi.fn(),
      enrollmentBasePrice: vi.fn().mockReturnValue(0),
      selectedInstructorId: vi.fn().mockReturnValue(null),
      scheduleGrid: vi.fn().mockReturnValue(null),
      activeDrafts: vi.fn().mockReturnValue([]),
      docsComplete: vi.fn().mockReturnValue(true),
      loadCourses: vi.fn().mockResolvedValue(undefined),
      loadInstructors: vi.fn().mockResolvedValue(undefined),
      loadScheduleGrid: vi.fn().mockResolvedValue(undefined),
      loadActiveDrafts: vi.fn().mockResolvedValue([]),
      reset: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: LayoutDrawerFacadeService,
          useValue: { setActions: vi.fn(), setBadge: vi.fn() },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        {
          provide: AuthFacade,
          useValue: {
            currentUser: vi.fn().mockReturnValue({ role: 'admin', branchId: 1 }),
            whenReady: Promise.resolve(),
          },
        },
        BranchFacade,
        { provide: SupabaseService, useValue: { client: {} } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
        { provide: EnrollmentFacade, useValue: enrollmentFacadeSpy },
        { provide: EnrollmentDocumentsFacade, useValue: { reset: vi.fn() } },
        { provide: EnrollmentPaymentFacade, useValue: { reset: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
      ],
    });

    const component = TestBed.runInInjectionContext(() => new SecretariaMatriculaComponent());
    TestBed.tick();
    return { component, enrollmentFacadeSpy };
  }

  it('isReinforcementCourse() es true solo para courseType=class_b_reinforcement', () => {
    const { component } = setup({ courseType: 'class_b_reinforcement' }, 'total');
    expect(component.isReinforcementCourse()).toBe(true);
  });

  it('isReinforcementCourse() es false para Clase B estándar', () => {
    const { component } = setup({ courseType: 'class_b' }, 'total');
    expect(component.isReinforcementCourse()).toBe(false);
  });

  it('fuerza paymentMode a "total" si venía en "partial" al detectar curso de Refuerzo', () => {
    const { enrollmentFacadeSpy } = setup({ courseType: 'class_b_reinforcement' }, 'partial');
    expect(enrollmentFacadeSpy.setPaymentMode).toHaveBeenCalledWith('total');
  });

  it('no llama setPaymentMode si ya estaba en "total" (evita loop innecesario)', () => {
    const { enrollmentFacadeSpy } = setup({ courseType: 'class_b_reinforcement' }, 'total');
    expect(enrollmentFacadeSpy.setPaymentMode).not.toHaveBeenCalled();
  });
});
