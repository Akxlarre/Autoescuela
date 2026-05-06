// supabase/functions/generate-payment-report/index.ts
//
// Edge Function: generate-payment-report
//
// Genera un Reporte de Pagos en PDF on-demand (multi-página, no se almacena).
// Devuelve el binario application/pdf para descarga directa.
//
// Body params:
//   { start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD", branch_id: number | null }
//   branch_id null = todas las escuelas (solo admin)
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ─── CORS ────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Handler principal ───────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonErr('Unauthorized', 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return jsonErr('Unauthorized', 401);

    const body = await req.json();
    const { start_date, end_date } = body;
    const branch_id: number | null = body.branch_id ?? null;

    if (!start_date || !end_date) return jsonErr('start_date y end_date son requeridos', 400);

    // ── Nombre del usuario que genera ─────────────────────────────────────────
    const { data: userInfo } = await supabase
      .from('users')
      .select('first_names, paternal_last_name')
      .eq('supabase_uid', user.id)
      .maybeSingle();
    const generatedBy = userInfo
      ? `${userInfo.first_names ?? ''} ${userInfo.paternal_last_name ?? ''}`.trim()
      : 'Sistema';

    // ── Nombre de la sede ─────────────────────────────────────────────────────
    let branchName = 'Todas las escuelas';
    if (branch_id !== null) {
      const { data: branch } = await supabase
        .from('branches')
        .select('name')
        .eq('id', branch_id)
        .single();
      if (branch) branchName = branch.name;
    }

    // ── Pagos en el rango ─────────────────────────────────────────────────────
    let paymentsQ = supabase
      .from('payments')
      .select(
        `id, payment_date, type, total_amount, document_number, status,
         cash_amount, transfer_amount, card_amount, voucher_amount,
         enrollments!inner(
           branch_id,
           branches!inner(name),
           students!inner(users!inner(first_names, paternal_last_name, maternal_last_name, rut))
         )`,
      )
      .gte('payment_date', start_date)
      .lte('payment_date', end_date)
      .order('payment_date', { ascending: false })
      .limit(500);

    if (branch_id !== null) paymentsQ = paymentsQ.eq('enrollments.branch_id', branch_id);

    const { data: rawPayments, error: payErr } = await paymentsQ;
    if (payErr) throw payErr;

    // ── Alumnos con saldo pendiente (snapshot actual) ─────────────────────────
    let deudoresQ = supabase
      .from('enrollments')
      .select(
        `id, base_price, discount, total_paid, pending_balance, payment_status,
         branches!inner(name),
         courses!inner(name),
         students!inner(users!inner(first_names, paternal_last_name, maternal_last_name, rut))`,
      )
      .gt('pending_balance', 0)
      .neq('status', 'draft')
      .order('pending_balance', { ascending: false });

    if (branch_id !== null) deudoresQ = deudoresQ.eq('branch_id', branch_id);

    const { data: rawDeudores, error: deudErr } = await deudoresQ;
    if (deudErr) throw deudErr;

    // ── Normalizar datos ──────────────────────────────────────────────────────
    const payments: PaymentRow[] = (rawPayments ?? []).map((p: any) => ({
      fecha: p.payment_date,
      alumno: formatAlumnoName(p.enrollments?.students?.users),
      rut: p.enrollments?.students?.users?.rut ?? '-',
      concepto: p.type?.trim() || 'Pago',
      metodo: deriveMetodo(p),
      nroDocumento: p.document_number,
      monto: p.total_amount ?? 0,
      estado: p.status,
      branchName: p.enrollments?.branches?.name ?? '',
    }));

    const deudores: DeudorRow[] = (rawDeudores ?? []).map((e: any) => ({
      alumno: formatAlumnoName(e.students?.users),
      rut: e.students?.users?.rut ?? '-',
      curso: e.courses?.name ?? '—',
      totalACurso: (e.base_price ?? 0) - (e.discount ?? 0),
      totalPagado: e.total_paid ?? 0,
      saldo: e.pending_balance ?? 0,
      paymentStatus: e.payment_status,
      branchName: e.branches?.name ?? '',
    }));

    // ── Generar PDF ───────────────────────────────────────────────────────────
    const pdfBytes = buildPaymentReportPdf({
      startDate: start_date,
      endDate: end_date,
      branchName,
      showBranchColumn: branch_id === null,
      generatedBy,
      payments,
      deudores,
    });

    const safeName = sanitize(
      `Reporte_Pagos_${start_date}_${end_date}${branch_id !== null ? `_sede${branch_id}` : ''}`,
    );

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error('generate-payment-report error:', err);
    return jsonErr(err instanceof Error ? err.message : 'Internal server error', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════════════════════════

interface PaymentRow {
  fecha: string | null;
  alumno: string;
  rut: string;
  concepto: string;
  metodo: string;
  nroDocumento: string | null;
  monto: number;
  estado: string | null;
  branchName: string;
}

interface DeudorRow {
  alumno: string;
  rut: string;
  curso: string;
  totalACurso: number;
  totalPagado: number;
  saldo: number;
  paymentStatus: string | null;
  branchName: string;
}

interface ReportData {
  startDate: string;
  endDate: string;
  branchName: string;
  showBranchColumn: boolean;
  generatedBy: string;
  payments: PaymentRow[];
  deudores: DeudorRow[];
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF Builder (multi-página)
// ══════════════════════════════════════════════════════════════════════════════

function buildPaymentReportPdf(data: ReportData): Uint8Array {
  const PW = 595;
  const PH = 842;
  const M = 40; // margen lateral
  const CW = 515; // ancho de contenido
  const TOP = 800; // y inicial de contenido
  const MIN_Y = 55; // página nueva si y < MIN_Y

  // Acumuladores de páginas
  const pages: string[] = [];
  let ops: string[] = [];
  let y = TOP;
  let pageNum = 1;

  // ── Primitivas PDF ──────────────────────────────────────────────────────────

  const T = (x: number, yp: number, s: string, sz: number, bold = false) =>
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${sz} Tf ${x} ${yp} Td (${pdfStr(s)}) Tj ET`);

  const L = (x1: number, y1: number, x2: number, y2: number) =>
    ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);

  const R = (x: number, yp: number, w: number, h: number, fill = false) =>
    ops.push(`${x} ${yp} ${w} ${h} re ${fill ? 'f' : 'S'}`);

  const rgb = (r: number, g: number, b: number) => ops.push(`${r} ${g} ${b} rg ${r} ${g} ${b} RG`);

  const gray = (g: number) => ops.push(`${g} g ${g} G`);

  const black = () => ops.push('0 g 0 G');

  // ── Footer de página ────────────────────────────────────────────────────────

  function drawFooter(pNum: number) {
    gray(0.75);
    R(0, 18, PW, 22, true);
    ops.push('1 g 1 G');
    T(M, 26, `Documento confidencial — ${data.branchName}`, 6);
    T(PW - M - 60, 26, `Página ${pNum}`, 6, true);
    black();
  }

  // ── Cabecera de primera página ──────────────────────────────────────────────

  function drawFirstPageHeader() {
    // Banda azul de título
    rgb(0.13, 0.33, 0.68);
    R(0, PH - 50, PW, 50, true);
    ops.push('1 g 1 G');
    T(M, PH - 22, 'REPORTE DE PAGOS', 14, true);
    T(M, PH - 36, `${data.branchName}`, 8);
    T(M, PH - 46, `Período: ${formatDateCL(data.startDate)} — ${formatDateCL(data.endDate)}`, 7);
    // Info derecha
    T(PW - M - 130, PH - 30, `Generado por: ${data.generatedBy}`, 6);
    T(PW - M - 130, PH - 40, `Fecha: ${formatDateTimeCL(new Date().toISOString())}`, 6);
    black();
    y = TOP;
  }

  // ── Cabecera de páginas de continuación ─────────────────────────────────────

  function drawContinuationHeader(section: string) {
    gray(0.3);
    R(0, PH - 26, PW, 26, true);
    ops.push('1 g 1 G');
    T(M, PH - 16, `REPORTE DE PAGOS — ${section} (continuación)`, 8, true);
    T(PW - M - 80, PH - 16, data.branchName, 7);
    black();
    y = TOP - 10;
  }

  // ── Nuevo bloque de página ─────────────────────────────────────────────────

  function newPage(section: string) {
    drawFooter(pageNum);
    pages.push(ops.join('\n'));
    ops = [];
    pageNum++;
    drawContinuationHeader(section);
  }

  function need(h: number, section: string) {
    if (y - h < MIN_Y) newPage(section);
  }

  // ── Separador de sección ───────────────────────────────────────────────────

  function sectionBar(title: string) {
    gray(0.18);
    R(M, y - 14, CW, 16, true);
    ops.push('1 g 1 G');
    T(M + 4, y - 9, title.toUpperCase(), 8, true);
    black();
    y -= 16;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 1. PRIMERA PÁGINA: cabecera + KPIs resumen
  // ════════════════════════════════════════════════════════════════════════════

  drawFirstPageHeader();
  y -= 20;

  // ── Calcular totales ─────────────────────────────────────────────────────────
  const totalRecaudado = data.payments.reduce((s, p) => s + p.monto, 0);
  const totalCompletados = data.payments.filter((p) => p.estado === 'completado').length;
  const totalPendienteDeudores = data.deudores.reduce((s, d) => s + d.saldo, 0);
  const nPagos = data.payments.length;

  // Totales por método
  const byMethod: Record<string, number> = {};
  for (const p of data.payments) {
    byMethod[p.metodo] = (byMethod[p.metodo] ?? 0) + p.monto;
  }
  const topMethod = Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0] ?? ['—', 0];

  // ── Fila de KPIs (4 cajas) ────────────────────────────────────────────────
  const kpiW = (CW - 9) / 4; // 4 cajas con 3 gaps de 3pt
  const kpiH = 52;
  const kpis = [
    {
      label: 'Total Recaudado',
      value: formatCLP(totalRecaudado),
      sub: `en el período`,
      accent: [0.13, 0.33, 0.68],
    },
    {
      label: 'Nro. Pagos',
      value: String(nPagos),
      sub: `${totalCompletados} completados`,
      accent: [0.18, 0.55, 0.32],
    },
    {
      label: 'Saldo Pendiente',
      value: formatCLP(totalPendienteDeudores),
      sub: `${data.deudores.length} alumnos`,
      accent: [0.72, 0.4, 0.08],
    },
    {
      label: 'Método Principal',
      value: topMethod[0],
      sub: formatCLP(topMethod[1] as number),
      accent: [0.38, 0.18, 0.65],
    },
  ];

  for (let i = 0; i < kpis.length; i++) {
    const kx = M + i * (kpiW + 3);
    const ky = y - kpiH;
    const k = kpis[i];

    // Fondo blanco con borde
    gray(0.94);
    R(kx, ky, kpiW, kpiH, true);
    black();
    ops.push(`${k.accent[0]} ${k.accent[1]} ${k.accent[2]} rg`);
    R(kx, y - 4, kpiW, 4, true);
    black();

    T(kx + 4, y - 14, k.label, 7);
    ops.push(`${k.accent[0]} ${k.accent[1]} ${k.accent[2]} rg 0 G`);
    T(kx + 4, y - 30, k.value.length > 14 ? k.value.substring(0, 14) : k.value, 11, true);
    gray(0.5);
    T(kx + 4, y - 43, k.sub, 6);
    black();
  }

  y -= kpiH + 14;

  // ════════════════════════════════════════════════════════════════════════════
  // 2. TABLA DE PAGOS
  // ════════════════════════════════════════════════════════════════════════════

  sectionBar(`Pagos del Período (${nPagos} registros)`);
  y -= 4;

  // Anchos de columna según si se muestra sede o no
  // Con sede:  Fecha(48) Alumno(105) RUT(62) Sede(80) Concepto(68) Método(68) Monto(84) = 515
  // Sin sede:  Fecha(52) Alumno(135) RUT(68) Concepto(88) Método(82) NroDoc(52) Monto(38) = 515
  const showBranch = data.showBranchColumn;
  const pCols = showBranch ? [48, 105, 62, 80, 68, 68, 84] : [52, 135, 68, 88, 82, 52, 38];
  const pHeaders = showBranch
    ? ['Fecha', 'Alumno', 'RUT', 'Sede', 'Concepto', 'Método', 'Monto']
    : ['Fecha', 'Alumno', 'RUT', 'Concepto', 'Método', 'N° Doc', 'Monto'];

  function drawTableHeader(cols: number[], headers: string[]) {
    gray(0.88);
    R(M, y - 13, CW, 15, true);
    black();
    let xc = M;
    for (let i = 0; i < headers.length; i++) {
      T(xc + 2, y - 9, headers[i], 6.5, true);
      xc += cols[i];
    }
    L(M, y + 2, M + CW, y + 2);
    L(M, y - 13, M + CW, y - 13);
    y -= 13;
  }

  drawTableHeader(pCols, pHeaders);

  for (let i = 0; i < data.payments.length; i++) {
    need(14, 'Pagos');
    if (y === TOP - 10) {
      // recién hicimos newPage, redibujar cabecera de tabla
      drawTableHeader(pCols, pHeaders);
    }

    const p = data.payments[i];
    if (i % 2 === 0) {
      gray(0.965);
      R(M, y - 12, CW, 14, true);
      black();
    }

    const cells = showBranch
      ? [
          formatDateCL(p.fecha),
          truncate(p.alumno, 24),
          p.rut,
          truncate(p.branchName, 13),
          truncate(p.concepto, 11),
          p.metodo,
          formatCLP(p.monto),
        ]
      : [
          formatDateCL(p.fecha),
          truncate(p.alumno, 30),
          p.rut,
          truncate(p.concepto, 14),
          p.metodo,
          p.nroDocumento ?? '-',
          formatCLP(p.monto),
        ];

    let xc = M;
    for (let j = 0; j < cells.length; j++) {
      // Monto en azul, estado visual
      if (j === pCols.length - 1) {
        rgb(0.13, 0.33, 0.68);
        T(xc + 2, y - 9, cells[j], 6.5, true);
        black();
      } else if (!showBranch && j === 0 && p.estado === 'pendiente') {
        // Fecha en ámbar si pendiente
        rgb(0.72, 0.4, 0.08);
        T(xc + 2, y - 9, cells[j], 6.5);
        black();
      } else {
        T(xc + 2, y - 9, cells[j], 6.5);
      }
      xc += pCols[j];
    }
    y -= 14;
  }

  // Línea de cierre de tabla
  L(M, y + 2, M + CW, y + 2);
  y -= 8;

  // Totales de tabla
  const totalText = `Total recaudado en el período: ${formatCLP(totalRecaudado)}`;
  gray(0.92);
  R(M, y - 13, CW, 15, true);
  black();
  rgb(0.13, 0.33, 0.68);
  T(CW + M - 200, y - 9, totalText, 7.5, true);
  black();
  y -= 22;

  // ════════════════════════════════════════════════════════════════════════════
  // 3. TABLA DE DEUDORES
  // ════════════════════════════════════════════════════════════════════════════

  if (data.deudores.length > 0) {
    need(40, 'Saldos Pendientes');
    y -= 6;
    sectionBar(`Saldos Pendientes (${data.deudores.length} alumnos)`);
    y -= 4;

    // Con sede:  Alumno(120) RUT(65) Sede(80) Curso(80) Total(60) Pagado(55) Saldo(55) = 515
    // Sin sede:  Alumno(140) RUT(70) Curso(105) Total(70) Pagado(65) Saldo(65) = 515
    const dCols = showBranch ? [120, 65, 80, 80, 60, 55, 55] : [140, 70, 105, 70, 65, 65];
    const dHeaders = showBranch
      ? ['Alumno', 'RUT', 'Sede', 'Curso', 'Total Curso', 'Pagado', 'Saldo']
      : ['Alumno', 'RUT', 'Curso', 'Total Curso', 'Pagado', 'Saldo'];

    drawTableHeader(dCols, dHeaders);

    for (let i = 0; i < data.deudores.length; i++) {
      need(14, 'Saldos Pendientes');
      if (y === TOP - 10) drawTableHeader(dCols, dHeaders);

      const d = data.deudores[i];
      if (i % 2 === 0) {
        gray(0.965);
        R(M, y - 12, CW, 14, true);
        black();
      }

      const cells = showBranch
        ? [
            truncate(d.alumno, 26),
            d.rut,
            truncate(d.branchName, 13),
            truncate(d.curso, 13),
            formatCLP(d.totalACurso),
            formatCLP(d.totalPagado),
            formatCLP(d.saldo),
          ]
        : [
            truncate(d.alumno, 30),
            d.rut,
            truncate(d.curso, 17),
            formatCLP(d.totalACurso),
            formatCLP(d.totalPagado),
            formatCLP(d.saldo),
          ];

      let xc = M;
      for (let j = 0; j < cells.length; j++) {
        const isLast = j === cells.length - 1;
        if (isLast) {
          rgb(0.72, 0.4, 0.08); // Saldo en ámbar
          T(xc + 2, y - 9, cells[j], 6.5, true);
          black();
        } else {
          T(xc + 2, y - 9, cells[j], 6.5);
        }
        xc += dCols[j];
      }
      y -= 14;
    }

    L(M, y + 2, M + CW, y + 2);
    y -= 8;

    // Total deuda
    gray(0.92);
    R(M, y - 13, CW, 15, true);
    black();
    rgb(0.72, 0.4, 0.08);
    T(
      CW + M - 200,
      y - 9,
      `Saldo total pendiente: ${formatCLP(totalPendienteDeudores)}`,
      7.5,
      true,
    );
    black();
    y -= 16;
  }

  // ── Cerrar última página ──────────────────────────────────────────────────
  drawFooter(pageNum);
  pages.push(ops.join('\n'));

  return assembleMultiPagePdf(pages, PW, PH);
}

// ══════════════════════════════════════════════════════════════════════════════
// Ensamblador PDF multi-página
// ══════════════════════════════════════════════════════════════════════════════

function assembleMultiPagePdf(pageContents: string[], W: number, H: number): Uint8Array {
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

  const N = pageContents.length;
  // Estructura de objetos:
  // 1: Catalog  2: Pages
  // 3+i*2: Page_i   4+i*2: Stream_i   (i = 0..N-1)
  // 3+N*2: Font Helvetica   4+N*2: Font Helvetica-Bold
  const fontObj1 = 3 + N * 2;
  const fontObj2 = 4 + N * 2;
  const totalObjs = 5 + N * 2;

  w('%PDF-1.4');
  w('%\xE2\xE3\xCF\xD3');

  startObj(1);
  w('<< /Type /Catalog /Pages 2 0 R >>');
  w('endobj');

  const kidsRefs = Array.from({ length: N }, (_, i) => `${3 + i * 2} 0 R`).join(' ');
  startObj(2);
  w(`<< /Type /Pages /Kids [${kidsRefs}] /Count ${N} >>`);
  w('endobj');

  for (let i = 0; i < N; i++) {
    const pageId = 3 + i * 2;
    const streamId = 4 + i * 2;

    startObj(pageId);
    w('<< /Type /Page /Parent 2 0 R');
    w(`   /MediaBox [0 0 ${W} ${H}]`);
    w(`   /Contents ${streamId} 0 R`);
    w(`   /Resources << /Font << /F1 ${fontObj1} 0 R /F2 ${fontObj2} 0 R >> >> >>`);
    w('endobj');

    const content = pageContents[i];
    const contentBytes = enc.encode(content);
    startObj(streamId);
    w(`<< /Length ${contentBytes.length} >>`);
    w('stream');
    lines.push(content);
    byteOffset += contentBytes.length + 1;
    w('endstream');
    w('endobj');
  }

  startObj(fontObj1);
  w('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  w('endobj');

  startObj(fontObj2);
  w('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  w('endobj');

  const xrefOffset = byteOffset;
  w('xref');
  w(`0 ${totalObjs}`);
  w('0000000000 65535 f ');
  for (let i = 1; i < totalObjs; i++) {
    w(String(objOffsets[i] ?? 0).padStart(10, '0') + ' 00000 n ');
  }
  w('trailer');
  w(`<< /Size ${totalObjs} /Root 1 0 R >>`);
  w('startxref');
  w(String(xrefOffset));
  w('%%EOF');

  return enc.encode(lines.join('\n'));
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

function deriveMetodo(p: any): string {
  const t = p.transfer_amount ?? 0;
  const c = p.cash_amount ?? 0;
  const k = p.card_amount ?? 0;
  const v = p.voucher_amount ?? 0;
  const active = [
    t > 0 && 'Transferencia',
    c > 0 && 'Efectivo',
    k > 0 && 'Débito/Crédito',
    v > 0 && 'WebPay',
  ].filter(Boolean);
  if (active.length === 0) return '—';
  if (active.length === 1) return active[0] as string;
  return 'Mixto';
}

function formatAlumnoName(u: any): string {
  if (!u) return '-';
  const parts = [(u.paternal_last_name ?? '').trim(), (u.first_names ?? '').trim()].filter(Boolean);
  return parts.join(' ') || '-';
}

function pdfStr(s: string): string {
  return s
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    .replace(/ /g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[()\\]/g, (c) => '\\' + c)
    .replace(/[^\x20-\x7E]/g, '?');
}

function truncate(s: string, max: number): string {
  if (!s) return '-';
  return s.length > max ? s.substring(0, max - 1) + '.' : s;
}

function formatDateCL(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Santiago',
  });
}

function formatDateTimeCL(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
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

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 80);
}

function jsonErr(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
