import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { professionalBranchGuard } from './professional-branch.guard';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';

describe('professionalBranchGuard (fix-029)', () => {
  let authSpy: any;
  let branchSpy: any;
  let routerSpy: any;

  beforeEach(() => {
    authSpy = { whenReady: Promise.resolve(), currentUser: vi.fn() };
    branchSpy = {
      // branch 1 = sin profesional · branch 2 = con profesional
      branches: vi.fn().mockReturnValue([
        { id: 1, hasProfessional: false },
        { id: 2, hasProfessional: true },
      ]),
      selectedBranchId: vi.fn().mockReturnValue(null),
      loadBranches: vi.fn().mockResolvedValue(undefined),
      ensureBranchesLoaded: vi.fn().mockResolvedValue(undefined),
    };
    routerSpy = { createUrlTree: vi.fn((cmds: string[]) => ({ __urlTree: cmds })) };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthFacade, useValue: authSpy },
        { provide: BranchFacade, useValue: branchSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  function run(): Promise<unknown> {
    return TestBed.runInInjectionContext(
      () => professionalBranchGuard({} as any, {} as any) as Promise<unknown>,
    );
  }

  it('admin → pasa (tiene selector)', async () => {
    authSpy.currentUser.mockReturnValue({ role: 'admin', branchId: null });
    expect(await run()).toBe(true);
  });

  it('secretaria CON grant → pasa (tiene selector)', async () => {
    authSpy.currentUser.mockReturnValue({
      role: 'secretaria',
      branchId: 1,
      canAccessBothBranches: true,
    });
    expect(await run()).toBe(true);
  });

  it('secretaria sin grant, sede CON profesional → pasa', async () => {
    authSpy.currentUser.mockReturnValue({
      role: 'secretaria',
      branchId: 2,
      canAccessBothBranches: false,
    });
    expect(await run()).toBe(true);
  });

  it('secretaria sin grant, sede SIN profesional → redirige a /app', async () => {
    authSpy.currentUser.mockReturnValue({
      role: 'secretaria',
      branchId: 1,
      canAccessBothBranches: false,
    });
    const result = await run();
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/app']);
    expect(result).toEqual({ __urlTree: ['/app'] });
  });

  // fix-334-m (A10): la página aplica la sede Profesional en ngOnInit; si las sedes aún no
  // cargaron (F5, URL directa) no la encuentra. El guard la deja entrar recién con la lista real.
  it('admin → espera la lista real de sedes antes de entrar', async () => {
    authSpy.currentUser.mockReturnValue({ role: 'admin', branchId: null });
    let resolveLoad!: () => void;
    branchSpy.ensureBranchesLoaded.mockReturnValue(new Promise<void>((r) => (resolveLoad = r)));

    let settled = false;
    const pending = run().then((r) => {
      settled = true;
      return r;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    resolveLoad();
    expect(await pending).toBe(true);
  });

  it('secretaria CON grant → también espera la lista real de sedes', async () => {
    authSpy.currentUser.mockReturnValue({
      role: 'secretaria',
      branchId: 1,
      canAccessBothBranches: true,
    });
    await run();
    expect(branchSpy.ensureBranchesLoaded).toHaveBeenCalledTimes(1);
  });

  it('secretaria sin grant → evalúa su sede con la lista real, no con el stub de localStorage', async () => {
    authSpy.currentUser.mockReturnValue({
      role: 'secretaria',
      branchId: 2,
      canAccessBothBranches: false,
    });
    await run();
    expect(branchSpy.ensureBranchesLoaded).toHaveBeenCalledTimes(1);
  });

  it('sin usuario → redirige a /login', async () => {
    authSpy.currentUser.mockReturnValue(null);
    await run();
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});
