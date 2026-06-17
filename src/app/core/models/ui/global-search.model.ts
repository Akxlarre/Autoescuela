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
  route: string[];
}

export type SearchResult = ActionResult | AlumnoResult;

/** Grupo de resultados con encabezado visible en el panel. */
export interface SearchResultGroup {
  label: string;
  /** Nombre de lucide-icon para el encabezado del grupo */
  icon: string;
  results: SearchResult[];
}
