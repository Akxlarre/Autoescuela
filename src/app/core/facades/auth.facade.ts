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
/** Tope de espera de la carga inicial de sesión (solo si Supabase no responde). */
const AUTH_READY_TIMEOUT_MS = 15_000;

/** Esperas entre reintentos al leer el perfil tras un error de red/servidor (fix-185-b). */
const PROFILE_RETRY_DELAYS_MS = [1000, 2000];

@Injectable({
  providedIn: 'root',
})
export class AuthFacade {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private branchFacade = inject(BranchFacade);

  private _currentUser = signal<User | null>(null);

  /**
   * La sesión actual viene de un link de "recuperar contraseña" y todavía no se fijó la clave
   * nueva (fix-181-b). Mientras sea true, authGuard no deja entrar a /app.
   */
  private _passwordRecovery = signal(false);
  readonly passwordRecovery = this._passwordRecovery.asReadonly();

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

    // Safety timeout: solo para no colgar la app si Supabase no responde. NO es el camino normal:
    // whenReady se resuelve cuando termina la carga inicial (sesión + perfil). Era de 5 s y, con
    // red lenta, ganaba la carrera: los guards leían currentUser() = null y mandaban a /login a
    // usuarios con sesión válida (S17, fix-185-b).
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, AUTH_READY_TIMEOUT_MS));
    this.whenReady = Promise.race([readyPromise, timeout]);

    this.supabase.client.auth.onAuthStateChange((event: any, session: any) => {
      if (event === 'INITIAL_SESSION') {
        // INITIAL_SESSION siempre dispara al arrancar (con o sin sesión).
        // Es la única fuente de verdad para la carga inicial; evita la race
        // condition que provocaba "Refresh Token Not Found" cuando getUser()
        // y INITIAL_SESSION intentaban rotar el token en paralelo.
        if (session?.user) {
          this.loadUserFromSession(session.user)
            .catch(() => undefined)
            .finally(() => resolveReady());
        } else {
          resolveReady();
        }
      } else if (event === 'SIGNED_IN' && session?.user) {
        this.loadUserFromSession(session.user).catch(() => undefined);
      } else if (event === 'PASSWORD_RECOVERY') {
        // El link del correo abre una sesión: sin esto la app la trataba como un login normal y
        // el usuario entraba sin fijar clave nueva (fix-181-b).
        this._passwordRecovery.set(true);
        if (session?.user) this.loadUserFromSession(session.user).catch(() => undefined);
        void this.router.navigate(['/recuperar-contrasena']);
      } else if (event === 'SIGNED_OUT') {
        this.disposeRealtime();
        this._passwordRecovery.set(false);
        this._currentUser.set(null);
      }
    });
  }

  /** Cargas de perfil en curso por id de Auth: SIGNED_IN y login() comparten una sola (fix-185-b). */
  private readonly profileLoads = new Map<string, Promise<void>>();

  private loadUserFromSession(authUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }): Promise<void> {
    // Si ya tenemos el usuario y el ID no ha cambiado, no recargamos
    if (this._currentUser()?.id === authUser.id) return Promise.resolve();
    const inFlight = this.profileLoads.get(authUser.id);
    if (inFlight) return inFlight;

    const load = this.buildUserFromDb(authUser)
      .then((user) => this._currentUser.set(user))
      .finally(() => this.profileLoads.delete(authUser.id));
    this.profileLoads.set(authUser.id, load);
    return load;
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

    // Un corte de red al leer el perfil NO es "usuario sin rol": antes se armaba el usuario con
    // rol 'unknown' y roleRedirectGuard cerraba una sesión válida (S17, fix-185-b). Se reintenta
    // y, si sigue fallando, se lanza: el usuario queda sin cargar pero la sesión no se cierra.
    let result = await this.fetchProfileRow(authUser.id);
    for (const delayMs of PROFILE_RETRY_DELAYS_MS) {
      if (!result.error) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      result = await this.fetchProfileRow(authUser.id);
    }
    if (result.error) {
      console.error('Error fetching user profile:', result.error);
      throw result.error;
    }

    const dbUser = result.data as unknown as UserWithRole | null;

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

  private fetchProfileRow(supabaseUid: string) {
    return this.supabase.client
      .from('users')
      .select(
        'id, first_names, paternal_last_name, branch_id, can_access_both_branches, first_login, active, role_id, roles(name)',
      )
      .eq('supabase_uid', supabaseUid)
      .maybeSingle();
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
    let updated: User;
    try {
      updated = await this.buildUserFromDb({ id: cur.id, email: cur.email });
    } catch {
      return; // sin red: se conserva el perfil vigente (fix-185-b)
    }
    this._currentUser.set(updated);
    if (wasGranted && !(updated.canAccessBothBranches ?? false)) {
      this.branchFacade.reset();
    }
  }

  async login(email: string, password: string): Promise<{ error: Error | null }> {
    const { data, error } = await this.supabase.signIn(email, password);
    if (error) return { error: new Error(mapAuthError(error)) };

    // Se espera la carga del perfil de ESTA sesión antes de devolver éxito; si no, el router
    // navega sin rol. Antes era un polling de 5 s que, con red lenta, devolvía éxito sin perfil y
    // roleRedirectGuard cerraba la sesión en silencio (S17/S6, fix-185-b).
    const authUser = data?.session?.user ?? data?.user;
    if (authUser) {
      try {
        await this.loadUserFromSession(authUser);
      } catch (profileError) {
        console.error('Error loading user profile after login:', profileError);
      }
    }

    const user = this._currentUser();
    if (!user || !user.role || user.role === 'unknown') {
      await this.supabase.signOut();
      this._currentUser.set(null);
      return {
        error: new Error(
          'No se pudo cargar tu perfil. Si el problema continúa, contacta al administrador.',
        ),
      };
    }
    return { error: null };
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
    const { error } = await this.supabase.resetPasswordForEmail(
      email,
      `${window.location.origin}/recuperar-contrasena`,
    );
    return { error: error ? new Error(mapAuthError(error)) : null };
  }

  /**
   * Cambio de clave desde Ajustes (fix-216-b, P04 de ASG-i-034): verifica la actual antes de
   * cambiarla, para que alguien frente a una sesión abierta ajena no pueda dejar afuera al titular.
   * La verificación es un inicio de sesión con el mismo usuario (renueva la sesión, no la cierra).
   */
  async changePassword(current: string, next: string): Promise<{ error: Error | null }> {
    const email = this._currentUser()?.email;
    if (!email) return { error: new Error('No hay una sesión activa.') };

    const { error } = await this.supabase.signIn(email, current);
    if (error) return { error: new Error('La contraseña actual no es correcta.') };

    return this.updatePassword(next);
  }

  /** Fija la clave nueva de una sesión de recuperación y la da por terminada (fix-181-b). */
  async completePasswordRecovery(password: string): Promise<{ error: Error | null }> {
    const result = await this.updatePassword(password);
    if (!result.error) this._passwordRecovery.set(false);
    return result;
  }

  logout(options: { redirect?: boolean } = {}): void {
    const { redirect = true } = options;
    this.disposeRealtime();
    this.supabase.signOut();
    // La sede activa vive en `localStorage` bajo una clave sin namespacing por usuario, y
    // `BranchFacade` la re-lee al construirse, antes de que se sepa quién se autenticó. Si no
    // se limpia acá, en una PC compartida —el mostrador— el próximo usuario hereda la sede del
    // anterior: ya dejó a una secretaria viendo su historial de comunicados vacío, sin error y
    // sin selector con el que darse cuenta (fix-168-b, fix-171-b).
    this.branchFacade.reset();
    this._currentUser.set(null);
    if (redirect) {
      this.router.navigate(['/']);
    }
  }

  setUser(user: User | null): void {
    this._currentUser.set(user);
  }

  async updatePassword(password: string): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    if (error) return { error: new Error(mapAuthError(error)) };

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
