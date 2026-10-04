/**
 * Cliente Supabase en Node, logueado como admin (spec 0019-m).
 *
 * Solo lo usan el helper de limpieza y las demos que crean datos por API. Usa la anon key
 * (la misma de la app), así que la RLS aplica igual que en la UI: nunca clave de servicio.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../src/environments/environment';
import { ACCOUNTS } from './accounts';

let client: Promise<SupabaseClient> | null = null;

export function getAdminClient(): Promise<SupabaseClient> {
  client ??= (async () => {
    const sb = createClient(environment.supabase.url, environment.supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await sb.auth.signInWithPassword({
      email: ACCOUNTS.admin.email,
      password: ACCOUNTS.admin.password,
    });
    if (error)
      throw new Error(`[e2e] No se pudo iniciar sesión como admin por API: ${error.message}`);
    return sb;
  })();
  return client;
}

/**
 * Cliente Supabase en Node logueado con una cuenta de prueba cualquiera (anon key, RLS activa).
 * Para los tests que comprueban qué puede leer o escribir un rol por fuera de la UI.
 */
export async function getClientFor(email: string, password: string): Promise<SupabaseClient> {
  const sb = createClient(environment.supabase.url, environment.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error)
    throw new Error(`[e2e] No se pudo iniciar sesión como ${email} por API: ${error.message}`);
  return sb;
}

/**
 * Cliente Supabase en Node sin sesión: solo la anon key, como cualquier visitante del sitio.
 * Para comprobar que algo NO se puede hacer sin iniciar sesión.
 */
export function getAnonClient(): SupabaseClient {
  return createClient(environment.supabase.url, environment.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** `users.id` (PK numérica) de una cuenta de prueba, buscada por email. */
export async function getUserDbId(email: string): Promise<{ id: number; branchId: number | null }> {
  const sb = await getAdminClient();
  const { data, error } = await sb
    .from('users')
    .select('id, branch_id')
    .eq('email', email)
    .single();
  if (error) throw new Error(`[e2e] No se encontró el usuario ${email}: ${error.message}`);
  return { id: data.id, branchId: data.branch_id };
}
