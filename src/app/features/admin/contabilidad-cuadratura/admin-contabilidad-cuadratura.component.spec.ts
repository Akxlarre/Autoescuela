import { TestBed } from '@angular/core/testing';
import { AdminContabilidadCuadraturaComponent } from './admin-contabilidad-cuadratura.component';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { PagosFacade } from '@core/facades/pagos.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

// La caja física es por sede — no existe "caja consolidada" (fix-212-m). Este test usa
// `runInInjectionContext` (constructor + effects) en vez de `TestBed.createComponent`, mismo
// patrón que `secretaria-matricula.component.spec.ts`: el template de este componente inyecta
// `CuadraturaContentComponent` (`app-section-hero`, `app-icon`, etc.) que el pipeline de Vitest
// del proyecto no compila — no hace falta renderizarlo para probar la lógica del gate.
describe('AdminContabilidadCuadraturaComponent — branch-gate (fix-212-m)', () => {
  let branchFacade: BranchFacade;
  let cuadraturaFacadeMock: {
    initialize: ReturnType<typeof vi.fn>;
    destroyRealtime: ReturnType<typeof vi.fn>;
  };

  function setup(role: 'admin' | 'secretaria', branchId: number | null) {
    cuadraturaFacadeMock = { initialize: vi.fn(), destroyRealtime: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: CuadraturaFacade, useValue: cuadraturaFacadeMock },
        { provide: PagosFacade, useValue: { seleccionarParaPago: vi.fn(), initialize: vi.fn() } },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role, branchId }) } },
        BranchFacade,
        { provide: SupabaseService, useValue: { client: {} } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
        { provide: LayoutDrawerFacadeService, useValue: { isOpen: () => false } },
        { provide: ConfirmModalService, useValue: { confirm: vi.fn() } },
      ],
    });

    branchFacade = TestBed.inject(BranchFacade);
    const component = TestBed.runInInjectionContext(
      () => new AdminContabilidadCuadraturaComponent(),
    );
    TestBed.tick();
    return component;
  }

  it('muestra branch-gate cuando el admin no tiene sede seleccionada', () => {
    const component = setup('admin', null);
    expect(component['requiresBranchGate']()).toBe(true);
  });

  it('no llama facade.initialize() mientras está en branch-gate', () => {
    setup('admin', null);
    expect(cuadraturaFacadeMock.initialize).not.toHaveBeenCalled();
  });

  it('sale de branch-gate y llama facade.initialize() cuando se elige una sede', () => {
    const component = setup('admin', null);
    cuadraturaFacadeMock.initialize.mockClear();

    branchFacade.selectBranch(3);
    TestBed.tick();

    expect(component['requiresBranchGate']()).toBe(false);
    expect(cuadraturaFacadeMock.initialize).toHaveBeenCalled();
  });

  it('marca requiresSpecificBranch en BranchFacade para deshabilitar "Todas las escuelas" en el topbar', () => {
    setup('admin', null);
    expect(branchFacade.requiresSpecificBranch()).toBe(true);
  });
});
