/**
 * Lectura del error real de una Edge Function (fix-268-m, DG-085). Functional Core.
 *
 * `functions.invoke()` de supabase-js, ante una respuesta no-2xx, devuelve un error cuyo
 * `.message` es siempre "Edge Function returned a non-2xx status code". Lo que la función
 * respondió de verdad (`{ "error": "…" }` + status) queda en `error.context`, el `Response`.
 */

export interface EdgeFunctionError {
  /** Status HTTP de la respuesta de la función. */
  status: number | null;
  /** Campo `error` del body, o null si el body no lo trae o no es JSON. */
  message: string | null;
}

/**
 * Devuelve lo que respondió la Edge Function, o `null` si `err` no trae una respuesta (red
 * caída, error lanzado en el cliente).
 *
 * Solo lee: decidir si ese mensaje se le muestra al usuario es del llamador. Un 4xx suele ser
 * un rechazo de negocio redactado para personas; un 5xx puede traer texto técnico de Postgres.
 */
export async function readEdgeFunctionError(err: unknown): Promise<EdgeFunctionError | null> {
  const context = (err as { context?: unknown } | null | undefined)?.context;
  if (!context || typeof (context as Response).json !== 'function') return null;

  const response = context as Response;
  const status = typeof response.status === 'number' ? response.status : null;
  try {
    const body: unknown = await response.json();
    const message = (body as { error?: unknown } | null)?.error;
    return { status, message: typeof message === 'string' ? message : null };
  } catch {
    return { status, message: null };
  }
}

/**
 * Texto para el toast cuando falla una Edge Function (fix-200-b): el mensaje de la función si
 * respondió 4xx (rechazo de negocio, redactado para personas), si no `fallback` (un 5xx puede
 * traer texto técnico; sin respuesta = red caída o error del cliente).
 */
export async function edgeFunctionUserMessage(err: unknown, fallback: string): Promise<string> {
  const response = await readEdgeFunctionError(err);
  if (
    response?.message &&
    response.status != null &&
    response.status >= 400 &&
    response.status < 500
  ) {
    return response.message;
  }
  return fallback;
}
