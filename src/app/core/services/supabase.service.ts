import { Injectable } from "@angular/core";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey,
    );
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
