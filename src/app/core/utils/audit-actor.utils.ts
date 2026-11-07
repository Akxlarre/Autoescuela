import type { AuditActor, AuditUsuarioOption } from '@core/models/ui/audit-log-row.model';

/**
 * Cómo se arma la consulta de `audit_log` según el filtro "Quién" (fix-069-i).
 *
 * - `innerUsers`: el embed de `users` es `!inner` (excluye filas sin usuario).
 * - `roleName`: rol de `users.roles.name` al que se limita, o null para todos.
 * - `onlySystem`: solo filas sin usuario (`user_id IS NULL`): lo que hace la limpieza automática.
 * La sede se filtra siempre por la de la acción (`audit_log.branch_id`, fix-487-m).
 */
export interface AuditActorPlan {
  innerUsers: boolean;
  roleName: 'secretary' | 'admin' | null;
  onlySystem: boolean;
}

export function auditActorPlan(actor: AuditActor): AuditActorPlan {
  switch (actor) {
    case 'secretarias':
      return {
        innerUsers: true,
        roleName: 'secretary',
        onlySystem: false,
      };
    case 'admin':
      return { innerUsers: true, roleName: 'admin', onlySystem: false };
    case 'sistema':
      return { innerUsers: false, roleName: null, onlySystem: true };
    case 'todos':
      return { innerUsers: false, roleName: null, onlySystem: false };
  }
}

const ROLE_LABEL: Record<string, string> = {
  secretary: 'Secretaria',
  admin: 'Administrador',
  instructor: 'Instructor',
  student: 'Alumno',
};

/** Rol legible de quien hizo la acción; sin usuario es la limpieza automática ("Sistema"). */
export function auditUserLabel(roleName: string | null | undefined): string {
  if (!roleName) return 'Sistema';
  return ROLE_LABEL[roleName] ?? roleName;
}

/** Usuarios que ofrece el filtro de usuario según el Quién elegido. */
export function usuariosForActor(
  usuarios: readonly AuditUsuarioOption[],
  actor: AuditActor,
): AuditUsuarioOption[] {
  switch (actor) {
    case 'secretarias':
      return usuarios.filter((u) => u.rol === 'secretary');
    case 'admin':
      return usuarios.filter((u) => u.rol === 'admin');
    case 'sistema':
      return [];
    case 'todos':
      return [...usuarios];
  }
}
