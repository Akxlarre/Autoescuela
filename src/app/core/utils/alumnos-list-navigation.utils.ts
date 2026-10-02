/** Ruta de la ficha de un alumno, en cualquiera de los portales: `…/alumnos/<id>`. */
const FICHA_URL = /\/alumnos\/\d+(?:[?#]|$)/;

/**
 * true si la pantalla anterior era la ficha de un alumno (hotfix-126-m). La Base de Alumnos
 * conserva la búsqueda y los filtros solo en ese caso: al devolverse desde una ficha. Por
 * cualquier otro camino la lista arranca sin filtros.
 */
export function isReturningFromFicha(previousUrl: string | null | undefined): boolean {
  return !!previousUrl && FICHA_URL.test(previousUrl);
}
