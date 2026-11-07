// supabase/functions/_shared/paged-fetch.test.ts
//
//   deno test supabase/functions/_shared/paged-fetch.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { fetchPagesCapped } from './paged-fetch.ts';

/** Simula PostgREST: devuelve como máximo `pageSize` filas del rango pedido. */
function fakeSource(total: number) {
  const calls: [number, number][] = [];
  const fetchPage = (from: number, to: number) => {
    calls.push([from, to]);
    const end = Math.min(to + 1, total);
    const rows = from < total ? Array.from({ length: end - from }, (_, i) => from + i) : [];
    return Promise.resolve({ data: rows, error: null, count: total });
  };
  return { fetchPage, calls };
}

Deno.test('trae todo en páginas de 1.000 cuando cabe en el tope', async () => {
  const src = fakeSource(2500);
  const r = await fetchPagesCapped(src.fetchPage, { pageSize: 1000, cap: 10000 });
  assertEquals(r.rows.length, 2500);
  assertEquals(r.total, 2500);
  assertEquals(r.truncated, false);
  assertEquals(src.calls, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

Deno.test('se detiene en el tope y avisa que quedó corto', async () => {
  const src = fakeSource(78000);
  const r = await fetchPagesCapped(src.fetchPage, { pageSize: 1000, cap: 3000 });
  assertEquals(r.rows.length, 3000);
  assertEquals(r.total, 78000);
  assertEquals(r.truncated, true);
  assertEquals(src.calls.length, 3);
});

Deno.test('sin filas: una sola consulta y nada truncado', async () => {
  const src = fakeSource(0);
  const r = await fetchPagesCapped(src.fetchPage, { pageSize: 1000, cap: 10000 });
  assertEquals(r.rows, []);
  assertEquals(r.truncated, false);
  assertEquals(src.calls.length, 1);
});

Deno.test('un error de la consulta se propaga', async () => {
  const fetchPage = () => Promise.resolve({ data: null, error: new Error('boom'), count: null });
  let msg = '';
  try {
    await fetchPagesCapped(fetchPage, { pageSize: 1000, cap: 10000 });
  } catch (e) {
    msg = (e as Error).message;
  }
  assertEquals(msg, 'boom');
});
