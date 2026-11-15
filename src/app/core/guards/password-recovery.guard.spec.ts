import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { passwordRecoveryGuard } from './password-recovery.guard';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';

describe('passwordRecoveryGuard (fix-181-b)', () => {
  let authSpy: any;
  let routerSpy: any;
  let toastSpy: any;
  let location: { hash: string; search: string };

  beforeEach(() => {
    authSpy = {
      whenReady: Promise.resolve(),
      passwordRecovery: vi.fn().mockReturnValue(false),
      currentUser: vi.fn().mockReturnValue(null),
    };
    routerSpy = {
      createUrlTree: vi.fn((cmds: string[], extras?: unknown) =>
        extras ? { __urlTree: cmds, extras } : { __urlTree: cmds },
      ),
    };
    toastSpy = { warning: vi.fn() };
    location = { hash: '', search: '' };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthFacade, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: DOCUMENT, useValue: { location } },
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

  it('sin sesión de recuperación y sin error en la URL (acceso directo) → /login sin aviso', async () => {
    expect(await run()).toEqual({ __urlTree: ['/login'] });
  });

  // F6 (D07): Supabase vuelve con el error en el fragmento cuando el enlace venció o ya se usó.
  it('enlace vencido o ya usado → /login?enlace=vencido', async () => {
    location.hash = '#error=access_denied&error_code=otp_expired&error_description=expired';
    expect(await run()).toEqual({
      __urlTree: ['/login'],
      extras: { queryParams: { enlace: 'vencido' } },
    });
    expect(toastSpy.warning).not.toHaveBeenCalled();
  });

  it('otro error del enlace → /login?enlace=invalido', async () => {
    location.search = '?error=server_error';
    expect(await run()).toEqual({
      __urlTree: ['/login'],
      extras: { queryParams: { enlace: 'invalido' } },
    });
  });

  it('con sesión de recuperación, un error viejo en la URL no la bloquea', async () => {
    authSpy.passwordRecovery.mockReturnValue(true);
    location.hash = '#error=access_denied&error_code=otp_expired';
    expect(await run()).toBe(true);
  });

  // F9 (prueba del 2026-11-14): con otra sesión abierta, supabase-js la conserva cuando el enlace
  // falla. /login la rebotaba a /app (guestGuard) y el aviso se perdía: el usuario terminaba en el
  // inicio de esa cuenta (o en "Módulo no disponible", si era un alumno) sin saber por qué.
  it('enlace vencido con otra sesión abierta → su inicio, con aviso que nombra la cuenta', async () => {
    authSpy.currentUser.mockReturnValue({ role: 'admin', email: 'admin@escuela.cl' });
    location.hash = '#error=access_denied&error_code=otp_expired';

    expect(await run()).toEqual({ __urlTree: ['/app'] });
    expect(toastSpy.warning).toHaveBeenCalledTimes(1);
    const [summary, detail, life] = toastSpy.warning.mock.calls[0];
    expect(summary).toBe('El enlace venció o ya se usó');
    expect(detail).toContain('admin@escuela.cl');
    expect(life).toBeGreaterThanOrEqual(8000);
  });

  it('sesión sin rol válido (guestGuard la deja en /login) → /login?enlace, sin toast', async () => {
    authSpy.currentUser.mockReturnValue({ role: 'unknown', email: 'x@escuela.cl' });
    location.hash = '#error=access_denied&error_code=otp_expired';

    expect(await run()).toEqual({
      __urlTree: ['/login'],
      extras: { queryParams: { enlace: 'vencido' } },
    });
    expect(toastSpy.warning).not.toHaveBeenCalled();
  });

  it('sesión abierta sin error en la URL → /login como antes (guestGuard decide)', async () => {
    authSpy.currentUser.mockReturnValue({ role: 'admin', email: 'admin@escuela.cl' });
    expect(await run()).toEqual({ __urlTree: ['/login'] });
    expect(toastSpy.warning).not.toHaveBeenCalled();
  });
});
