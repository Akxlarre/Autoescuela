// supabase/functions/generate-enrollment-sheet/index.ts
//
// Edge Function: generate-enrollment-sheet
//
// Genera la Ficha de Matrícula en PDF on-demand.
// Siempre refleja el estado actual del alumno (no se almacena).
// Retorna el PDF como binario application/pdf para descarga directa.
//
// Invocación desde el frontend:
//   const resp = await supabase.functions.invoke('generate-enrollment-sheet', {
//     body: { enrollment_id: 42 }
//   })
//   // resp.data es un Blob con el PDF
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ─── CORS ───────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { enrollment_id } = await req.json();

    if (!enrollment_id || typeof enrollment_id !== 'number') {
      return jsonErr('enrollment_id (number) is required', 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 1. Enrollment base ──────────────────────────────────────────────────
    const { data: enrollment, error: enrollErr } = await supabase
      .from('enrollments')
      .select(
        `id, number, status, license_group, payment_mode, registration_channel,
         total_paid, pending_balance, base_price, discount, created_at, expires_at,
         students!inner(
           address,
           users!inner(rut, first_names, paternal_last_name, maternal_last_name, email, phone)
         ),
         courses!inner(name, license_class, practical_hours, theory_hours),
         branches!inner(name)`,
      )
      .eq('id', enrollment_id)
      .single();

    if (enrollErr || !enrollment) {
      return jsonErr(`Enrollment ${enrollment_id} not found`, 404);
    }

    // ── 2. Payments ─────────────────────────────────────────────────────────
    const { data: payments } = await supabase
      .from('payments')
      .select('id, payment_date, type, total_amount, cash_amount, transfer_amount, card_amount')
      .eq('enrollment_id', enrollment_id)
      .order('payment_date', { ascending: true });

    const licenseGroup: string = enrollment.license_group;

    // ── 3. Progreso académico (bifurcado por tipo) ──────────────────────────
    let classBProgress: { practicasCompletadas: number; teoricasCompletadas: number } | null = null;
    let profProgress: {
      teoriaAsistida: number;
      teoriaTotalSesiones: number;
      practicaAsistida: number;
      practicaTotalSesiones: number;
      grades: Array<{ module: string; grade: number | null; passed: boolean | null }>;
    } | null = null;

    if (licenseGroup === 'class_b') {
      // v_student_progress_b: completed_practices + pct_theory_attendance
      const [progressRes, theorySessRes] = await Promise.all([
        supabase
          .from('v_student_progress_b')
          .select('completed_practices, total_theory_sessions, attended_theory_sessions')
          .eq('enrollment_id', enrollment_id)
          .maybeSingle(),
        // Count distinct theory sessions for this enrollment to get absolute number
        supabase
          .from('class_b_theory_attendance')
          .select('theory_session_b_id', { count: 'exact' })
          .eq('student_id', enrollment.students.users ? undefined : undefined) // handled below
          .limit(0),
      ]);

      const prog = progressRes.data;
      classBProgress = {
        practicasCompletadas: prog?.completed_practices ?? 0,
        teoricasCompletadas: prog?.attended_theory_sessions ?? 0,
      };
    } else {
      // Professional: attendance + grades
      const [theoryRes, practiceRes, gradesRes] = await Promise.all([
        supabase
          .from('professional_theory_attendance')
          .select('status')
          .eq('enrollment_id', enrollment_id),
        supabase
          .from('professional_practice_attendance')
          .select('status')
          .eq('enrollment_id', enrollment_id),
        supabase
          .from('professional_module_grades')
          .select('module_number, module, grade, passed')
          .eq('enrollment_id', enrollment_id)
          .order('module_number', { ascending: true }),
      ]);

      const theoryRows = theoryRes.data ?? [];
      const practiceRows = practiceRes.data ?? [];
      const gradesRows = gradesRes.data ?? [];

      profProgress = {
        teoriaAsistida: theoryRows.filter((r: any) => r.status === 'present').length,
        teoriaTotalSesiones: theoryRows.length,
        practicaAsistida: practiceRows.filter((r: any) => r.status === 'present').length,
        practicaTotalSesiones: practiceRows.length,
        grades: gradesRows.map((g: any) => ({
          module: g.module ?? `Módulo ${g.module_number}`,
          grade: g.grade,
          passed: g.passed,
        })),
      };
    }

    // ── 4. Generar PDF ──────────────────────────────────────────────────────
    const user = enrollment.students.users;
    const nombreCompleto = [user.first_names, user.paternal_last_name, user.maternal_last_name]
      .filter(Boolean)
      .join(' ');

    const pdfBytes = buildEnrollmentSheetPdf({
      enrollment: {
        id: enrollment.id,
        number: enrollment.number,
        status: enrollment.status,
        licenseGroup,
        paymentMode: enrollment.payment_mode,
        registrationChannel: enrollment.registration_channel,
        totalPaid: enrollment.total_paid ?? 0,
        pendingBalance: enrollment.pending_balance ?? 0,
        basePrice: enrollment.base_price ?? 0,
        discount: enrollment.discount ?? 0,
        createdAt: enrollment.created_at,
        expiresAt: enrollment.expires_at,
      },
      student: {
        nombreCompleto,
        rut: user.rut,
        email: user.email,
        phone: user.phone,
        address: enrollment.students.address,
      },
      course: {
        name: enrollment.courses.name,
        licenseClass: enrollment.courses.license_class,
        practicalHours: enrollment.courses.practical_hours,
        theoryHours: enrollment.courses.theory_hours,
      },
      branch: { name: enrollment.branches.name },
      payments: (payments ?? []).map((p: any) => ({
        date: p.payment_date,
        concept: p.type?.trim() || 'Pago',
        amount: p.total_amount ?? 0,
        method: deriveMethod(p),
      })),
      classBProgress,
      profProgress,
      generatedAt: new Date().toISOString(),
    });

    // ── 5. Retornar binario directamente (sin almacenar) ────────────────────
    const safeName = sanitize(`Ficha_${nombreCompleto}_${enrollment.number ?? enrollment_id}`);
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error('generate-enrollment-sheet error:', err);
    return jsonErr(err instanceof Error ? err.message : 'Internal server error', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PDF Builder
// ══════════════════════════════════════════════════════════════════════════════

interface SheetData {
  enrollment: {
    id: number;
    number: string | null;
    status: string;
    licenseGroup: string;
    paymentMode: string;
    registrationChannel: string;
    totalPaid: number;
    pendingBalance: number;
    basePrice: number;
    discount: number;
    createdAt: string;
    expiresAt: string | null;
  };
  student: {
    nombreCompleto: string;
    rut: string;
    email: string;
    phone: string | null;
    address: string | null;
  };
  course: {
    name: string;
    licenseClass: string;
    practicalHours: number | null;
    theoryHours: number | null;
  };
  branch: { name: string };
  payments: Array<{ date: string | null; concept: string; amount: number; method: string | null }>;
  classBProgress: { practicasCompletadas: number; teoricasCompletadas: number } | null;
  profProgress: {
    teoriaAsistida: number;
    teoriaTotalSesiones: number;
    practicaAsistida: number;
    practicaTotalSesiones: number;
    grades: Array<{ module: string; grade: number | null; passed: boolean | null }>;
  } | null;
  generatedAt: string;
}

function buildEnrollmentSheetPdf(data: SheetData): Uint8Array {
  const lines: string[] = [];
  const objOffsets: number[] = [];
  let byteOffset = 0;

  const enc = new TextEncoder();

  function w(s: string) {
    lines.push(s);
    byteOffset += enc.encode(s + '\n').length;
  }

  function startObj(n: number) {
    objOffsets[n] = byteOffset;
    w(`${n} 0 obj`);
  }

  // ── PDF header ───────────────────────────────────────────────────────────
  w('%PDF-1.4');
  w('%\xE2\xE3\xCF\xD3'); // binary comment marker

  // ── Object 1: Catalog ────────────────────────────────────────────────────
  startObj(1);
  w('<< /Type /Catalog /Pages 2 0 R >>');
  w('endobj');

  // ── Object 2: Pages ──────────────────────────────────────────────────────
  startObj(2);
  w('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  w('endobj');

  // ── Object 3: Page ───────────────────────────────────────────────────────
  startObj(3);
  w('<< /Type /Page /Parent 2 0 R');
  w('   /MediaBox [0 0 595 842]');
  w('   /Contents 4 0 R');
  w('   /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>');
  w('endobj');

  // ── Build page content ───────────────────────────────────────────────────
  const content = buildPageContent(data);
  const contentBytes = enc.encode(content);

  // ── Object 4: Stream ─────────────────────────────────────────────────────
  startObj(4);
  w(`<< /Length ${contentBytes.length} >>`);
  w('stream');
  lines.push(content);
  byteOffset += contentBytes.length + 1; // +1 for \n after push
  w('endstream');
  w('endobj');

  // ── Object 5: Helvetica ──────────────────────────────────────────────────
  startObj(5);
  w('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  w('endobj');

  // ── Object 6: Helvetica-Bold ─────────────────────────────────────────────
  startObj(6);
  w('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  w('endobj');

  // ── xref + trailer ───────────────────────────────────────────────────────
  const xrefOffset = byteOffset;
  w('xref');
  w(`0 7`);
  w('0000000000 65535 f ');
  for (let i = 1; i <= 6; i++) {
    w(String(objOffsets[i] ?? 0).padStart(10, '0') + ' 00000 n ');
  }
  w('trailer');
  w('<< /Size 7 /Root 1 0 R >>');
  w('startxref');
  w(String(xrefOffset));
  w('%%EOF');

  return enc.encode(lines.join('\n'));
}

// ── Page content builder ─────────────────────────────────────────────────────

function buildPageContent(data: SheetData): string {
  const ops: string[] = [];
  const M = 50; // left margin
  const W = 495; // content width (595 - 2*50)
  let y = 800;

  function text(x: number, yPos: number, str: string, size: number, bold = false) {
    const font = bold ? 'F2' : 'F1';
    ops.push(`BT /${font} ${size} Tf ${x} ${yPos} Td (${pdfStr(str)}) Tj ET`);
  }

  function line(x1: number, y1: number, x2: number, y2: number) {
    ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  }

  function rect(x: number, yPos: number, w: number, h: number, fill = false) {
    ops.push(`${x} ${yPos} ${w} ${h} re ${fill ? 'f' : 'S'}`);
  }

  function setGray(g: number) {
    ops.push(`${g} g ${g} G`);
  }

  function resetColor() {
    ops.push('0 g 0 G');
  }

  // ── Header ───────────────────────────────────────────────────────────────
  setGray(0.15);
  rect(0, 810, 595, 32, true);
  ops.push('1 g'); // white text
  text(M, 820, data.branch.name.toUpperCase(), 12, true);
  text(M, 813, 'FICHA DE MATRÍCULA', 8);

  // Enrollment number + date (right side)
  const nro = data.enrollment.number ? `Nro. ${data.enrollment.number}` : `ID ${data.enrollment.id}`;
  const genDate = formatDateCL(data.generatedAt);
  text(400, 820, nro, 10, true);
  text(400, 813, `Generada: ${genDate}`, 7);
  resetColor();

  y = 790;

  // ── Section: Datos del Alumno ─────────────────────────────────────────────
  y = sectionHeader(ops, M, y, W, 'DATOS DEL ALUMNO');
  y -= 4;

  const studentRows: [string, string][] = [
    ['Nombre', data.student.nombreCompleto],
    ['RUT', data.student.rut],
    ['Email', data.student.email],
    ['Teléfono', data.student.phone ?? '-'],
    ['Dirección', data.student.address ?? '-'],
  ];
  y = twoColTable(ops, M, y, W, studentRows, text, line);

  // ── Section: Datos de Matrícula ───────────────────────────────────────────
  y -= 10;
  y = sectionHeader(ops, M, y, W, 'DATOS DE MATRÍCULA');
  y -= 4;

  const enrollRows: [string, string][] = [
    ['Número matrícula', data.enrollment.number ?? '-'],
    ['Fecha ingreso', formatDateCL(data.enrollment.createdAt)],
    ['Curso', data.course.name],
    ['Tipo', data.enrollment.licenseGroup === 'class_b' ? 'Clase B' : 'Clase Profesional'],
    ['Estado', mapStatus(data.enrollment.status)],
    ['Modalidad pago', data.enrollment.paymentMode === 'total' ? 'Total' : 'Depósito (50%)'],
    ['Canal', data.enrollment.registrationChannel === 'online' ? 'Online' : 'Presencial'],
  ];
  y = twoColTable(ops, M, y, W, enrollRows, text, line);

  // ── Section: Estado Financiero ────────────────────────────────────────────
  y -= 10;
  y = sectionHeader(ops, M, y, W, 'ESTADO FINANCIERO');
  y -= 4;

  const finRows: [string, string][] = [
    ['Total pagado', formatCLP(data.enrollment.totalPaid)],
    ['Saldo pendiente', formatCLP(data.enrollment.pendingBalance)],
    ['Precio base', formatCLP(data.enrollment.basePrice)],
    ['Descuento', data.enrollment.discount > 0 ? formatCLP(data.enrollment.discount) : 'No aplica'],
  ];
  y = twoColTable(ops, M, y, W, finRows, text, line);

  // Payments table
  if (data.payments.length > 0) {
    y -= 8;
    text(M, y, 'Historial de pagos', 8, true);
    y -= 6;

    // Table header
    const cols = [70, 160, 90, 95, 80]; // widths
    const headers = ['Fecha', 'Concepto', 'Monto', 'Método', 'Estado'];
    let xCur = M;
    setGray(0.88);
    rect(M, y - 12, W, 14, true);
    resetColor();

    headers.forEach((h, i) => {
      text(xCur + 2, y - 8, h, 7, true);
      xCur += cols[i];
    });
    line(M, y + 2, M + W, y + 2);
    line(M, y - 12, M + W, y - 12);
    y -= 12;

    // Table rows
    data.payments.forEach((p, idx) => {
      if (y < 100) return; // page overflow guard
      if (idx % 2 === 0) {
        setGray(0.96);
        rect(M, y - 12, W, 14, true);
        resetColor();
      }
      xCur = M;
      const row = [
        p.date ? formatDateCL(p.date) : '-',
        p.concept.substring(0, 24),
        formatCLP(p.amount),
        p.method ?? '-',
        'Confirmado',
      ];
      row.forEach((cell, i) => {
        text(xCur + 2, y - 8, cell, 7);
        xCur += cols[i];
      });
      y -= 14;
    });
    line(M, y + 2, M + W, y + 2);
  }

  // ── Section: Progreso Académico ───────────────────────────────────────────
  y -= 10;

  if (data.classBProgress) {
    y = sectionHeader(ops, M, y, W, 'PROGRESO ACADÉMICO - CLASE B');
    y -= 4;
    const total_practicas = 12;
    const total_teoricas = 8;
    const progRows: [string, string][] = [
      ['Clases prácticas', `${data.classBProgress.practicasCompletadas} / ${total_practicas}`],
      ['Clases teóricas', `${data.classBProgress.teoricasCompletadas} / ${total_teoricas}`],
    ];
    y = twoColTable(ops, M, y, W, progRows, text, line);
  }

  if (data.profProgress) {
    y = sectionHeader(ops, M, y, W, 'PROGRESO ACADÉMICO - CLASE PROFESIONAL');
    y -= 4;

    const tPct =
      data.profProgress.teoriaTotalSesiones > 0
        ? Math.round(
            (data.profProgress.teoriaAsistida / data.profProgress.teoriaTotalSesiones) * 100,
          )
        : 0;
    const pPct =
      data.profProgress.practicaTotalSesiones > 0
        ? Math.round(
            (data.profProgress.practicaAsistida / data.profProgress.practicaTotalSesiones) * 100,
          )
        : 0;

    const progRows: [string, string][] = [
      [
        'Asistencia teórica (mín. 75%)',
        `${data.profProgress.teoriaAsistida}/${data.profProgress.teoriaTotalSesiones} sesiones (${tPct}%) ${tPct >= 75 ? '(OK)' : '(X)'}`,
      ],
      [
        'Asistencia práctica (mín. 100%)',
        `${data.profProgress.practicaAsistida}/${data.profProgress.practicaTotalSesiones} sesiones (${pPct}%) ${pPct >= 100 ? '(OK)' : '(X)'}`,
      ],
    ];
    y = twoColTable(ops, M, y, W, progRows, text, line);

    // Grades table
    if (data.profProgress.grades.length > 0) {
      y -= 8;
      text(M, y, 'Notas por módulo', 8, true);
      y -= 6;

      const gCols = [260, 100, 135];
      const gHeaders = ['Módulo', 'Nota', 'Estado'];
      let xCur = M;
      setGray(0.88);
      rect(M, y - 12, W, 14, true);
      resetColor();
      gHeaders.forEach((h, i) => {
        text(xCur + 2, y - 8, h, 7, true);
        xCur += gCols[i];
      });
      line(M, y + 2, M + W, y + 2);
      line(M, y - 12, M + W, y - 12);
      y -= 12;

      data.profProgress.grades.forEach((g, idx) => {
        if (y < 100) return;
        if (idx % 2 === 0) {
          setGray(0.96);
          rect(M, y - 12, W, 14, true);
          resetColor();
        }
        xCur = M;
        const estado = g.grade === null ? 'Sin nota' : g.passed ? 'Aprobado' : 'Reprobado';
        const notaStr = g.grade !== null ? String(g.grade) : '-';
        [g.module.substring(0, 38), notaStr, estado].forEach((cell, i) => {
          text(xCur + 2, y - 8, cell, 7);
          xCur += gCols[i];
        });
        y -= 14;
      });
      line(M, y + 2, M + W, y + 2);
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  setGray(0.85);
  rect(0, 20, 595, 20, true);
  resetColor();
  ops.push('0.5 g');
  text(
    M,
    26,
    `Documento generado el ${formatDateTimeCL(data.generatedAt)} - ${data.branch.name}`,
    6,
  );
  resetColor();

  return ops.join('\n');
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function sectionHeader(ops: string[], x: number, y: number, w: number, title: string): number {
  ops.push(`0.2 g`);
  ops.push(`${x} ${y - 13} ${w} 15 re f`);
  ops.push('1 g');
  ops.push(`BT /F2 8 Tf ${x + 4} ${y - 8} Td (${pdfStr(title)}) Tj ET`);
  ops.push('0 g');
  return y - 15;
}

function twoColTable(
  ops: string[],
  x: number,
  y: number,
  w: number,
  rows: [string, string][],
  text: (x: number, y: number, s: string, sz: number, b?: boolean) => void,
  line: (x1: number, y1: number, x2: number, y2: number) => void,
): number {
  const labelW = 150;
  const rowH = 14;
  rows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      ops.push(`0.97 g`);
      ops.push(`${x} ${y - rowH + 2} ${w} ${rowH} re f`);
      ops.push('0 g');
    }
    text(x + 4, y - 9, label, 7, true);
    text(x + labelW + 4, y - 9, value, 7);
    y -= rowH;
  });
  line(x, y + 2, x + w, y + 2);
  return y;
}

// ── String helpers ────────────────────────────────────────────────────────────

function pdfStr(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[()\\]/g, (c) => '\\' + c)
    .replace(/[^\x20-\x7E]/g, '?'); // fallback non-ASCII
}

function formatDateCL(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Santiago',
  });
}

function formatDateTimeCL(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago',
  });
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

function mapStatus(s: string): string {
  const map: Record<string, string> = {
    active: 'Activo',
    draft: 'Borrador',
    pending_payment: 'Pendiente Pago',
    inactive: 'Inactivo',
    completed: 'Completado',
    cancelled: 'Cancelado',
  };
  return map[s] ?? s;
}

function deriveMethod(p: any): string | null {
  if ((p.cash_amount ?? 0) > 0 && (p.transfer_amount ?? 0) === 0 && (p.card_amount ?? 0) === 0)
    return 'Efectivo';
  if ((p.transfer_amount ?? 0) > 0 && (p.cash_amount ?? 0) === 0 && (p.card_amount ?? 0) === 0)
    return 'Transferencia';
  if ((p.card_amount ?? 0) > 0 && (p.cash_amount ?? 0) === 0 && (p.transfer_amount ?? 0) === 0)
    return 'Tarjeta';
  if ((p.cash_amount ?? 0) > 0 || (p.transfer_amount ?? 0) > 0 || (p.card_amount ?? 0) > 0)
    return 'Mixto';
  return null;
}

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 80);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
