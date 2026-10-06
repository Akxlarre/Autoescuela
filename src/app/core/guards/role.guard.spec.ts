import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { hasRoleGuard } from './role.guard';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';

describe('hasRoleGuard (fix-184-b)', () => {
  let authSpy: any;
  let routerSpy: any;
  let toastSpy: any;

  beforeEach(() => {
    authSpy = { whenReady: Promise.resolve(), currentUser: vi.fn().mockReturnValue(null) };
    routerSpy = { createUrlTree: vi.fn((cmds: string[]) => ({ __urlTree: cmds })) };
    toastSpy = { warning: vi.fn(), info: vi.fn(), error: vi.fn(), success: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthFacade, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    });
  });

  function run(roles: string[]): Promise<unknown> {
    return TestBed.runInInjectionContext(
      () => hasRoleGuard(roles)({} as any, {} as any) as Promise<unknown>,
    );
  }

  it('rol permitido → pasa, sin aviso', async () => {
    authSpy.currentUser.mockReturnValue({ role: 'admin' });
    expect(await run(['admin'])).toBe(true);
    expect(toastSpy.warning).not.toHaveBeenCalled();
  });

  it('rol no permitido → avisa "No tienes acceso a esa sección" y manda a /app', async () => {
    authSpy.currentUser.mockReturnValue({ role: 'secretaria' });
    expect(await run(['admin'])).toEqual({ __urlTree: ['/app'] });
    expect(toastSpy.warning).toHaveBeenCalledWith('No tienes acceso a esa sección');
  });

  it('sin sesión → /login, sin aviso', async () => {
    expect(await run(['admin'])).toEqual({ __urlTree: ['/login'] });
    expect(toastSpy.warning).not.toHaveBeenCalled();
  });

  it('primer login pendiente → /force-password-change, sin aviso', async () => {
    authSpy.currentUser.mockReturnValue({ role: 'secretaria', firstLogin: true });
    expect(await run(['admin'])).toEqual({ __urlTree: ['/force-password-change'] });
    expect(toastSpy.warning).not.toHaveBeenCalled();
  });
});
