import { TestBed } from '@angular/core/testing';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  let service: SupabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SupabaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('client getter should return a SupabaseClient instance', () => {
    expect(service.client).toBeTruthy();
  });

  it('client should expose the auth API', () => {
    expect(service.client.auth).toBeTruthy();
    expect(typeof service.client.auth.signInWithPassword).toBe('function');
  });

  it('getUser() should return a Promise', () => {
    const result = service.getUser();
    expect(typeof result.then).toBe('function');
    // Suppress unhandled rejection from placeholder Supabase URL in tests
    result.catch(() => {});
  });

  it('getSession() should return a Promise', () => {
    const result = service.getSession();
    expect(typeof result.then).toBe('function');
    result.catch(() => {});
  });

  describe('signOut (hotfix-091-b, E10)', () => {
    const storageKey = () => (service.client.auth as unknown as { storageKey: string }).storageKey;

    afterEach(() => localStorage.clear());

    it('si el servidor no responde, borra igual la sesión guardada en el navegador', async () => {
      localStorage.setItem(storageKey(), '{"access_token":"x"}');
      vi.spyOn(service.client.auth, 'signOut').mockResolvedValue({
        error: new Error('Failed to fetch'),
      } as never);

      await service.signOut();

      expect(localStorage.getItem(storageKey())).toBeNull();
    });

    it('si el servidor responde bien, no toca nada más', async () => {
      localStorage.setItem('otra-clave', 'sigue');
      vi.spyOn(service.client.auth, 'signOut').mockResolvedValue({ error: null } as never);

      const { error } = await service.signOut();

      expect(error).toBeNull();
      expect(localStorage.getItem('otra-clave')).toBe('sigue');
    });
  });

  it('signIn() should be a function', () => {
    expect(typeof service.signIn).toBe('function');
  });

  it('signOut() should be a function', () => {
    expect(typeof service.signOut).toBe('function');
  });

  it('signOut() cierra solo la sesión de este equipo (scope local, fix-184-b)', async () => {
    const spy = vi.spyOn(service.client.auth, 'signOut').mockResolvedValue({ error: null });
    await service.signOut();
    expect(spy).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('signUp() should be a function', () => {
    expect(typeof service.signUp).toBe('function');
  });

  it('resetPasswordForEmail() should be a function', () => {
    expect(typeof service.resetPasswordForEmail).toBe('function');
  });

  it('refreshSession() should return a Promise', () => {
    const result = service.refreshSession();
    expect(typeof result.then).toBe('function');
    result.catch(() => {});
  });
});
