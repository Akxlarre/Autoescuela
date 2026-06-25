import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { User } from '@core/models/ui/user.model';
import { getInitialsFromDisplayName } from '@core/models/ui/user.model';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { mapAuthError } from '@core/utils/auth-errors.utils';

/**
 * AuthFacade - Facade de autenticación con Supabase.
 *
 * Actúa como capa intermedia entre la UI y SupabaseService.
 * Mantiene el estado de sesión como Signals y expone métodos de autenticación.
 * La UI inyecta AuthFacade; nunca inyecta SupabaseService directamente.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthFacade {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private branchFacade = inject(BranchFacade);

  private _currentUser = signal<User | null>(null);

  /** Canal Realtime de la fila propia de `users` (grant multi-sede en caliente, AC-E3). */
  private realtimeChannel: RealtimeChannel | null = null;
  private realtimeDbId: number | null = null;

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
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        this.loadUserFromSession(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.disposeRealtime();
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
    // Si ya tenemos el usuario y el ID no ha cambiado, no recargamos
    if (this._currentUser()?.id === authUser.id) return;
    this._currentUser.set(await this.buildUserFromDb(authUser));
  }

  /**
   * Lee el perfil de `users` desde la BD y lo mapea al modelo de UI.
   * Reutilizado por la carga inicial de sesión y por el refresh en caliente (Realtime).
   */
  private async buildUserFromDb(authUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }): Promise<User> {
    // Definimos la interfaz para la respuesta del JOIN con roles
    interface UserWithRole {
      id: number;
      first_names: string;
      paternal_last_name: string;
      branch_id: number;
      can_access_both_branches: boolean;
      first_login: boolean;
      active: boolean;
      role_id: number;
      roles: {
        name: string;
      } | null;
    }

    const result = await this.supabase.client
      .from('users')
      .select(
        'id, first_names, paternal_last_name, branch_id, can_access_both_branches, first_login, active, role_id, roles(name)',
      )
      .eq('supabase_uid', authUser.id)
      .maybeSingle();

    const dbUser = result.data as unknown as UserWithRole | null;
    const error = result.error;

    if (error) {
      console.error('Error fetching user profile:', error);
    }

    const name = dbUser
      ? `${dbUser.first_names} ${dbUser.paternal_last_name}`
      : ((authUser.user_metadata?.['display_name'] as string) ??
        (authUser.email ? authUser.email.split('@')[0] : 'Usuario'));

    let roleName = dbUser?.roles?.name?.toLowerCase() || 'unknown';

    // Normalizar roles en inglés que vengan de la base de datos
    const roleMap: Record<string, string> = {
      secretary: 'secretaria',
      student: 'alumno',
      instructor: 'instructor',
      admin: 'admin',
    };

    if (roleMap[roleName]) {
      roleName = roleMap[roleName];
    }

    return {
      id: authUser.id,
      dbId: dbUser?.id,
      name,
      email: authUser.email ?? '',
      role: roleName as any, // Mantenemos el cast final a UserRole
      initials: getInitialsFromDisplayName(name),
      firstLogin: dbUser?.first_login,
      branchId: dbUser?.branch_id,
      canAccessBothBranches: dbUser?.can_access_both_branches ?? false,
      isActive: dbUser?.active,
    };
  }

  // ── Realtime: grant multi-sede en caliente (AC-E3, spec 0017) ──────────────

  /**
   * Suscribe Realtime a la fila propia de `users` para reflejar en vivo los cambios del
   * grant `can_access_both_branches` (otorgar/revocar sin re-login). Idempotente: no
   * re-suscribe si ya hay un canal para el mismo usuario. Llamar desde AppShell cuando
   * el usuario está autenticado.
   */
  initializeRealtime(): void {
    const dbId = this._currentUser()?.dbId;
    if (!dbId || dbId === this.realtimeDbId) return;
    this.disposeRealtime();
    this.realtimeDbId = dbId;
    this.realtimeChannel = this.supabase.client
      .channel('user-self')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${dbId}` },
        () => void this.refreshProfile(),
      )
      .subscribe();
  }

  /** Cancela la suscripción Realtime. Llamar al logout. Idempotente. */
  disposeRealtime(): void {
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    this.realtimeDbId = null;
  }

  /**
   * Re-lee el perfil del usuario actual (forzado, sin el guard de id) tras un cambio en su
   * fila de `users`. Si el grant multi-sede fue revocado, resetea la sede activa para que el
   * selector desaparezca y las facades vuelvan a anclar a la sede propia.
   */
  private async refreshProfile(): Promise<void> {
    const cur = this._currentUser();
    if (!cur) return;
    const wasGranted = cur.canAccessBothBranches ?? false;
    const updated = await this.buildUserFromDb({ id: cur.id, email: cur.email });
    this._currentUser.set(updated);
    if (wasGranted && !(updated.canAccessBothBranches ?? false)) {
      this.branchFacade.reset();
    }
  }

  async login(email: string, password: string): Promise<{ error: Error | null }> {
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

    return { error: error ? new Error(mapAuthError(error)) : null };
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
      error: result.error ? new Error(mapAuthError(result.error)) : null,
    };
  }

  async resetPasswordForEmail(email: string): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.resetPasswordForEmail(email);
    return { error: error ? new Error(mapAuthError(error)) : null };
  }

  logout(): void {
    this.disposeRealtime();
    this.supabase.signOut();
    this._currentUser.set(null);
    this.router.navigate(['/']);
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
      console.error('Error clearing first_login via RPC:', dbError);
      return {
        error: new Error(
          'Contraseña actualizada, pero hubo un error al sincronizar. Por favor, contacta al administrador.',
        ),
      };
    }

    // SOLO si el RPC fue exitoso, actualizamos el estado del Signal en el cliente.
    const user = this._currentUser();
    if (user) {
      this._currentUser.set({ ...user, firstLogin: false });
    }
    return { error: null };
  }
}
