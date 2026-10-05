/**
 * Tamaño del panel lateral del layout (el drawer) según el ancho de la ventana. Lo usan la
 * apertura del panel y su ajuste al cambiar el tamaño de la ventana (fix-317-m), para que las dos
 * calculen lo mismo.
 */

/** Bajo este ancho de ventana el panel ocupa la pantalla completa. */
export const LAYOUT_DRAWER_MOBILE_BREAKPOINT = 768;

export function isLayoutDrawerMobile(viewportWidth: number): boolean {
  return viewportWidth < LAYOUT_DRAWER_MOBILE_BREAKPOINT;
}

/**
 * Ancho del panel en escritorio: el fijo que pidió el panel al abrirse, o el 45 % de la ventana
 * con un piso de 400 px.
 */
export function layoutDrawerDesktopWidth(viewportWidth: number, widthOverride?: number): number {
  return widthOverride ?? Math.max(400, viewportWidth * 0.45);
}
