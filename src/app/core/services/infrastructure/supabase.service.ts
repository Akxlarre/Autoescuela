import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';
import {
  ALIVE_COOKIE,
  REMEMBER_KEY,
  shouldDiscardStoredSession,
  supabaseStorageKey,
} from '@core/utils/remember-session.utils';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private _session = signal<any>(null); // Type 'any' to avoid import issues if Session isn't exported, but it is in supabase-js
  public readonly session = this._session.asReadonly();

  constructor() {
    // fix-229-b (A19): "Mantener sesión iniciada" desmarcada y el navegador se cerró → la sesión
    // guardada se descarta ANTES de que el cliente la restaure.
    this.discardSessionIfBrowserWasClosed();

    this.supabase = createClient(environment.supabase.url, environment.supabase.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });

    // Escuchar cambios de sesión de forma centralizada
    this.supabase.auth.onAuthStateChange((event, session) => {
      this._session.set(session);
    });

    // Carga inicial de sesión (una sola vez)
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this._session.set(session);
    });
  }

  get client() {
    return this.supabase;
  }

  // Auth
  async signUp(email: string, password: string, options?: { data?: Record<string, unknown> }) {
    return await this.supabase.auth.signUp({ email, password, options });
  }

  async signIn(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({ email, password });
  }

  /**
   * Cierra la sesión solo en este equipo (fix-184-b). El default de Supabase es `global`: cerrar
   * en el mostrador sacaba a la persona también de su celular. Para sacar a alguien de todos los
   * equipos se desactiva el usuario (fix-180-b).
   */
  /**
   * Guarda "Mantener sesión iniciada" (fix-229-b). Desmarcada: preferencia en `localStorage` +
   * cookie de sesión (sin vencimiento: el navegador la borra al cerrarse y la comparte entre
   * pestañas). Marcada: se borran las dos y la sesión dura como siempre.
   */
  setRememberSession(remember: boolean): void {
    if (typeof localStorage === 'undefined' || typeof document === 'undefined') return;
    if (remember) {
      localStorage.removeItem(REMEMBER_KEY);
      document.cookie = `${ALIVE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    } else {
      localStorage.setItem(REMEMBER_KEY, '0');
      document.cookie = `${ALIVE_COOKIE}=1; path=/; SameSite=Lax`;
    }
  }

  private discardSessionIfBrowserWasClosed(): void {
    if (typeof localStorage === 'undefined' || typeof document === 'undefined') return;
    if (!shouldDiscardStoredSession(localStorage.getItem(REMEMBER_KEY), document.cookie)) return;
    const key = supabaseStorageKey(environment.supabase.url);
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}-code-verifier`);
    localStorage.removeItem(REMEMBER_KEY);
  }

  async signOut() {
    const result = await this.supabase.auth.signOut({ scope: 'local' });
    if (result.error) {
      // hotfix-091-b (E10): si el servidor no responde (sin red), supabase-js NO borra la sesión
      // guardada y la próxima persona en el mostrador la encuentra abierta. Se borra igual: el
      // cliente lee la sesión de este almacenamiento en cada consulta.
      const storageKey = (this.supabase.auth as unknown as { storageKey: string }).storageKey;
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`${storageKey}-code-verifier`);
    }
    return result;
  }

  async getUser() {
    return await this.supabase.auth.getUser();
  }

  /** Sesión actual (para interceptor HTTP). Refresca si está expirada. */
  async getSession() {
    return await this.supabase.auth.getSession();
  }

  /** Refresca la sesión con el refresh token (para interceptor en 401). */
  async refreshSession() {
    return await this.supabase.auth.refreshSession();
  }

  /** `redirectTo`: pantalla a la que vuelve el link del correo (fix-181-b). */
  async resetPasswordForEmail(email: string, redirectTo?: string) {
    return await this.supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
  }
}
