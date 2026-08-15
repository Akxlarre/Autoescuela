import type { BranchOption } from '@core/models/ui/branch.model';

/**
 * Resuelve el texto de marca que muestra el sidebar (fix-146-b).
 *
 * Núcleo funcional puro: extraído de `LogoComponent`, que lo calculaba inyectando
 * `AuthFacade` + `BranchFacade` siendo un componente presentacional de `shared/`.
 * Ahora la decisión vive acá (testeable sin Angular) y `SidebarComponent` (layout/,
 * autorizado a inyectar Facades) le pasa el resultado al logo vía `input()`.
 *
 * Reglas:
 * - Admin → la sede que tenga filtrada; sin filtro ("todas") → marca genérica.
 * - Secretaria → siempre su propia sede, nunca el filtro global.
 * - Cualquier otro rol → marca genérica.
 */
export function resolveBrandText(
  role: string | undefined,
  selectedBranchId: number | null,
  userBranchId: number | null | undefined,
  branches: readonly Pick<BranchOption, 'id' | 'name'>[],
): string {
  const fallback = 'Autoescuela';

  let activeId: number | null | undefined = null;
  if (role === 'admin') {
    activeId = selectedBranchId;
  } else if (role === 'secretaria') {
    activeId = userBranchId;
  }

  if (!activeId) {
    return fallback;
  }

  return branches.find((b) => b.id === activeId)?.name ?? fallback;
}
