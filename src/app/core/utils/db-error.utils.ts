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
 * Una escritura terminó sin error pero no tocó ninguna fila. Con RLS es el caso normal de un
 * UPDATE/DELETE rechazado: la policy filtra la fila y PostgREST responde 200 con `[]`.
 */
export class NoRowsAffectedError extends Error {
  constructor() {
    super('La escritura no afectó ninguna fila');
    this.name = 'NoRowsAffectedError';
  }
}

/**
 * Convierte el `{ error }` de una escritura de supabase-js en una excepción.
 *
 * supabase-js NO lanza cuando un insert/update/delete/upsert/rpc falla: resuelve `{ error }`.
 * Un `await` suelto descarta ese error y el flujo sigue hasta el toast de éxito. Envolver la
 * llamada con esto deja que el `catch` del Facade lo vea.
 *
 * `requireRows` cubre lo que `error` no ve: un UPDATE/DELETE filtrado por RLS no devuelve error,
 * devuelve 0 filas. Exige encadenar `.select()` en la query para que `data` traiga las filas.
 */
export function assertWriteOk<T extends { error: unknown; data?: unknown }>(
  result: T,
  options?: { requireRows?: boolean },
): T {
  if (result.error) throw result.error;
  if (options?.requireRows && !(Array.isArray(result.data) && result.data.length > 0)) {
    throw new NoRowsAffectedError();
  }
  return result;
}

/**
 * Traduce un error de BD a un mensaje seguro y accionable para el usuario.
 * Nunca incluye el texto original del error.
 *
 * @param err      Error capturado (PostgrestError, Error, o desconocido).
 * @param fallback Mensaje genérico contextual ("Error al inscribir al alumno").
 */
export function toFriendlyDbMessage(err: unknown, fallback: string): string {
  if (err instanceof NoRowsAffectedError) {
    return 'No se aplicó el cambio: el registro ya no existe o no tienes permisos sobre él en esta sede.';
  }
  if (!isPostgrestLike(err)) return fallback;

  // Tokens estables emitidos por triggers propios (RAISE EXCEPTION 'TOKEN').
  // No exponen esquema: son contratos UI↔BD definidos en nuestras migraciones.
  if (err.message?.includes('CUPOS_AGOTADOS')) {
    return 'No quedan cupos disponibles en este curso. Actualiza la lista para ver el estado actual.';
  }
  // fix-044-i: triggers de Caja. Un movimiento de un día con caja cerrada no se borra (el cierre
  // guarda totales congelados, DG-065) y un cierre definitivo no se sobrescribe.
  if (err.message?.includes('CAJA_CERRADA')) {
    return 'La caja de ese día ya está cerrada. Registra la corrección como ajuste en Historial de Cuadraturas.';
  }
  if (err.message?.includes('CIERRE_DEFINITIVO')) {
    return 'Esta caja ya se cerró (en otra pestaña o por otra persona). La pantalla se actualizó con el cierre guardado.';
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
