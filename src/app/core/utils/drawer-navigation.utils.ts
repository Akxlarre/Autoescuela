/** Path de una URL de la app, sin query string, fragmento ni barra final. */
function pathOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/**
 * ¿La navegación lleva a otra pantalla? (hotfix-061-b). El drawer global se cierra solo en ese
 * caso: un cambio de query o fragmento (p. ej. `?tab=` de las pestañas) sigue en la misma pantalla.
 */
export function isRouteChange(currentUrl: string, nextUrl: string): boolean {
  return pathOf(currentUrl) !== pathOf(nextUrl);
}
