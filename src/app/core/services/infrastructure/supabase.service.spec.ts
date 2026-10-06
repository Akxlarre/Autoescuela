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
