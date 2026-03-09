// supabase/functions/generate-contract-pdf/index.ts
//
// Edge Function: generate-contract-pdf
//
// Genera un PDF de contrato de matrícula a partir de los datos del enrollment,
// lo sube a Supabase Storage y registra/actualiza el registro en digital_contracts.
//
// Invocación desde el frontend:
//   await supabase.functions.invoke('generate-contract-pdf', {
//     body: { enrollment_id: 42 }
//   })
//
// Respuesta exitosa: { pdfUrl: "https://...storage.../contracts/42/Contrato_..." }
// @ts-nocheck

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ─── CORS headers ───

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Types ───

interface EnrollmentData {
  id: number;
  number: string | null;
  base_price: number | null;
  discount: number;
  created_at: string;
  student: {
    birth_date: string | null;
    address: string | null;
    user: {
      rut: string;
      first_names: string;
      paternal_last_name: string;
      maternal_last_name: string | null;
      email: string;
      phone: string | null;
    };
  };
  course: {
    name: string;
    license_class: string;
    duration_weeks: number | null;
    practical_hours: number | null;
    theory_hours: number | null;
  };
  branch: {
    name: string;
    address: string | null;
  };
}

// ─── Main handler ───

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Parse request body
    const { enrollment_id } = await req.json();

    if (!enrollment_id || typeof enrollment_id !== 'number') {
      return new Response(JSON.stringify({ error: 'enrollment_id (number) is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Create Supabase admin client (service_role for full access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Fetch enrollment with related data
    const { data: enrollment, error: fetchError } = await supabase
      .from('enrollments')
      .select(
        `
        id,
        number,
        base_price,
        discount,
        created_at,
        students!inner (
          birth_date,
          address,
          users!inner (
            rut,
            first_names,
            paternal_last_name,
            maternal_last_name,
            email,
            phone
          )
        ),
        courses!inner (
          name,
          license_class,
          duration_weeks,
          practical_hours,
          theory_hours
        ),
        branches!inner (
          name,
          address
        )
      `,
      )
      .eq('id', enrollment_id)
      .single();

    if (fetchError || !enrollment) {
      return new Response(
        JSON.stringify({ error: `Enrollment ${enrollment_id} not found: ${fetchError?.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Flatten nested relations
    const data = flattenEnrollment(enrollment);

    // 4. Generate structured PDF directly from enrollment data
    const pdfBytes = buildStructuredPdf(data);

    // 5. Build filename and upload to Storage
    const studentName = sanitizeFilename(
      `${data.student.user.first_names}_${data.student.user.paternal_last_name}`,
    );
    const year = new Date().getFullYear();
    const fileName = `Contrato_${studentName}_${year}.pdf`;
    const storagePath = `contracts/${enrollment_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: `Storage upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);

    const pdfUrl = urlData.publicUrl;

    // 6. Upsert digital_contracts record
    const { error: contractError } = await supabase.from('digital_contracts').upsert(
      {
        enrollment_id,
        student_id: getStudentId(enrollment),
        file_name: fileName,
        file_url: pdfUrl,
        content_hash: await computeHash(pdfBytes),
      },
      { onConflict: 'enrollment_id' },
    );

    if (contractError) {
      console.error('digital_contracts upsert error:', contractError);
      // Non-fatal: the PDF was uploaded, just the DB record failed
    }

    // 7. Return the URL
    return new Response(JSON.stringify({ pdfUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-contract-pdf error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Helper functions
// ══════════════════════════════════════════════════════════════════════════════

function flattenEnrollment(raw: any): EnrollmentData {
  return {
    id: raw.id,
    number: raw.number,
    base_price: raw.base_price,
    discount: raw.discount,
    created_at: raw.created_at,
    student: {
      birth_date: raw.students.birth_date,
      address: raw.students.address,
      user: {
        rut: raw.students.users.rut,
        first_names: raw.students.users.first_names,
        paternal_last_name: raw.students.users.paternal_last_name,
        maternal_last_name: raw.students.users.maternal_last_name,
        email: raw.students.users.email,
        phone: raw.students.users.phone,
      },
    },
    course: {
      name: raw.courses.name,
      license_class: raw.courses.license_class,
      duration_weeks: raw.courses.duration_weeks,
      practical_hours: raw.courses.practical_hours,
      theory_hours: raw.courses.theory_hours,
    },
    branch: {
      name: raw.branches.name,
      address: raw.branches.address,
    },
  };
}

function getStudentId(enrollment: any): number {
  // The students table has its own id, but the FK in enrollments is student_id
  // Since we selected via enrollments.student_id, the join gives us the student record
  return enrollment.students?.id ?? enrollment.student_id;
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '$0';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

async function computeHash(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF Generation — Structured layout with proper WinAnsi encoding
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Converts a character to its WinAnsi (Latin-1) octal escape for PDF strings.
 * Characters U+00A0–U+00FF map directly to their codepoint (same as Latin-1).
 * This fixes the accented characters bug (ñ, é, á, etc. were showing as "?").
 */
function escapePdfWinAnsi(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 92)
      out += '\\\\'; // backslash
    else if (c === 40)
      out += '\\('; // (
    else if (c === 41)
      out += '\\)'; // )
    else if (c >= 32 && c <= 126)
      out += str[i]; // printable ASCII
    else if (c >= 160 && c <= 255) out += `\\${c.toString(8).padStart(3, '0')}`; // Latin-1 → WinAnsi octal
    // else: skip unsupported chars
  }
  return out;
}

function wrapTextToLines(text: string, maxChars: number): string[] {
  const result: string[] = [];
  const words = text.trim().split(/\s+/);
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars) {
      if (line) result.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) result.push(line);
  return result;
}

/**
 * Assembles a PDF 1.4 document from page content streams.
 * Uses two fonts: F1=Helvetica, F2=Helvetica-Bold.
 * Object layout: 1=Catalog, 2=Pages, 3=F1, 4=F2, then pairs (stream+page) per page.
 */
function assemblePdf(pageStreams: string[], W: number, H: number): Uint8Array {
  const fixedObjs: string[] = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`,
    ``, // pages — filled below
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`,
  ];

  const pageObjs: string[] = [];
  const pageIds: number[] = [];

  for (let i = 0; i < pageStreams.length; i++) {
    const stream = pageStreams[i];
    const contentId = 5 + i * 2;
    const pageId = 6 + i * 2;
    pageObjs.push(
      `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`,
    );
    pageObjs.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj`,
    );
    pageIds.push(pageId);
  }

  fixedObjs[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>\nendobj`;

  const allObjs = [...fixedObjs, ...pageObjs];
  const totalObjs = allObjs.length; // 4 fixed + 2 per page

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of allObjs) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }

  const xrefPos = pdf.length;
  pdf += `xref\n0 ${totalObjs + 1}\n`; // +1 for free-list head at obj 0
  pdf += '0000000000 65535 f \n';
  for (const off of offsets) {
    pdf += `${off.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

/**
 * Builds a structured, well-formatted contract PDF directly from enrollment data.
 * Sections, labels/values, clauses, and signature blocks are rendered with
 * proper coordinates and fonts — no HTML parsing required.
 */
function buildStructuredPdf(data: EnrollmentData): Uint8Array {
  const u = data.student.user;
  const fullName =
    `${u.first_names} ${u.paternal_last_name}${u.maternal_last_name ? ' ' + u.maternal_last_name : ''}`.trim();
  const today = formatDate(new Date().toISOString());
  const enrollmentDate = formatDate(data.created_at);
  const netPrice = (data.base_price ?? 0) - data.discount;

  const W = 595,
    H = 842;
  const ML = 55,
    MR = 55,
    MB = 65;
  const valueX = ML + 165; // label column ends, value column starts

  // ── Rendering state ──
  const pages: string[] = [];
  let ops = '';
  let y = H - 55;

  const NP = () => {
    pages.push(ops);
    ops = '';
    y = H - 55;
  };
  const need = (h: number) => {
    if (y - h < MB) NP();
  };

  // Draw text at absolute position (PDF y=0 is bottom of page)
  const T = (x: number, yp: number, text: string, f: 'F1' | 'F2', size: number) => {
    ops += `BT /${f} ${size} Tf ${x} ${Math.round(yp)} Td (${escapePdfWinAnsi(text)}) Tj ET\n`;
  };

  // Horizontal line
  const HL = (yp: number, lw = 0.4, x1 = ML, x2 = W - MR) => {
    ops += `${lw} w ${x1} ${Math.round(yp)} m ${x2} ${Math.round(yp)} l S\n`;
  };

  // Section header: bold title + underline
  const section = (num: string, title: string) => {
    need(38);
    y -= 14;
    T(ML, y, `${num}. ${title}`, 'F2', 11);
    y -= 6;
    HL(y, 0.6);
    y -= 16;
  };

  // Two-column data row: bold label on left, regular value on right
  const row = (label: string, value: string) => {
    need(16);
    T(ML, y, label, 'F2', 10);
    T(valueX, y, value, 'F1', 10);
    y -= 15;
  };

  // Clause: bold title line + wrapped body text
  const clause = (title: string, body: string) => {
    const LH = 14;
    need(LH * 2 + 4);
    T(ML, y, title, 'F2', 10);
    y -= LH;
    for (const line of wrapTextToLines(body, 90)) {
      need(LH);
      T(ML, y, line, 'F1', 10);
      y -= LH;
    }
    y -= 5;
  };

  // ── TITLE BLOCK ──
  T(ML, y, 'CONTRATO DE PRESTACION DE SERVICIOS EDUCACIONALES', 'F2', 12);
  y -= 17;
  T(ML, y, data.branch.name.toUpperCase(), 'F1', 11);
  y -= 7;
  HL(y, 1.0);
  y -= 18;

  // ── SECTION I: IDENTIFICACION ──
  section('I', 'IDENTIFICACION DE LAS PARTES');

  T(ML, y, 'Escuela', 'F2', 10);
  y -= 13;
  row('Nombre:', data.branch.name);
  row('Direcci\xF3n:', data.branch.address ?? '\u2014');
  y -= 6;

  T(ML, y, 'Alumno/a', 'F2', 10);
  y -= 13;
  row('Nombre completo:', fullName);
  row('RUT:', u.rut);
  row('Fecha de nacimiento:', formatDate(data.student.birth_date));
  row('Domicilio:', data.student.address || '\u2014');
  row('Correo electr\xF3nico:', u.email);
  row('Tel\xE9fono:', u.phone ?? '\u2014');

  // ── SECTION II: CURSO ──
  section('II', 'CURSO CONTRATADO');
  row('Curso:', data.course.name);
  row('Clase de licencia:', data.course.license_class);
  row(
    'Duraci\xF3n:',
    data.course.duration_weeks ? `${data.course.duration_weeks} semanas` : '\u2014',
  );
  row(
    'Horas pr\xE1cticas:',
    data.course.practical_hours != null ? `${data.course.practical_hours} h` : '\u2014',
  );
  row(
    'Horas te\xF3ricas:',
    data.course.theory_hours != null ? `${data.course.theory_hours} h` : '\u2014',
  );
  row('Fecha de matr\xEDcula:', enrollmentDate);
  if (data.number) row('N\xFA de matr\xEDcula:', data.number);

  // ── SECTION III: CONDICIONES ECONOMICAS ──
  section('III', 'CONDICIONES ECONOMICAS');
  row('Valor del curso:', formatCurrency(data.base_price));
  if (data.discount > 0) row('Descuento:', `-${formatCurrency(data.discount)}`);
  row('Total a pagar:', formatCurrency(netPrice));

  // ── SECTION IV: CLAUSULAS ──
  section('IV', 'CLAUSULAS GENERALES');

  clause(
    'PRIMERA: Objeto del contrato.',
    'La Escuela se compromete a impartir al Alumno/a el curso de conducci\xF3n indicado en la secci\xF3n II, de acuerdo con los programas aprobados por el Ministerio de Transportes y Telecomunicaciones, proporcionando los medios materiales y humanos necesarios para su correcto desarrollo.',
  );
  clause(
    'SEGUNDA: Obligaciones del alumno/a.',
    'El/la alumno/a se obliga a: (a) asistir a las clases te\xF3ricas y pr\xE1cticas programadas; (b) respetar los horarios acordados, comunicando con al menos 24 horas de anticipaci\xF3n cualquier cambio; (c) cumplir con las normas internas de la escuela y las instrucciones del personal docente; (d) pagar el valor del curso en los t\xE9rminos pactados.',
  );
  clause(
    'TERCERA: Asistencia y reprogramaci\xF3n.',
    'Las clases no asistidas sin aviso previo de 24 horas se considerar\xE1n realizadas. La escuela podr\xE1 reprogramar clases por motivos de fuerza mayor, notificando al alumno/a con la mayor antelaci\xF3n posible.',
  );
  clause(
    'CUARTA: Pol\xEDtica de devoluci\xF3n.',
    'En caso de desistimiento voluntario del alumno/a, la escuela reembolsar\xE1 el valor proporcional a las clases no realizadas, descontando un 10% por concepto de gastos administrativos, siempre que la solicitud se realice con al menos 7 d\xEDas h\xE1biles de anticipaci\xF3n.',
  );
  clause(
    'QUINTA: Protecci\xF3n de datos personales.',
    'Los datos personales del alumno/a ser\xE1n tratados conforme a la Ley N\xBA 19.628 sobre protecci\xF3n de la vida privada, exclusivamente para fines educativos y administrativos vinculados a este contrato.',
  );
  clause(
    'SEXTA: Vigencia.',
    'Este contrato rige desde la fecha de firma y se mantendr\xE1 vigente hasta la finalizaci\xF3n del curso contratado o hasta que se resuelva por alguna de las causales previstas en las cl\xE1usulas anteriores.',
  );

  // ── SECTION V: FIRMAS ──
  section('V', 'FIRMAS');
  T(ML, y, `En ${data.branch.address ?? 'la ciudad'}, a ${today}.`, 'F1', 10);
  y -= 55;

  need(40);
  const col2X = ML + 260;
  HL(y, 0.5, ML, ML + 180);
  HL(y, 0.5, col2X, col2X + 180);
  y -= 13;
  T(ML, y, 'Representante de la Escuela', 'F1', 9);
  T(col2X, y, fullName, 'F1', 9);
  y -= 12;
  T(ML, y, data.branch.name, 'F1', 9);
  T(col2X, y, `RUT: ${u.rut}`, 'F1', 9);

  pages.push(ops); // commit last page
  return assemblePdf(pages, W, H);
}
