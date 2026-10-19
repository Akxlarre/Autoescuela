/**
 * "Mantener sesión iniciada" (fix-229-b, A19 de ASG-i-022).
 *
 * La sesión de Supabase siempre se guarda en `localStorage`. Si la persona desmarca la casilla se
 * guarda además:
 * - `REMEMBER_KEY = '0'` en `localStorage` (la preferencia), y
 * - la cookie `ALIVE_COOKIE` sin vencimiento: el navegador la borra al cerrarse y la comparte entre
 *   pestañas.
 * Al abrir la app, preferencia "0" sin cookie = el navegador se cerró → se descarta la sesión.
 * La cookie es solo una marca: la sesión completa puede pasar los 4 KB de una cookie.
 */
export const REMEMBER_KEY = 'auth:remember';
export const ALIVE_COOKIE = 'auth_alive';

export function shouldDiscardStoredSession(rememberFlag: string | null, cookies: string): boolean {
  if (rememberFlag !== '0') return false;
  const vivo = cookies.split(';').some((c) => c.trim().startsWith(`${ALIVE_COOKIE}=`));
  return !vivo;
}

/** Clave de `localStorage` donde supabase-js guarda la sesión (`sb-<proyecto>-auth-token`). */
export function supabaseStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}
