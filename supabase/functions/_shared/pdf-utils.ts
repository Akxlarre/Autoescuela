// supabase/functions/_shared/pdf-utils.ts
//
// Shared PDF generation utilities for Deno Edge Functions.
// Consolidates font metrics, text rendering, image loading (PNG/JPEG),
// downscaling, and PDF 1.4 assembly.
//
// Usado por: generate-certificate-b-pdf, generate-certificate-professional-pdf,
// generate-class-book-pdf, generate-student-license-pdf, generate-contract-pdf, etc.
// @ts-nocheck
// ══════════════════════════════════════════════════════════════════════════════
// 1. Text & Font Primitives
// ══════════════════════════════════════════════════════════════════════════════

export function escapePdfWinAnsi(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 92) out += '\\\\';
    else if (c === 40) out += '\\(';
    else if (c === 41) out += '\\)';
    else if (c >= 32 && c <= 126) out += str[i];
    else if (c < 256) out += `\\${c.toString(8).padStart(3, '0')}`;
    else out += '?'; // Caracter fuera de WinAnsi (ej: emojis, kanji)
  }
  return out;
}

export function wrapLines(text: string, maxChars: number): string[] {
  const result: string[] = [];
  const words = text.trim().split(/\s+/);
  let line = '';
  for (const w of words) {
    const c = line ? `${line} ${w}` : w;
    if (c.length > maxChars) {
      if (line) result.push(line);
      line = w;
    } else line = c;
  }
  if (line) result.push(line);
  return result;
}

export const HV_REG: Record<string, number> = {
  ' ': 278,
  '!': 278,
  '"': 355,
  '#': 556,
  $: 556,
  '%': 889,
  '&': 667,
  "'": 222,
  '(': 333,
  ')': 333,
  '*': 389,
  '+': 584,
  ',': 278,
  '-': 333,
  '.': 278,
  '/': 278,
  '0': 556,
  '1': 556,
  '2': 556,
  '3': 556,
  '4': 556,
  '5': 556,
  '6': 556,
  '7': 556,
  '8': 556,
  '9': 556,
  ':': 278,
  ';': 278,
  '<': 584,
  '=': 584,
  '>': 584,
  '?': 556,
  '@': 1015,
  A: 667,
  B: 667,
  C: 667,
  D: 722,
  E: 667,
  F: 611,
  G: 722,
  H: 722,
  I: 278,
  J: 500,
  K: 667,
  L: 611,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 611,
  Z: 611,
  a: 556,
  b: 611,
  c: 556,
  d: 611,
  e: 556,
  f: 333,
  g: 611,
  h: 611,
  i: 278,
  j: 278,
  k: 556,
  l: 278,
  m: 889,
  n: 611,
  o: 611,
  p: 611,
  q: 611,
  r: 333,
  s: 556,
  t: 278,
  u: 611,
  v: 556,
  w: 778,
  x: 556,
  y: 556,
  z: 500,
};

export const HV_BOLD: Record<string, number> = {
  ' ': 278,
  '(': 333,
  ')': 333,
  '-': 333,
  '.': 278,
  ',': 278,
  ':': 333,
  '/': 278,
  '0': 556,
  '1': 556,
  '2': 556,
  '3': 556,
  '4': 556,
  '5': 556,
  '6': 556,
  '7': 556,
  '8': 556,
  '9': 556,
  A: 722,
  B: 722,
  C: 667,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 556,
  K: 722,
  L: 611,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 611,
  Z: 611,
  a: 556,
  b: 611,
  c: 556,
  d: 611,
  e: 556,
  f: 333,
  g: 611,
  h: 611,
  i: 278,
  j: 278,
  k: 556,
  l: 278,
  m: 889,
  n: 611,
  o: 611,
  p: 611,
  q: 611,
  r: 389,
  s: 556,
  t: 333,
  u: 611,
  v: 556,
  w: 778,
  x: 611,
  y: 556,
  z: 500,
};

export function textWidth(text: string, size: number, bold: boolean): number {
  const table = bold ? HV_BOLD : HV_REG;
  let total = 0;
  for (const ch of text) {
    total += table[ch] ?? (bold ? 556 : 500);
  }
  return (total / 1000) * size;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. ASCII85 Encoder
// ══════════════════════════════════════════════════════════════════════════════

export function encodeAscii85(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 4) {
    const remaining = len - i;
    const b0 = bytes[i];
    const b1 = remaining > 1 ? bytes[i + 1] : 0;
    const b2 = remaining > 2 ? bytes[i + 2] : 0;
    const b3 = remaining > 3 ? bytes[i + 3] : 0;
    const n = ((b0 * 16777216 + b1 * 65536 + b2 * 256 + b3) >>> 0) as number;

    if (remaining >= 4 && n === 0) {
      out += 'z';
    } else {
      let v = n;
      const g = new Array(5);
      for (let j = 4; j >= 0; j--) {
        g[j] = String.fromCharCode((v % 85) + 33);
        v = Math.floor(v / 85);
      }
      const chars = g.join('');
      out += remaining >= 4 ? chars : chars.slice(0, remaining + 1);
    }
    if (out.length % 75 < 5 && out.length > 75) out += '\n';
  }
  out += '~>';
  return out;
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Image Types & Loaders
// ══════════════════════════════════════════════════════════════════════════════

export interface PngPdfImage {
  kind: 'png';
  width: number;
  height: number;
  rgb: Uint8Array;
  alpha: Uint8Array | null;
}

export interface JpgPdfImage {
  kind: 'jpg';
  width: number;
  height: number;
  raw: Uint8Array;
}

export type AnyPdfImage = PngPdfImage | JpgPdfImage;

function downscaleRgb(
  rgb: Uint8Array,
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number,
): { data: Uint8Array; w: number; h: number } {
  if (srcW <= maxW && srcH <= maxH) return { data: rgb, w: srcW, h: srcH };
  const scale = Math.min(maxW / srcW, maxH / srcH);
  const dstW = Math.max(1, Math.round(srcW * scale));
  const dstH = Math.max(1, Math.round(srcH * scale));
  const out = new Uint8Array(dstW * dstH * 3);
  const xScale = srcW / dstW;
  const yScale = srcH / dstH;
  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      const sx = Math.min(Math.floor(dx * xScale), srcW - 1);
      const sy = Math.min(Math.floor(dy * yScale), srcH - 1);
      const si = (sy * srcW + sx) * 3;
      const di = (dy * dstW + dx) * 3;
      out[di] = rgb[si];
      out[di + 1] = rgb[si + 1];
      out[di + 2] = rgb[si + 2];
    }
  }
  return { data: out, w: dstW, h: dstH };
}

function downscaleAlpha(
  alpha: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array {
  if (srcW === dstW && srcH === dstH) return alpha;
  const out = new Uint8Array(dstW * dstH);
  const xScale = srcW / dstW;
  const yScale = srcH / dstH;
  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      const sx = Math.min(Math.floor(dx * xScale), srcW - 1);
      const sy = Math.min(Math.floor(dy * yScale), srcH - 1);
      out[dy * dstW + dx] = alpha[sy * srcW + sx];
    }
  }
  return out;
}

export async function loadImageForPdf(
  url: string,
  maxW = 9999,
  maxH = 9999,
): Promise<AnyPdfImage | null> {
  let bytes: Uint8Array;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return loadJpegForPdf(bytes);
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG_SIG.every((b, i) => bytes[i] === b)) return loadPngFromBytes(bytes, maxW, maxH);
  return null;
}

export async function loadPngForPdf(
  url: string,
  maxW = 9999,
  maxH = 9999,
): Promise<PngPdfImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return loadPngFromBytes(new Uint8Array(await res.arrayBuffer()), maxW, maxH);
  } catch {
    return null;
  }
}

function loadJpegForPdf(bytes: Uint8Array): JpgPdfImage | null {
  let width = 0,
    height = 0;
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) break;
    const marker = bytes[pos + 1];
    const len = (bytes[pos + 2] << 8) | bytes[pos + 3];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      height = (bytes[pos + 5] << 8) | bytes[pos + 6];
      width = (bytes[pos + 7] << 8) | bytes[pos + 8];
      break;
    }
    pos += 2 + len;
  }
  if (!width || !height) return null;
  return { kind: 'jpg', width, height, raw: bytes };
}

export async function loadPngFromBytes(
  bytes: Uint8Array,
  maxW = 9999,
  maxH = 9999,
): Promise<PngPdfImage | null> {
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) return null;

  let pos = 8,
    width = 0,
    height = 0,
    colorType = 0;
  const idatParts: Uint8Array[] = [];

  while (pos + 12 <= bytes.length) {
    const length = (((bytes[pos] << 24) |
      (bytes[pos + 1] << 16) |
      (bytes[pos + 2] << 8) |
      bytes[pos + 3]) >>>
      0) as number;
    const type = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7],
    );
    const data = bytes.slice(pos + 8, pos + 8 + length);
    pos += 12 + length;
    if (type === 'IHDR') {
      width = (((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0) as number;
      height = (((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>> 0) as number;
      if (data[8] !== 8 || (data[9] !== 2 && data[9] !== 6)) return null;
      colorType = data[9];
    } else if (type === 'IDAT') idatParts.push(data);
    else if (type === 'IEND') break;
  }
  if (!width || !height) return null;

  const totalLen = idatParts.reduce((s, p) => s + p.length, 0);
  const idatData = new Uint8Array(totalLen);
  let off = 0;
  for (const p of idatParts) {
    idatData.set(p, off);
    off += p.length;
  }

  let raw: Uint8Array;
  try {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    const [, chunks] = await Promise.all([
      (async () => {
        await writer.write(idatData);
        await writer.close();
      })(),
      (async () => {
        const parts: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) parts.push(value);
        }
        return parts;
      })(),
    ]);
    const rawLen = chunks.reduce((s, c) => s + c.length, 0);
    raw = new Uint8Array(rawLen);
    let rOff = 0;
    for (const c of chunks) {
      raw.set(c, rOff);
      rOff += c.length;
    }
  } catch {
    return null;
  }

  const ch = colorType === 6 ? 4 : 3;
  const stride = width * ch;
  const rgb = new Uint8Array(width * height * 3);
  const alphaData = colorType === 6 ? new Uint8Array(width * height) : null;
  const prev = new Uint8Array(stride);

  for (let row = 0; row < height; row++) {
    const rs = row * (stride + 1);
    const ft = raw[rs];
    const rr = raw.subarray(rs + 1, rs + 1 + stride);
    const cur = new Uint8Array(stride);
    switch (ft) {
      case 0:
        cur.set(rr);
        break;
      case 1:
        for (let i = 0; i < stride; i++) cur[i] = (rr[i] + (i >= ch ? cur[i - ch] : 0)) & 0xff;
        break;
      case 2:
        for (let i = 0; i < stride; i++) cur[i] = (rr[i] + prev[i]) & 0xff;
        break;
      case 3:
        for (let i = 0; i < stride; i++) {
          const a = i >= ch ? cur[i - ch] : 0;
          cur[i] = (rr[i] + Math.floor((a + prev[i]) / 2)) & 0xff;
        }
        break;
      case 4:
        for (let i = 0; i < stride; i++) {
          const a = i >= ch ? cur[i - ch] : 0;
          const b = prev[i];
          const c = i >= ch ? prev[i - ch] : 0;
          const p = a + b - c;
          const pa = Math.abs(p - a),
            pb = Math.abs(p - b),
            pc = Math.abs(p - c);
          cur[i] = (rr[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
        }
        break;
    }
    prev.set(cur);
    for (let col = 0; col < width; col++) {
      const s = col * ch,
        d = (row * width + col) * 3;
      rgb[d] = cur[s];
      rgb[d + 1] = cur[s + 1];
      rgb[d + 2] = cur[s + 2];
      if (alphaData) alphaData[row * width + col] = cur[s + 3];
    }
  }

  const scaled = downscaleRgb(rgb, width, height, maxW, maxH);
  const scaledAlpha = alphaData
    ? downscaleAlpha(alphaData, width, height, scaled.w, scaled.h)
    : null;

  return {
    kind: 'png',
    width: scaled.w,
    height: scaled.h,
    rgb: scaled.data,
    alpha: scaledAlpha,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. PDF Assembler
// ══════════════════════════════════════════════════════════════════════════════

export function assemblePdf(
  pageStreams: string[],
  W: number,
  H: number,
  logo?: AnyPdfImage | null,
  photo?: AnyPdfImage | null,
): Uint8Array {
  const imageObjs: string[] = [];
  let logoRef = '';
  let photoRef = '';
  let nextId = 5;

  if (logo) {
    if (logo.kind === 'png') {
      const smaskRef = logo.alpha ? `${nextId + 1} 0 R` : '';
      const smask = smaskRef ? ` /SMask ${smaskRef}` : '';
      const a85rgb = encodeAscii85(logo.rgb);
      imageObjs.push(
        `${nextId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height}` +
          ` /ColorSpace /DeviceRGB /BitsPerComponent 8${smask}` +
          ` /Filter /ASCII85Decode /Length ${a85rgb.length} >>\nstream\n${a85rgb}\nendstream\nendobj`,
      );
      logoRef = `${nextId} 0 R`;
      nextId++;
      if (logo.alpha) {
        const a85alpha = encodeAscii85(logo.alpha);
        imageObjs.push(
          `${nextId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height}` +
            ` /ColorSpace /DeviceGray /BitsPerComponent 8` +
            ` /Filter /ASCII85Decode /Length ${a85alpha.length} >>\nstream\n${a85alpha}\nendstream\nendobj`,
        );
        nextId++;
      }
    }
  }

  if (photo) {
    if (photo.kind === 'png') {
      const smaskRef = photo.alpha ? `${nextId + 1} 0 R` : '';
      const smask = smaskRef ? ` /SMask ${smaskRef}` : '';
      const a85rgb = encodeAscii85(photo.rgb);
      imageObjs.push(
        `${nextId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${photo.width} /Height ${photo.height}` +
          ` /ColorSpace /DeviceRGB /BitsPerComponent 8${smask}` +
          ` /Filter /ASCII85Decode /Length ${a85rgb.length} >>\nstream\n${a85rgb}\nendstream\nendobj`,
      );
      photoRef = `${nextId} 0 R`;
      nextId++;
      if (photo.alpha) {
        const a85alpha = encodeAscii85(photo.alpha);
        imageObjs.push(
          `${nextId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${photo.width} /Height ${photo.height}` +
            ` /ColorSpace /DeviceGray /BitsPerComponent 8` +
            ` /Filter /ASCII85Decode /Length ${a85alpha.length} >>\nstream\n${a85alpha}\nendstream\nendobj`,
        );
        nextId++;
      }
    } else {
      // JPEG: ASCII85 + DCT
      const a85jpg = encodeAscii85(photo.raw);
      imageObjs.push(
        `${nextId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${photo.width} /Height ${photo.height}` +
          ` /ColorSpace /DeviceRGB /BitsPerComponent 8` +
          ` /Filter [/ASCII85Decode /DCTDecode] /Length ${a85jpg.length} >>\nstream\n${a85jpg}\nendstream\nendobj`,
      );
      photoRef = `${nextId} 0 R`;
      nextId++;
    }
  }

  const pageObjs: string[] = [];
  const pageIds: number[] = [];

  for (let i = 0; i < pageStreams.length; i++) {
    const s = pageStreams[i];
    const cId = nextId++;
    const pId = nextId++;

    let xobjDict = '';
    if (logoRef) xobjDict += ` /Im1 ${logoRef}`;
    if (photoRef) xobjDict += ` /Im2 ${photoRef}`;

    pageObjs.push(`${cId} 0 obj\n<< /Length ${s.length} >>\nstream\n${s}\nendstream\nendobj`);
    pageObjs.push(
      `${pId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}]` +
        ` /Contents ${cId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >>` +
        (xobjDict ? ` /XObject <<${xobjDict} >>` : '') +
        ` >> >>\nendobj`,
    );
    pageIds.push(pId);
  }

  const fixedObjs = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`,
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>\nendobj`,
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`,
  ];

  const all = [...fixedObjs, ...imageObjs, ...pageObjs];
  const encoder = new TextEncoder();
  // Header + binary comment (essential for some viewers)
  let pdf = encoder.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const offsets: number[] = [];

  for (const obj of all) {
    offsets.push(pdf.length);
    const objBytes = encoder.encode(obj + '\n');
    const nextPdf = new Uint8Array(pdf.length + objBytes.length);
    nextPdf.set(pdf);
    nextPdf.set(objBytes, pdf.length);
    pdf = nextPdf;
  }

  const xrefOffset = pdf.length;
  let xref = `xref\n0 ${all.length + 1}\n0000000000 65535 f \r\n`;
  for (const off of offsets) {
    xref += off.toString().padStart(10, '0') + ' 00000 n \r\n';
  }
  const trailer = `trailer\n<< /Size ${all.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const xrefBytes = encoder.encode(xref);
  const trailerBytes = encoder.encode(trailer);
  const finalPdf = new Uint8Array(pdf.length + xrefBytes.length + trailerBytes.length);
  finalPdf.set(pdf);
  finalPdf.set(xrefBytes, pdf.length);
  finalPdf.set(trailerBytes, pdf.length + xrefBytes.length);

  return finalPdf;
}
