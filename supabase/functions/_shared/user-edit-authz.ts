// supabase/functions/_shared/user-edit-authz.ts
//
// Autorización sobre el OBJETIVO de una edición de usuario (fix-179-b).
//
// Las Edge Functions de edición usan la clave de servicio (se saltan la RLS), así que validar
// solo "quién llama" no alcanza: hay que validar también "a quién se edita". Sin esto, una
// secretaria podía mandar el `userId` de un admin, cambiarle el email en Auth y tomar su cuenta.
//
// Funciones puras (sin I/O): la Edge Function carga caller y objetivo, y decide con esto.
// Tests: deno test supabase/functions/_shared/user-edit-authz.test.ts

export interface EditCaller {
  /** roles.name del llamador: 'admin' | 'secretary' | … */
  role: string | null | undefined;
  /** users.branch_id del llamador */
  branchId: number | null;
  /** users.can_access_both_branches (grant multi-sede) */
  bothBranches: boolean;
}

export interface AuthzResult {
  ok: boolean;
  status: number;
  message: string;
}

const OK: AuthzResult = { ok: true, status: 200, message: '' };
const deny = (status: number, message: string): AuthzResult => ({ ok: false, status, message });

/** Admin o secretaria multi-sede: alcance sobre todas las sedes. */
function seesAllBranches(caller: EditCaller): boolean {
  return caller.role === 'admin' || (caller.role === 'secretary' && caller.bothBranches);
}

/**
 * ¿Puede `caller` editar el perfil (nombre, teléfono, email) del usuario `target`?
 * - El objetivo debe ser un alumno (nunca un admin, secretaria o instructor).
 * - Una secretaria sin grant solo edita alumnos de su propia sede.
 */
export function authorizeStudentProfileEdit(
  caller: EditCaller,
  target: { role: string | null | undefined; branchId: number | null } | null,
): AuthzResult {
  if (caller.role !== 'admin' && caller.role !== 'secretary') {
    return deny(403, 'Solo administradores y secretarias pueden editar alumnos');
  }
  if (!target) return deny(404, 'No se encontró al alumno en la BD');
  if (target.role !== 'student') {
    return deny(403, 'Esta acción solo permite editar alumnos');
  }
  if (seesAllBranches(caller)) return OK;
  if (target.branchId === null || target.branchId !== caller.branchId) {
    return deny(403, 'No puedes editar alumnos de otra sede');
  }
  return OK;
}

/**
 * ¿Puede `caller` editar el instructor `target` (y escribir en su usuario `requestedUserId`)?
 * - `requestedUserId` debe ser el usuario dueño del instructor (no se acepta otro `userId`).
 * - Ese usuario debe tener rol instructor.
 * - Una secretaria sin grant solo edita instructores de su sede o "ambas sedes", y no puede
 *   cambiarles la sede. `requestedBranchId === undefined` = el body no pide cambiar la sede.
 */
export function authorizeInstructorEdit(
  caller: EditCaller,
  target: {
    instructorUserId: number;
    role: string | null | undefined;
    branchId: number | null;
    bothBranches: boolean;
  } | null,
  requestedUserId: number,
  requestedBranchId: number | null | undefined,
): AuthzResult {
  if (caller.role !== 'admin' && caller.role !== 'secretary') {
    return deny(403, 'Solo administradores y secretarias pueden editar instructores');
  }
  if (!target) return deny(404, 'No se encontró el instructor en la BD');
  if (target.instructorUserId !== requestedUserId) {
    return deny(400, 'El usuario indicado no corresponde a este instructor');
  }
  if (target.role !== 'instructor') {
    return deny(403, 'Esta acción solo permite editar instructores');
  }
  if (seesAllBranches(caller)) return OK;

  const inScope =
    target.bothBranches || target.branchId === null || target.branchId === caller.branchId;
  if (!inScope) return deny(403, 'No puedes editar instructores de otra sede');

  if (requestedBranchId !== undefined && requestedBranchId !== target.branchId) {
    return deny(403, 'Solo un administrador puede cambiar la sede de un instructor');
  }
  return OK;
}

/**
 * fix-198-b — ¿Puede `caller` crear un instructor en la sede `requestedBranchId`?
 * Una secretaria sin grant solo en su propia sede (el body ya no se toma tal cual).
 */
export function authorizeInstructorCreate(
  caller: EditCaller,
  requestedBranchId: number | null | undefined,
): AuthzResult {
  if (caller.role !== 'admin' && caller.role !== 'secretary') {
    return deny(403, 'Solo administradores y secretarias pueden crear instructores');
  }
  if (seesAllBranches(caller)) return OK;
  if (caller.branchId === null || requestedBranchId !== caller.branchId) {
    return deny(403, 'No puedes crear instructores en otra sede');
  }
  return OK;
}

/**
 * fix-198-b — ¿Puede `caller` reenviar la invitación del usuario `target`?
 * El objetivo debe ser un instructor; una secretaria sin grant solo los de su sede o "ambas".
 */
export function authorizeInstructorReinvite(
  caller: EditCaller,
  target: { role: string | null | undefined; branchId: number | null; bothBranches: boolean } | null,
): AuthzResult {
  if (caller.role !== 'admin' && caller.role !== 'secretary') {
    return deny(403, 'Solo administradores y secretarias pueden realizar esta acción');
  }
  if (!target) return deny(404, 'Usuario no encontrado');
  if (target.role !== 'instructor') {
    return deny(403, 'Esta acción solo aplica a instructores');
  }
  if (seesAllBranches(caller)) return OK;
  const inScope =
    target.bothBranches || target.branchId === null || target.branchId === caller.branchId;
  if (!inScope) return deny(403, 'No puedes reenviar invitaciones de instructores de otra sede');
  return OK;
}
