import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * spec 0060-b — Red de seguridad contra lecturas a Supabase cuyo error se descarta.
 *
 * supabase-js no lanza cuando un select/rpc/functions.invoke falla: resuelve `{ data: null, error }`.
 * Un `const { data } = await ...` sin `error`, seguido de `data ?? []`, muestra la falla como "no hay
 * nada": la pantalla dice $0 o "sin datos" en vez de "no se pudo cargar".
 *
 * Este test recorre los Facades y falla si aparece una lectura así. La forma de arreglarlo es
 * capturar el error (`const { data, error } = await ...; if (error) throw error;`) o envolver la
 * respuesta con `assertReadOk(...)` de `core/utils/db-error.utils.ts`.
 *
 * Par de `unchecked-writes.guard.spec.ts` (fix-362-m): las escrituras las revisa ese test, este las
 * ignora para no marcar dos veces lo mismo.
 *
 * Límite conocido: no ve que la PANTALLA muestre el error que el facade sí captura (forma F3 del
 * plan de la spec). Eso lo cubre el bloque X01 de `e2e/transversal-shell.spec.ts`.
 */

/** Mismas llamadas que revisa el guard de escrituras. */
const WRITE_CALL = /\.(insert|update|delete|upsert|rpc)\(/;

export interface UncheckedRead {
  line: number;
  kind: 'destructure' | 'promise-all';
  detail: string;
}

/** Junta líneas desde `start` hasta que `done(texto)` sea verdadero (máx. `max` líneas). */
function collect(lines: string[], start: number, done: (text: string) => boolean, max: number) {
  let text = lines[start];
  let end = start;
  while (!done(text) && end < start + max && end < lines.length - 1) {
    end++;
    text += '\n' + lines[end];
  }
  return { text, end };
}

/** Separa los elementos de primer nivel de `a, { b, c }, d`, respetando llaves y corchetes. */
function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of list) {
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    if (ch === '}' || ch === ']' || ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Un patrón `{ ... }` que saca `data` y deja fuera `error`. */
function patternDropsError(pattern: string): boolean {
  return /^\{[\s\S]*\}$/.test(pattern) && /\bdata\b/.test(pattern) && !/\berror\b/.test(pattern);
}

/** Hasta dónde llega el método que contiene la línea: el primer `}` con la sangría de un miembro. */
function methodEnd(lines: string[], from: number): number {
  for (let k = from + 1; k < lines.length; k++) {
    if (/^ {2}\}\s*$/.test(lines[k])) return k;
  }
  return lines.length - 1;
}

/** Devuelve las lecturas cuyo error se descarta (líneas 1-indexadas). */
export function findUncheckedReads(source: string): UncheckedRead[] {
  const lines = source.split(/\r?\n/);
  const found: UncheckedRead[] = [];

  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].trim();

    // F1 — const { data } = await ...   (la cabecera puede ocupar varias líneas)
    if (/^(const|let)\s*\{/.test(head)) {
      const header = collect(lines, i, (t) => /\}\s*=/.test(t), 10);
      const m = header.text.match(/^\s*(?:const|let)\s*(\{[^=]*\})\s*=/);
      if (m && patternDropsError(m[1].trim())) {
        const stmt = collect(lines, header.end, (t) => /;\s*$/.test(t), 40).text;
        const full = header.text + '\n' + stmt;
        if (/=\s*await\b/.test(full) && !WRITE_CALL.test(full) && !/throwOnError\(\)/.test(full)) {
          found.push({ line: i + 1, kind: 'destructure', detail: m[1].replace(/\s+/g, ' ') });
        }
      }
      continue;
    }

    // F2 — const [a, { data }, b] = await Promise.all([...])
    if (/^(const|let)\s*\[/.test(head)) {
      const header = collect(lines, i, (t) => /\]\s*=/.test(t), 10);
      const m = header.text.match(/^\s*(?:const|let)\s*\[([\s\S]*?)\]\s*=\s*await\s+Promise\.all/);
      if (!m) continue;
      const scope = lines.slice(i, methodEnd(lines, i) + 1).join('\n');
      for (const element of splitTopLevel(m[1])) {
        if (/^[A-Za-z_$][\w$]*$/.test(element)) {
          // Resultado con nombre: cuenta si se usa `.data` y nunca se mira `.error`.
          const usesData = new RegExp(`\\b${element}\\.data\\b`).test(scope);
          const checksError = new RegExp(`\\b${element}\\.error\\b`).test(scope);
          if (usesData && !checksError) {
            found.push({ line: i + 1, kind: 'promise-all', detail: element });
          }
        } else if (patternDropsError(element)) {
          found.push({ line: i + 1, kind: 'promise-all', detail: element.replace(/\s+/g, ' ') });
        }
      }
    }
  }
  return found;
}

const lineas = (source: string) => findUncheckedReads(source).map((r) => r.line);

describe('findUncheckedReads (el detector)', () => {
  it('detecta una desestructuración de data sin error', () => {
    const source = "const { data } = await this.supabase.client.from('tasks').select('id');";
    expect(lineas(source)).toEqual([1]);
  });

  it('detecta la lectura de un builder armado antes (await q)', () => {
    const source = [
      'let q = this.supabase.client.from("payments").select("*");',
      'const { data } = await q;',
    ].join('\n');
    expect(lineas(source)).toEqual([2]);
  });

  it('detecta una desestructuración partida en varias líneas', () => {
    const source = [
      'const {',
      '  data,',
      '  count,',
      '} = await this.supabase.client',
      "  .from('enrollments')",
      "  .select('id', { count: 'exact' });",
    ].join('\n');
    expect(lineas(source)).toEqual([1]);
  });

  it('detecta un renombre de data (data: rows) sin error', () => {
    const source = "const { data: rows } = await this.supabase.client.from('x').select('*');";
    expect(lineas(source)).toEqual([1]);
  });

  it('no marca una lectura que captura error', () => {
    const source = [
      "const { data, error } = await this.supabase.client.from('tasks').select('id');",
      'if (error) throw error;',
    ].join('\n');
    expect(lineas(source)).toEqual([]);
  });

  it('no marca una lectura que renombra el error (error: e)', () => {
    const source = "const { data, error: e } = await this.supabase.client.from('x').select('*');";
    expect(lineas(source)).toEqual([]);
  });

  it('no marca una lectura envuelta en assertReadOk', () => {
    const source =
      "const rows = assertReadOk(await this.supabase.client.from('tasks').select('id'));";
    expect(lineas(source)).toEqual([]);
  });

  it('no marca una escritura (la revisa unchecked-writes.guard.spec.ts)', () => {
    const source = [
      "const { data } = await this.supabase.client.from('tasks').insert({ title: 'x' }).select();",
      "const { data: r } = await this.supabase.client.rpc('algo', { p: 1 });",
    ].join('\n');
    expect(lineas(source)).toEqual([]);
  });

  it('no marca una lectura con throwOnError()', () => {
    const source =
      "const { data } = await this.supabase.client.from('x').select('*').throwOnError();";
    expect(lineas(source)).toEqual([]);
  });

  describe('Promise.all', () => {
    const metodo = (cuerpo: string[]) =>
      ['class F {', '  async cargar(): Promise<void> {', ...cuerpo, '  }', '}'].join('\n');

    it('detecta un resultado con nombre del que se usa .data sin mirar .error', () => {
      const source = metodo([
        '    const [aRes, bRes] = await Promise.all([qa, qb]);',
        '    if (aRes.error) throw aRes.error;',
        '    this._a.set(aRes.data ?? []);',
        '    this._b.set(bRes.data ?? []);',
      ]);
      expect(findUncheckedReads(source)).toEqual([
        { line: 3, kind: 'promise-all', detail: 'bRes' },
      ]);
    });

    it('detecta un patrón { data } dentro de la tupla', () => {
      const source = metodo([
        '    const [{ data: branches }, { data: closings }] = await Promise.all([qa, qb]);',
      ]);
      expect(findUncheckedReads(source).map((r) => r.detail)).toEqual([
        '{ data: branches }',
        '{ data: closings }',
      ]);
    });

    it('no marca resultados que revisan su error ni patrones con error', () => {
      const source = metodo([
        '    const [{ data, error }, bRes, otros] = await Promise.all([qa, qb, helper()]);',
        '    if (error) throw error;',
        '    const rows = assertReadOk(bRes);',
        '    this._x.set([...rows, ...otros]);',
      ]);
      expect(findUncheckedReads(source)).toEqual([]);
    });

    it('el chequeo de .error se busca solo dentro del mismo método', () => {
      const source = [
        'class F {',
        '  async uno(): Promise<void> {',
        '    const [res] = await Promise.all([qa]);',
        '    this._a.set(res.data ?? []);',
        '  }',
        '',
        '  async dos(): Promise<void> {',
        '    const [res] = await Promise.all([qb]);',
        '    if (res.error) throw res.error;',
        '    this._b.set(res.data ?? []);',
        '  }',
        '}',
      ].join('\n');
      expect(lineas(source)).toEqual([3]);
    });
  });
});

describe('Facades: ninguna lectura a Supabase descarta su error', () => {
  /**
   * Pendientes conocidos, con la etapa de la spec 0060-b que los cubre. Vaciar esta lista es el
   * objetivo (AC9): cada entrada sale en el PR de su etapa. No agregar archivos nuevos acá para
   * pasar el test; un facade que se decida no migrar sale de la lista con su excepción escrita en
   * la spec, no se queda aquí.
   */
  const PENDING: Record<string, string> = {
    // Etapa 1 — Dinero
    'pagos.facade.ts': 'etapa 1',
    'liquidaciones.facade.ts': 'etapa 1',
    'dashboard.facade.ts': 'etapa 1',
    'enrollment-payment.facade.ts': 'etapa 1',
    'anticipos.facade.ts': 'etapa 1',
    // Etapa 2 — Lecturas que alimentan una escritura o una decisión
    'enrollment.facade.ts': 'etapa 2',
    'admin-alumno-detalle.facade.ts': 'etapa 2',
    'cursos-singulares.facade.ts': 'etapa 2',
    'certificacion-clase-b.facade.ts': 'etapa 2',
    'enrollment-documents.facade.ts': 'etapa 2',
    'public-enrollment.facade.ts': 'etapa 2',
    'admin-pre-inscritos.facade.ts': 'etapa 2',
    'student-enrollment-context.facade.ts': 'etapa 2',
    // Etapa 3a — Gestión Clase B y portales
    'asistencia-clase-b.facade.ts': 'etapa 3a',
    'admin-alumnos.facade.ts': 'etapa 3a',
    // Etapa 3b — Clase Profesional
    'asistencia-profesional.facade.ts': 'etapa 3b',
    'certificacion-profesional.facade.ts': 'etapa 3b',
    'archivo-profesional.facade.ts': 'etapa 3b',
    'admin-alumnos-profesional.facade.ts': 'etapa 3b',
    'libro-de-clases.facade.ts': 'etapa 3b',
    'promociones.facade.ts': 'etapa 3b',
    'relatores.facade.ts': 'etapa 3b',
  };

  const facadesDir = resolve(__dirname);
  const allFacades = readdirSync(facadesDir).filter((name) => name.endsWith('.facade.ts'));
  const facadeFiles = allFacades.filter((name) => !(name in PENDING));

  const reportar = (name: string) =>
    findUncheckedReads(readFileSync(resolve(facadesDir, name), 'utf-8')).map(
      (r) => `${name}:${r.line} ${r.kind} ${r.detail}`,
    );

  it('encuentra Facades para revisar', () => {
    expect(facadeFiles.length).toBeGreaterThan(20);
  });

  it('cada entrada de PENDING es un facade que existe', () => {
    expect(Object.keys(PENDING).filter((name) => !allFacades.includes(name))).toEqual([]);
  });

  it.each(facadeFiles)('%s', (name) => {
    expect(reportar(name)).toEqual([]);
  });

  it.each(Object.keys(PENDING))('%s sigue pendiente (sacar de PENDING al corregirlo)', (name) => {
    // Si ya no tiene lecturas sin revisar, la entrada en PENDING sobra.
    expect(reportar(name).length).toBeGreaterThan(0);
  });
});
