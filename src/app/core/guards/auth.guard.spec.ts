import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthFacade } from '@core/facades/auth.facade';

describe('authGuard — cuenta desactivada (fix-180-b)', () => {
  let authSpy: any;
  let routerSpy: any;

  beforeEach(() => {
    authSpy = {
      whenReady: Promise.resolve(),
      currentUser: vi.fn().mockReturnValue(null),
      isAuthenticated: vi.fn().mockReturnValue(false),
      passwordRecovery: vi.fn().mockReturnValue(false),
      logout: vi.fn(),
    };
    routerSpy = { createUrlTree: vi.fn((cmds: string[]) => ({ __urlTree: cmds })) };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthFacade, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  function run(): Promise<unknown> {
    return TestBed.runInInjectionContext(() => authGuard({} as any, {} as any) as Promise<unknown>);
  }

  it('usuario con isActive === false → cierra sesión sin redirigir y manda a /login', async () => {
    authSpy.currentUser.mockReturnValue({ id: 'u1', isActive: false });
    authSpy.isAuthenticated.mockReturnValue(true);

    const result = await run();

    expect(authSpy.logout).toHaveBeenCalledWith({ redirect: false });
    expect(result).toEqual({ __urlTree: ['/login'] });
  });

  it('usuario activo → no cierra sesión', async () => {
    authSpy.currentUser.mockReturnValue({ id: 'u1', isActive: true });
    authSpy.isAuthenticated.mockReturnValue(true);

    const result = await run();

    expect(authSpy.logout).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('perfil sin campo active (undefined) → se trata como activo', async () => {
    authSpy.currentUser.mockReturnValue({ id: 'u1' });
    authSpy.isAuthenticated.mockReturnValue(true);

    await run();

    expect(authSpy.logout).not.toHaveBeenCalled();
  });

  it('sesión de recuperación sin clave nueva → /recuperar-contrasena (fix-181-b)', async () => {
    authSpy.currentUser.mockReturnValue({ id: 'u1', isActive: true });
    authSpy.isAuthenticated.mockReturnValue(true);
    authSpy.passwordRecovery.mockReturnValue(true);

    expect(await run()).toEqual({ __urlTree: ['/recuperar-contrasena'] });
  });
});
