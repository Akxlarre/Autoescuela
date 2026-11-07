import type { BranchOption } from '@core/models/ui/branch.model';

/** Nombre del producto: la puerta de la app y donde no corresponde una escuela (fix-242-b). */
export const PRODUCT_NAME = 'Gestor de Autoescuelas';

/**
 * Resuelve el texto de marca que muestra el sidebar (fix-146-b, fix-242-b).
 *
 * Núcleo funcional puro: extraído de `LogoComponent`, que lo calculaba inyectando
 * `AuthFacade` + `BranchFacade` siendo un componente presentacional de `shared/`.
 * Ahora la decisión vive acá (testeable sin Angular) y `SidebarComponent` (layout/,
 * autorizado a inyectar Facades) le pasa el resultado al logo vía `input()`.
 *
 * Criterio: adentro de la app va la escuela; donde no corresponde una, el producto.
 * - Admin → la sede que tenga filtrada; sin filtro ("todas") → el producto.
 * - Secretaria, instructor y alumno → su propia sede (`users.branch_id`), nunca el filtro
 *   global del topbar (que es solo-admin).
 * - Sin usuario, rol desconocido, sin sede o sede aún no cargada → el producto.
 */
export function resolveBrandText(
  role: string | undefined,
  selectedBranchId: number | null,
  userBranchId: number | null | undefined,
  branches: readonly Pick<BranchOption, 'id' | 'name'>[],
): string {
  let activeId: number | null | undefined = null;
  if (role === 'admin') {
    activeId = selectedBranchId;
  } else if (role === 'secretaria' || role === 'instructor' || role === 'alumno') {
    activeId = userBranchId;
  }

  if (!activeId) {
    return PRODUCT_NAME;
  }

  return branches.find((b) => b.id === activeId)?.name ?? PRODUCT_NAME;
}
