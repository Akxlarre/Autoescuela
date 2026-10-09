import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * fix-362-m — Red de seguridad contra escrituras a Supabase cuyo resultado se descarta.
 *
 * supabase-js no lanza cuando un insert/update/delete/upsert/rpc falla: resuelve `{ error }`.
 * Un `await this.supabase.client.from(...).update(...)` suelto, o un `const { data } = await ...`
 * sin `error`, tira ese error a la basura y el flujo sigue hasta el toast de éxito.
 *
 * Este test recorre los Facades y falla si aparece una escritura así. La forma de arreglarlo es
 * capturar el resultado (`const { error } = await ...`) o envolverlo con `assertWriteOk(...)` de
 * `core/utils/db-error.utils.ts`.
 */

const WRITE_CALL = /\.(insert|update|delete|upsert|rpc)\(/;

/** Devuelve las líneas (1-indexadas) donde empieza una escritura cuyo resultado se descarta. */
function findUncheckedWrites(source: string): number[] {
  const lines = source.split(/\r?\n/);
  const found: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].trim();
    if (!/\bawait\b/.test(head)) continue;

    // Junta la sentencia completa hasta su punto y coma.
    let statement = lines[i];
    for (let j = i; !/;\s*$/.test(lines[j]) && j < i + 40 && j < lines.length - 1; ) {
      j++;
      statement += '\n' + lines[j];
    }
    if (!/supabase/.test(statement) || !WRITE_CALL.test(statement)) continue;
    if (/throwOnError\(\)/.test(statement)) continue;

    const previous = (lines[i - 1] ?? '').trim();
    // `await` al inicio de la línea y sin nada antes que reciba el valor: resultado descartado.
    const discarded = /^await\b/.test(head) && !/([=(,[]|return)$/.test(previous);
    // Desestructura el resultado pero deja fuera `error`.
    const destructuredWithoutError =
      /^(const|let)\s*\{[^}]*\}\s*=\s*await/.test(head) && !/error/i.test(head);

    if (discarded || destructuredWithoutError) found.push(i + 1);
  }
  return found;
}

describe('findUncheckedWrites (el detector)', () => {
  it('detecta un await suelto sobre una escritura', () => {
    const source = [
      'async function f() {',
      "  await this.supabase.client.from('vehicles').update({ current_km: 1 }).eq('id', 1);",
      '}',
    ].join('\n');
    expect(findUncheckedWrites(source)).toEqual([2]);
  });

  it('detecta un await suelto partido en varias líneas', () => {
    const source = [
      'async function f() {',
      '  await this.supabase.client',
      "    .from('payments')",
      '    .delete()',
      "    .eq('enrollment_id', 1);",
      '}',
    ].join('\n');
    expect(findUncheckedWrites(source)).toEqual([2]);
  });

  it('detecta una desestructuración que deja fuera error', () => {
    const source = "const { data } = await this.supabase.client.rpc('algo', { p: 1 });";
    expect(findUncheckedWrites(source)).toEqual([1]);
  });

  it('no marca una escritura cuyo error se captura', () => {
    const source = [
      'const { error } = await this.supabase.client',
      "  .from('tasks')",
      "  .update({ status: 'completed' })",
      "  .eq('id', 1);",
    ].join('\n');
    expect(findUncheckedWrites(source)).toEqual([]);
  });

  it('no marca una escritura envuelta en assertWriteOk', () => {
    const source = [
      'assertWriteOk(',
      "  await this.supabase.client.from('tasks').update({ status: 'x' }).eq('id', 1),",
      ');',
    ].join('\n');
    expect(findUncheckedWrites(source)).toEqual([]);
  });

  it('no marca una lectura', () => {
    const source = "await this.supabase.client.from('tasks').select('id');";
    expect(findUncheckedWrites(source)).toEqual([]);
  });
});

describe('Facades: ninguna escritura a Supabase descarta su error', () => {
  /**
   * Pendientes conocidos, con dueño. Vaciar esta lista es el objetivo: cada entrada debe salir
   * cuando se cierre el trabajo que la cubre. No agregar archivos nuevos acá para pasar el test.
   */
  const PENDING: Record<string, string> = {
    'cuadratura.facade.ts': 'ASG-i-048 (Cuadratura: operaciones que fallan en silencio)',
  };

  const facadesDir = resolve(__dirname);
  const facadeFiles = readdirSync(facadesDir).filter(
    (name) => name.endsWith('.facade.ts') && !(name in PENDING),
  );

  it('encuentra Facades para revisar', () => {
    expect(facadeFiles.length).toBeGreaterThan(20);
  });

  it.each(facadeFiles)('%s', (name) => {
    const source = readFileSync(resolve(facadesDir, name), 'utf-8');
    expect(findUncheckedWrites(source)).toEqual([]);
  });

  it.each(Object.keys(PENDING))('%s sigue pendiente (sacar de PENDING al corregirlo)', (name) => {
    const source = readFileSync(resolve(facadesDir, name), 'utf-8');
    // Si ya no tiene escrituras sin revisar, la entrada en PENDING sobra.
    expect(findUncheckedWrites(source).length).toBeGreaterThan(0);
  });
});
