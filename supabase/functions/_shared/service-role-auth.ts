// supabase/functions/_shared/service-role-auth.ts
//
// Autorización para edge functions que solo debe invocar un proceso del servidor (pg_cron vía
// net.http_post con la service key del Vault), nunca un usuario ni la anon key.
//
// ⚠️ Solo es seguro con `verify_jwt` en su default `true` para la función: el gateway de
// Supabase verifica la FIRMA del token antes de llegar al handler. Acá solo se decide la
// AUTORIZACIÓN (que el claim `role` sea `service_role`). Con `verify_jwt = false`, cualquiera
// podría fabricar un token sin firmar con ese claim.
//
// Se valida el claim y no una comparación de strings contra `SUPABASE_SERVICE_ROLE_KEY`: la
// clave que el cron saca del Vault es el JWT legacy y no necesariamente es idéntica a la
// variable de entorno del runtime (conviven formatos de key distintos).
//
// Usado por: auto-create-next-promotions.

/** Lee el claim `role` del payload de un JWT, sin verificar firma (eso lo hace el gateway). */
export function readJwtRole(token: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

/** `true` si el header `Authorization` trae un token de rol de servicio. */
export function isServiceRoleRequest(authHeader: string | null, serviceKey?: string): boolean {
  const token = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return false;
  if (serviceKey && token === serviceKey) return true;
  return readJwtRole(token) === 'service_role';
}
