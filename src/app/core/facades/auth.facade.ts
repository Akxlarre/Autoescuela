import { Injectable, signal, computed, inject } from "@angular/core";
import { Router } from "@angular/router";
import type { User } from "@core/models/ui/user.model";
import { getInitialsFromDisplayName } from "@core/models/ui/user.model";
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


  private _currentUser = signal<User | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  /** Resuelve cuando la comprobación inicial de sesión ha terminado (para guards). */
  readonly whenReady: Promise<void>;

  constructor() {
    let resolveReady!: () => void;
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    // Safety timeout: si Supabase no responde en 5s, resolvemos para no colgar la app.
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
    this.whenReady = Promise.race([readyPromise, timeout]);

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
    // Definimos la interfaz para la respuesta del JOIN con roles
    interface UserWithRole {
      id: number;
      first_names: string;
      paternal_last_name: string;
      branch_id: number;
      first_login: boolean;
      active: boolean;
      role_id: number;
      roles: {
        name: string;
      } | null;
    }

    const result = await this.supabase.client
      .from("users")
      .select("id, first_names, paternal_last_name, branch_id, first_login, active, role_id, roles(name)")
      .eq("supabase_uid", authUser.id)
      .maybeSingle();

    const dbUser = result.data as unknown as UserWithRole | null;
    const error = result.error;

    if (error) {
      console.error("Error fetching user profile:", error);
    }

    const name = dbUser
      ? `${dbUser.first_names} ${dbUser.paternal_last_name}`
      : (authUser.user_metadata?.["display_name"] as string) ?? (authUser.email ? authUser.email.split("@")[0] : "Usuario");

    let roleName = dbUser?.roles?.name?.toLowerCase() || 'unknown';

    // Normalizar roles en inglés que vengan de la base de datos
    const roleMap: Record<string, string> = {
      'secretary': 'secretaria',
      'student': 'alumno',
      'teacher': 'instructor',
      'speaker': 'relator',
      'administrator': 'admin'
    };

    if (roleMap[roleName]) {
      roleName = roleMap[roleName];
    }

    const user: User = {
      id: authUser.id,
      dbId: dbUser?.id,
      name,
      email: authUser.email ?? "",
      role: roleName as any, // Mantenemos el cast final a UserRole
      initials: getInitialsFromDisplayName(name),
      firstLogin: dbUser?.first_login,
      branchId: dbUser?.branch_id,
      isActive: dbUser?.active,
    };
    this._currentUser.set(user);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.signIn(email, password);

    // Si el inicio de sesión es exitoso, debemos esperar a que el listener onAuthStateChange
    // termine de obtener el perfil de usuario de la base de datos antes de resolver,
    // de lo contrario, el router navegará sin un rol de usuario válido en memoria.
    if (!error) {
      // 50 intentos * 100ms = 5 segundos de espera máxima
      let attempts = 0;
      while (this._currentUser() === null && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }
    }

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

  async updatePassword(password: string): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    if (error) return { error };

    // Utilizamos un RPC (Stored Procedure) porque las políticas RLS 
    // de la tabla "users" impiden que los no-admin hagan UPDATE directamente.
    const { error: dbError } = await this.supabase.client.rpc('user_complete_first_login');

    if (dbError) {
      console.error("Error clearing first_login via RPC:", dbError);
      return { error: new Error('Password updated but login flag failed. Please contact admin.') };
    }

    // SOLO si el RPC fue exitoso, actualizamos el estado del Signal en el cliente.
    const user = this._currentUser();
    if (user) {
      this._currentUser.set({ ...user, firstLogin: false });
    }
    return { error: null };
  }
}
