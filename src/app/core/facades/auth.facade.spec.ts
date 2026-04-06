import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { User } from '@core/models/dto/user.model';
import { AuthFacade } from './auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('AuthFacade', () => {
  let service: AuthFacade;
  let router: Router;
  let supabaseSpy: any;

  beforeEach(() => {
    const mockSupabaseClient = {
      auth: {
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
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

  it("logout() should navigate to '/'", () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    service.logout();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('login() should call supabase.signIn with the given credentials', async () => {
    // Use an error response so the polling loop (waiting for _currentUser) is skipped
    supabaseSpy.signIn.mockResolvedValue({ error: new Error('_skip_poll') } as any);
    await service.login('user@example.com', 'password123');
    expect(supabaseSpy.signIn).toHaveBeenCalledWith('user@example.com', 'password123');
  });

  it('login() should return null error on success', async () => {
    // login() polls _currentUser every 100ms up to 5s after signIn succeeds.
    // Since onAuthStateChange never fires in the test, advance fake timers past 5s.
    vi.useFakeTimers();
    supabaseSpy.signIn.mockResolvedValue({ error: null } as any);
    const loginPromise = service.login('user@example.com', 'correct');
    await vi.advanceTimersByTimeAsync(5100);
    const result = await loginPromise;
    vi.useRealTimers();
    expect(result.error).toBeNull();
  });

  it('login() should return an Error instance on failure', async () => {
    supabaseSpy.signIn.mockResolvedValue({
      error: new Error('Invalid credentials'),
    } as any);
    const result = await service.login('user@example.com', 'wrong');
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('Invalid credentials');
  });

  it('resetPasswordForEmail() should call supabase.resetPasswordForEmail', async () => {
    await service.resetPasswordForEmail('user@example.com');
    expect(supabaseSpy.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com');
  });

  it('whenReady should resolve after getUser() completes', async () => {
    await expect(service.whenReady).resolves.toBeUndefined();
  });
});
