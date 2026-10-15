import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SecretariaAsistenciaComponent } from './secretaria-asistencia.component';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { CiclosTeoricosFacade } from '@core/facades/ciclos-teoricos.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';

// fix-385-m: la sede de la pantalla sale de resolveBranchScope(), no de un valor leído una vez.
describe('SecretariaAsistenciaComponent — sede', () => {
  let facade: {
    enterToday: ReturnType<typeof vi.fn>;
    setBranchFilter: ReturnType<typeof vi.fn>;
    initialize: ReturnType<typeof vi.fn>;
  };
  let ciclos: { setBranchFilter: ReturnType<typeof vi.fn>; loadCycles: ReturnType<typeof vi.fn> };
  let selectedBranchId: ReturnType<typeof signal<number | null>>;

  function setup(user: { branchId: number; canAccessBothBranches?: boolean }) {
    facade = {
      enterToday: vi.fn(),
      setBranchFilter: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
    };
    ciclos = { setBranchFilter: vi.fn(), loadCycles: vi.fn().mockResolvedValue(undefined) };
    selectedBranchId = signal<number | null>(null);

    TestBed.configureTestingModule({
      providers: [
        { provide: AsistenciaClaseBFacade, useValue: facade },
        { provide: CiclosTeoricosFacade, useValue: ciclos },
        {
          provide: AuthFacade,
          useValue: { currentUser: signal({ role: 'secretaria', ...user }) },
        },
        { provide: BranchFacade, useValue: { selectedBranchId } },
        { provide: LayoutService, useValue: { tier: signal('desktop') } },
        { provide: LayoutDrawerFacadeService, useValue: { open: vi.fn() } },
        { provide: ConfirmModalService, useValue: { confirm: vi.fn() } },
      ],
    });

    // Sin plantilla: solo interesa qué sede aplica el componente (los tests de template están
    // excluidos de Vitest).
    const component = TestBed.runInInjectionContext(() => new SecretariaAsistenciaComponent());
    TestBed.tick();
    return component as unknown as {
      branchId: () => number | null;
      showBranchColumn: () => boolean;
    };
  }

  it('sin el permiso multi-sede queda anclada a su sede aunque el selector diga otra', () => {
    const component = setup({ branchId: 1 });
    selectedBranchId.set(2);
    TestBed.tick();

    expect(component.branchId()).toBe(1);
    expect(component.showBranchColumn()).toBe(false);
    expect(facade.setBranchFilter).toHaveBeenLastCalledWith(1);
    expect(facade.initialize).toHaveBeenCalledTimes(1);
  });

  it('abre en hoy y carga con la sede resuelta', () => {
    setup({ branchId: 1 });

    expect(facade.enterToday).toHaveBeenCalledTimes(1);
    expect(facade.setBranchFilter).toHaveBeenCalledWith(1);
    expect(ciclos.setBranchFilter).toHaveBeenCalledWith(1);
    expect(ciclos.loadCycles).toHaveBeenCalledTimes(1);
  });

  it('con el permiso multi-sede sigue al selector y recarga al cambiarlo', () => {
    const component = setup({ branchId: 1, canAccessBothBranches: true });
    expect(facade.setBranchFilter).toHaveBeenLastCalledWith(null);
    expect(component.showBranchColumn()).toBe(true);

    selectedBranchId.set(2);
    TestBed.tick();

    expect(component.branchId()).toBe(2);
    expect(component.showBranchColumn()).toBe(false);
    expect(facade.setBranchFilter).toHaveBeenLastCalledWith(2);
    expect(ciclos.setBranchFilter).toHaveBeenLastCalledWith(2);
    expect(facade.initialize).toHaveBeenCalledTimes(2);
    expect(ciclos.loadCycles).toHaveBeenCalledTimes(2);
  });
});
