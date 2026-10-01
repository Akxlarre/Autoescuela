import { describe, expect, it } from 'vitest';
import { readEdgeFunctionError } from './edge-function-error.utils';

/** Imita el `FunctionsHttpError` de supabase-js: mensaje fijo + el `Response` en `context`. */
function functionsHttpError(status: number, body: unknown): Error {
  const err = new Error('Edge Function returned a non-2xx status code');
  err.name = 'FunctionsHttpError';
  (err as Error & { context: unknown }).context = {
    status,
    json: () => Promise.resolve(body),
  };
  return err;
}

describe('readEdgeFunctionError — fix-268-m', () => {
  it('devuelve el status y el mensaje que envió la función', async () => {
    const result = await readEdgeFunctionError(
      functionsHttpError(409, { error: 'Ya existe un usuario con ese correo electrónico' }),
    );
    expect(result).toEqual({
      status: 409,
      message: 'Ya existe un usuario con ese correo electrónico',
    });
  });

  it('body sin campo error → mensaje null, pero conserva el status', async () => {
    expect(await readEdgeFunctionError(functionsHttpError(500, { detalle: 'x' }))).toEqual({
      status: 500,
      message: null,
    });
  });

  it('body que no es JSON → mensaje null, sin lanzar', async () => {
    const err = new Error('Edge Function returned a non-2xx status code');
    (err as Error & { context: unknown }).context = {
      status: 502,
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    };
    expect(await readEdgeFunctionError(err)).toEqual({ status: 502, message: null });
  });

  it('un error sin respuesta de la función (red caída, Error común, null) → null', async () => {
    expect(await readEdgeFunctionError(new Error('Failed to fetch'))).toBeNull();
    expect(await readEdgeFunctionError(null)).toBeNull();
    expect(await readEdgeFunctionError('texto')).toBeNull();
  });
});
