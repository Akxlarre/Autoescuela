/**
 * Error de un enlace de correo de Supabase Auth (fix-181-b, F6).
 *
 * Cuando el enlace de "restablecer contraseña" venció o ya se usó, Supabase no crea la sesión y
 * vuelve a la app con el error en la URL: en el fragmento (`#error=…&error_code=otp_expired`,
 * flujo implícito, el que usa esta app) o en la query (flujo PKCE). supabase-js no lo borra de la
 * URL, así que el guard de `/recuperar-contrasena` lo puede leer.
 */
export type AuthLinkError = 'vencido' | 'invalido';

const MESSAGES: Record<AuthLinkError, string> = {
  vencido:
    'El enlace para restablecer tu contraseña venció o ya se usó. Pide uno nuevo con tu correo.',
  invalido: 'El enlace para restablecer tu contraseña no es válido. Pide uno nuevo con tu correo.',
};

function paramsOf(raw: string): URLSearchParams {
  return new URLSearchParams(raw.replace(/^[#?]/, ''));
}

/** `hash` y `search` tal como vienen en `location`. `null` si la URL no trae un error de Auth. */
export function authLinkErrorFromUrl(hash: string, search: string): AuthLinkError | null {
  for (const params of [paramsOf(hash), paramsOf(search)]) {
    const code = params.get('error_code');
    if (code === 'otp_expired') return 'vencido';
    if (code || params.get('error') || params.get('error_description')) return 'invalido';
  }
  return null;
}

/** Texto del aviso para el valor del query param `enlace` del login. Otro valor → `null`. */
export function authLinkErrorMessage(value: string | null): string | null {
  return value === 'vencido' || value === 'invalido' ? MESSAGES[value] : null;
}
