// supabase/functions/_shared/table-pdf.test.ts
//
//   deno test supabase/functions/_shared/table-pdf.test.ts

import { assertEquals, assert } from 'jsr:@std/assert';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import {
  ROWS_PER_PAGE,
  buildTablePdf,
  fitText,
  paginate,
  resolveColumnWidths,
} from './table-pdf.ts';

/** Fuente de mentira: cada carácter mide 5 puntos. */
const measure = (t: string) => t.length * 5;

Deno.test('resolveColumnWidths: sin pesos reparte el ancho en partes iguales', () => {
  assertEquals(resolveColumnWidths(4, 400), [100, 100, 100, 100]);
});

Deno.test('resolveColumnWidths: con pesos reparte en proporción', () => {
  assertEquals(resolveColumnWidths(3, 400, [2, 1, 1]), [200, 100, 100]);
});

Deno.test('resolveColumnWidths: pesos que no calzan con las columnas se ignoran', () => {
  assertEquals(resolveColumnWidths(2, 400, [2, 1, 1]), [200, 200]);
  assertEquals(resolveColumnWidths(2, 400, [0, 1]), [200, 200]);
});

Deno.test('paginate: corta en páginas del tamaño pedido', () => {
  assertEquals(paginate([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

Deno.test('paginate: sin filas devuelve una página vacía', () => {
  assertEquals(paginate([], 10), [[]]);
});

Deno.test('fitText: un texto que cabe queda igual', () => {
  assertEquals(fitText('Araya', 100, measure), 'Araya');
});

Deno.test('fitText: un texto largo se recorta y termina en puntos suspensivos', () => {
  // Caben 6 caracteres (30 pt): 5 letras + "…"
  assertEquals(fitText('Fernandez Soto', 30, measure), 'Ferna…');
});

Deno.test('fitText: no deja un espacio antes de los puntos suspensivos', () => {
  assertEquals(fitText('Soto Andy', 30, measure), 'Soto…');
});

Deno.test(
  'buildTablePdf: genera un PDF válido con una página por cada bloque de filas',
  async () => {
    const rows = Array.from({ length: ROWS_PER_PAGE + 1 }, (_, i) => [
      `Alumno ${i}`,
      '11.111.111-1',
      'Al día',
    ]);

    const bytes = await buildTablePdf({
      title: 'Ex-Alumnos Clase B',
      subtitle: 'Generado: 02-10-2026',
      headers: ['Alumno', 'RUT', 'Estado de cuenta'],
      rows,
      footer: `Total: ${rows.length} egresados`,
    });

    assertEquals(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
    assertEquals((await PDFDocument.load(bytes)).getPageCount(), 2);
  },
);

Deno.test('buildTablePdf: sin filas genera igual una página', async () => {
  const bytes = await buildTablePdf({ title: 'Vacío', headers: ['A'], rows: [] });

  assertEquals((await PDFDocument.load(bytes)).getPageCount(), 1);
});

Deno.test('buildTablePdf: tildes, eñes, guion largo y emojis no rompen la generación', async () => {
  const bytes = await buildTablePdf({
    title: 'Ñandú — Peñalolén',
    headers: ['Alumno', 'Nº Exp.'],
    rows: [
      ['Zúñiga Peña José 🚗', '—'],
      ['Línea\ncon salto', '$ 45.000'],
    ],
  });

  assert(bytes.length > 500);
});
