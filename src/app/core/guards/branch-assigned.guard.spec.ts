import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { branchAssignedGuard } from './branch-assigned.guard';
import { AuthFacade } from '@core/facades/auth.facade';

describe('branchAssignedGuard (hotfix-099-b)', () => {
  let authSpy: any;
  let routerSpy: any;

  beforeEach(() => {
    authSpy = { whenReady: Promise.resolve(), currentUser: vi.fn().mockReturnValue(null) };
    routerSpy = { createUrlTree: vi.fn((cmds: string[]) => ({ __urlTree: cmds })) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthFacade, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  const run = () =>
    TestBed.runInInjectionContext(
      () => branchAssignedGuard({} as any, {} as any) as Promise<unknown>,
    );

  it('secretaria sin sede → /sin-sede', async () => {
    authSpy.currentUser.mockReturnValue({ role: 'secretaria', branchId: null });
    expect(await run()).toEqual({ __urlTree: ['/sin-sede'] });
  });

  it('secretaria con sede → pasa', async () => {
    authSpy.currentUser.mockReturnValue({ role: 'secretaria', branchId: 2 });
    expect(await run()).toBe(true);
  });

  it('secretaria sin sede con grant multisede → pasa', async () => {
    authSpy.currentUser.mockReturnValue({
      role: 'secretaria',
      branchId: null,
      canAccessBothBranches: true,
    });
    expect(await run()).toBe(true);
  });

  it('sin sesión → pasa (lo resuelven los guards de sesión y rol)', async () => {
    expect(await run()).toBe(true);
  });
});
