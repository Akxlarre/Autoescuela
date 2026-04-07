// supabase/functions/generate-class-book-pdf/index.ts
//
// Edge Function: generate-class-book-pdf
//
// Genera el Libro de Clases Profesional como PDF a partir de un promotion_course_id.
// Incluye: cabecera, profesores, lista de alumnos, reglamento OTEC, asistencia semanal,
// calendario de clases, evaluaciones, resumen de asistencia.
//
// Invocación:
//   await supabase.functions.invoke('generate-class-book-pdf', {
//     body: { promotion_course_id: 42 }
//   })
//
// Respuesta: { pdfUrl: "https://...storage.../class-books/42/LibroDeClases_A2_PROM-2026-01.pdf" }
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ─── CORS ───

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Main ───

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { promotion_course_id } = await req.json();

    if (!promotion_course_id || typeof promotion_course_id !== 'number') {
      return jsonRes({ error: 'promotion_course_id (number) is required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Fetch all data in parallel ──
    const [
      courseRes,
      lecturersRes,
      enrollmentsRes,
      theoryRes,
      practiceRes,
      gradesRes,
      signaturesRes,
      classBookRes,
    ] = await Promise.all([
      // 1. Course + promotion + branch
      supabase
        .from('promotion_courses')
        .select(
          `id, courses!inner(name, code, license_class),
             professional_promotions!inner(name, code, start_date, end_date, status, branches(name, address))`,
        )
        .eq('id', promotion_course_id)
        .single(),

      // 2. Lecturers
      supabase
        .from('promotion_course_lecturers')
        .select('role, lecturers!inner(first_names, paternal_last_name)')
        .eq('promotion_course_id', promotion_course_id),

      // 3. Enrolled students
      supabase
        .from('enrollments')
        .select(
          'id, students!inner(users!inner(first_names, paternal_last_name, maternal_last_name, rut, phone))',
        )
        .eq('promotion_course_id', promotion_course_id)
        .not('status', 'in', '("cancelled","draft")')
        .order('id'),

      // 4. Theory sessions + attendance
      supabase
        .from('professional_theory_sessions')
        .select('id, date, status')
        .eq('promotion_course_id', promotion_course_id)
        .order('date'),

      // 5. Practice sessions
      supabase
        .from('professional_practice_sessions')
        .select('id, date, status')
        .eq('promotion_course_id', promotion_course_id)
        .order('date'),

      // 6. Grades (fetched separately after enrollments)
      supabase
        .from('professional_module_grades')
        .select('enrollment_id, module_number, grade, passed, status')
        .order('enrollment_id'),

      // 7. Weekly signatures
      supabase
        .from('professional_weekly_signatures')
        .select('enrollment_id, week_start_date, signed_at')
        .eq('promotion_course_id', promotion_course_id),

      // 8. Class book editable fields
      supabase
        .from('class_book')
        .select('sence_code, horario')
        .eq('promotion_course_id', promotion_course_id)
        .maybeSingle(),
    ]);

    if (courseRes.error || !courseRes.data) {
      return jsonRes({ error: `Curso no encontrado: ${courseRes.error?.message}` }, 404);
    }

    const course = courseRes.data.courses;
    const promo = courseRes.data.professional_promotions;
    const branch = promo.branches;
    const licenseClass = course.license_class;
    const classBook = classBookRes.data;

    // Enrollments
    const enrollments = (enrollmentsRes.data ?? []).map((e, i) => {
      const u = e.students.users;
      return {
        id: e.id,
        numero: i + 1,
        nombre: [u.paternal_last_name, u.maternal_last_name, u.first_names]
          .filter(Boolean)
          .join(' '),
        rut: u.rut ?? '',
        telefono: u.phone ?? '',
      };
    });
    const enrollmentIds = enrollments.map((e) => e.id);

    // Filter grades to this course's enrollments
    const grades = (gradesRes.data ?? []).filter((g) => enrollmentIds.includes(g.enrollment_id));

    // Theory attendance (need separate query with session IDs)
    const theoryIds = (theoryRes.data ?? []).map((s) => s.id);
    const practiceIds = (practiceRes.data ?? []).map((s) => s.id);

    const [theoryAttRes, practiceAttRes] = await Promise.all([
      theoryIds.length > 0
        ? supabase
            .from('professional_theory_attendance')
            .select('theory_session_prof_id, enrollment_id, status')
            .in('theory_session_prof_id', theoryIds)
        : Promise.resolve({ data: [], error: null }),
      practiceIds.length > 0
        ? supabase
            .from('professional_practice_attendance')
            .select('session_id, enrollment_id, status')
            .in('session_id', practiceIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    // Module names based on license class
    const moduleNames = getModuleNames(licenseClass);

    // Lecturers
    const lecturers = (lecturersRes.data ?? []).map((l) => ({
      name: `${l.lecturers.first_names} ${l.lecturers.paternal_last_name}`,
      role: l.role,
    }));

    // ── Build PDF (with 40s safety timeout) ──
    const pdfBytes = await Promise.race([
      buildClassBookPdf({
        promo: {
          name: promo.name,
          code: promo.code,
          startDate: promo.start_date,
          endDate: promo.end_date,
        },
        course: { name: course.name, code: course.code, licenseClass },
        branch: { name: branch?.name ?? '', address: branch?.address ?? '' },
        senceCode: classBook?.sence_code ?? '',
        horario: classBook?.horario ?? '',
        lecturers,
        moduleNames,
        enrollments,
        theorySessions: theoryRes.data ?? [],
        theoryAttendance: theoryAttRes.data ?? [],
        practiceSessions: practiceRes.data ?? [],
        practiceAttendance: practiceAttRes.data ?? [],
        grades,
        signatures: signaturesRes.data ?? [],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PDF generation timeout after 40s')), 40_000),
      ),
    ]);

    // ── Upload to Storage ──
    const fileName = `LibroDeClases_${licenseClass}_${promo.code ?? promotion_course_id}.pdf`;
    const storagePath = `class-books/${promotion_course_id}/${sanitize(fileName)}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      return jsonRes({ error: `Upload failed: ${uploadError.message}` }, 500);
    }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);

    // ── Update class_book record ──
    await supabase.from('class_book').upsert(
      {
        promotion_course_id,
        branch_id: branch?.id ?? null,
        period: promo.code,
        pdf_url: urlData.publicUrl,
        generated_at: new Date().toISOString(),
        status: 'active',
      },
      { onConflict: 'promotion_course_id' },
    );

    return jsonRes({ pdfUrl: urlData.publicUrl });
  } catch (err) {
    console.error('generate-class-book-pdf error:', err);
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
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function fmtDate(d: string | null): string {
  if (!d) return '\u2014';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtShort(d: string): string {
  const dt = new Date(d + 'T12:00:00');
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function getMondayForDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

const BASE_MODULES: Record<number, string> = {
  1: 'Ley del Tr\u00e1nsito, Resp. Civil y Penal',
  2: 'Prevenci\u00f3n de Riesgos',
  3: 'Infraestructura y Educ. Vial',
  4: 'Mec\u00e1nica',
  6: 'Conducci\u00f3n',
  7: 'Asp. Psicol\u00f3gicos y Comunicaci\u00f3n',
};

function getModuleNames(lc: string): string[] {
  const m5 = lc === 'A4' || lc === 'A5' ? 'Transporte de Carga' : 'Transporte de Pasajeros';
  return [
    BASE_MODULES[1],
    BASE_MODULES[2],
    BASE_MODULES[3],
    BASE_MODULES[4],
    m5,
    BASE_MODULES[6],
    BASE_MODULES[7],
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF Primitives (same pattern as generate-contract-pdf)
// ══════════════════════════════════════════════════════════════════════════════

function esc(str: string): string {
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

function wrapLines(text: string, max: number): string[] {
  const result: string[] = [];
  const words = text.trim().split(/\s+/);
  let line = '';
  for (const w of words) {
    const c = line ? `${line} ${w}` : w;
    if (c.length > max) {
      if (line) result.push(line);
      line = w;
    } else {
      line = c;
    }
  }
  if (line) result.push(line);
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// PNG → PDF Image (logo embedding via ASCIIHexDecode)
// ══════════════════════════════════════════════════════════════════════════════

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
    if (!res.ok) {
      console.error(`[loadPngForPdf] HTTP ${res.status} fetching logo: ${url}`);
      return null;
    }
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.error('[loadPngForPdf] fetch error:', e);
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
      if (data[8] !== 8 || (data[9] !== 2 && data[9] !== 6)) return null; // 8-bit RGB or RGBA only
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (!width || !height) return null;

  // Concatenate IDAT chunks → decompress (zlib format)
  const totalLen = idatParts.reduce((s, p) => s + p.length, 0);
  const idatData = new Uint8Array(totalLen);
  let off2 = 0;
  for (const p of idatParts) {
    idatData.set(p, off2);
    off2 += p.length;
  }

  let raw: Uint8Array;
  try {
    // PNG IDAT is zlib-encoded (78 DA header + deflate payload + 4-byte adler32).
    // DecompressionStream('deflate') handles the full zlib format natively — no slicing needed.
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();

    // Write and read concurrently to avoid TransformStream backpressure deadlock
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
  } catch (e) {
    console.error('[loadPngForPdf] IDAT decompression error:', e);
    return null;
  }

  // Remove PNG row filters
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
  // Image XObjects: logo RGB at obj 5, alpha SMask at obj 6 (if RGBA)
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
// PDF Builder — Libro de Clases
// ══════════════════════════════════════════════════════════════════════════════

interface ClassBookData {
  promo: { name: string; code: string; startDate: string; endDate: string };
  course: { name: string; code: string; licenseClass: string };
  branch: { name: string; address: string };
  senceCode: string;
  horario: string;
  lecturers: { name: string; role: string | null }[];
  moduleNames: string[];
  enrollments: { id: number; numero: number; nombre: string; rut: string; telefono: string }[];
  theorySessions: { id: number; date: string; status: string }[];
  theoryAttendance: { theory_session_prof_id: number; enrollment_id: number; status: string }[];
  practiceSessions: { id: number; date: string; status: string }[];
  practiceAttendance: { session_id: number; enrollment_id: number; status: string }[];
  grades: {
    enrollment_id: number;
    module_number: number;
    grade: number;
    passed: boolean;
    status: string;
  }[];
  signatures: { enrollment_id: number; week_start_date: string; signed_at: string | null }[];
}

async function buildClassBookPdf(d: ClassBookData): Promise<Uint8Array> {
  const W = 842,
    H = 595; // Landscape A4
  const ML = 40,
    MR = 40,
    MB = 40;
  const PW = W - ML - MR; // printable width

  // Logo desde Supabase Storage (bucket public "assets")
  const logo = await loadPngForPdf(
    'https://skvekggejikzxhzsjmkz.supabase.co/storage/v1/object/public/assets/chillan_capacita.png',
  );
  const logoH = 68;
  const logoW = logo ? Math.round((logo.width / logo.height) * logoH) : 0;

  // Smaller logo for inner pages
  const innerLogoH = 44;
  const innerLogoW = logo ? Math.round((logo.width / logo.height) * innerLogoH) : 0;

  const pages: string[] = [];
  let ops = '';
  let y = H - 40;

  /**
   * Draws a page header with logo (top-left) + centered bold title + thick separator.
   * Advances y to the content area below. Call right after NP().
   */
  const drawLogoHeader = (title: string, size = 12) => {
    if (logo) {
      ops += `q ${innerLogoW} 0 0 ${innerLogoH} ${ML} ${Math.round(y - innerLogoH)} cm /Im1 Do Q\n`;
    }
    // Vertically center title within logo height; estimate half-width for centering
    const titleY = Math.round(y - innerLogoH / 2 + size / 2);
    const halfW = Math.round((title.length * 0.68 * size) / 2);
    const cx = Math.round(W / 2);
    T(cx - halfW, titleY, title, 'F2', size);
    y -= innerLogoH + 6;
    HL(y, 1.5);
    y -= 10;
  };

  const NP = () => {
    pages.push(ops);
    ops = '';
    y = H - 40;
  };
  const need = (h: number) => {
    if (y - h < MB) NP();
  };

  const T = (x: number, yp: number, text: string, f: 'F1' | 'F2', size: number) => {
    ops += `BT /${f} ${size} Tf ${x} ${Math.round(yp)} Td (${esc(text)}) Tj ET\n`;
  };
  const HL = (yp: number, lw = 0.4, x1 = ML, x2 = W - MR) => {
    ops += `${lw} w ${x1} ${Math.round(yp)} m ${x2} ${Math.round(yp)} l S\n`;
  };
  const VL = (x: number, y1: number, y2: number, lw = 0.3) => {
    ops += `${lw} w ${Math.round(x)} ${Math.round(y1)} m ${Math.round(x)} ${Math.round(y2)} l S\n`;
  };
  const Rect = (x: number, yp: number, w: number, h: number) => {
    ops += `0.93 0.93 0.93 rg ${Math.round(x)} ${Math.round(yp)} ${Math.round(w)} ${Math.round(h)} re f 0 0 0 rg\n`;
  };
  // Set fill color (for text)
  const C = (r: number, g: number, b: number) => {
    ops += `${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)} rg\n`;
  };
  const K = () => {
    ops += `0 0 0 rg\n`;
  }; // reset to black

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1: PORTADA
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Logo (top-left) ──
  if (logo) {
    ops += `q ${logoW} 0 0 ${logoH} ${ML} ${Math.round(y - logoH)} cm /Im1 Do Q\n`;
  }

  // ── Title (centered over full page width) ──
  const titleY = Math.round(y - logoH / 2 + 7); // vertically centered in logo area
  const titleHalfW = 145; // approx half-width of "LIBRO DE CONTROL DE CLASES" at F2/18
  T(Math.round(W / 2) - titleHalfW, titleY, 'LIBRO DE CONTROL DE CLASES', 'F2', 18);
  HL(titleY - 4, 1.5, Math.round(W / 2) - titleHalfW, Math.round(W / 2) + titleHalfW);

  y -= logoH + 6;

  // ── Thick divider under header ──
  HL(y, 2.0);
  y -= 10;

  // ── Cover table ──
  const labelW = 235;
  const rowH = 34;
  const tableRows: [string, string][] = [
    ['NOMBRE DE LA AUTOESCUELA', d.branch.name],
    [
      'NOMBRE DE LA ACTIVIDAD DE CAPACITACI\u00d3N',
      `CURSO PROFESIONAL CLASE ${d.course.licenseClass}`,
    ],
    ['IDENTIFICADOR DE LA ACTIVIDAD (ID SENCE)', d.course.code],
    ['C\u00d3DIGO AUTORIZADO POR SENCE', d.senceCode || '\u2014'],
    ['FECHA DE INICIO CURSO', fmtDate(d.promo.startDate)],
    ['FECHA DE T\u00c9RMINO DE CURSO', fmtDate(d.promo.endDate)],
    ['LUGAR DE EJECUCI\u00d3N', d.branch.address || '\u2014'],
    ['HORARIO', d.horario || '\u2014'],
  ];

  const tableTop = y;
  const tableH2 = tableRows.length * rowH;
  const tableBot = tableTop - tableH2;

  // Outer border
  ops += `1.5 w ${ML} ${Math.round(tableBot)} ${PW} ${tableH2} re S\n`;

  for (let i = 0; i < tableRows.length; i++) {
    const [label, value] = tableRows[i];
    const rowTop = tableTop - i * rowH;
    // Inner row divider (skip first — outer border covers it)
    if (i > 0) HL(rowTop, 0.5, ML, ML + PW);
    const textY = rowTop - rowH / 2 - 3;
    // Label
    T(ML + 8, textY, label, 'F2', 7.5);
    // Colon
    T(ML + labelW - 14, textY, ':', 'F2', 8);
    // Value (black)
    T(ML + labelW + 8, textY, value, 'F1', 9);
  }

  // Vertical divider between label and value columns
  VL(ML + labelW, tableBot, tableTop, 0.5);

  y = tableBot;
  NP();

  // ── Profesores por módulo ──
  T(ML, y, 'PROFESORES', 'F2', 10);
  y -= 4;
  HL(y, 0.6);
  y -= 14;

  const modColW = [30, 300, PW - 330]; // N°, Módulo, Profesor
  // Header row
  Rect(ML, y - 2, PW, 14);
  T(ML + 4, y, 'N\u00b0', 'F2', 7);
  T(ML + modColW[0] + 4, y, 'M\u00d3DULO', 'F2', 7);
  T(ML + modColW[0] + modColW[1] + 4, y, 'NOMBRE PROFESOR', 'F2', 7);
  y -= 14;

  for (let i = 0; i < d.moduleNames.length; i++) {
    need(13);
    const prof = pickLecturer(d.lecturers, i + 1);
    T(ML + 8, y, `${i + 1}`, 'F1', 7);
    T(ML + modColW[0] + 4, y, d.moduleNames[i], 'F1', 7);
    T(ML + modColW[0] + modColW[1] + 4, y, prof, 'F1', 7);
    y -= 12;
    HL(y + 10, 0.15);
  }
  y -= 10;

  // ── Lista de Clase ──
  need(30);
  T(ML, y, 'LISTA DE CLASE', 'F2', 10);
  y -= 4;
  HL(y, 0.6);
  y -= 14;

  const listCols = [30, 250, 100, 100, 50]; // N°, Nombre, RUN, Teléfono, Lic.
  Rect(ML, y - 2, PW, 16);
  T(ML + 4, y, 'N\u00b0', 'F2', 8);
  T(ML + listCols[0] + 4, y, 'APELLIDO, NOMBRE', 'F2', 8);
  T(ML + listCols[0] + listCols[1] + 4, y, 'RUN', 'F2', 8);
  T(ML + listCols[0] + listCols[1] + listCols[2] + 4, y, 'TEL\u00c9FONO', 'F2', 8);
  T(ML + listCols[0] + listCols[1] + listCols[2] + listCols[3] + 4, y, 'LIC.', 'F2', 8);
  y -= 16;

  for (const e of d.enrollments) {
    need(14);
    T(ML + 8, y, `${e.numero}`, 'F1', 9);
    T(ML + listCols[0] + 4, y, e.nombre.slice(0, 45), 'F1', 9);
    T(ML + listCols[0] + listCols[1] + 4, y, e.rut, 'F1', 9);
    T(ML + listCols[0] + listCols[1] + listCols[2] + 4, y, e.telefono, 'F1', 9);
    T(
      ML + listCols[0] + listCols[1] + listCols[2] + listCols[3] + 4,
      y,
      d.course.licenseClass,
      'F1',
      9,
    );
    y -= 13;
    HL(y + 11, 0.15);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGLAMENTO INTERNO OTEC
  // ═══════════════════════════════════════════════════════════════════════════

  NP();
  T(ML, y, 'REGLAMENTO INTERNO OTEC CONDUCTORES CHILL\u00c1N', 'F2', 12);
  y -= 18;

  const reglamento = getReglamentoText();
  for (const para of reglamento) {
    if (para.startsWith('T\u00cdTULO') || para.startsWith('Art\u00edculo')) {
      need(16);
      T(ML, y, para, 'F2', 8);
      y -= 12;
    } else {
      const lines = wrapLines(para, 130);
      for (const line of lines) {
        need(11);
        T(ML, y, line, 'F1', 7);
        y -= 10;
      }
      y -= 4;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASISTENCIA SEMANAL
  // ═══════════════════════════════════════════════════════════════════════════

  const sessions = d.theorySessions ?? [];
  if (sessions.some((s) => s.status !== 'cancelled')) {
    // Group sessions by week (include cancelled to render them as 'C')
    const weekMap = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const mon = getMondayForDate(s.date);
      if (!weekMap.has(mon)) weekMap.set(mon, []);
      weekMap.get(mon)!.push(s);
    }
    // Remove weeks where ALL sessions are cancelled
    for (const [mon, ws] of weekMap) {
      if (ws.every((s) => s.status === 'cancelled')) weekMap.delete(mon);
    }

    // Attendance map
    const attMap = new Map<string, string>();
    for (const a of d.theoryAttendance) {
      attMap.set(`${a.theory_session_prof_id}-${a.enrollment_id}`, a.status);
    }

    // Signature set
    const sigSet = new Set<string>();
    for (const s of d.signatures) {
      if (s.signed_at) sigSet.add(`${s.enrollment_id}-${s.week_start_date}`);
    }

    let weekNum = 0;
    const dayNames = ['Lun', 'Mar', 'Mi\u00e9', 'Jue', 'Vie', 'S\u00e1b'];

    for (const [monday, weekSessions] of weekMap) {
      weekNum++;
      NP();

      // Generate 6 days Mon-Sat
      const dias: string[] = [];
      for (let i = 0; i < 6; i++) {
        const dt = new Date(monday + 'T12:00:00');
        dt.setDate(dt.getDate() + i);
        dias.push(dt.toISOString().split('T')[0]);
      }

      drawLogoHeader(
        `CONTROL DE ASISTENCIA DE ALUMNOS (FIRMA DIARIA) \u2014 Semana ${weekNum}`,
        11,
      );
      T(ML, y, `${fmtShort(monday)} al ${fmtShort(dias[5])}`, 'F1', 8);
      y -= 26;

      // Table header — nameW + dayW sized to fill PW=762
      // Layout: N°(28) + NOMBRE(252) + 6×day(73=438) + FIRMA(44) = 762
      const nameW = 252;
      const dayW = 73;
      const sigW = PW - 28 - nameW - 6 * dayW; // ~44
      Rect(ML, y - 2, PW, 18);
      T(ML + 4, y, 'N\u00b0', 'F2', 9);
      T(ML + 28, y, 'APELLIDO, NOMBRE', 'F2', 9);
      for (let i = 0; i < 6; i++) {
        const x = ML + 28 + nameW + i * dayW;
        T(x + 2, y, `${dayNames[i]} ${fmtShort(dias[i])}`, 'F2', 8);
      }
      T(ML + 28 + nameW + 6 * dayW + 4, y, 'FIRMA', 'F2', 9);
      y -= 18;

      for (const e of d.enrollments) {
        need(15);
        T(ML + 6, y, `${e.numero}`, 'F1', 9);
        T(ML + 28, y, e.nombre.slice(0, 38), 'F1', 9);

        for (let di = 0; di < 6; di++) {
          const x = ML + 28 + nameW + di * dayW;
          const session = weekSessions.find((s) => s.date === dias[di]);
          if (session && session.status === 'cancelled') {
            T(x + 5, y, 'LIBRE', 'F2', 8);
          } else if (session) {
            const status = attMap.get(`${session.id}-${e.id}`);
            const label =
              status === 'present'
                ? 'P'
                : status === 'absent'
                  ? 'A'
                  : status === 'excused'
                    ? 'J'
                    : '\u2014';
            T(x + 28, y, label, 'F1', 9);
          } else {
            T(x + 28, y, '\u2014', 'F1', 9);
          }
        }

        // Firma semanal
        const hasSig = sigSet.has(`${e.id}-${monday}`);
        T(ML + 28 + nameW + 6 * dayW + 8, y, hasSig ? 'S\u00ed' : '\u2014', 'F1', 9);

        y -= 14;
        HL(y + 12, 0.1);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDARIO DE CLASES
  // ═══════════════════════════════════════════════════════════════════════════

  NP();
  drawLogoHeader('CALENDARIO DE CLASES', 14);

  // Calendario layout: N°(35) | FECHA(100) | ASIGNATURA(290) | HORAS(70) | PROFESOR(rest≈267)
  Rect(ML, y - 2, PW, 18);
  T(ML + 4, y, 'N\u00b0', 'F2', 9);
  T(ML + 35, y, 'FECHA', 'F2', 9);
  T(ML + 135, y, 'ASIGNATURA', 'F2', 9);
  T(ML + 430, y, 'HORAS', 'F2', 9);
  T(ML + 500, y, 'PROFESOR', 'F2', 9);
  y -= 18;

  const activeSessions = sessions.filter((s) => s.status !== 'cancelled');
  const defaultProf = d.lecturers.length > 0 ? d.lecturers[0].name : '\u2014';

  for (let i = 0; i < activeSessions.length; i++) {
    need(15);
    const s = activeSessions[i];
    T(ML + 8, y, `${i + 1}`, 'F1', 10);
    T(ML + 35, y, fmtDate(s.date), 'F1', 10);
    T(ML + 135, y, 'Clase Te\u00f3rica', 'F1', 10);
    T(ML + 435, y, '5', 'F1', 10);
    T(ML + 500, y, defaultProf.slice(0, 30), 'F1', 10);
    y -= 14;
    HL(y + 12, 0.15);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVALUACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  NP();
  drawLogoHeader('EVALUACIONES CLASE PROFESIONAL', 14);

  // Build grades map: enrollmentId → moduleNumber → grade
  const gradeMap = new Map<number, Map<number, number>>();
  for (const g of d.grades) {
    if (!gradeMap.has(g.enrollment_id)) gradeMap.set(g.enrollment_id, new Map());
    gradeMap.get(g.enrollment_id)!.set(g.module_number, g.grade);
  }

  // Evaluaciones layout: N°(25) | APELLIDO(215) | 7×Mód(66=462) | FINAL(60) = 762
  const evalNameW = 215;
  const modW = 66;
  Rect(ML, y - 2, PW, 18);
  T(ML + 4, y, 'N\u00b0', 'F2', 9);
  T(ML + 25, y, 'APELLIDO, NOMBRE', 'F2', 9);
  for (let m = 0; m < 7; m++) {
    T(ML + 25 + evalNameW + m * modW + 4, y, `M\u00f3d.${m + 1}`, 'F2', 8);
  }
  T(ML + 25 + evalNameW + 7 * modW + 4, y, 'FINAL', 'F2', 9);
  y -= 18;

  for (const e of d.enrollments) {
    need(14);
    T(ML + 6, y, `${e.numero}`, 'F1', 9);
    T(ML + 25, y, e.nombre.slice(0, 35), 'F1', 9);

    const eGrades = gradeMap.get(e.id);
    const notasArr: (number | null)[] = [];
    for (let m = 1; m <= 7; m++) {
      const grade = eGrades?.get(m) ?? null;
      notasArr.push(grade);
      const x = ML + 25 + evalNameW + (m - 1) * modW;
      T(x + 18, y, grade !== null ? `${grade}` : '\u2014', 'F1', 9);
    }

    // Nota final (promedio)
    const validGrades = notasArr.filter((n): n is number => n !== null);
    const avg =
      validGrades.length > 0
        ? Math.round((validGrades.reduce((a, b) => a + b, 0) / validGrades.length) * 10) / 10
        : null;
    const x = ML + 25 + evalNameW + 7 * modW;
    T(x + 10, y, avg !== null ? `${avg}` : '\u2014', 'F2', 9);

    y -= 13;
    HL(y + 11, 0.1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUMEN ASISTENCIA
  // ═══════════════════════════════════════════════════════════════════════════

  NP();
  drawLogoHeader('ASISTENCIA CLASE PROFESIONAL', 14);

  const completedTheory = d.theorySessions.filter((s) => s.status === 'completed').map((s) => s.id);
  const completedPractice = d.practiceSessions
    .filter((s) => s.status === 'completed')
    .map((s) => s.id);

  // Asistencia layout: N°(30) | APELLIDO(330) | %PRÁCTICA(200) | %TEÓRICA(rest≈202)
  Rect(ML, y - 2, PW, 18);
  T(ML + 4, y, 'N\u00b0', 'F2', 9);
  T(ML + 35, y, 'APELLIDO, NOMBRE', 'F2', 9);
  T(ML + 365, y, '% ASIST. PR\u00c1CTICA', 'F2', 9);
  T(ML + 565, y, '% ASIST. TE\u00d3RICA', 'F2', 9);
  y -= 18;

  for (const e of d.enrollments) {
    need(15);
    const thAtt = d.theoryAttendance.filter(
      (a) =>
        a.enrollment_id === e.id &&
        a.status === 'present' &&
        completedTheory.includes(a.theory_session_prof_id),
    ).length;
    const prAtt = d.practiceAttendance.filter(
      (a) =>
        a.enrollment_id === e.id &&
        a.status === 'present' &&
        completedPractice.includes(a.session_id),
    ).length;
    const pctTh =
      completedTheory.length > 0 ? Math.round((thAtt / completedTheory.length) * 100) : 0;
    const pctPr =
      completedPractice.length > 0 ? Math.round((prAtt / completedPractice.length) * 100) : 0;

    T(ML + 8, y, `${e.numero}`, 'F1', 10);
    T(ML + 35, y, e.nombre.slice(0, 45), 'F1', 10);
    T(ML + 430, y, `${pctPr}%`, 'F1', 10);
    T(ML + 630, y, `${pctTh}%`, 'F1', 10);
    y -= 14;
    HL(y + 12, 0.15);
  }

  // Commit last page
  pages.push(ops);
  return assemblePdf(pages, W, H, logo ?? undefined);
}

function pickLecturer(
  lecturers: { name: string; role: string | null }[],
  moduleNumber: number,
): string {
  if (lecturers.length === 0) return '\u2014';
  if (lecturers.length === 1) return lecturers[0].name;
  const pref = moduleNumber === 6 ? 'practice' : 'theory';
  return (
    lecturers.find((l) => l.role === pref) ??
    lecturers.find((l) => l.role === 'both') ??
    lecturers[0]
  ).name;
}

// ══════════════════════════════════════════════════════════════════════════════
// Reglamento Interno OTEC (texto estático)
// ══════════════════════════════════════════════════════════════════════════════

function getReglamentoText(): string[] {
  return [
    'T\u00cdTULO I \u2014 DISPOSICIONES GENERALES',
    'Art\u00edculo N\u00b0 1. \u00c1mbito del Reglamento',
    'El presente Reglamento es el conjunto de normas que regula las actividades de capacitaci\u00f3n en CONDUCTORES CHILL\u00c1N as\u00ed como los derechos y deberes de los participantes.',
    'Art\u00edculo N\u00b0 2. Definiciones',
    'Para los prop\u00f3sitos de este reglamento, se aplican las definiciones indicadas en la NCh 2728 y adicionalmente las siguientes: a) Jornadas Abiertas: Actividades de capacitaci\u00f3n ofertadas directamente al mercado por parte de CONDUCTORES CHILL\u00c1N; b) Jornadas Cerradas: Actividades de capacitaci\u00f3n solicitadas expl\u00edcitamente por el cliente a CONDUCTORES CHILL\u00c1N, con caracter\u00edsticas espec\u00edficas acordadas.',
    'Art\u00edculo N\u00b0 3. Responsabilidad OTEC',
    'La responsabilidad sobre la planificaci\u00f3n, aplicaci\u00f3n y evaluaci\u00f3n de las actividades de capacitaci\u00f3n contenidas en el programa de capacitaci\u00f3n corresponde a CONDUCTORES CHILL\u00c1N.',
    'Art\u00edculo N\u00b0 4. Calidad',
    'CONDUCTORES CHILL\u00c1N se compromete a velar por la calidad del servicio ofrecido, someti\u00e9ndose a lo establecido en la norma chilena de calidad NCh 2728.',
    'T\u00cdTULO II \u2014 DE LOS PROGRAMAS',
    'Art\u00edculo N\u00b0 5.',
    'Los relatores o profesores deber\u00e1n aplicar y desarrollar \u00edntegramente los programas de capacitaci\u00f3n aprobados por CONDUCTORES CHILL\u00c1N.',
    'Art\u00edculo N\u00b0 6.',
    'Cada relator deber\u00e1 dar a conocer a sus alumnos el programa establecido al comienzo de la actividad de capacitaci\u00f3n, explicando, en rasgos generales su contenido.',
    'T\u00cdTULO III \u2014 DE LA INSCRIPCI\u00d3N',
    'Art\u00edculo N\u00b0 7.',
    'La Inscripci\u00f3n es el proceso en virtud del cual un cliente se incorpora a CONDUCTORES CHILL\u00c1N en un determinado programa de Capacitaci\u00f3n.',
    'Art\u00edculo N\u00b0 8.',
    'CONDUCTORES CHILL\u00c1N garantiza que ha adoptado las medidas organizativas y t\u00e9cnicas necesarias para mantener el nivel de seguridad requerido.',
    'T\u00cdTULO IV \u2014 DE LA EVALUACI\u00d3N DE LOS PARTICIPANTES',
    'Art\u00edculo N\u00b0 9.',
    'La evaluaci\u00f3n es toda actividad tendiente a medir el grado o nivel de logro de un participante respecto de los aprendizajes esperados en cada asignatura.',
    'Art\u00edculo N\u00b0 10.',
    'Son instrumentos de evaluaci\u00f3n: las pruebas escritas, interrogaciones orales, trabajos de grupo o individuales, informes de trabajos en terreno.',
    'Art\u00edculo N\u00b0 11.',
    'Las evaluaciones se aplicar\u00e1n dentro del horario y calendario que determine el relator encargado de la actividad de capacitaci\u00f3n.',
    'T\u00cdTULO V \u2014 DE LA ASISTENCIA',
    'Art\u00edculo N\u00b0 12.',
    'Se entiende por asistencia la comparecencia f\u00edsica del participante en las diversas actividades de car\u00e1cter te\u00f3rico y/o pr\u00e1ctico, indicadas por el relator.',
    'Art\u00edculo N\u00b0 13.',
    'La asistencia es obligatoria. Es requisito esencial para aprobar una determinada actividad de capacitaci\u00f3n (jornada abierta o cerrada), haber asistido como m\u00ednimo al 75% de las horas programadas.',
    'Art\u00edculo N\u00b0 14.',
    'Cualquier inasistencia deber\u00e1 justificarse documentalmente ante el relator encargado de la actividad de capacitaci\u00f3n, en un plazo no superior a 3 d\u00edas h\u00e1biles.',
    'Art\u00edculo N\u00b0 15.',
    'Se considerar\u00e1n causales v\u00e1lidas para justificar una inasistencia: a) Problema de salud del participante justificado mediante certificado m\u00e9dico; b) Otras causales cuya resoluci\u00f3n corresponda a la jefatura de CONDUCTORES CHILL\u00c1N.',
    'T\u00cdTULO VI \u2014 DE LAS CALIFICACIONES',
    'Art\u00edculo N\u00b0 16.',
    'Se realizar\u00e1n evaluaciones con una escala del 10 al 100. La nota setenta y cinco (75) corresponde a la nota m\u00ednima de aprobaci\u00f3n de una actividad de capacitaci\u00f3n.',
    'Art\u00edculo N\u00b0 17.',
    'El participante insatisfecho a un control evaluativo, deber\u00e1 justificar debidamente su inasistencia en un plazo no superior a tres (3) d\u00edas h\u00e1biles.',
    'Art\u00edculo N\u00b0 18.',
    'Todo acto realizado por un participante que vicie su evaluaci\u00f3n, ser\u00e1 sancionado con la suspensi\u00f3n inmediata del control y con la aplicaci\u00f3n de la nota m\u00ednima.',
    'Art\u00edculo N\u00b0 19.',
    'Para la aprobaci\u00f3n de los alumnos se considerar\u00e1 el rendimiento y la asistencia a las actividades programadas. Sin perjuicio de lo anterior, se evaluar\u00e1 tambi\u00e9n su conducta.',
    'T\u00cdTULO VII \u2014 DEL R\u00c9GIMEN DISCIPLINARIO',
    'Art\u00edculo N\u00b0 20.',
    'Los clientes de CONDUCTORES CHILL\u00c1N deber\u00e1n respetar y cumplir las disposiciones del presente Reglamento. Los participantes tendr\u00e1n derecho a ser tratados con respeto y dignidad.',
    'Art\u00edculo N\u00b0 21.',
    'El Organismo T\u00e9cnico de Capacitaci\u00f3n, solicita a quienes se inscriban en una determinada actividad de capacitaci\u00f3n, llegar puntualmente.',
    'T\u00cdTULO VIII \u2014 DEL PAGO POR CONCEPTO DE CAPACITACI\u00d3N',
    'Art\u00edculo N\u00b0 22.',
    'Los costos asociados a las actividades de capacitaci\u00f3n contempla la forma prevista en el p\u00e1rrafo 4\u00b0 de la Ley N\u00b0 19.518.',
    'Art\u00edculo N\u00b0 23.',
    'El valor del programa es fijo de acuerdo a la cantidad de horas de duraci\u00f3n, y las condiciones requeridas para impartir la actividad.',
    'Art\u00edculo N\u00b0 24.',
    'El pago del valor del programa se podr\u00e1 efectuar bajo alguna de las siguientes formas: a) Pago total al contado; b) Pago mediante dep\u00f3sito en cuenta corriente; c) Pago con cheque cruzado.',
    'Art\u00edculo N\u00b0 25.',
    'Toda anulaci\u00f3n de inscripci\u00f3n a jornadas abiertas (una vez inscritos) cualquiera sea la causal, deber\u00e1 informarse por escrito 72 horas h\u00e1biles antes.',
    'Art\u00edculo N\u00b0 26.',
    'La renuncia a jornadas cerradas (una vez formalizada la aceptaci\u00f3n de la cotizaci\u00f3n) cualquiera sea la causal, deber\u00e1 informarse por escrito 7 d\u00edas h\u00e1biles antes.',
    'Art\u00edculo N\u00b0 27.',
    'El participante puede manifestar de manera formal, su descontento con la actividad de capacitaci\u00f3n, detallando las razones por las que no ha sido de su conformidad.',
    'DISPOSICIONES GENERALES',
    'Art\u00edculo N\u00b0 28.',
    'Todo participante deber\u00e1 tener, al momento de su inscripci\u00f3n en CONDUCTORES CHILL\u00c1N y durante toda su capacitaci\u00f3n, salud y conducta compatible.',
    'Art\u00edculo N\u00b0 29.',
    'Las personas, empresas, OTIC y cualquier organismo vinculado con cualquiera de los servicios de capacitaci\u00f3n impartidos por CONDUCTORES CHILL\u00c1N deber\u00e1n respetar estas normas.',
    'Art\u00edculo N\u00b0 30.',
    'Las situaciones no previstas en el presente Reglamento ser\u00e1n resueltas por la Gerencia General de CONDUCTORES CHILL\u00c1N.',
  ];
}
