import type { SectionHeroMenuItem } from '@core/models/ui/section-hero.model';

/** Estado necesario para construir el menú "Carnet" de un alumno Clase B. */
export interface CarnetMenuState {
  /** Ruta del carnet de 6 clases ya generado, o null si aún no existe. */
  initialPath: string | null;
  /** Ruta del carnet de 12 clases ya generado, o null si aún no existe. */
  fullPath: string | null;
  /** Cuántas de las primeras 6 clases prácticas están completadas (firmadas). */
  primeras6Completadas: number;
  /**
   * true = curso "Refuerzo Clase B" (6 clases en total, nunca llega a 12) — spec 0006-m.
   * El carnet de 6 clases sigue disponible (idéntico al de Clase B estándar); el de 12
   * se omite del menú por completo, no solo se deshabilita, porque nunca aplica.
   */
  isReinforcement?: boolean;
}

/** Total de clases de la primera etapa que habilitan el carnet completo. */
const PRIMERA_ETAPA = 6;

/**
 * Construye los ítems del menú desplegable "Carnet" (Clase B) según el estado del
 * alumno. Reglas (fix-019):
 *  - El carnet de 6 clases siempre se puede generar; "Generar" pasa a "Volver a
 *    generar" una vez emitido.
 *  - "Ver" de cada carnet sólo se habilita cuando ese carnet ya existe.
 *  - El carnet de 12 clases sólo se habilita cuando el alumno completó sus
 *    primeras 6 clases; mientras tanto indica cuántas faltan.
 *
 * Función pura (Data In → Data Out): testeable sin Angular.
 */
export function buildCarnetMenu(state: CarnetMenuState): SectionHeroMenuItem[] {
  const { initialPath, fullPath, primeras6Completadas, isReinforcement = false } = state;
  const puede12 = primeras6Completadas >= PRIMERA_ETAPA;
  const faltan = Math.max(0, PRIMERA_ETAPA - primeras6Completadas);

  const items: SectionHeroMenuItem[] = [
    { id: 'carnet-6-header', label: 'Carnet 6 clases', header: true },
    {
      id: 'generar-carnet-6',
      label: initialPath ? 'Volver a generar Carnet 6 clases' : 'Generar Carnet 6 clases',
      icon: initialPath ? 'refresh-cw' : 'file-plus',
    },
    { id: 'ver-carnet-6', label: 'Ver Carnet 6 clases', icon: 'eye', disabled: !initialPath },
  ];

  // Refuerzo Clase B nunca llega a 12 clases — el carnet de 12 no aplica (spec 0006-m).
  if (isReinforcement) return items;

  items.push(
    { id: 'carnet-12-header', label: 'Carnet 12 clases', header: true },
    {
      id: 'generar-carnet-12',
      label: fullPath ? 'Volver a generar Carnet 12 clases' : 'Generar Carnet 12 clases',
      icon: fullPath ? 'refresh-cw' : 'file-plus',
      disabled: !puede12,
      hint: puede12 ? undefined : `faltan ${faltan} de las primeras 6 clases`,
    },
    { id: 'ver-carnet-12', label: 'Ver Carnet 12 clases', icon: 'eye', disabled: !fullPath },
  );
  return items;
}
