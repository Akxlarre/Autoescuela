import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { passwordRecoveryGuard } from './password-recovery.guard';
import { AuthFacade } from '@core/facades/auth.facade';

describe('passwordRecoveryGuard (fix-181-b)', () => {
  let authSpy: any;
  let routerSpy: any;
  let location: { hash: string; search: string };

  beforeEach(() => {
    authSpy = { whenReady: Promise.resolve(), passwordRecovery: vi.fn().mockReturnValue(false) };
    routerSpy = {
      createUrlTree: vi.fn((cmds: string[], extras?: unknown) =>
        extras ? { __urlTree: cmds, extras } : { __urlTree: cmds },
      ),
    };
    location = { hash: '', search: '' };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthFacade, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
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
});
