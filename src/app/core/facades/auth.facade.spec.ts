import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { User } from '@core/models/dto/user.model';
import { AuthFacade } from './auth.facade';
import { BranchFacade } from './branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('AuthFacade', () => {
  let service: AuthFacade;
  let router: Router;
  let supabaseSpy: any;
  let authCallback: ((event: string, session: unknown) => void) | null;

  beforeEach(() => {
    authCallback = null;
    const mockSupabaseClient = {
      auth: {
        // Captura el callback para poder disparar INITIAL_SESSION desde los tests
        onAuthStateChange: vi.fn().mockImplementation((cb: any) => {
          authCallback = cb;
          return { data: { subscription: { unsubscribe: () => {} } } };
        }),
        updateUser: vi.fn().mockResolvedValue({ error: null }),
      },
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null }),
          }),
        }),
      }),
    };

    supabaseSpy = {
      getUser: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    };
    supabaseSpy.getUser.mockResolvedValue({ data: { user: null } } as any);
    supabaseSpy.signIn.mockResolvedValue({ error: null } as any);
    supabaseSpy.signUp.mockResolvedValue({ data: null, error: null } as any);
    supabaseSpy.signOut.mockResolvedValue({ error: null } as any);
    supabaseSpy.resetPasswordForEmail.mockResolvedValue({ error: null } as any);
    (supabaseSpy as any).client = mockSupabaseClient;

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SupabaseService, useValue: supabaseSpy }],
    });

    service = TestBed.inject(AuthFacade);
    router = TestBed.inject(Router);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('currentUser should start as null', () => {
    expect(service.currentUser()).toBeNull();
  });

  it('isAuthenticated should be false when no user is set', () => {
    expect(service.isAuthenticated()).toBe(false);
  });

  it('setUser() should update currentUser signal', () => {
    const user: User = {
      id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'member',
      initials: 'TU',
    };
    service.setUser(user);
    expect(service.currentUser()).toEqual(user);
  });

  it('setUser() should make isAuthenticated return true', () => {
    const user: User = {
      id: 'u1',
      name: 'Test',
      email: 'test@example.com',
      role: 'member',
      initials: 'T',
    };
    service.setUser(user);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('setUser(null) should clear user and set isAuthenticated to false', () => {
    const user: User = {
      id: 'u1',
      name: 'Test',
      email: 'test@example.com',
      role: 'member',
      initials: 'T',
    };
    service.setUser(user);
    service.setUser(null);
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('logout() should clear the current user', () => {
    const user: User = {
      id: 'u1',
      name: 'Test',
      email: 'test@example.com',
      role: 'member',
      initials: 'T',
    };
    service.setUser(user);
    service.logout();
    expect(service.currentUser()).toBeNull();
  });

  // fix-171-b: la sede activa vive en localStorage bajo una clave sin namespacing por
  // usuario. Si no se limpia al cerrar sesión, en una PC compartida el siguiente usuario
  // hereda la sede del anterior — ya pasó: una secretaria vio su historial de comunicados
  // vacío, sin error, por heredar una sede ajena (fix-168-b).
  it('logout() limpia la sede activa para que no la herede el próximo usuario', () => {
    const branchFacade = TestBed.inject(BranchFacade);
    const resetSpy = vi.spyOn(branchFacade, 'reset');

    service.logout({ redirect: false });

    expect(resetSpy).toHaveBeenCalled();
  });

  it('logout() deja la sede en null, no solo llama al reset', () => {
    const branchFacade = TestBed.inject(BranchFacade);
    branchFacade.selectBranch(2);
    expect(branchFacade.selectedBranchId()).toBe(2);

    service.logout({ redirect: false });

    expect(branchFacade.selectedBranchId()).toBeNull();
  });

  it("logout() should navigate to '/'", () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    service.logout();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('logout({ redirect: false }) should clear the user without navigating', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    const user: User = {
      id: 'u1',
      name: 'Test',
      email: 'test@example.com',
      role: 'member',
      initials: 'T',
    };
    service.setUser(user);
    service.logout({ redirect: false });
    expect(service.currentUser()).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('login() should call supabase.signIn with the given credentials', async () => {
    // Use an error response so the polling loop (waiting for _currentUser) is skipped
    supabaseSpy.signIn.mockResolvedValue({ error: new Error('_skip_poll') } as any);
    await service.login('user@example.com', 'password123');
    expect(supabaseSpy.signIn).toHaveBeenCalledWith('user@example.com', 'password123');
  });

  describe('sesión lenta (fix-185-b, S17)', () => {
    const PROFILE = {
      id: 7,
      first_names: 'Ana',
      paternal_last_name: 'Soto',
      branch_id: 1,
      can_access_both_branches: false,
      first_login: false,
      active: true,
      role_id: 2,
      roles: { name: 'secretary' },
    };

    /** Perfil que tarda `ms` en llegar (o nunca, si data es null → rol unknown). */
    function profileAfter(ms: number, data: unknown = PROFILE) {
      const maybeSingle = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve({ data, error: null }), ms)),
      );
      (service as any).supabase.client.from = vi.fn(() => ({
        select: () => ({ eq: () => ({ maybeSingle }) }),
      }));
      return maybeSingle;
    }

    afterEach(() => vi.useRealTimers());

    /**
     * Timers falsos + servicio NUEVO: el reloj de seguridad de whenReady se arma en el
     * constructor, así que el servicio tiene que crearse después de vi.useFakeTimers().
     */
    function fakeTimersFreshService(): void {
      vi.useFakeTimers();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter([]), { provide: SupabaseService, useValue: supabaseSpy }],
      });
      service = TestBed.inject(AuthFacade);
      router = TestBed.inject(Router);
    }

    it('whenReady espera al perfil aunque tarde más de 5 s (no decide con usuario null)', async () => {
      fakeTimersFreshService();
      profileAfter(8000);
      let ready = false;
      service.whenReady.then(() => (ready = true));

      authCallback!('INITIAL_SESSION', { user: { id: 'u1', email: 'a@b.cl' } });
      await vi.advanceTimersByTimeAsync(5100);
      expect(ready).toBe(false);

      await vi.advanceTimersByTimeAsync(3000);
      expect(ready).toBe(true);
      expect(service.currentUser()?.role).toBe('secretaria');
    });

    it('whenReady igual se resuelve a los 15 s si Supabase no responde (la app no queda colgada)', async () => {
      fakeTimersFreshService();
      let ready = false;
      service.whenReady.then(() => (ready = true));
      await vi.advanceTimersByTimeAsync(14_900);
      expect(ready).toBe(false);
      await vi.advanceTimersByTimeAsync(200);
      expect(ready).toBe(true);
    });

    it('login() espera el perfil de la sesión aunque tarde 8 s y devuelve éxito con el usuario cargado', async () => {
      fakeTimersFreshService();
      profileAfter(8000);
      supabaseSpy.signIn.mockResolvedValue({
        data: { session: { user: { id: 'u1', email: 'a@b.cl' } }, user: { id: 'u1' } },
        error: null,
      } as any);

      const loginPromise = service.login('a@b.cl', 'Clave12345');
      await vi.advanceTimersByTimeAsync(8100);
      const result = await loginPromise;

      expect(result.error).toBeNull();
      expect(service.currentUser()?.role).toBe('secretaria');
    });

    it('login() con sesión pero sin perfil en users → error claro y cierra la sesión', async () => {
      profileAfter(0, null);
      supabaseSpy.signIn.mockResolvedValue({
        data: { session: { user: { id: 'u1', email: 'a@b.cl' } }, user: { id: 'u1' } },
        error: null,
      } as any);

      const result = await service.login('a@b.cl', 'Clave12345');

      expect(result.error?.message).toBe(
        'No se pudo cargar tu perfil. Si el problema continúa, contacta al administrador.',
      );
      expect(supabaseSpy.signOut).toHaveBeenCalled();
      expect(service.currentUser()).toBeNull();
    });

    it('SIGNED_IN y login() del mismo usuario comparten una sola consulta del perfil', async () => {
      const maybeSingle = profileAfter(50);
      supabaseSpy.signIn.mockImplementation(async () => {
        authCallback!('SIGNED_IN', { user: { id: 'u1', email: 'a@b.cl' } });
        return { data: { session: { user: { id: 'u1', email: 'a@b.cl' } } }, error: null } as any;
      });

      await service.login('a@b.cl', 'Clave12345');

      expect(maybeSingle).toHaveBeenCalledTimes(1);
    });
  });

  it('login() should return an Error instance on failure', async () => {
    supabaseSpy.signIn.mockResolvedValue({
      error: new Error('Invalid credentials'),
    } as any);
    const result = await service.login('user@example.com', 'wrong');
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe(
      'Error de autenticación. Por favor, verifica tus datos e intenta de nuevo.',
    );
  });

  it('resetPasswordForEmail() pide el link con redirectTo a /recuperar-contrasena (fix-181-b)', async () => {
    await service.resetPasswordForEmail('user@example.com');
    expect(supabaseSpy.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      `${window.location.origin}/recuperar-contrasena`,
    );
  });

  describe('recuperar contraseña (fix-181-b)', () => {
    it('passwordRecovery() empieza en false', () => {
      expect(service.passwordRecovery()).toBe(false);
    });

    it('PASSWORD_RECOVERY marca la sesión de recuperación y navega a /recuperar-contrasena', () => {
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      authCallback!('PASSWORD_RECOVERY', { user: { id: 'u1', email: 'a@b.cl' } });

      expect(service.passwordRecovery()).toBe(true);
      expect(navigateSpy).toHaveBeenCalledWith(['/recuperar-contrasena']);
    });

    it('completePasswordRecovery() actualiza la clave y apaga passwordRecovery', async () => {
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      authCallback!('PASSWORD_RECOVERY', { user: { id: 'u1' } });

      const result = await service.completePasswordRecovery('NuevaClave123');

      expect(result.error).toBeNull();
      expect((service as any).supabase.client.auth.updateUser).toHaveBeenCalledWith({
        password: 'NuevaClave123',
      });
      expect(service.passwordRecovery()).toBe(false);
    });

    it('completePasswordRecovery() con error deja passwordRecovery encendido', async () => {
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      authCallback!('PASSWORD_RECOVERY', { user: { id: 'u1' } });
      (service as any).supabase.client.auth.updateUser.mockResolvedValue({
        error: Object.assign(new Error('Password should be at least 6 characters'), {
          name: 'AuthApiError',
        }),
      });

      const result = await service.completePasswordRecovery('123');

      expect(result.error).toBeInstanceOf(Error);
      expect(service.passwordRecovery()).toBe(true);
    });

    it('SIGNED_OUT apaga passwordRecovery', () => {
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      authCallback!('PASSWORD_RECOVERY', { user: { id: 'u1' } });

      authCallback!('SIGNED_OUT', null);

      expect(service.passwordRecovery()).toBe(false);
    });
  });

  it('updatePassword() retorna mensaje de error legible cuando la nueva contraseña es igual a la anterior', async () => {
    const authError = Object.assign(
      new Error('New password should be different from the old password.'),
      { name: 'AuthApiError' },
    );
    (service as any).supabase.client.auth.updateUser.mockResolvedValue({ error: authError });

    const result = await service.updatePassword('samepassword');

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('La nueva contraseña debe ser diferente a la anterior.');
  });

  it('whenReady se resuelve al llegar INITIAL_SESSION sin sesión', async () => {
    // La carga inicial se resuelve vía INITIAL_SESSION (no getUser()) — ver
    // constructor de AuthFacade. Sin este evento, solo el safety-timeout de 5s
    // resolvería whenReady, empatando con el timeout de vitest (test flaky).
    authCallback!('INITIAL_SESSION', null);
    await expect(service.whenReady).resolves.toBeUndefined();
  });
});
