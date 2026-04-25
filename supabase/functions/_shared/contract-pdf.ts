// supabase/functions/_shared/contract-pdf.ts
//
// Shared PDF generation utilities for contract documents.
// Used by: generate-contract-pdf, public-enrollment (preview action).

// ─── Types ───

export interface EnrollmentData {
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
  convalidation: {
    convalidated_license: 'A4' | 'A3';
    reduced_hours: number;
  } | null;
}

// ─── Helpers ───

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '$0';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

/**
 * Converts a character to its WinAnsi (Latin-1) octal escape for PDF strings.
 * Characters U+00A0–U+00FF map directly to their codepoint (same as Latin-1).
 * This fixes the accented characters bug (ñ, é, á, etc. were showing as "?").
 */
export function escapePdfWinAnsi(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 92) out += '\\\\';
    else if (c === 40) out += '\\(';
    else if (c === 41) out += '\\)';
    else if (c >= 32 && c <= 126) out += str[i];
    else if (c >= 160 && c <= 255) out += `\\${c.toString(8).padStart(3, '0')}`;
    // else: skip unsupported chars
  }
  return out;
}

export function wrapTextToLines(text: string, maxChars: number): string[] {
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
 */
export function assemblePdf(pageStreams: string[], W: number, H: number): Uint8Array {
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
  const totalObjs = allObjs.length;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of allObjs) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }

  const xrefPos = pdf.length;
  pdf += `xref\n0 ${totalObjs + 1}\n`;
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
 */
export function buildStructuredPdf(data: EnrollmentData): Uint8Array {
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
  const valueX = ML + 165;

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

  const T = (x: number, yp: number, text: string, f: 'F1' | 'F2', size: number) => {
    ops += `BT /${f} ${size} Tf ${x} ${Math.round(yp)} Td (${escapePdfWinAnsi(text)}) Tj ET\n`;
  };

  const HL = (yp: number, lw = 0.4, x1 = ML, x2 = W - MR) => {
    ops += `${lw} w ${x1} ${Math.round(yp)} m ${x2} ${Math.round(yp)} l S\n`;
  };

  const section = (num: string, title: string) => {
    need(38);
    y -= 14;
    T(ML, y, `${num}. ${title}`, 'F2', 11);
    y -= 6;
    HL(y, 0.6);
    y -= 16;
  };

  const row = (label: string, value: string) => {
    need(16);
    T(ML, y, label, 'F2', 10);
    T(valueX, y, value, 'F1', 10);
    y -= 15;
  };

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

  T(ML, y, 'CONTRATO DE PRESTACION DE SERVICIOS EDUCACIONALES', 'F2', 12);
  y -= 17;
  T(ML, y, data.branch.name.toUpperCase(), 'F1', 11);
  y -= 7;
  HL(y, 1.0);
  y -= 18;

  section('I', 'IDENTIFICACION DE LAS PARTES');

  T(ML, y, 'Escuela', 'F2', 10);
  y -= 13;
  row('Nombre:', data.branch.name);
  row('Direcci\xF3n:', data.branch.address ?? '—');
  y -= 6;

  T(ML, y, 'Alumno/a', 'F2', 10);
  y -= 13;
  row('Nombre completo:', fullName);
  row('RUT:', u.rut);
  row('Fecha de nacimiento:', formatDate(data.student.birth_date));
  row('Domicilio:', data.student.address || '—');
  row('Correo electr\xF3nico:', u.email);
  row('Tel\xE9fono:', u.phone ?? '—');

  section('II', 'CURSO CONTRATADO');
  row('Curso:', data.course.name);
  row('Clase de licencia:', data.course.license_class);
  row('Duraci\xF3n:', data.course.duration_weeks ? `${data.course.duration_weeks} semanas` : '—');
  row(
    'Horas pr\xE1cticas:',
    data.course.practical_hours != null ? `${data.course.practical_hours} h` : '—',
  );
  row(
    'Horas te\xF3ricas:',
    data.course.theory_hours != null ? `${data.course.theory_hours} h` : '—',
  );
  row('Fecha de matr\xEDcula:', enrollmentDate);
  if (data.number) row('N\xFA de matr\xEDcula:', data.number);

  if (data.convalidation) {
    y -= 4;
    need(16);
    T(ML, y, 'Convalidaci\xF3n simult\xE1nea', 'F2', 10);
    y -= 15;
    row(
      'Licencia convalidada:',
      `${data.convalidation.convalidated_license} (simult\xE1nea con ${data.course.license_class})`,
    );
    row('Horas convalidadas:', `${data.convalidation.reduced_hours} h`);
  }

  section('III', 'CONDICIONES ECONOMICAS');
  row('Valor del curso:', formatCurrency(data.base_price));
  if (data.discount > 0) row('Descuento:', `-${formatCurrency(data.discount)}`);
  row('Total a pagar:', formatCurrency(netPrice));

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

  if (data.convalidation) {
    clause(
      `S\xC9PTIMA: Convalidaci\xF3n simult\xE1nea de Licencia ${data.convalidation.convalidated_license}.`,
      `El/la alumno/a se matricula en el curso ${data.course.license_class} con convalidaci\xF3n simult\xE1nea de la Licencia ${data.convalidation.convalidated_license}, la que se cursar\xE1 dentro de la misma promoci\xF3n bajo un libro de clases independiente. Las ${data.convalidation.reduced_hours} horas convalidadas quedan cubiertas por el valor \xFAnico de esta matr\xEDcula. La apertura del libro de clases de la licencia convalidada ser\xE1 informada al alumno/a por la administraci\xF3n.`,
    );
  }

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

  pages.push(ops);
  return assemblePdf(pages, W, H);
}
