export interface ClauseCharacterStatus {
  withinLimit: boolean;
  /** Positivo = caracteres disponibles. Negativo = caracteres de sobra a recortar. */
  remaining: number;
}

/**
 * Mitigación de overflow del editor de plantillas (spec 0016-m, AC5) — no resuelve el problema
 * del todo (el propio dueño lo reconoce como complejo), solo avisa cuando una sección se acerca o
 * excede el límite sugerido para esa cláusula, antes de que rompa el layout del PDF.
 */
export function getClauseCharacterStatus(text: string, maxLength: number): ClauseCharacterStatus {
  const remaining = maxLength - text.length;
  return { withinLimit: remaining >= 0, remaining };
}
