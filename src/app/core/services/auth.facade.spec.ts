import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import type { User } from "@core/models/user.model";
import { AuthFacade } from "./auth.facade";
import { SupabaseService } from "./supabase.service";

describe("AuthFacade", () => {
  let service: AuthFacade;
  let router: Router;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;

  beforeEach(() => {
    const mockSupabaseClient = {
      auth: {
        onAuthStateChange: jasmine
          .createSpy("onAuthStateChange")
          .and.returnValue({
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

    supabaseSpy = jasmine.createSpyObj<SupabaseService>("SupabaseService", [
      "getUser",
      "signIn",
      "signUp",
      "signOut",
      "resetPasswordForEmail",
    ]);
    supabaseSpy.getUser.and.resolveTo({ data: { user: null } } as any);
    supabaseSpy.signIn.and.resolveTo({ error: null } as any);
    supabaseSpy.signUp.and.resolveTo({ data: null, error: null } as any);
    supabaseSpy.signOut.and.resolveTo({ error: null } as any);
    supabaseSpy.resetPasswordForEmail.and.resolveTo({ error: null } as any);
    (supabaseSpy as any).client = mockSupabaseClient;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseSpy },
      ],
    });

    service = TestBed.inject(AuthFacade);
    router = TestBed.inject(Router);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("currentUser should start as null", () => {
    expect(service.currentUser()).toBeNull();
  });

  it("isAuthenticated should be false when no user is set", () => {
    expect(service.isAuthenticated()).toBeFalse();
  });

  it("setUser() should update currentUser signal", () => {
    const user: User = {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      role: "member",
      initials: "TU",
    };
    service.setUser(user);
    expect(service.currentUser()).toEqual(user);
  });

  it("setUser() should make isAuthenticated return true", () => {
    const user: User = {
      id: "u1",
      name: "Test",
      email: "test@example.com",
      role: "member",
      initials: "T",
    };
    service.setUser(user);
    expect(service.isAuthenticated()).toBeTrue();
  });

  it("setUser(null) should clear user and set isAuthenticated to false", () => {
    const user: User = {
      id: "u1",
      name: "Test",
      email: "test@example.com",
      role: "member",
      initials: "T",
    };
    service.setUser(user);
    service.setUser(null);
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it("logout() should clear the current user", () => {
    const user: User = {
      id: "u1",
      name: "Test",
      email: "test@example.com",
      role: "member",
      initials: "T",
    };
    service.setUser(user);
    service.logout();
    expect(service.currentUser()).toBeNull();
  });

  it("logout() should navigate to '/'", () => {
    const navigateSpy = spyOn(router, "navigate");
    service.logout();
    expect(navigateSpy).toHaveBeenCalledWith(["/"]);
  });

  it("login() should call supabase.signIn with the given credentials", async () => {
    await service.login("user@example.com", "password123");
    expect(supabaseSpy.signIn).toHaveBeenCalledWith(
      "user@example.com",
      "password123",
    );
  });

  it("login() should return null error on success", async () => {
    supabaseSpy.signIn.and.resolveTo({ error: null } as any);
    const result = await service.login("user@example.com", "correct");
    expect(result.error).toBeNull();
  });

  it("login() should return an Error instance on failure", async () => {
    supabaseSpy.signIn.and.resolveTo({
      error: new Error("Invalid credentials"),
    } as any);
    const result = await service.login("user@example.com", "wrong");
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("Invalid credentials");
  });

  it("resetPasswordForEmail() should call supabase.resetPasswordForEmail", async () => {
    await service.resetPasswordForEmail("user@example.com");
    expect(supabaseSpy.resetPasswordForEmail).toHaveBeenCalledWith(
      "user@example.com",
    );
  });

  it("whenReady should resolve after getUser() completes", async () => {
    await expectAsync(service.whenReady).toBeResolved();
  });
});
