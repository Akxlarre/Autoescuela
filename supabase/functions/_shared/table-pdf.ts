// supabase/functions/_shared/table-pdf.ts
//
// PDF de una tabla simple (A4 apaisado): título, subtítulo, cabecera, filas con franjas y total.
// Lo usa export-table-pdf (spec 0021-m). El diseño es el del PDF de export-students,
// generalizado para cualquier lista: quien llama entrega las cabeceras y las celdas ya armadas.
//
// @ts-nocheck

import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

export interface TablePdfInput {
  title: string;
  /** Línea bajo el título (ej. "Generado: 02-10-2026"). El número de página se agrega solo. */
  subtitle?: string;
  headers: string[];
  rows: string[][];
  /** Peso relativo de cada columna. Sin pesos, todas miden lo mismo. */
  columnWeights?: number[];
  /** Texto del pie (ej. "Total: 12 egresados"). */
  footer?: string;
}

const PAGE_W = 842; // A4 apaisado
const PAGE_H = 595;
const MARGIN = 36;
const ROW_H = 18;
const HEADER_H = 24;
const TITLE_BLOCK_H = 40;
const CELL_PAD = 4;

/** Filas que caben en una página bajo el título y la cabecera de la tabla. */
export const ROWS_PER_PAGE = Math.floor((PAGE_H - MARGIN * 2 - HEADER_H - TITLE_BLOCK_H) / ROW_H);

/** Reparte el ancho disponible entre las columnas según su peso. */
export function resolveColumnWidths(
  count: number,
  available: number,
  weights?: number[],
): number[] {
  const usable =
    weights && weights.length === count && weights.every((w) => Number.isFinite(w) && w > 0)
      ? weights
      : Array.from({ length: count }, () => 1);
  const total = usable.reduce((sum, w) => sum + w, 0);
  return usable.map((w) => (available * w) / total);
}

/** Divide las filas en páginas. Sin filas devuelve una página vacía (el PDF igual se genera). */
export function paginate<T>(rows: T[], perPage: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  return pages.length > 0 ? pages : [[]];
}

/**
 * Recorta el texto para que quepa en `maxWidth`, terminándolo en "…".
 * `measure` devuelve el ancho del texto en puntos (lo da la fuente).
 */
export function fitText(text: string, maxWidth: number, measure: (t: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 0 && measure(cut + '…') > maxWidth) cut = cut.slice(0, -1);
  return cut.length > 0 ? cut.trimEnd() + '…' : '';
}

/** Reemplaza por "?" los caracteres que la fuente estándar no puede dibujar (ej. emojis). */
function drawable(font: { encodeText: (t: string) => unknown }, text: string): string {
  let out = '';
  for (const ch of text.replace(/\s+/g, ' ')) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
    }
  }
  return out;
}

export async function buildTablePdf(input: TablePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);

  const tableW = PAGE_W - MARGIN * 2;
  const widths = resolveColumnWidths(input.headers.length, tableW, input.columnWeights);
  const pages = paginate(input.rows, ROWS_PER_PAGE);

  const cellText = (raw: unknown, width: number, font: typeof fontReg, size: number): string =>
    fitText(drawable(font, String(raw ?? '')), width - CELL_PAD * 2, (t) =>
      font.widthOfTextAtSize(t, size),
    );

  pages.forEach((pageRows, pageIdx) => {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const top = PAGE_H - MARGIN;

    page.drawText(drawable(fontBold, input.title), {
      x: MARGIN,
      y: top - 14,
      size: 14,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    const pageLabel = `Página ${pageIdx + 1} de ${pages.length}`;
    const subtitle = input.subtitle ? `${input.subtitle}  ·  ${pageLabel}` : pageLabel;
    page.drawText(drawable(fontReg, subtitle), {
      x: MARGIN,
      y: top - 26,
      size: 7.5,
      font: fontReg,
      color: rgb(0.5, 0.5, 0.5),
    });

    // La cabecera va DEBAJO del bloque del título. En export-students se dibuja hacia arriba
    // desde esta misma coordenada y tapa la línea "Generado · Página".
    const tableTop = top - TITLE_BLOCK_H - HEADER_H;
    page.drawRectangle({
      x: MARGIN,
      y: tableTop,
      width: tableW,
      height: HEADER_H,
      color: rgb(0.18, 0.18, 0.22),
    });
    let hx = MARGIN;
    input.headers.forEach((label, i) => {
      page.drawText(cellText(label, widths[i], fontBold, 7.5), {
        x: hx + CELL_PAD,
        y: tableTop + 7,
        size: 7.5,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      hx += widths[i];
    });

    pageRows.forEach((row, ri) => {
      // La primera fila queda justo debajo de la cabecera.
      const rowY = tableTop - (ri + 1) * ROW_H;
      page.drawRectangle({
        x: MARGIN,
        y: rowY,
        width: tableW,
        height: ROW_H,
        color: ri % 2 === 0 ? rgb(0.97, 0.97, 0.98) : rgb(1, 1, 1),
      });
      let cx = MARGIN;
      input.headers.forEach((_, ci) => {
        page.drawText(cellText(row[ci], widths[ci], fontReg, 7), {
          x: cx + CELL_PAD,
          y: rowY + 5,
          size: 7,
          font: fontReg,
          color: rgb(0.15, 0.15, 0.15),
        });
        cx += widths[ci];
      });
    });

    page.drawLine({
      start: { x: MARGIN, y: MARGIN },
      end: { x: PAGE_W - MARGIN, y: MARGIN },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    if (input.footer) {
      page.drawText(drawable(fontReg, input.footer), {
        x: MARGIN,
        y: MARGIN - 12,
        size: 7,
        font: fontReg,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  });

  return doc.save();
}
