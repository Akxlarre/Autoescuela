import { monthsAgoIso } from './date.utils';

/**
 * Ventana de período para listas históricas acumulativas (ex-alumnos, servicios especiales).
 *
 * Es un filtro de **renderizado**, no de query: el dataset completo se sigue trayendo de BD,
 * porque la búsqueda y el export tienen que poder operar sobre todo el historial.
 * Ver `docs/research/listas-grandes-virtual-scroll.md` §2.1.
 */
export type PeriodWindow = 'last-12-months' | 'all';

/** Meses que abarca la ventana acotada. Igual para Clase B y Profesional (decisión del estrés-test). */
export const PERIOD_WINDOW_MONTHS = 12;

/** Lo que ve el usuario al entrar, sin tocar nada. */
export const DEFAULT_PERIOD_WINDOW: PeriodWindow = 'last-12-months';

/**
 * Fecha ISO (YYYY-MM-DD) a partir de la cual un registro entra en la ventana.
 *
 * @param cutoffIso corte explícito, para tests deterministas. Sin él se calcula contra hoy.
 * @returns `null` cuando la ventana es "todo el historial" — no hay nada que recortar.
 */
export function periodCutoffIso(window: PeriodWindow, cutoffIso?: string): string | null {
  if (window === 'all') return null;
  return cutoffIso ?? monthsAgoIso(PERIOD_WINDOW_MONTHS);
}

export interface PeriodWindowOptions<T> {
  /** Ventana elegida por el usuario. */
  window: PeriodWindow;
  /**
   * Si hay un término de búsqueda activo. Cuando es `true` la ventana **no se aplica**:
   * buscar tiene que encontrar al alumno sin importar la antigüedad de su matrícula.
   */
  hasActiveSearch: boolean;
  /** Cómo obtener la fecha comparable (ISO) de cada item. */
  dateOf: (item: T) => string | null | undefined;
  /** Corte explícito, para tests deterministas. */
  cutoffIso?: string;
}

/**
 * Aplica la ventana de período a una lista ya fetcheada.
 *
 * **Regla no negociable (ASG-b-087):** con búsqueda activa devuelve el dataset completo. Si el
 * período atrapara a la búsqueda, buscar a alguien con matrícula de hace 2 años daría
 * "0 resultados", y eso se lee como "no existe" — un bug silencioso en una lista de personas.
 * El export tiene que partir del dataset completo por el mismo motivo, y es peor: una planilla
 * incompleta no avisa que le faltan filas.
 *
 * Los registros **sin fecha** se conservan: descartarlos sería perder datos en silencio, que es
 * justo lo que esta función existe para evitar.
 */
export function applyPeriodWindow<T>(
  items: readonly T[],
  { window, hasActiveSearch, dateOf, cutoffIso }: PeriodWindowOptions<T>,
): T[] {
  if (hasActiveSearch) return [...items];

  const cutoff = periodCutoffIso(window, cutoffIso);
  if (cutoff === null) return [...items];

  return items.filter((item) => {
    const fecha = dateOf(item);
    if (!fecha) return true;
    return fecha.slice(0, 10) >= cutoff;
  });
}
