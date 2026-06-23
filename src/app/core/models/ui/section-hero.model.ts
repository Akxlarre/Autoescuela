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

/**
 * Ítem de un menú desplegable colgado de una acción del hero (fix-019).
 * Cada selección emite `actionClick` con su propio `id`.
 */
export interface SectionHeroMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  /** Encabezado de grupo no seleccionable (separa secciones dentro del menú). */
  header?: boolean;
  /** Texto auxiliar bajo el label (ej: motivo por el que está deshabilitado). */
  hint?: string;
}

/** KPI compacto para el modo slim del hero. */
export interface SectionHeroKpi {
  id: string;
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  /** Positivo = verde (▲), negativo = rojo (▼). */
  trend?: number;
  trendLabel?: string;
  /** 6-8 puntos normalizados 0-1 para el sparkline SVG inline. */
  sparkline?: number[];
  color?: 'default' | 'success' | 'warning' | 'error';
  icon?: string;
}

/** Acción (CTA) del hero. Solo una debe tener primary: true. */
export interface SectionHeroAction {
  id: string;
  label: string;
  icon?: string;
  primary: boolean;
  /** Si se define, se usa routerLink; si no, se emite actionClick. */
  route?: string;
  disabled?: boolean;
  /** Aplica estilo de peligro (error token) al botón. */
  danger?: boolean;
  /** Muestra el ícono con animación de spinner girando. */
  loading?: boolean;
  /**
   * Si se define, el botón actúa como disparador de un menú desplegable en vez
   * de emitir `actionClick` directamente. Cada ítem emite su propio id al click.
   * Solo disponible en density="full".
   */
  menu?: SectionHeroMenuItem[];
  /** Oculta el botón en viewports mobile (< sm). Útil para acciones secundarias en slim mode. */
  hiddenOnMobile?: boolean;
}
