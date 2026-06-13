// supabase/functions/generate-cash-closing-report/index.ts
//
// Edge Function: generate-cash-closing-report
//
// Genera un reporte de la Cuadratura Diaria de Caja en formato Excel (JSON payload)
// o PDF multi-página. No almacena archivos — retorna binario/JSON directamente.
//
// Body esperado:
//   format    : 'excel' | 'pdf'
//   date      : 'YYYY-MM-DD'          — fecha a reportar (default: hoy)
//   branch_id : number | null          — sede; null = admin (todas las sedes sin filtro)
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonError(msg: string, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonError('No autorizado', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return jsonError('No autorizado', 401);

    const body = await req.json();
    const format: 'excel' | 'pdf' = body.format ?? 'excel';
    const date: string = body.date ?? new Date().toISOString().slice(0, 10);
    const branchId: number | null = body.branch_id ?? null;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Usuario que genera ────────────────────────────────────────────────────
    const { data: userInfo } = await adminClient
      .from('users')
      .select('first_names, paternal_last_name')
      .eq('supabase_uid', user.id)
      .maybeSingle();
    const generatedBy = userInfo
      ? `${userInfo.first_names ?? ''} ${userInfo.paternal_last_name ?? ''}`.trim()
      : 'Sistema';

    // ── Sede ──────────────────────────────────────────────────────────────────
    let branchName = 'Todas las escuelas';
    if (branchId !== null) {
      const { data: branch } = await adminClient
        .from('branches')
        .select('name')
        .eq('id', branchId)
        .single();
      if (branch) branchName = branch.name;
    }

    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;

    // ── Ingresos del día (payments) ────────────────────────────────────────────
    let paymentsQ = adminClient
      .from('payments')
      .select(
        `id, created_at, document_number, type,
         cash_amount, transfer_amount, card_amount, voucher_amount, total_amount,
         enrollments!inner(branch_id, students!inner(users!inner(first_names, paternal_last_name, rut)))`,
      )
      .eq('status', 'paid')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .order('created_at', { ascending: true });

    if (branchId !== null) {
      paymentsQ = paymentsQ.eq('enrollments.branch_id', branchId);
    }

    const { data: rawPayments, error: payErr } = await paymentsQ;
    if (payErr) throw payErr;

    // ── Cobros de cursos singulares del día (fix-016 AC3) ──────────────────────
    // No existen en `payments`: viven en standalone_course_enrollments.paid_at.
    let singularsQ = adminClient
      .from('standalone_course_enrollments')
      .select(
        `id, paid_at, amount_paid, payment_method,
         standalone_courses!inner(name, branch_id),
         students!inner(users!inner(first_names, paternal_last_name, rut))`,
      )
      .eq('payment_status', 'paid')
      .gte('paid_at', dayStart)
      .lte('paid_at', dayEnd)
      .order('paid_at', { ascending: true });

    if (branchId !== null) {
      singularsQ = singularsQ.eq('standalone_courses.branch_id', branchId);
    }

    const { data: rawSingulars, error: singErr } = await singularsQ;
    if (singErr) throw singErr;

    // ── Egresos del día (expenses) ─────────────────────────────────────────────
    let expQ = adminClient
      .from('expenses')
      .select('id, description, amount, created_at')
      .eq('date', date)
      .order('created_at', { ascending: true });
    if (branchId !== null) expQ = expQ.eq('branch_id', branchId);

    // ── Anticipos del día (instructor_advances) ────────────────────────────────
    const advQ = adminClient
      .from('instructor_advances')
      .select('id, reason, description, amount, created_at')
      .eq('date', date)
      .order('created_at', { ascending: true });

    const [expRes, advRes] = await Promise.all([expQ, advQ]);

    // ── Cierre de caja del día ─────────────────────────────────────────────────
    let cierreQ = adminClient
      .from('cash_closings')
      .select(
        `date, closed, closed_at, status, notes,
         cash_amount, transfer_amount, card_amount, voucher_amount,
         total_income, total_expenses, balance, payments_count,
         arqueo_amount, difference,
         qty_bill_20000, qty_bill_10000, qty_bill_5000, qty_bill_2000, qty_bill_1000,
         qty_coin_500, qty_coin_100, qty_coin_50, qty_coin_10`,
      )
      .eq('date', date)
      .eq('closed', true);
    if (branchId !== null) cierreQ = cierreQ.eq('branch_id', branchId);
    const { data: cierreData } = await cierreQ.maybeSingle();

    // ── Normalizar datos ───────────────────────────────────────────────────────
    const FONDO_INICIAL = 50_000;

    const ingresosPagos: IngresoRow[] = (rawPayments ?? []).map((p: any) => ({
      hora: formatTimeCL(p.created_at),
      nBoleta: p.document_number ?? '—',
      alumno: formatAlumno(p.enrollments?.students?.users),
      rut: p.enrollments?.students?.users?.rut ?? '—',
      concepto: p.type ?? '—',
      efectivo: p.cash_amount ?? 0,
      transferencia: p.transfer_amount ?? 0,
      sence: p.voucher_amount ?? 0,
      otros: p.card_amount ?? 0,
      total: p.total_amount ?? 0,
    }));

    // Mismos buckets que CuadraturaFacade.mapSingularSaleToIngreso():
    // efectivo→efectivo · transferencia→transferencia · tarjeta→otros · sence→sence
    const ingresosSingulares: IngresoRow[] = (rawSingulars ?? []).map((s: any) => {
      const monto = s.amount_paid ?? 0;
      const metodo = s.payment_method ?? 'efectivo';
      return {
        hora: formatTimeCL(s.paid_at),
        nBoleta: '—',
        alumno: formatAlumno(s.students?.users),
        rut: s.students?.users?.rut ?? '—',
        concepto: `Curso: ${s.standalone_courses?.name ?? 'singular'}`,
        efectivo: metodo === 'efectivo' ? monto : 0,
        transferencia: metodo === 'transferencia' ? monto : 0,
        sence: metodo === 'sence' ? monto : 0,
        otros: metodo === 'tarjeta' ? monto : 0,
        total: monto,
      };
    });

    const ingresos: IngresoRow[] = [...ingresosPagos, ...ingresosSingulares].sort((a, b) =>
      a.hora.localeCompare(b.hora),
    );

    const egresos: EgresoRow[] = [
      ...(expRes.data ?? []).map((e: any) => ({
        hora: formatTimeCL(e.created_at),
        descripcion: e.description ?? '—',
        tipo: 'Gasto' as const,
        monto: e.amount ?? 0,
      })),
      ...(advRes.data ?? []).map((a: any) => ({
        hora: formatTimeCL(a.created_at),
        descripcion: a.reason ?? a.description ?? 'Anticipo instructor',
        tipo: 'Anticipo' as const,
        monto: a.amount ?? 0,
      })),
    ].sort((a, b) => a.hora.localeCompare(b.hora));

    const totalIngresos = ingresos.reduce((s, i) => s + i.total, 0);
    const totalEfectivo = ingresos.reduce((s, i) => s + i.efectivo, 0);
    const totalEgresos = egresos.reduce((s, e) => s + e.monto, 0);
    const saldoTeorico = FONDO_INICIAL + totalEfectivo - totalEgresos;

    const reportData: ReportData = {
      fecha: date,
      branchName,
      generatedBy,
      ingresos,
      egresos,
      fondoInicial: FONDO_INICIAL,
      totalIngresos,
      totalEfectivo,
      totalEgresos,
      saldoTeorico,
      cierre: cierreData
        ? {
            cerradoEn: cierreData.closed_at ? formatDateTimeCL(cierreData.closed_at) : '—',
            arqueoTotal: cierreData.arqueo_amount ?? 0,
            diferencia: cierreData.difference ?? 0,
            notas: cierreData.notes ?? '',
            bill20000: cierreData.qty_bill_20000 ?? 0,
            bill10000: cierreData.qty_bill_10000 ?? 0,
            bill5000: cierreData.qty_bill_5000 ?? 0,
            bill2000: cierreData.qty_bill_2000 ?? 0,
            bill1000: cierreData.qty_bill_1000 ?? 0,
            coin500: cierreData.qty_coin_500 ?? 0,
            coin100: cierreData.qty_coin_100 ?? 0,
            coin50: cierreData.qty_coin_50 ?? 0,
            coin10: cierreData.qty_coin_10 ?? 0,
          }
        : null,
    };

    if (format === 'excel') {
      const payload = buildExcelPayload(reportData);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pdfBytes = buildPdf(reportData);
    const safeName = sanitize(`Cuadratura_${date}${branchId !== null ? `_sede${branchId}` : ''}`);
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[generate-cash-closing-report]', err);
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════════════════════════

interface IngresoRow {
  hora: string;
  nBoleta: string;
  alumno: string;
  rut: string;
  concepto: string;
  efectivo: number;
  transferencia: number;
  sence: number;
  otros: number;
  total: number;
}

interface EgresoRow {
  hora: string;
  descripcion: string;
  tipo: 'Gasto' | 'Anticipo';
  monto: number;
}

interface CierreInfo {
  cerradoEn: string;
  arqueoTotal: number;
  diferencia: number;
  notas: string;
  bill20000: number;
  bill10000: number;
  bill5000: number;
  bill2000: number;
  bill1000: number;
  coin500: number;
  coin100: number;
  coin50: number;
  coin10: number;
}

interface ReportData {
  fecha: string;
  branchName: string;
  generatedBy: string;
  ingresos: IngresoRow[];
  egresos: EgresoRow[];
  fondoInicial: number;
  totalIngresos: number;
  totalEfectivo: number;
  totalEgresos: number;
  saldoTeorico: number;
  cierre: CierreInfo | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Excel payload builder (retorna JSON; el frontend usa downloadExcel())
// ══════════════════════════════════════════════════════════════════════════════

interface ExcelPayload {
  sheetName: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}

function buildExcelPayload(d: ReportData): ExcelPayload {
  const rows: (string | number)[][] = [];

  // ── Encabezado del reporte ────────────────────────────────────────────────
  rows.push(['CUADRATURA DIARIA DE CAJA']);
  rows.push([`Fecha: ${formatDateCL(d.fecha)}`]);
  rows.push([`Sede: ${d.branchName}`]);
  rows.push([`Estado: ${d.cierre ? 'Caja Cerrada' : 'Caja Abierta'}`]);
  rows.push([`Generado por: ${d.generatedBy}`]);
  rows.push([]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  rows.push(['RESUMEN DE CAJA']);
  rows.push(['Concepto', 'Monto']);
  rows.push(['Fondo Inicial', d.fondoInicial]);
  rows.push(['Total Ingresos del Día', d.totalIngresos]);
  rows.push(['  — Efectivo', d.totalEfectivo]);
  rows.push(['  — Otros Métodos', d.totalIngresos - d.totalEfectivo]);
  rows.push(['Total Egresos del Día', d.totalEgresos]);
  rows.push(['Saldo Teórico en Efectivo', d.saldoTeorico]);
  if (d.cierre) {
    rows.push(['Total Físico Arqueado', d.cierre.arqueoTotal]);
    rows.push(['Diferencia', d.cierre.diferencia]);
  }
  rows.push([]);

  // ── Ingresos ──────────────────────────────────────────────────────────────
  rows.push([`INGRESOS (${d.ingresos.length} registros)`]);
  rows.push([
    'Hora',
    'N° Boleta',
    'Alumno',
    'RUT',
    'Concepto',
    'Efectivo',
    'Transferencia',
    'SENCE',
    'Otro',
    'Total',
  ]);
  for (const ing of d.ingresos) {
    rows.push([
      ing.hora,
      ing.nBoleta,
      ing.alumno,
      ing.rut,
      ing.concepto,
      ing.efectivo,
      ing.transferencia,
      ing.sence,
      ing.otros,
      ing.total,
    ]);
  }
  rows.push([
    '',
    '',
    '',
    '',
    'TOTAL',
    d.ingresos.reduce((s, i) => s + i.efectivo, 0),
    d.ingresos.reduce((s, i) => s + i.transferencia, 0),
    d.ingresos.reduce((s, i) => s + i.sence, 0),
    d.ingresos.reduce((s, i) => s + i.otros, 0),
    d.totalIngresos,
  ]);
  rows.push([]);

  // ── Egresos ───────────────────────────────────────────────────────────────
  rows.push([`EGRESOS Y ANTICIPOS (${d.egresos.length} registros)`]);
  rows.push(['Hora', 'Descripción', 'Tipo', 'Monto']);
  for (const eg of d.egresos) {
    rows.push([eg.hora, eg.descripcion, eg.tipo, eg.monto]);
  }
  rows.push(['', 'TOTAL', '', d.totalEgresos]);
  rows.push([]);

  // ── Arqueo / Desglose de billetes (si caja cerrada) ───────────────────────
  if (d.cierre) {
    rows.push(['ARQUEO DE CAJA']);
    rows.push(['Denominación', 'Cantidad', 'Subtotal']);
    const denomsBilletes = [
      { label: 'Billetes de $20.000', qty: d.cierre.bill20000, val: 20000 },
      { label: 'Billetes de $10.000', qty: d.cierre.bill10000, val: 10000 },
      { label: 'Billetes de $5.000', qty: d.cierre.bill5000, val: 5000 },
      { label: 'Billetes de $2.000', qty: d.cierre.bill2000, val: 2000 },
      { label: 'Billetes de $1.000', qty: d.cierre.bill1000, val: 1000 },
      { label: 'Monedas de $500', qty: d.cierre.coin500, val: 500 },
      { label: 'Monedas de $100', qty: d.cierre.coin100, val: 100 },
      { label: 'Monedas de $50', qty: d.cierre.coin50, val: 50 },
      { label: 'Monedas de $10', qty: d.cierre.coin10, val: 10 },
    ];
    for (const d2 of denomsBilletes) {
      if (d2.qty > 0) rows.push([d2.label, d2.qty, d2.qty * d2.val]);
    }
    rows.push(['TOTAL FÍSICO ARQUEADO', '', d.cierre.arqueoTotal]);
    rows.push(['DIFERENCIA', '', d.cierre.diferencia]);
    if (d.cierre.notas) rows.push(['Observaciones', d.cierre.notas]);
    rows.push([`Cierre registrado: ${d.cierre.cerradoEn}`]);
  }

  const fecha = d.fecha.replace(/-/g, '');
  return {
    sheetName: 'Cuadratura',
    headers: [],
    rows,
    filename: `Cuadratura_${fecha}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF Builder
// ══════════════════════════════════════════════════════════════════════════════

function buildPdf(data: ReportData): Uint8Array {
  const PW = 595;
  const PH = 842;
  const M = 40;
  const CW = 515;
  const TOP = 800;
  const MIN_Y = 55;

  const pages: string[] = [];
  let ops: string[] = [];
  let y = TOP;
  let pageNum = 1;

  // ── Primitivas ──────────────────────────────────────────────────────────────
  const T = (x: number, yp: number, s: string, sz: number, bold = false) =>
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${sz} Tf ${x} ${yp} Td (${pdfStr(s)}) Tj ET`);
  const L = (x1: number, y1: number, x2: number, y2: number) =>
    ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  const R = (x: number, yp: number, w: number, h: number, fill = false) =>
    ops.push(`${x} ${yp} ${w} ${h} re ${fill ? 'f' : 'S'}`);
  const rgb = (r: number, g: number, b: number) => ops.push(`${r} ${g} ${b} rg ${r} ${g} ${b} RG`);
  const gray = (g: number) => ops.push(`${g} g ${g} G`);
  const black = () => ops.push('0 g 0 G');

  function drawFooter(pNum: number) {
    gray(0.75);
    R(0, 18, PW, 22, true);
    ops.push('1 g 1 G');
    T(M, 26, `Documento confidencial — ${data.branchName}`, 6);
    T(PW - M - 60, 26, `Página ${pNum}`, 6, true);
    black();
  }

  function drawHeader() {
    // Banda azul
    rgb(0.13, 0.33, 0.68);
    R(0, PH - 52, PW, 52, true);
    ops.push('1 g 1 G');
    T(M, PH - 20, 'CUADRATURA DIARIA DE CAJA', 13, true);
    T(M, PH - 33, `${data.branchName}  —  ${formatDateCL(data.fecha)}`, 8);
    T(M, PH - 44, `Estado: ${data.cierre ? 'Caja Cerrada' : 'Caja Abierta'}`, 7);
    T(PW - M - 140, PH - 30, `Generado por: ${data.generatedBy}`, 6);
    T(PW - M - 140, PH - 40, `Fecha: ${formatDateTimeCL(new Date().toISOString())}`, 6);
    black();
    y = TOP;
  }

  function drawContHeader(section: string) {
    gray(0.3);
    R(0, PH - 26, PW, 26, true);
    ops.push('1 g 1 G');
    T(M, PH - 16, `CUADRATURA — ${section} (continuación)`, 8, true);
    T(PW - M - 80, PH - 16, data.branchName, 7);
    black();
    y = TOP - 10;
  }

  function newPage(section: string) {
    drawFooter(pageNum);
    pages.push(ops.join('\n'));
    ops = [];
    pageNum++;
    drawContHeader(section);
  }

  function need(h: number, section: string) {
    if (y - h < MIN_Y) newPage(section);
  }

  function sectionBar(title: string) {
    gray(0.18);
    R(M, y - 14, CW, 16, true);
    ops.push('1 g 1 G');
    T(M + 4, y - 9, title.toUpperCase(), 8, true);
    black();
    y -= 16;
  }

  function tblHeader(cols: number[], headers: string[]) {
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

  // ── 1. Primera página: cabecera + KPIs ───────────────────────────────────────
  drawHeader();
  y -= 20;

  // KPI boxes
  const cajaStatus = data.cierre ? 'Cerrada' : 'Abierta';
  const kpiW = (CW - 6) / 4;
  const kpiH = 52;
  const kpis = [
    {
      label: 'Fondo Inicial',
      value: clp(data.fondoInicial),
      sub: 'base del día',
      accent: [0.38, 0.18, 0.65],
    },
    {
      label: 'Total Ingresos',
      value: clp(data.totalIngresos),
      sub: `${data.ingresos.length} registros`,
      accent: [0.18, 0.55, 0.32],
    },
    {
      label: 'Total Egresos',
      value: clp(data.totalEgresos),
      sub: `${data.egresos.length} registros`,
      accent: [0.72, 0.4, 0.08],
    },
    {
      label: 'Saldo Teórico',
      value: clp(data.saldoTeorico),
      sub: `Caja ${cajaStatus}`,
      accent: [0.13, 0.33, 0.68],
    },
  ];

  for (let i = 0; i < kpis.length; i++) {
    const kx = M + i * (kpiW + 2);
    const ky = y - kpiH;
    const k = kpis[i];
    gray(0.94);
    R(kx, ky, kpiW, kpiH, true);
    black();
    ops.push(`${k.accent[0]} ${k.accent[1]} ${k.accent[2]} rg`);
    R(kx, y - 4, kpiW, 4, true);
    black();
    T(kx + 4, y - 14, k.label, 7);
    ops.push(`${k.accent[0]} ${k.accent[1]} ${k.accent[2]} rg 0 G`);
    const val = k.value.length > 14 ? k.value.substring(0, 14) : k.value;
    T(kx + 4, y - 30, val, 11, true);
    gray(0.5);
    T(kx + 4, y - 43, k.sub, 6);
    black();
  }

  y -= kpiH + 14;

  // Si caja cerrada: fila adicional de arqueo
  if (data.cierre) {
    need(30, 'Cuadratura');
    const dif = data.cierre.diferencia;
    const difLabel =
      dif === 0
        ? 'Cuadrado'
        : dif > 0
          ? `Sobrante: ${clp(dif)}`
          : `Faltante: ${clp(Math.abs(dif))}`;
    const difColor: [number, number, number] =
      dif === 0 ? [0.18, 0.55, 0.32] : dif > 0 ? [0.72, 0.4, 0.08] : [0.72, 0.18, 0.18];

    gray(0.92);
    R(M, y - 22, CW, 24, true);
    black();
    T(M + 4, y - 8, 'RESULTADO DEL ARQUEO:', 7, true);
    T(M + 130, y - 8, `Físico Arqueado: ${clp(data.cierre.arqueoTotal)}`, 7);
    ops.push(`${difColor[0]} ${difColor[1]} ${difColor[2]} rg`);
    T(M + 280, y - 8, difLabel, 7, true);
    black();
    T(M + 4, y - 17, `Cierre registrado: ${data.cierre.cerradoEn}`, 6.5);
    if (data.cierre.notas) {
      T(M + 200, y - 17, `Obs: ${truncate(data.cierre.notas, 60)}`, 6.5);
    }
    y -= 30;
  }

  y -= 6;

  // ── 2. Tabla de Ingresos ──────────────────────────────────────────────────────
  sectionBar(`Ingresos del Día (${data.ingresos.length} registros)`);
  y -= 4;

  const iCols = [34, 52, 130, 72, 64, 50, 50, 40, 23];
  const iHeaders = [
    'Hora',
    'N° Boleta',
    'Alumno',
    'RUT',
    'Concepto',
    'Efectivo',
    'Transfer.',
    'SENCE',
    'Total',
  ];

  tblHeader(iCols, iHeaders);

  for (let i = 0; i < data.ingresos.length; i++) {
    need(14, 'Ingresos');
    if (y === TOP - 10) tblHeader(iCols, iHeaders);

    const ing = data.ingresos[i];
    if (i % 2 === 0) {
      gray(0.965);
      R(M, y - 12, CW, 14, true);
      black();
    }

    const cells = [
      ing.hora,
      ing.nBoleta,
      truncate(ing.alumno, 26),
      ing.rut,
      truncate(ing.concepto, 10),
      clp(ing.efectivo),
      clp(ing.transferencia),
      clp(ing.sence),
      clp(ing.total),
    ];

    let xc = M;
    for (let j = 0; j < cells.length; j++) {
      if (j === cells.length - 1) {
        rgb(0.13, 0.33, 0.68);
        T(xc + 2, y - 9, cells[j], 6.5, true);
        black();
      } else {
        T(xc + 2, y - 9, cells[j], 6.5);
      }
      xc += iCols[j];
    }
    y -= 14;
  }

  L(M, y + 2, M + CW, y + 2);
  y -= 4;

  // Totales de ingresos
  gray(0.92);
  R(M, y - 13, CW, 15, true);
  black();
  rgb(0.13, 0.33, 0.68);
  T(
    CW + M - 200,
    y - 9,
    `Total ingresos del día: ${clp(data.totalIngresos)}  |  Efectivo: ${clp(data.totalEfectivo)}`,
    7.5,
    true,
  );
  black();
  y -= 22;

  // ── 3. Tabla de Egresos ───────────────────────────────────────────────────────
  if (data.egresos.length > 0) {
    need(40, 'Egresos');
    y -= 6;
    sectionBar(`Egresos y Anticipos del Día (${data.egresos.length} registros)`);
    y -= 4;

    const eCols = [34, 310, 87, 84];
    const eHeaders = ['Hora', 'Descripción', 'Tipo', 'Monto'];

    tblHeader(eCols, eHeaders);

    for (let i = 0; i < data.egresos.length; i++) {
      need(14, 'Egresos');
      if (y === TOP - 10) tblHeader(eCols, eHeaders);

      const eg = data.egresos[i];
      if (i % 2 === 0) {
        gray(0.965);
        R(M, y - 12, CW, 14, true);
        black();
      }

      const cells = [eg.hora, truncate(eg.descripcion, 62), eg.tipo, clp(eg.monto)];
      let xc = M;
      for (let j = 0; j < cells.length; j++) {
        if (j === cells.length - 1) {
          rgb(0.72, 0.4, 0.08);
          T(xc + 2, y - 9, cells[j], 6.5, true);
          black();
        } else {
          T(xc + 2, y - 9, cells[j], 6.5);
        }
        xc += eCols[j];
      }
      y -= 14;
    }

    L(M, y + 2, M + CW, y + 2);
    y -= 4;

    gray(0.92);
    R(M, y - 13, CW, 15, true);
    black();
    rgb(0.72, 0.4, 0.08);
    T(CW + M - 200, y - 9, `Total egresos del día: ${clp(data.totalEgresos)}`, 7.5, true);
    black();
    y -= 16;
  }

  // ── 4. Desglose de billetes (si caja cerrada) ─────────────────────────────────
  if (data.cierre) {
    const denoms = [
      { label: 'Billetes de $20.000', qty: data.cierre.bill20000, val: 20000 },
      { label: 'Billetes de $10.000', qty: data.cierre.bill10000, val: 10000 },
      { label: 'Billetes de $5.000', qty: data.cierre.bill5000, val: 5000 },
      { label: 'Billetes de $2.000', qty: data.cierre.bill2000, val: 2000 },
      { label: 'Billetes de $1.000', qty: data.cierre.bill1000, val: 1000 },
      { label: 'Monedas de $500', qty: data.cierre.coin500, val: 500 },
      { label: 'Monedas de $100', qty: data.cierre.coin100, val: 100 },
      { label: 'Monedas de $50', qty: data.cierre.coin50, val: 50 },
      { label: 'Monedas de $10', qty: data.cierre.coin10, val: 10 },
    ].filter((d) => d.qty > 0);

    if (denoms.length > 0) {
      need(40 + denoms.length * 14, 'Arqueo');
      y -= 6;
      sectionBar('Desglose de Billetes y Monedas');
      y -= 4;

      const dCols = [220, 120, 175];
      const dHeaders = ['Denominación', 'Cantidad', 'Subtotal'];
      tblHeader(dCols, dHeaders);

      for (let i = 0; i < denoms.length; i++) {
        need(14, 'Arqueo');
        const d2 = denoms[i];
        if (i % 2 === 0) {
          gray(0.965);
          R(M, y - 12, CW, 14, true);
          black();
        }
        const cells = [d2.label, String(d2.qty), clp(d2.qty * d2.val)];
        let xc = M;
        for (let j = 0; j < cells.length; j++) {
          T(xc + 2, y - 9, cells[j], 6.5);
          xc += dCols[j];
        }
        y -= 14;
      }

      L(M, y + 2, M + CW, y + 2);
      y -= 4;

      // Total arqueo y diferencia
      const dif = data.cierre.diferencia;
      const difColor: [number, number, number] =
        dif === 0 ? [0.18, 0.55, 0.32] : dif > 0 ? [0.72, 0.4, 0.08] : [0.72, 0.18, 0.18];
      gray(0.92);
      R(M, y - 13, CW, 15, true);
      black();
      rgb(0.13, 0.33, 0.68);
      T(M + 4, y - 9, `Total Físico Arqueado: ${clp(data.cierre.arqueoTotal)}`, 7.5, true);
      ops.push(`${difColor[0]} ${difColor[1]} ${difColor[2]} rg`);
      const difStr =
        dif === 0 ? 'Sin diferencia' : dif > 0 ? `Sobrante: +${clp(dif)}` : `Faltante: ${clp(dif)}`;
      T(CW + M - 180, y - 9, difStr, 7.5, true);
      black();
      y -= 16;
    }
  }

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

function formatAlumno(u: any): string {
  if (!u) return '—';
  return `${u.paternal_last_name ?? ''} ${u.first_names ?? ''}`.trim() || '—';
}

function pdfStr(s: string): string {
  return s
    .replace(/[   ]/g, ' ')
    .replace(/°/g, '.')
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[()\\]/g, (c) => '\\' + c)
    .replace(/[^\x20-\x7E]/g, '?');
}

function truncate(s: string, max: number): string {
  if (!s) return '—';
  return s.length > max ? s.substring(0, max - 1) + '.' : s;
}

function clp(amount: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

function formatDateCL(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Santiago',
  });
}

function formatTimeCL(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
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

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 80);
}
