import { Injectable, signal, computed, inject } from "@angular/core";
import { Router } from "@angular/router";
import type { User } from "@core/models/domain/user.model";
import { getInitialsFromDisplayName } from "@core/models/domain/user.model";
import { SupabaseService } from "../services/infrastructure/supabase.service";

/**
 * AuthFacade - Facade de autenticación con Supabase.
 *
 * Actúa como capa intermedia entre la UI y SupabaseService.
 * Mantiene el estado de sesión como Signals y expone métodos de autenticación.
 * La UI inyecta AuthFacade; nunca inyecta SupabaseService directamente.
 */
@Injectable({
  providedIn: "root",
})
export class AuthFacade {
  private supabase = inject(SupabaseService);
  private router = inject(Router);


  // TODO: ELIMINAR ESTO (USUARIO MOCK)
  private _currentUser = signal<User | null>({
    id: 'mock-id-123',
    name: 'Carlos Mendez',
    email: 'carlos.mendez@empresa.com',
    role: 'admin',
    initials: 'CM',
  });

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  /** Resuelve cuando la comprobación inicial de sesión ha terminado (para guards). */
  readonly whenReady: Promise<void>;

  constructor() {
    let resolveReady!: () => void;
    this.whenReady = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    this.supabase.client.auth.onAuthStateChange((event: any, session: any) => {
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        session?.user
      ) {
        this.loadUserFromSession(session.user);
      } else if (event === "SIGNED_OUT") {
        this._currentUser.set(null);
      }
    });

    this.supabase
      .getUser()
      .then(async ({ data: { user } }: any) => {
        if (user) await this.loadUserFromSession(user);
      })
      .finally(() => resolveReady());
  }

  private async loadUserFromSession(authUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { data: profile } = await this.supabase.client
      .from("profiles")
      .select("display_name, avatar_url, role")
      .eq("id", authUser.id)
      .maybeSingle();

    const name =
      (profile?.display_name as string) ??
      (authUser.user_metadata?.["display_name"] as string) ??
      (authUser.email ? authUser.email.split("@")[0] : "Usuario");

    const user: User = {
      id: authUser.id,
      name,
      email: authUser.email ?? "",
      role: profile?.role === "admin" ? "admin" : "member",
      initials: getInitialsFromDisplayName(name),
      avatarUrl: profile?.avatar_url ?? undefined,
    };
    this._currentUser.set(user);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.signIn(email, password);
    return { error: error ?? null };
  }

  async signUp(
    email: string,
    password: string,
    options?: { data?: Record<string, unknown> },
  ): Promise<{
    data: { user?: { id: string } | null; session?: unknown } | null;
    error: Error | null;
  }> {
    const result = await this.supabase.signUp(email, password, options);
    return {
      data: result.data
        ? {
          user: result.data.user ?? undefined,
          session: result.data.session ?? undefined,
        }
        : null,
      error: (result.error as Error) ?? null,
    };
  }

  async resetPasswordForEmail(email: string): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.resetPasswordForEmail(email);
    return { error: (error as Error) ?? null };
  }

  logout(): void {
    this.supabase.signOut();
    this._currentUser.set(null);
    this.router.navigate(["/"]);
  }

  setUser(user: User | null): void {
    this._currentUser.set(user);
  }
}
