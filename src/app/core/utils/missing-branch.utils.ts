/**
 * Una secretaria sin sede asignada (`users.branch_id` nulo) y sin grant multisede no puede operar:
 * la RLS no le muestra nada y lo que guarda falla o queda sin sede. Se la bloquea con la pantalla
 * `/sin-sede` (hotfix-099-b). El admin sin sede es lo normal (ve todas).
 */
export function isMissingBranch(
  role: string | undefined,
  branchId: number | null | undefined,
  canAccessBothBranches = false,
): boolean {
  return role === 'secretaria' && branchId == null && !canAccessBothBranches;
}
