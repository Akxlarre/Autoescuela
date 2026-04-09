import { Injectable, signal } from "@angular/core";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { environment } from "../../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private _session = signal<any>(null); // Type 'any' to avoid import issues if Session isn't exported, but it is in supabase-js
  public readonly session = this._session.asReadonly();

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    );

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
  async signUp(
    email: string,
    password: string,
    options?: { data?: Record<string, unknown> },
  ) {
    return await this.supabase.auth.signUp({ email, password, options });
  }

  async signIn(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    return await this.supabase.auth.signOut();
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

  async resetPasswordForEmail(email: string) {
    return await this.supabase.auth.resetPasswordForEmail(email);
  }
}
