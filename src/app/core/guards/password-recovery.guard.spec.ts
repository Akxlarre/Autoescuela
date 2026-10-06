import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { passwordRecoveryGuard } from './password-recovery.guard';
import { AuthFacade } from '@core/facades/auth.facade';

describe('passwordRecoveryGuard (fix-181-b)', () => {
  let authSpy: any;
  let routerSpy: any;

  beforeEach(() => {
    authSpy = { whenReady: Promise.resolve(), passwordRecovery: vi.fn().mockReturnValue(false) };
    routerSpy = { createUrlTree: vi.fn((cmds: string[]) => ({ __urlTree: cmds })) };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthFacade, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  function run(): Promise<unknown> {
    return TestBed.runInInjectionContext(
      () => passwordRecoveryGuard({} as any, {} as any) as Promise<unknown>,
    );
  }

  it('con sesión de recuperación → deja pasar', async () => {
    authSpy.passwordRecovery.mockReturnValue(true);
    expect(await run()).toBe(true);
  });

  it('sin sesión de recuperación (link vencido o acceso directo) → /login', async () => {
    expect(await run()).toEqual({ __urlTree: ['/login'] });
  });
});
