import type { AuditActor, AuditUsuarioOption } from '@core/models/ui/audit-log-row.model';

/**
 * Cómo se arma la consulta de `audit_log` según el filtro "Quién" (fix-069-i).
 *
 * - `innerUsers`: el embed de `users` es `!inner` (excluye filas sin usuario).
 * - `roleName`: rol de `users.roles.name` al que se limita, o null para todos.
 * - `onlySystem`: solo filas sin usuario (`user_id IS NULL`): lo que hace la limpieza automática.
 * - `branchColumn`: columna del filtro de sede. Secretarias sigue usando la sede de la secretaria
 *   (como antes de este fix); el resto usa la sede de la acción, que es la única que tiene una
 *   fila del Sistema.
 */
export interface AuditActorPlan {
  innerUsers: boolean;
  roleName: 'secretary' | 'admin' | null;
  onlySystem: boolean;
  branchColumn: 'users.branch_id' | 'branch_id';
}

export function auditActorPlan(actor: AuditActor): AuditActorPlan {
  switch (actor) {
    case 'secretarias':
      return {
        innerUsers: true,
        roleName: 'secretary',
        onlySystem: false,
        branchColumn: 'users.branch_id',
      };
    case 'admin':
      return { innerUsers: true, roleName: 'admin', onlySystem: false, branchColumn: 'branch_id' };
    case 'sistema':
      return { innerUsers: false, roleName: null, onlySystem: true, branchColumn: 'branch_id' };
    case 'todos':
      return { innerUsers: false, roleName: null, onlySystem: false, branchColumn: 'branch_id' };
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
