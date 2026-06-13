/**
 * Sanitización de errores de base de datos (Supabase/PostgreSQL) para la UI.
 *
 * Los mensajes crudos de PostgreSQL exponen nombres de columnas, constraints
 * y detalles internos del esquema. Nunca deben llegar al usuario final:
 * la UI muestra un mensaje amigable en español y el error real se loguea
 * a consola para diagnóstico.
 */

/** Forma mínima de un error de PostgREST/Supabase. */
interface PostgrestLikeError {
  code?: string;
  message?: string;
}

function isPostgrestLike(err: unknown): err is PostgrestLikeError {
  return typeof err === 'object' && err !== null && ('code' in err || 'message' in err);
}

/**
 * Traduce un error de BD a un mensaje seguro y accionable para el usuario.
 * Nunca incluye el texto original del error.
 *
 * @param err      Error capturado (PostgrestError, Error, o desconocido).
 * @param fallback Mensaje genérico contextual ("Error al inscribir al alumno").
 */
export function toFriendlyDbMessage(err: unknown, fallback: string): string {
  if (!isPostgrestLike(err)) return fallback;

  // Tokens estables emitidos por triggers propios (RAISE EXCEPTION 'TOKEN').
  // No exponen esquema: son contratos UI↔BD definidos en nuestras migraciones.
  if (err.message?.includes('CUPOS_AGOTADOS')) {
    return 'No quedan cupos disponibles en este curso. Actualiza la lista para ver el estado actual.';
  }

  switch (err.code) {
    // unique_violation — registro duplicado
    case '23505':
      return 'Ya existe un registro con estos datos. Verifica el RUT o el email ingresado.';
    // not_null_violation — falta un dato obligatorio
    case '23502':
      return 'Faltan datos obligatorios del alumno. Revisa que el formulario esté completo.';
    // check_violation — en students el único CHECK es la edad mínima (≥ 17)
    case '23514':
      return 'Los datos no cumplen los requisitos: verifica la fecha de nacimiento (el alumno debe tener al menos 17 años).';
    // foreign_key_violation
    case '23503':
      return 'No se pudo completar la operación porque hay datos relacionados inconsistentes. Contacta al administrador.';
    // RLS / permisos
    case '42501':
      return 'No tienes permisos para realizar esta acción en esta sede.';
    default:
      return fallback;
  }
}
