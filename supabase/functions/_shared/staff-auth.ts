// supabase/functions/_shared/staff-auth.ts
//
// Autorización de staff para Edge Functions que usan la clave de servicio (spec 0009-i).
//
// `verify_jwt` acepta la anon key como JWT válido, así que "hay token" no basta: hay que resolver
// el usuario real con `auth.getUser()` y su rol desde `users`/`roles`. El rol nunca se lee del body.

import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Nombres de rol tal como están en la tabla `roles`. */
export type StaffRole = 'admin' | 'secretary';

export type StaffAccess =
  | {
      ok: true;
      userId: number;
      role: StaffRole;
      /** `users.branch_id`: sede propia (null en el admin). */
      branchId: number | null;
      /** `users.can_access_both_branches`: grant multi-sede de la secretaria. */
      canAccessBothBranches: boolean;
    }
  | { ok: false; status: 401 | 403 | 500; error: string };

export interface StaffAccessInput {
  /** `auth.users.id` del token, o null si no hay usuario real (sin header, anon key, token inválido). */
  authUserId: string | null;
  /** `users.id`, o null si el usuario de Auth no tiene fila en `users`. */
  dbUserId: number | null;
  /** `roles.name` del usuario, o null si no tiene. */
  roleName: string | null;
  /** `users.branch_id`. */
  branchId?: number | null;
  /** `users.can_access_both_branches`. */
  canAccessBothBranches?: boolean;
}

const NOT_AUTHENTICATED = 'No autorizado';
const FORBIDDEN = 'No tienes permiso para realizar esta acción';

/** Núcleo funcional: decide a partir de lo ya resuelto. Sin I/O. */
export function decideStaffAccess(
  input: StaffAccessInput,
  allowed: readonly StaffRole[],
): StaffAccess {
  if (!input.authUserId) return { ok: false, status: 401, error: NOT_AUTHENTICATED };

  const role = input.roleName;
  if (input.dbUserId === null || !role || !(allowed as readonly string[]).includes(role)) {
    return { ok: false, status: 403, error: FORBIDDEN };
  }
  return {
    ok: true,
    userId: input.dbUserId,
    role: role as StaffRole,
    branchId: input.branchId ?? null,
    canAccessBothBranches: input.canAccessBothBranches ?? false,
  };
}

export type BranchScope =
  | { ok: true; branchId: number | null }
  | { ok: false; status: 403; error: string };

/**
 * Sede que puede consultar quien llama (fix-430-m). Las funciones que exportan listados usan la
 * clave de servicio (saltan RLS), así que la sede pedida en el body se valida aquí, con la misma
 * regla que la RLS por sede (spec 0047-b):
 *   - admin o secretaria con grant multi-sede → la sede pedida; null = todas.
 *   - secretaria sin grant → solo la suya; sin sede pedida se acota a la suya (nunca todas).
 * Núcleo funcional: sin I/O.
 */
export function resolveBranchScope(
  access: { role: StaffRole; branchId: number | null; canAccessBothBranches: boolean },
  requested: unknown,
): BranchScope {
  const pedida = typeof requested === 'number' && Number.isInteger(requested) ? requested : null;
  if (access.role === 'admin' || access.canAccessBothBranches) return { ok: true, branchId: pedida };

  if (access.branchId === null || (pedida !== null && pedida !== access.branchId)) {
    return { ok: false, status: 403, error: FORBIDDEN };
  }
  return { ok: true, branchId: access.branchId };
}

/**
 * Resuelve quién llama y decide si puede usar la función.
 * Uso: `const access = await requireStaff(req, ['admin', 'secretary']);
 *       if (!access.ok) return authErrorResponse(access, corsHeaders);`
 */
export async function requireStaff(
  req: Request,
  allowed: readonly StaffRole[],
): Promise<StaffAccess> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return decideStaffAccess({ authUserId: null, dbUserId: null, roleName: null }, allowed);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData?.user) {
    return decideStaffAccess({ authUserId: null, dbUserId: null, roleName: null }, allowed);
  }

  const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: row, error: rowError } = await serviceClient
    .from('users')
    .select('id, branch_id, can_access_both_branches, roles ( name )')
    .eq('supabase_uid', authData.user.id)
    .maybeSingle();
  if (rowError) return { ok: false, status: 500, error: 'No se pudo verificar los permisos' };

  // `roles` llega como objeto o como arreglo según cómo infiera la relación PostgREST.
  const roles = (row as { roles?: unknown } | null)?.roles;
  const roleName =
    (Array.isArray(roles) ? (roles[0] as { name?: string } | undefined)?.name : (roles as { name?: string } | null)?.name) ??
    null;

  const user = row as {
    id?: number;
    branch_id?: number | null;
    can_access_both_branches?: boolean | null;
  } | null;
  return decideStaffAccess(
    {
      authUserId: authData.user.id,
      dbUserId: user?.id ?? null,
      roleName,
      branchId: user?.branch_id ?? null,
      canAccessBothBranches: user?.can_access_both_branches === true,
    },
    allowed,
  );
}

/** Respuesta de rechazo con el formato `{ "error": "..." }` que lee el cliente (DG-085). */
export function authErrorResponse(
  access: { status: number; error: string },
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: access.error }), {
    status: access.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
