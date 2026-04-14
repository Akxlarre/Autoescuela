// supabase/functions/generate-certificate-professional-pdf/index.ts
//
// Edge Function: generate-certificate-professional-pdf
//
// Genera el Certificado de finalización del Curso de Licencia Profesional a partir
// de un enrollment_id, lo sube al bucket 'documents' y devuelve su signed URL.
//
// Invocación desde el frontend:
//   await supabase.functions.invoke('generate-certificate-professional-pdf', {
//     body: { enrollment_id: 42 }
//   })
//
// Respuesta: { pdfUrl: "https://.../documents/...", pdfPath: "certificates_prof/42/Cert.pdf" }
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ─── CORS ───
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Constantes de la escuela ───
const SCHOOL = {
  nameTop: 'CONDUCTORES CHILLAN',
  subtitle: 'ESCUELA DE CONDUCTORES PROFESIONALES',
  address: 'CARRERA 74 FONO 2244030 WWW.CONDUCTORESCHILLAN.CL',
  legalRepFullName: 'JORGE ENRIQUE PEREZ GODOY',
  legalRepShort: 'CONDUCTORES CHILLAN',
  legalRepRut: '77.940.120-0',
  secretariaName: 'VICTORIA NAVARRETE UTRERAS',
  secretariaRole: 'ENCARGADA DE MATRICULA',
  city: 'Chillán',
};

const LOGO_URL =
  'https://skvekggejikzxhzsjmkz.supabase.co/storage/v1/object/public/assets/chillan_capacita.png';

// ─── Nombre del curso según clase de licencia ───
function getCourseLabel(licenseClass: string): string {
  const map: Record<string, string> = {
    A2: 'Licencia Profesional Clase A2',
    A3: 'Licencia Profesional Clase A3',
    A4: 'Licencia Profesional Clase A4',
    A5: 'Licencia Profesional Clase A5',
  };
  return map[licenseClass?.toUpperCase()] ?? 'Licencia Profesional';
}

// ─── Main ───
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { enrollment_id } = await req.json();
    if (!enrollment_id || typeof enrollment_id !== 'number') {
      return jsonRes({ error: 'enrollment_id (number) is required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 0. Obtener user_id interno del caller (para auditoría)
    let callerUserId: number | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const {
        data: { user: caller },
      } = await userClient.auth.getUser();
      if (caller) {
        const { data: callerRow } = await supabase
          .from('users')
          .select('id')
          .eq('supabase_uid', caller.id)
          .maybeSingle();
        callerUserId = callerRow?.id ?? null;
      }
    }

    // 1. Enrollment + student + user + course (para license_class)
    const { data: enrollment, error: enrollmentErr } = await supabase
      .from('enrollments')
      .select(
        `
        id,
        students!inner(
          id,
          users!inner(first_names, paternal_last_name, maternal_last_name, rut)
        ),
        courses!inner(license_class),
        promotion_courses!inner(
          professional_promotions!inner(name, start_date, end_date)
        )
      `,
      )
      .eq('id', enrollment_id)
      .single();

    if (enrollmentErr || !enrollment) {
      return jsonRes({ error: `Enrollment ${enrollment_id} no encontrado` }, 404);
    }

    const u = enrollment.students.users;
    const fullName = [u.first_names, u.paternal_last_name, u.maternal_last_name]
      .filter(Boolean)
      .join(' ')
      .toUpperCase();
    const rut = u.rut ?? '';

    const licenseClass = enrollment.courses?.license_class ?? 'A4';
    const courseLabel = getCourseLabel(licenseClass);

    const promo = enrollment.promotion_courses?.professional_promotions;
    const startDate = promo?.start_date ? fmtDateShort(promo.start_date) : '';
    const endDate = promo?.end_date ? fmtDateShort(promo.end_date) : '';

    // 3. Logo
    const logo = await loadPngForPdf(LOGO_URL);

    // 4. Build PDF
    const pdfBytes = buildCertificatePdf({
      fullName,
      rut,
      courseLabel,
      startDate,
      endDate,
      todayText: todayInSpanish(),
      logo,
    });

    // 5. Upload en bucket 'documents', carpeta 'certificates_prof/'
    const fileName = `Certificado_Prof_${sanitize(fullName)}.pdf`;
    const storagePath = `certificates_prof/${enrollment_id}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) {
      return jsonRes({ error: `Upload failed: ${uploadErr.message}` }, 500);
    }

    // 6. Persistir path relativo en enrollments
    await supabase
      .from('enrollments')
      .update({ certificate_professional_pdf_url: storagePath })
      .eq('id', enrollment_id);

    // 7. Upsert registro en `certificates` y registrar en `certificate_issuance_log`
    const studentId: number = enrollment.students.id;
    let certId: number | null = null;

    const { data: existingCert } = await supabase
      .from('certificates')
      .select('id')
      .eq('enrollment_id', enrollment_id)
      .eq('type', 'professional')
      .maybeSingle();

    if (existingCert) {
      certId = existingCert.id;
    } else {
      const { data: maxFolioRes } = await supabase
        .from('certificates')
        .select('folio')
        .order('folio', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextFolio = (maxFolioRes?.folio ?? 0) + 1;

      const { data: newCert, error: certErr } = await supabase
        .from('certificates')
        .insert({
          folio: nextFolio,
          enrollment_id,
          student_id: studentId,
          type: 'professional',
          status: 'issued',
          issued_date: new Date().toISOString().split('T')[0],
          issued_by: callerUserId,
        })
        .select('id')
        .single();

      if (!certErr && newCert) certId = newCert.id;
    }

    if (certId !== null) {
      await supabase.from('certificate_issuance_log').insert({
        certificate_id: certId,
        action: 'generated',
        user_id: callerUserId,
      });
    }

    // 8. Signed URL de corta vida (1 hora)
    const { data: signedData, error: signErr } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600);

    if (signErr || !signedData) {
      return jsonRes({ error: `Signed URL failed: ${signErr?.message}` }, 500);
    }

    return jsonRes({ pdfUrl: signedData.signedUrl, pdfPath: storagePath });
  } catch (err) {
    console.error('generate-certificate-professional-pdf error:', err);
    return jsonRes({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

function jsonRes(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

function fmtDateShort(ts: string): string {
  const d = new Date(ts);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function todayInSpanish(): string {
  const meses = [
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE',
  ];
  const d = new Date();
  return `${SCHOOL.city}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF Primitives (idéntico a generate-certificate-b-pdf)
// ══════════════════════════════════════════════════════════════════════════════

function escapePdfWinAnsi(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 92) out += '\\\\';
    else if (c === 40) out += '\\(';
    else if (c === 41) out += '\\)';
    else if (c >= 32 && c <= 126) out += str[i];
    else if (c >= 160 && c <= 255) out += `\\${c.toString(8).padStart(3, '0')}`;
  }
  return out;
}

function wrap(text: string, maxChars: number): string[] {
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

const HV_REG: Record<string, number> = {
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

const HV_BOLD: Record<string, number> = {
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

function textWidth(text: string, size: number, bold: boolean): number {
  const table = bold ? HV_BOLD : HV_REG;
  let total = 0;
  for (const ch of text) {
    total += table[ch] ?? (bold ? 556 : 500);
  }
  return (total / 1000) * size;
}

// ──────────────────────────────────────────────────────────────
// PNG loader → PdfImage
// ──────────────────────────────────────────────────────────────

interface PdfImage {
  width: number;
  height: number;
  rgbHex: string;
  alphaHex: string | null;
}

async function loadPngForPdf(url: string): Promise<PdfImage | null> {
  let bytes: Uint8Array;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }

  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) return null;

  let pos = 8;
  let width = 0,
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
      const s = col * ch;
      const d = (row * width + col) * 3;
      rgb[d] = cur[s];
      rgb[d + 1] = cur[s + 1];
      rgb[d + 2] = cur[s + 2];
      if (alphaData) alphaData[row * width + col] = cur[s + 3];
    }
  }

  const hexChars = '0123456789abcdef';
  const toHex = (data: Uint8Array) => {
    let s = '';
    for (let i = 0; i < data.length; i++) {
      s += hexChars[data[i] >> 4] + hexChars[data[i] & 0xf];
      if ((i + 1) % 40 === 0) s += '\n';
    }
    return s;
  };

  return { width, height, rgbHex: toHex(rgb), alphaHex: alphaData ? toHex(alphaData) : null };
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF Assembler
// ══════════════════════════════════════════════════════════════════════════════

function assemblePdf(pageStreams: string[], W: number, H: number, logo?: PdfImage): Uint8Array {
  const imageObjs: string[] = [];
  if (logo) {
    const smaskRef = logo.alphaHex ? ` /SMask 6 0 R` : '';
    const rgbStream = logo.rgbHex + '>';
    imageObjs.push(
      `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height}` +
        ` /ColorSpace /DeviceRGB /BitsPerComponent 8${smaskRef}` +
        ` /Filter /ASCIIHexDecode /Length ${rgbStream.length} >>\nstream\n${rgbStream}\nendstream\nendobj`,
    );
    if (logo.alphaHex) {
      const alphaStream = logo.alphaHex + '>';
      imageObjs.push(
        `6 0 obj\n<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height}` +
          ` /ColorSpace /DeviceGray /BitsPerComponent 8` +
          ` /Filter /ASCIIHexDecode /Length ${alphaStream.length} >>\nstream\n${alphaStream}\nendstream\nendobj`,
      );
    }
  }

  const firstPgId = 5 + imageObjs.length;
  const xobjRes = logo ? ` /XObject << /Im1 5 0 R >>` : '';

  const pageObjs: string[] = [];
  const pageIds: number[] = [];
  for (let i = 0; i < pageStreams.length; i++) {
    const s = pageStreams[i];
    const cId = firstPgId + i * 2;
    const pId = firstPgId + 1 + i * 2;
    pageObjs.push(`${cId} 0 obj\n<< /Length ${s.length} >>\nstream\n${s}\nendstream\nendobj`);
    pageObjs.push(
      `${pId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}]` +
        ` /Contents ${cId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobjRes} >> >>\nendobj`,
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
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of all) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${all.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${off.toString().padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${all.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF Builder — Certificado Clase Profesional (una sola página, Carta)
// ══════════════════════════════════════════════════════════════════════════════

interface CertificateData {
  fullName: string;
  rut: string;
  courseLabel: string;
  startDate: string;
  endDate: string;
  todayText: string;
  logo: PdfImage | null;
}

function buildCertificatePdf(d: CertificateData): Uint8Array {
  const W = 612,
    H = 792;
  const ML = 60,
    MR = 60;
  const cx = Math.round(W / 2);

  let ops = '';

  const T = (x: number, y: number, text: string, f: 'F1' | 'F2', size: number) => {
    ops += `BT /${f} ${size} Tf ${Math.round(x)} ${Math.round(y)} Td (${escapePdfWinAnsi(text)}) Tj ET\n`;
  };

  const TC = (y: number, text: string, f: 'F1' | 'F2', size: number) => {
    const w = textWidth(text, size, f === 'F2');
    T(cx - w / 2, y, text, f, size);
  };

  const paragraph = (
    yStart: number,
    text: string,
    f: 'F1' | 'F2',
    size: number,
    maxChars: number,
    leading: number,
    align: 'left' | 'center' = 'left',
  ): number => {
    const lines = wrap(text, maxChars);
    let y = yStart;
    for (const line of lines) {
      if (align === 'center') TC(y, line, f, size);
      else T(ML, y, line, f, size);
      y -= leading;
    }
    return y;
  };

  // ── ENCABEZADO ──
  const logo = d.logo;
  const logoH = 70;
  const logoW = logo ? Math.round((logo.width / logo.height) * logoH) : 0;
  let y = H - 60;

  if (logo) {
    ops += `q ${logoW} 0 0 ${logoH} ${ML} ${Math.round(y - logoH)} cm /Im1 Do Q\n`;
  }

  const headerRightX = ML + logoW + 20;
  const headerCenterX = Math.round((headerRightX + (W - MR)) / 2);
  const headerTop = y - 18;

  ops += `0 0 0.55 rg\n`;
  const l1 = SCHOOL.nameTop;
  const l1W = textWidth(l1, 11, true);
  T(headerCenterX - l1W / 2, headerTop, l1, 'F2', 11);
  ops += `0.6 w 0 0 0.55 RG ${Math.round(headerCenterX - l1W / 2)} ${Math.round(headerTop - 2)} m ${Math.round(headerCenterX + l1W / 2)} ${Math.round(headerTop - 2)} l S\n`;

  const l2 = SCHOOL.subtitle;
  const l2W = textWidth(l2, 10, true);
  T(headerCenterX - l2W / 2, headerTop - 14, l2, 'F2', 10);
  ops += `0.6 w ${Math.round(headerCenterX - l2W / 2)} ${Math.round(headerTop - 16)} m ${Math.round(headerCenterX + l2W / 2)} ${Math.round(headerTop - 16)} l S\n`;

  const l3W = textWidth(SCHOOL.address, 8, false);
  T(headerCenterX - l3W / 2, headerTop - 28, SCHOOL.address, 'F1', 8);
  ops += `0 0 0 rg 0 0 0 RG\n`;

  // ── Título ──
  y = H - 60 - logoH - 30;
  ops += `0 0 0.55 rg\n`;
  const titleTxt = 'Certificado';
  const titleSize = 18;
  const titleW = textWidth(titleTxt, titleSize, true);
  T(cx - titleW / 2, y, titleTxt, 'F2', titleSize);
  ops += `1.0 w 0 0 0.55 RG ${Math.round(cx - titleW / 2)} ${Math.round(y - 3)} m ${Math.round(cx + titleW / 2)} ${Math.round(y - 3)} l S\n`;
  ops += `0 0 0 rg 0 0 0 RG\n`;

  // ── Párrafo introductorio ──
  y -= 55;
  const intro =
    `${SCHOOL.legalRepFullName} representante legal, de ${SCHOOL.legalRepShort} ` +
    `Escuela de Conductores Profesionales Rut: ${SCHOOL.legalRepRut}, mediante el presente ` +
    `documento certifica que:`;
  y = paragraph(y, intro, 'F1', 11, 78, 16, 'left');

  // ── Nombre y RUT ──
  y -= 24;
  TC(y, `El Sr.(a) ${d.fullName}`, 'F2', 11);
  y -= 16;
  TC(y, `RUT ${d.rut}`, 'F2', 11);

  // ── Párrafo del curso ──
  y -= 32;
  const startTxt = d.startDate || '__________';
  const endTxt = d.endDate || '__________';
  const body =
    `Realiz\xF3 el Curso de ${d.courseLabel} en Nuestra Escuela entre los d\xEDas ` +
    `${startTxt} al ${endTxt} aprobando satisfactoriamente.`;
  y = paragraph(y, body, 'F1', 11, 82, 16, 'left');

  // ── Cierre ──
  y -= 24;
  TC(y, 'Se extiende el presente certificado para acreditar curso.', 'F1', 11);

  // ── Firma ──
  y -= 70;
  TC(y, SCHOOL.secretariaName, 'F2', 11);
  y -= 14;
  TC(y, SCHOOL.secretariaRole, 'F2', 10);

  // ── Fecha ciudad ──
  y -= 50;
  T(ML, y, d.todayText, 'F1', 10);

  return assemblePdf([ops], W, H, logo ?? undefined);
}
