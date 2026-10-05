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
import { normalizePhoto } from '@core/utils/image.utils';

// `normalizePhoto` usa `<img>.onload/onerror`, que happy-dom no dispara de forma realista.
// Mockeado para controlar por test si la "imagen" es válida o rechaza (fix-251-m).
vi.mock('@core/utils/image.utils', () => ({
  normalizePhoto: vi.fn(),
}));

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
          useValue: {
            setActions: vi.fn(),
            setBadge: vi.fn(),
            setCloseGuard: vi.fn(),
            component: vi.fn().mockReturnValue(null),
          },
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

  describe('sede elegida en el wizard (fix-309-m)', () => {
    // BranchFacade recuerda la sede en localStorage: los tests anteriores dejan una elegida.
    beforeEach(() => branchFacade.reset());

    it('la sede elegida en la pantalla de selección vale mientras dura el wizard y se deshace al cerrarlo', () => {
      component.onBranchSelectedFromGate(2);
      expect(branchFacade.selectedBranchId()).toBe(2);

      component.ngOnDestroy();

      expect(branchFacade.selectedBranchId()).toBeNull();
    });

    it('una sede elegida en el topbar no se toca al cerrar el wizard', () => {
      branchFacade.selectBranch(2);
      TestBed.tick();

      component.ngOnDestroy();

      expect(branchFacade.selectedBranchId()).toBe(2);
    });
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

// Foto carnet no-imagen (ej. PDF) ya no cuelga el flujo de subida — fix-251-m.
describe('SecretariaMatriculaComponent — error al subir foto carnet inválida (fix-251-m)', () => {
  it('captura el rechazo de normalizePhoto, notifica error y no invoca uploadCarnetPhoto', async () => {
    vi.mocked(normalizePhoto).mockRejectedValueOnce(new Error('Image load failed'));

    const enrollmentFacadeSpy: any = {
      currentStep: vi.fn().mockReturnValue(2),
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
      draft: vi.fn().mockReturnValue({ enrollmentId: 123, studentId: 456 }),
      reset: vi.fn(),
    };
    const docsFacadeSpy = {
      uploadCarnetPhoto: vi.fn(),
      setUploadError: vi.fn(),
      reset: vi.fn(),
    };
    const toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

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
        { provide: EnrollmentDocumentsFacade, useValue: docsFacadeSpy },
        { provide: EnrollmentPaymentFacade, useValue: { reset: vi.fn() } },
        { provide: ToastService, useValue: toastSpy },
      ],
    });

    const component = TestBed.runInInjectionContext(() => new SecretariaMatriculaComponent());
    TestBed.tick();

    const pdfFile = new File(['%PDF-1.4'], 'cedula.pdf', { type: 'application/pdf' });
    await component.onDocFileSelected({ type: 'id_photo', file: pdfFile });

    expect(docsFacadeSpy.uploadCarnetPhoto).not.toHaveBeenCalled();
    expect(docsFacadeSpy.setUploadError).toHaveBeenCalledWith(expect.any(String));
    expect(toastSpy.error).toHaveBeenCalled();
  });
});

// Cancelar o terminar la matrícula abierta como panel no saca de la pantalla — fix-307-m.
describe('SecretariaMatriculaComponent — finishWizard (fix-307-m)', () => {
  function setup(drawerComponent: unknown) {
    const enrollmentFacadeSpy: any = {
      currentStep: vi.fn().mockReturnValue(1),
      personalData: vi.fn().mockReturnValue(null),
      courseOptions: vi.fn().mockReturnValue([]),
      paymentMode: vi.fn().mockReturnValue('total'),
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
    const drawerSpy = {
      setActions: vi.fn(),
      setBadge: vi.fn(),
      setCloseGuard: vi.fn(),
      close: vi.fn(),
      component: vi.fn().mockReturnValue(drawerComponent),
    };
    const routerSpy = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: LayoutDrawerFacadeService, useValue: drawerSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        {
          provide: AuthFacade,
          useValue: {
            currentUser: vi.fn().mockReturnValue({ role: 'secretaria', branchId: 1 }),
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
    return { component, drawerSpy, routerSpy, enrollmentFacadeSpy };
  }

  it('abierto como panel: cierra el panel y no navega', () => {
    const { component, drawerSpy, routerSpy, enrollmentFacadeSpy } = setup(
      SecretariaMatriculaComponent,
    );

    component.finishWizard();

    expect(enrollmentFacadeSpy.reset).toHaveBeenCalled();
    expect(drawerSpy.close).toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('como página propia: lleva al Inicio del rol', () => {
    const { component, routerSpy } = setup(null);

    component.finishWizard();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/app/secretaria/dashboard']);
  });

  describe('RUT de la re-matrícula en la dirección (hotfix-141-m)', () => {
    /** Wizard ya iniciado, con la dirección actual `url` y el RUT que usó para precargar. */
    function setupConRut(drawerComponent: unknown, queryParams: Record<string, string>) {
      const ctx = setup(drawerComponent);
      const tree = { queryParams: { ...queryParams } };
      const router = ctx.routerSpy as any;
      router.url = '/app/secretaria/ex-alumnos';
      router.parseUrl = vi.fn().mockReturnValue(tree);
      router.navigateByUrl = vi.fn().mockResolvedValue(true);
      ctx.component.ngOnInit();
      (ctx.component as any).prefilledRut = '11.111.111-1';
      return { ...ctx, router, tree };
    }

    it('abierto como panel: al cerrarse quita el rut y conserva el resto de la dirección', () => {
      const { component, router, tree } = setupConRut(SecretariaMatriculaComponent, {
        rut: '11.111.111-1',
        orden: 'nombre',
      });

      component.ngOnDestroy();

      expect(tree.queryParams).toEqual({ orden: 'nombre' });
      expect(router.navigateByUrl).toHaveBeenCalledWith(tree, { replaceUrl: true });
    });

    it('si la dirección ya no lleva ese rut (el usuario navegó a otra parte), no la toca', () => {
      const { component, router } = setupConRut(SecretariaMatriculaComponent, {});

      component.ngOnDestroy();

      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('como página propia no toca la dirección', () => {
      const { component, router } = setupConRut(null, { rut: '11.111.111-1' });

      component.ngOnDestroy();

      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('aviso de datos sin guardar (fix-310-m)', () => {
    function setupWizard(confirmAnswer: boolean) {
      const ctx = setup(SecretariaMatriculaComponent);
      ctx.enrollmentFacadeSpy.confirm = vi.fn().mockResolvedValue(confirmAnswer);
      ctx.enrollmentFacadeSpy.savePersonalData = vi.fn().mockResolvedValue(true);
      (ctx.component as any)._viewMode.set('wizard');
      const escribir = (firstNames: string) =>
        ctx.component.onStep1DataChange({ ...ctx.component.step1Data(), firstNames });
      return { ...ctx, escribir };
    }

    it('al iniciar registra su pregunta de cierre en el panel', () => {
      const { component, drawerSpy } = setupWizard(true);

      component.ngOnInit();

      expect(drawerSpy.setCloseGuard).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sin nada escrito deja cerrar sin preguntar', async () => {
      const { component, enrollmentFacadeSpy } = setupWizard(false);

      await expect(component.confirmDiscardUnsaved()).resolves.toBe(true);
      expect(enrollmentFacadeSpy.confirm).not.toHaveBeenCalled();
    });

    it('con algo escrito pregunta y respeta la respuesta', async () => {
      const { component, enrollmentFacadeSpy, escribir } = setupWizard(false);
      escribir('Ana');

      await expect(component.confirmDiscardUnsaved()).resolves.toBe(false);
      expect(enrollmentFacadeSpy.confirm).toHaveBeenCalledTimes(1);
    });

    it('con el Paso 1 ya guardado no pregunta', async () => {
      const { component, enrollmentFacadeSpy, escribir } = setupWizard(false);
      escribir('Ana');

      await component.onStep1Next();

      await expect(component.confirmDiscardUnsaved()).resolves.toBe(true);
      expect(enrollmentFacadeSpy.confirm).not.toHaveBeenCalled();
    });

    it('"Cancelar" con datos escritos no cierra si se responde que no', async () => {
      const { component, drawerSpy, escribir } = setupWizard(false);
      escribir('Ana');

      await component.onStep1Cancel();

      expect(drawerSpy.close).not.toHaveBeenCalled();
    });

    it('"Cancelar" con datos escritos cierra si se confirma', async () => {
      const { component, drawerSpy, escribir } = setupWizard(true);
      escribir('Ana');

      await component.onStep1Cancel();

      expect(drawerSpy.close).toHaveBeenCalled();
    });
  });
});
