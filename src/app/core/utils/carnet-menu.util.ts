import type { SectionHeroMenuItem } from '@core/models/ui/section-hero.model';

/** Estado necesario para construir el menú "Carnet" de un alumno Clase B. */
export interface CarnetMenuState {
  /** Ruta del carnet de 6 clases ya generado, o null si aún no existe. */
  initialPath: string | null;
  /** Ruta del carnet de 12 clases ya generado, o null si aún no existe. */
  fullPath: string | null;
  /**
   * true = curso "Refuerzo Clase B" (6 clases en total, nunca llega a 12) — spec 0006-m.
   * El carnet de 6 clases sigue disponible (idéntico al de Clase B estándar); el de 12
   * se omite del menú por completo, no solo se deshabilita, porque nunca aplica.
   */
  isReinforcement?: boolean;
}

/**
 * Construye los ítems del menú desplegable "Carnet" (Clase B) según el estado del
 * alumno. Reglas (fix-019, hotfix-093):
 *  - Ambos carnets (6 y 12 clases) siempre se pueden generar; "Generar" pasa a
 *    "Volver a generar" una vez emitido cada uno.
 *  - "Ver" de cada carnet sólo se habilita cuando ese carnet ya existe.
 *
 * Función pura (Data In → Data Out): testeable sin Angular.
 */
export function buildCarnetMenu(state: CarnetMenuState): SectionHeroMenuItem[] {
  const { initialPath, fullPath, isReinforcement = false } = state;

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
    },
    { id: 'ver-carnet-12', label: 'Ver Carnet 12 clases', icon: 'eye', disabled: !fullPath },
  );
  return items;
}
