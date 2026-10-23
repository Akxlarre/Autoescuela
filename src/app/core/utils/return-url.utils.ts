/**
 * Volver a la pantalla pedida después del login (hotfix-096-b, A18 de ASG-i-022).
 *
 * Solo se acepta una pantalla interna de la app (`/app/<algo>`): cualquier otra cosa podría usarse
 * para mandar a la persona a otro sitio después de iniciar sesión (redirección abierta).
 */
export function safeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/app/')) return null;
  if (raw.includes('//') || raw.includes('\\') || raw.includes('://')) return null;
  return raw;
}

/** Query params para `/login` cuando un guard rechaza por falta de sesión. */
export function loginQueryParams(url: string | undefined): { returnUrl: string } | undefined {
  const safe = safeReturnUrl(url);
  return safe ? { returnUrl: safe } : undefined;
}
