export type AlumnoQuickActionType = 'view' | 'payment' | 'schedule' | 'enrollment';

/** Acción rápida contextual para un alumno en el menú expandible del Omnibar. */
export interface AlumnoQuickAction {
  label: string;
  icon: string;
  actionType: AlumnoQuickActionType;
  route: string[];
}

/** Resultado de tipo "acción de navegación" generado por el diccionario de intenciones. */
export interface ActionResult {
  type: 'action';
  id: string;
  label: string;
  description: string;
  icon: string;
  route: string[];
}

/** Resultado de tipo "alumno" generado por búsqueda en memoria. */
export interface AlumnoResult {
  type: 'alumno';
  studentId: string;
  label: string;
  rut: string;
  status: string;
  /** Ruta principal (Ver Ficha) — también presente en quickActions[0]. */
  route: string[];
  /** Acciones rápidas contextuales expandibles en el panel de búsqueda. */
  quickActions: AlumnoQuickAction[];
}

export type SearchResult = ActionResult | AlumnoResult;

/** Grupo de resultados con encabezado visible en el panel. */
export interface SearchResultGroup {
  label: string;
  /** Nombre de lucide-icon para el encabezado del grupo */
  icon: string;
  results: SearchResult[];
}
