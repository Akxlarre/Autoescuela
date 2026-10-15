import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * spec 0025-m — Red de seguridad: toda lectura de `payments` declara qué estados incluye.
 *
 * Un pago puede estar `paid`, `pending` (deuda registrada con $0 recibido) o `anulado` (se quitó,
 * pero la fila sigue ahí). Una lectura que suma o cuenta sin filtrar por estado muestra plata que
 * no entró, y nada lo delata: el total simplemente queda más alto.
 *
 * Este test recorre `src/app` y falla si una lectura de `payments`:
 *   - no filtra por `status` (lo normal: `.in('status', [...PAYMENT_STATUSES_QUE_SUMAN])`), y
 *   - tampoco declara, con un comentario `payments-all-statuses: <motivo>` justo antes o dentro
 *     de la sentencia, que trae todos los estados a propósito (un listado que muestra los
 *     anulados tachados, un conteo de historial).
 */

const READ_START = /\.from\(\s*['"]payments['"]\s*\)/;
const WRITE_CALL = /\.(insert|update|delete|upsert)\(/;
const STATUS_FILTER = /\.(in|eq|neq|not)\(\s*['"]status['"]/;
const OPT_OUT = /payments-all-statuses:[ \t]*\S+/;

/** Devuelve las líneas (1-indexadas) de lecturas de `payments` sin estado declarado. */
function findUndeclaredReads(source: string): number[] {
  const lines = source.split(/\r?\n/);
  const found: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!READ_START.test(lines[i])) continue;

    // Junta la consulta hasta su punto y coma, o hasta que empiece otra consulta (las lecturas
    // dentro de un Promise.all se separan con coma, no con punto y coma).
    let end = i;
    while (
      end < lines.length - 1 &&
      end - i < 40 &&
      !/;\s*$/.test(lines[end]) &&
      !/\.from\(/.test(lines[end + 1])
    ) {
      end++;
    }
    const statement = lines.slice(i, end + 1).join('\n');

    if (WRITE_CALL.test(statement)) continue;
    if (STATUS_FILTER.test(statement)) continue;

    // El comentario puede ir dentro de la consulta o en las 5 líneas anteriores.
    const context = lines.slice(Math.max(0, i - 5), end + 1).join('\n');
    if (OPT_OUT.test(context)) continue;

    found.push(i + 1);
  }
  return found;
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [full] : [];
  });
}

describe('findUndeclaredReads (el detector)', () => {
  it('detecta una suma sin filtro de estado', () => {
    const source = [
      'let q: any = this.supabase.client',
      "  .from('payments')",
      "  .select('total_amount')",
      "  .eq('payment_date', today);",
    ].join('\n');
    expect(findUndeclaredReads(source)).toEqual([2]);
  });

  it('acepta una lectura que filtra por estado', () => {
    const source = [
      'let q: any = this.supabase.client',
      "  .from('payments')",
      "  .select('total_amount')",
      "  .in('status', [...PAYMENT_STATUSES_QUE_SUMAN])",
      "  .eq('payment_date', today);",
    ].join('\n');
    expect(findUndeclaredReads(source)).toEqual([]);
  });

  it('acepta una lectura que declara traer todos los estados', () => {
    const source = [
      '// payments-all-statuses: listado, los anulados se muestran tachados',
      'const { data } = await this.supabase.client',
      "  .from('payments')",
      "  .select('*')",
      "  .eq('enrollment_id', id);",
    ].join('\n');
    expect(findUndeclaredReads(source)).toEqual([]);
  });

  it('no acepta la marca sin motivo', () => {
    const source = [
      '// payments-all-statuses:',
      "const { data } = await this.supabase.client.from('payments').select('*');",
    ].join('\n');
    expect(findUndeclaredReads(source)).toEqual([2]);
  });

  it('ignora las escrituras', () => {
    const source = [
      "const { error } = await this.supabase.client.from('payments').insert({ a: 1 });",
      'assertWriteOk(',
      "  await this.supabase.client.from('payments').update({ a: 1 }).eq('id', 1).select('id'),",
      ');',
    ].join('\n');
    expect(findUndeclaredReads(source)).toEqual([]);
  });

  it('detecta una lectura sin estado dentro de un Promise.all, aunque la vecina filtre', () => {
    const source = [
      'await Promise.all([',
      '  this.supabase.client',
      "    .from('payments')",
      "    .select('id', { count: 'exact', head: true })",
      "    .in('enrollment_id', ids),",
      '  this.supabase.client',
      "    .from('class_b_sessions')",
      "    .select('id')",
      "    .eq('status', 'scheduled'),",
      ']);',
    ].join('\n');
    expect(findUndeclaredReads(source)).toEqual([3]);
  });

  it('la marca de una lectura no cubre a la siguiente', () => {
    const source = [
      '// payments-all-statuses: listado',
      "const a = await this.supabase.client.from('payments').select('*');",
      'const x = 1;',
      'const y = 2;',
      'const z = 3;',
      'const w = 4;',
      "const b = await this.supabase.client.from('payments').select('total_amount');",
    ].join('\n');
    expect(findUndeclaredReads(source)).toEqual([7]);
  });
});

describe('lecturas de payments en src/app — spec 0025-m', () => {
  it('toda lectura filtra por estado o declara que trae todos', () => {
    const root = resolve(process.cwd(), 'src/app');
    const offenders = listSourceFiles(root).flatMap((file) =>
      findUndeclaredReads(readFileSync(file, 'utf8')).map(
        (line) => `${relative(process.cwd(), file).replace(/\\/g, '/')}:${line}`,
      ),
    );
    expect(
      offenders,
      'Lectura de payments sin estado declarado. Filtra con ' +
        ".in('status', [...PAYMENT_STATUSES_QUE_SUMAN]) o, si es un listado que muestra los " +
        'anulados, agrega el comentario "payments-all-statuses: <motivo>".',
    ).toEqual([]);
  });
});
