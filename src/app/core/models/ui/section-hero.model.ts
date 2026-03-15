/**
 * Modelos para el componente Section Hero (cabecera de sección reutilizable).
 * Usado en Dashboard, Base de Alumnos y otras vistas principales.
 */

/** Chip/badge de contexto en el hero (ej. "18 clases programadas", "2 alertas"). */
export interface SectionHeroChip {
  label: string;
  icon?: string;
  style?: 'default' | 'warning' | 'error' | 'success';
}

/** Acción (CTA) del hero. Solo una debe tener primary: true. */
export interface SectionHeroAction {
  id: string;
  label: string;
  icon?: string;
  primary: boolean;
  /** Si se define, se usa routerLink; si no, se emite actionClick. */
  route?: string;
}
