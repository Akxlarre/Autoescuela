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
    region: string | null;
    district: string | null;
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
          region,
          district,
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

    // 4. Generate PDF content (HTML → PDF via built-in rendering)
    const html = buildContractHtml(data);
    const pdfBytes = await renderHtmlToPdf(html);

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
      region: raw.students.region,
      district: raw.students.district,
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
// PDF Generation
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Renders HTML to a PDF using a simple approach:
 * - In production Supabase Edge, we use a lightweight HTML-to-PDF solution
 * - Falls back to returning the HTML wrapped as a minimal PDF if no renderer available
 *
 * NOTE: For production, consider using:
 * - Deno-compatible pdf-lib or jsPDF for programmatic PDF
 * - An external PDF rendering service (e.g., Puppeteer via Cloud Run)
 *
 * This implementation uses a text-based PDF builder for zero external deps.
 */
async function renderHtmlToPdf(html: string): Promise<Uint8Array> {
  // Use a minimal PDF builder to avoid external dependencies in Edge Runtime.
  // This produces a valid PDF with the contract text content.
  const pdf = buildMinimalPdf(html);
  return pdf;
}

/**
 * Builds a minimal valid PDF 1.4 document with the contract text.
 * No external dependencies required. Produces a readable, printable PDF.
 */
function buildMinimalPdf(html: string): Uint8Array {
  // Extract text content from HTML (strip tags for the PDF text layer)
  const textContent = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Split into lines that fit within page width (~80 chars per line)
  const lines = wrapText(textContent, 85);

  // PDF constants
  const pageWidth = 595; // A4 width in points
  const pageHeight = 842; // A4 height in points
  const margin = 50;
  const fontSize = 10;
  const lineHeight = 14;
  const linesPerPage = Math.floor((pageHeight - 2 * margin) / lineHeight);

  // Split lines into pages
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(['(Contrato vacio)']);

  // Build PDF objects
  const objects: string[] = [];
  let objectCount = 0;

  const addObject = (content: string): number => {
    objectCount++;
    objects.push(content);
    return objectCount;
  };

  // Obj 1: Catalog
  addObject('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

  // Obj 2: Pages (placeholder, updated later)
  const pagesObjIndex = addObject(''); // placeholder

  // Obj 3: Font
  addObject(
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj',
  );

  // Generate page objects
  const pageObjIds: number[] = [];
  for (const pageLines of pages) {
    // Content stream
    let stream = `BT\n/F1 ${fontSize} Tf\n`;
    let y = pageHeight - margin;
    for (const line of pageLines) {
      stream += `1 0 0 1 ${margin} ${y} Tm\n(${escapePdfString(line)}) Tj\n`;
      y -= lineHeight;
    }
    stream += 'ET';

    const streamObj = addObject(
      `${objectCount + 1} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`,
    );

    // Page object
    const pageObj = addObject(
      `${objectCount + 1} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamObj} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj`,
    );
    pageObjIds.push(pageObj);
  }

  // Update Pages object (obj 2)
  const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjIds.length} >>\nendobj`;

  // Build final PDF
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }

  // Cross-reference table
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objectCount + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  // Trailer
  pdf += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

function wrapText(text: string, maxWidth: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      result.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let currentLine = '';
    for (const word of words) {
      if (currentLine.length + word.length + 1 > maxWidth) {
        result.push(currentLine);
        currentLine = word;
      } else {
        currentLine = currentLine ? `${currentLine} ${word}` : word;
      }
    }
    if (currentLine) result.push(currentLine);
  }
  return result;
}

function escapePdfString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?'); // Replace non-ASCII for Type1 font compat
}

// ══════════════════════════════════════════════════════════════════════════════
// Contract HTML Template
// ══════════════════════════════════════════════════════════════════════════════

function buildContractHtml(data: EnrollmentData): string {
  const u = data.student.user;
  const fullName = `${u.first_names} ${u.paternal_last_name} ${u.maternal_last_name ?? ''}`.trim();
  const today = formatDate(new Date().toISOString());
  const enrollmentDate = formatDate(data.created_at);
  const netPrice = (data.base_price ?? 0) - data.discount;

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Contrato de Matricula</title>
<style>
  body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #1a1a1a; max-width: 700px; margin: 0 auto; padding: 40px; }
  h1 { text-align: center; font-size: 16px; margin-bottom: 4px; }
  h2 { text-align: center; font-size: 12px; font-weight: normal; color: #555; margin-top: 0; }
  .section { margin: 20px 0; }
  .section-title { font-weight: bold; font-size: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  td { padding: 4px 8px; vertical-align: top; }
  td.label { font-weight: bold; width: 35%; color: #333; }
  .clause { margin: 12px 0; text-align: justify; }
  .clause strong { display: block; margin-bottom: 4px; }
  .signatures { margin-top: 60px; display: flex; justify-content: space-between; }
  .sig-block { text-align: center; width: 45%; }
  .sig-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 4px; }
</style>
</head>
<body>

<h1>CONTRATO DE PRESTACION DE SERVICIOS EDUCACIONALES</h1>
<h2>${data.branch.name}</h2>

<div class="section">
  <div class="section-title">I. IDENTIFICACION DE LAS PARTES</div>
  <table>
    <tr><td class="label">Escuela:</td><td>${data.branch.name}</td></tr>
    <tr><td class="label">Direccion:</td><td>${data.branch.address ?? '—'}</td></tr>
  </table>
  <table>
    <tr><td class="label">Alumno/a:</td><td>${fullName}</td></tr>
    <tr><td class="label">RUT:</td><td>${u.rut}</td></tr>
    <tr><td class="label">Fecha de nacimiento:</td><td>${formatDate(data.student.birth_date)}</td></tr>
    <tr><td class="label">Domicilio:</td><td>${data.student.address ?? '—'}, ${data.student.district ?? ''}, ${data.student.region ?? ''}</td></tr>
    <tr><td class="label">Correo electronico:</td><td>${u.email}</td></tr>
    <tr><td class="label">Telefono:</td><td>${u.phone ?? '—'}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">II. CURSO CONTRATADO</div>
  <table>
    <tr><td class="label">Curso:</td><td>${data.course.name}</td></tr>
    <tr><td class="label">Clase de licencia:</td><td>${data.course.license_class}</td></tr>
    <tr><td class="label">Duracion:</td><td>${data.course.duration_weeks ? data.course.duration_weeks + ' semanas' : '—'}</td></tr>
    <tr><td class="label">Horas practicas:</td><td>${data.course.practical_hours ?? '—'}h</td></tr>
    <tr><td class="label">Horas teoricas:</td><td>${data.course.theory_hours ?? '—'}h</td></tr>
    <tr><td class="label">Fecha de matricula:</td><td>${enrollmentDate}</td></tr>
    ${data.number ? `<tr><td class="label">N. de matricula:</td><td>${data.number}</td></tr>` : ''}
  </table>
</div>

<div class="section">
  <div class="section-title">III. CONDICIONES ECONOMICAS</div>
  <table>
    <tr><td class="label">Valor del curso:</td><td>${formatCurrency(data.base_price)}</td></tr>
    ${data.discount > 0 ? `<tr><td class="label">Descuento:</td><td>-${formatCurrency(data.discount)}</td></tr>` : ''}
    <tr><td class="label">Total a pagar:</td><td><strong>${formatCurrency(netPrice)}</strong></td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">IV. CLAUSULAS GENERALES</div>

  <div class="clause">
    <strong>PRIMERA: Objeto del contrato.</strong>
    La Escuela se compromete a impartir al Alumno/a el curso de conduccion indicado en la seccion II,
    de acuerdo con los programas aprobados por el Ministerio de Transportes y Telecomunicaciones,
    proporcionando los medios materiales y humanos necesarios para su correcto desarrollo.
  </div>

  <div class="clause">
    <strong>SEGUNDA: Obligaciones del alumno/a.</strong>
    El/la alumno/a se obliga a: (a) asistir a las clases teoricas y practicas programadas;
    (b) respetar los horarios acordados, comunicando con al menos 24 horas de anticipacion
    cualquier cambio; (c) cumplir con las normas internas de la escuela y las instrucciones
    del personal docente; (d) pagar el valor del curso en los terminos pactados.
  </div>

  <div class="clause">
    <strong>TERCERA: Asistencia y reprogramacion.</strong>
    Las clases no asistidas sin aviso previo de 24 horas se consideraran realizadas.
    La escuela podra reprogramar clases por motivos de fuerza mayor, notificando
    al alumno/a con la mayor antelacion posible.
  </div>

  <div class="clause">
    <strong>CUARTA: Politica de devolucion.</strong>
    En caso de desistimiento voluntario del alumno/a, la escuela reembolsara
    el valor proporcional a las clases no realizadas, descontando un 10% por
    concepto de gastos administrativos, siempre que la solicitud se realice
    con al menos 7 dias habiles de anticipacion.
  </div>

  <div class="clause">
    <strong>QUINTA: Proteccion de datos personales.</strong>
    Los datos personales del alumno/a seran tratados conforme a la Ley N. 19.628
    sobre proteccion de la vida privada, exclusivamente para fines educativos
    y administrativos vinculados a este contrato.
  </div>

  <div class="clause">
    <strong>SEXTA: Vigencia.</strong>
    Este contrato rige desde la fecha de firma y se mantendra vigente
    hasta la finalizacion del curso contratado o hasta que se resuelva
    por alguna de las causales previstas en las clausulas anteriores.
  </div>
</div>

<div class="section">
  <div class="section-title">V. FIRMAS</div>
  <p>En ${data.branch.address ?? 'la ciudad'}, a ${today}.</p>

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-line">Representante de la Escuela</div>
    </div>
    <div class="sig-block">
      <div class="sig-line">${fullName}<br/>RUT: ${u.rut}</div>
    </div>
  </div>
</div>

</body>
</html>`;
}
