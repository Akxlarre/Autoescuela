import type { UserRole } from '@core/models/ui/user.model';

/**
 * Branch id centinela que no existe en BD. Fuerza 0 filas cuando una secretaria
 * está mal configurada (sin `branchId`), evitando que `null` se interprete como
 * "todas las sedes". Ver fix-027 y spec 0017 (multi-sede).
 */
export const NO_BRANCH_SCOPE = -1;

/**
 * Núcleo funcional del aislamiento por sede (fix-027).
 *
 * Resuelve el `branch_id` a usar como filtro de query según el rol:
 * - **admin**: respeta el selector de sede (`selectedBranchId`); `null` = todas las sedes.
 * - **secretaria** (y cualquier no-admin): anclada a su `branchId`. Si no tiene sede
 *   asignada (misconfig), devuelve `NO_BRANCH_SCOPE` para no exponer todas las sedes.
 *
 * Data-in / data-out: sin dependencias de Angular, testeable al instante.
 *
 * `canAccessBothBranches` (RF-013 / spec 0017): grant que hace que una secretaria se comporte
 * como un admin para el scope de sede (respeta el selector, incluido `null` = todas las sedes).
 * Sin grant, queda anclada a su `branchId` (fix-027).
 */
export function resolveBranchScope(
  role: UserRole | undefined,
  userBranchId: number | null | undefined,
  selectedBranchId: number | null,
  canAccessBothBranches = false,
): number | null {
  // admin, o secretaria con grant → respeta el selector (incl. null = todas las sedes)
  if (canChooseBranch(role, canAccessBothBranches)) return selectedBranchId;
  return userBranchId ?? NO_BRANCH_SCOPE;
}

/**
 * ¿Este usuario elige su sede, o está anclado a la suya?
 *
 * Es la mitad de `resolveBranchScope()` que decide *quién manda*, extraída porque hay
 * queries donde el `branch_id` resuelto no sirve como filtro y la pregunta que importa es
 * solo esta. Caso concreto (fix-168-b): en `announcements`, `branch_id IS NULL` significa
 * "a todas las sedes", así que filtrar por la sede de la secretaria le escondería los
 * comunicados que administración mandó a todos —y que llegaron a sus alumnos—. Ahí el
 * scope correcto lo pone la RLS (`branch_visible`), y el cliente solo debe filtrar cuando
 * hay un selector de sede que respetar.
 *
 * Vive acá y no en cada facade para que la regla de rol tenga una sola definición: la
 * causa de fix-168-b fue justamente reimplementarla a mano.
 */
export function canChooseBranch(
  role: UserRole | undefined,
  canAccessBothBranches = false,
): boolean {
  return role === 'admin' || canAccessBothBranches;
}

/**
 * Alumnos de una sede (fix-458-m, DG-115).
 *
 * `users.branch_id` es un solo valor, pero cada matrícula tiene su propia sede (spec 0007-m):
 * un alumno es de cada sede donde tiene matrícula. Con `branchId`:
 * - con matrículas → aparece si alguna es de esa sede, y la fila queda solo con esas;
 * - sin matrículas → aparece en la sede de su usuario.
 * `null` = todas las sedes (sin cambios). `NO_BRANCH_SCOPE` no coincide con ninguna sede → vacío.
 */
export function scopeStudentsToBranch<
  T extends { users: { branch_id: number | null }; enrollments: { branch_id: number | null }[] },
>(rows: T[], branchId: number | null): T[] {
  if (branchId === null) return rows;
  const scoped: T[] = [];
  for (const row of rows) {
    const enrollments = row.enrollments ?? [];
    if (enrollments.length === 0) {
      if (row.users.branch_id === branchId) scoped.push(row);
      continue;
    }
    const inBranch = enrollments.filter((e) => e.branch_id === branchId);
    if (inBranch.length > 0) scoped.push({ ...row, enrollments: inBranch });
  }
  return scoped;
}
