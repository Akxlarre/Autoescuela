// supabase/functions/generate-financial-report/index.ts
//
// Edge Function: generate-financial-report
//
// Genera un Reporte Contable en formato Excel (JSON payload)
// o PDF multi-página. No almacena archivos — retorna binario/JSON directamente.
//
// Body esperado:
//   format    : 'excel' | 'pdf'
//   desde     : 'YYYY-MM-DD'          — inicio del rango
//   hasta     : 'YYYY-MM-DD'          — fin del rango
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

// ─── Labels de dominio ────────────────────────────────────────────────────────

const LICENSE_LABELS: Record<string, string> = {
  class_b: 'Clase B',
  professional: 'Clase Profesional',
  complement: 'Complemento',
  special_service: 'Servicio Especial',
};

const EXPENSE_LABELS: Record<string, string> = {
  fuel: 'Bencina',
  rent: 'Arriendo',
  cleaning: 'Aseo',
  materials: 'Materiales',
  other: 'Otros',
};

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
    const desde: string = body.desde ?? new Date().toISOString().slice(0, 10);
    const hasta: string = body.hasta ?? desde;
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

    // ── Pagos en el rango ────────────────────────────────────────────────────
    let paymentsQ = adminClient
      .from('payments')
      .select(
        `total_amount, type, payment_date,
         enrollments!inner(branch_id, license_group,
           students!inner(users!inner(first_names, paternal_last_name, rut)))`,
      )
      .eq('status', 'paid')
      .gte('payment_date', desde)
      .lte('payment_date', hasta)
      .order('payment_date', { ascending: true });

    if (branchId !== null) {
      paymentsQ = paymentsQ.eq('enrollments.branch_id', branchId);
    }

    const { data: rawPayments, error: payErr } = await paymentsQ;
    if (payErr) throw payErr;

    // ── Gastos en el rango ────────────────────────────────────────────────────
    let expQ = adminClient
      .from('expenses')
      .select('amount, category, date, description')
      .gte('date', desde)
      .lte('date', hasta)
      .order('date', { ascending: true });

    if (branchId !== null) {
      expQ = expQ.eq('branch_id', branchId);
    }

    const { data: rawExpenses, error: expErr } = await expQ;
    if (expErr) throw expErr;

    // ── Filtro adicional de payments por branch (PostgREST inner join) ────────
    const payments: PaymentRow[] = (rawPayments ?? [])
      .filter((p: any) => branchId === null || p.enrollments?.branch_id === branchId)
      .map((p: any) => ({
        date: p.payment_date ?? '',
        licenseGroup: p.enrollments?.license_group ?? 'other',
        amount: p.total_amount ?? 0,
        alumno: formatName(p.enrollments?.students?.users),
        rut: p.enrollments?.students?.users?.rut ?? '—',
        type: p.type ?? '—',
      }));

    const expenses: ExpenseRow[] = (rawExpenses ?? []).map((e: any) => ({
      date: e.date ?? '',
      category: e.category ?? 'other',
      amount: e.amount ?? 0,
      description: e.description ?? '—',
    }));

    // ── Cómputos ──────────────────────────────────────────────────────────────
    const totalIngresos = payments.reduce((s, p) => s + p.amount, 0);
    const totalGastos = expenses.reduce((s, e) => s + e.amount, 0);
    const totalNeto = totalIngresos - totalGastos;
    const margen = totalIngresos > 0 ? (totalNeto / totalIngresos) * 100 : 0;

    const ingresosCategoria = computeIngresosCategoria(payments, totalIngresos);
    const gastosCategoria = computeGastosCategoria(expenses, totalGastos);
    const evolucionMensual = computeEvolucionMensual(payments, expenses);
    const detalleDiario = computeDetalleDiario(payments, expenses);

    const reportData: ReportData = {
      desde,
      hasta,
      branchName,
      generatedBy,
      totalIngresos,
      totalGastos,
      totalNeto,
      margen,
      ingresosCategoria,
      gastosCategoria,
      evolucionMensual,
      detalleDiario,
      payments,
      expenses,
    };

    if (format === 'excel') {
      const payload = buildExcelPayload(reportData);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pdfBytes = buildPdf(reportData);
    const safeName = sanitize(
      `ReporteContable_${desde}_${hasta}${branchId !== null ? `_sede${branchId}` : ''}`,
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
    console.error('[generate-financial-report]', err);
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════════════════════════

interface PaymentRow {
  date: string;
  licenseGroup: string;
  amount: number;
  alumno: string;
  rut: string;
  type: string;
}

interface ExpenseRow {
  date: string;
  category: string;
  amount: number;
  description: string;
}

interface CategoriaIngreso {
  nombre: string;
  licenseGroup: string;
  monto: number;
  operaciones: number;
  porcentaje: number;
}

interface CategoriaGasto {
  nombre: string;
  category: string;
  monto: number;
  registros: number;
  porcentaje: number;
}

interface EvolucionMes {
  mes: string;
  ingresos: number;
  gastos: number;
  neto: number;
  margen: number;
}

interface DetalleDia {
  fecha: string;
  operaciones: number;
  ingresos: number;
  gastos: number;
  neto: number;
}

interface ReportData {
  desde: string;
  hasta: string;
  branchName: string;
  generatedBy: string;
  totalIngresos: number;
  totalGastos: number;
  totalNeto: number;
  margen: number;
  ingresosCategoria: CategoriaIngreso[];
  gastosCategoria: CategoriaGasto[];
  evolucionMensual: EvolucionMes[];
  detalleDiario: DetalleDia[];
  payments: PaymentRow[];
  expenses: ExpenseRow[];
}

// ══════════════════════════════════════════════════════════════════════════════
// Cómputos auxiliares
// ══════════════════════════════════════════════════════════════════════════════

function computeIngresosCategoria(payments: PaymentRow[], total: number): CategoriaIngreso[] {
  const map = new Map<string, { monto: number; ops: number }>();
  for (const p of payments) {
    const key = p.licenseGroup || 'other';
    const cur = map.get(key) ?? { monto: 0, ops: 0 };
    map.set(key, { monto: cur.monto + p.amount, ops: cur.ops + 1 });
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      nombre: LICENSE_LABELS[key] ?? key,
      licenseGroup: key,
      monto: v.monto,
      operaciones: v.ops,
      porcentaje: total > 0 ? (v.monto / total) * 100 : 0,
    }))
    .sort((a, b) => b.monto - a.monto);
}

function computeGastosCategoria(expenses: ExpenseRow[], total: number): CategoriaGasto[] {
  const map = new Map<string, { monto: number; regs: number }>();
  for (const e of expenses) {
    const key = e.category || 'other';
    const cur = map.get(key) ?? { monto: 0, regs: 0 };
    map.set(key, { monto: cur.monto + e.amount, regs: cur.regs + 1 });
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      nombre: EXPENSE_LABELS[key] ?? key,
      category: key,
      monto: v.monto,
      registros: v.regs,
      porcentaje: total > 0 ? (v.monto / total) * 100 : 0,
    }))
    .sort((a, b) => b.monto - a.monto);
}

function computeEvolucionMensual(payments: PaymentRow[], expenses: ExpenseRow[]): EvolucionMes[] {
  const months = new Map<string, { ing: number; gas: number }>();

  for (const p of payments) {
    const key = p.date.substring(0, 7); // YYYY-MM
    const cur = months.get(key) ?? { ing: 0, gas: 0 };
    months.set(key, { ...cur, ing: cur.ing + p.amount });
  }
  for (const e of expenses) {
    const key = e.date.substring(0, 7);
    const cur = months.get(key) ?? { ing: 0, gas: 0 };
    months.set(key, { ...cur, gas: cur.gas + e.amount });
  }

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      mes: formatMonthLabel(key),
      ingresos: v.ing,
      gastos: v.gas,
      neto: v.ing - v.gas,
      margen: v.ing > 0 ? ((v.ing - v.gas) / v.ing) * 100 : 0,
    }));
}

function computeDetalleDiario(payments: PaymentRow[], expenses: ExpenseRow[]): DetalleDia[] {
  const days = new Map<string, { ing: number; gas: number; ops: number }>();

  for (const p of payments) {
    const cur = days.get(p.date) ?? { ing: 0, gas: 0, ops: 0 };
    days.set(p.date, { ...cur, ing: cur.ing + p.amount, ops: cur.ops + 1 });
  }
  for (const e of expenses) {
    const cur = days.get(e.date) ?? { ing: 0, gas: 0, ops: 0 };
    days.set(e.date, { ...cur, gas: cur.gas + e.amount, ops: cur.ops + 1 });
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      fecha: formatDateCL(date),
      operaciones: v.ops,
      ingresos: v.ing,
      gastos: v.gas,
      neto: v.ing - v.gas,
    }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Excel payload builder
// ══════════════════════════════════════════════════════════════════════════════

interface ExcelPayload {
  sheetName: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}

function buildExcelPayload(d: ReportData): ExcelPayload {
  const rows: (string | number)[][] = [];

  // Encabezado
  rows.push(['REPORTE CONTABLE']);
  rows.push([`Período: ${formatDateCL(d.desde)} — ${formatDateCL(d.hasta)}`]);
  rows.push([`Sede: ${d.branchName}`]);
  rows.push([`Generado por: ${d.generatedBy}`]);
  rows.push([`Fecha de generación: ${formatDateTimeCL(new Date().toISOString())}`]);
  rows.push([]);

  // KPIs
  rows.push(['RESUMEN EJECUTIVO']);
  rows.push(['Concepto', 'Monto']);
  rows.push(['Total Ingresos', d.totalIngresos]);
  rows.push(['Total Gastos', d.totalGastos]);
  rows.push(['Total Neto (Ingresos - Gastos)', d.totalNeto]);
  rows.push([`Margen de Ganancia`, `${d.margen.toFixed(1)}%`]);
  rows.push([]);

  // Ingresos por categoría
  rows.push(['INGRESOS POR CATEGORÍA']);
  rows.push(['Categoría', 'Monto', 'Operaciones', '% del Total']);
  for (const cat of d.ingresosCategoria) {
    rows.push([cat.nombre, cat.monto, cat.operaciones, `${cat.porcentaje.toFixed(1)}%`]);
  }
  rows.push(['TOTAL INGRESOS', d.totalIngresos, d.payments.length, '100.0%']);
  rows.push([]);

  // Gastos por categoría
  rows.push(['GASTOS POR CATEGORÍA']);
  rows.push(['Categoría', 'Monto', 'Registros', '% del Total']);
  for (const cat of d.gastosCategoria) {
    rows.push([cat.nombre, cat.monto, cat.registros, `${cat.porcentaje.toFixed(1)}%`]);
  }
  rows.push(['TOTAL GASTOS', d.totalGastos, d.expenses.length, '100.0%']);
  rows.push([]);

  // Evolución mensual (solo si hay más de un mes)
  if (d.evolucionMensual.length > 1) {
    rows.push(['EVOLUCIÓN MENSUAL']);
    rows.push(['Mes', 'Ingresos', 'Gastos', 'Neto', 'Margen']);
    for (const row of d.evolucionMensual) {
      rows.push([row.mes, row.ingresos, row.gastos, row.neto, `${row.margen.toFixed(1)}%`]);
    }
    rows.push([]);
  }

  // Detalle diario
  if (d.detalleDiario.length > 0) {
    rows.push(['DETALLE DIARIO']);
    rows.push(['Fecha', 'Operaciones', 'Ingresos', 'Gastos', 'Neto']);
    for (const row of d.detalleDiario) {
      rows.push([row.fecha, row.operaciones, row.ingresos, row.gastos, row.neto]);
    }
    rows.push([
      'TOTALES',
      d.payments.length + d.expenses.length,
      d.totalIngresos,
      d.totalGastos,
      d.totalNeto,
    ]);
    rows.push([]);
  }

  // Detalle de pagos individuales
  if (d.payments.length > 0) {
    rows.push([`DETALLE DE PAGOS (${d.payments.length} registros)`]);
    rows.push(['Fecha', 'Alumno', 'RUT', 'Categoría', 'Tipo', 'Monto']);
    for (const p of d.payments) {
      rows.push([
        formatDateCL(p.date),
        p.alumno,
        p.rut,
        LICENSE_LABELS[p.licenseGroup] ?? p.licenseGroup,
        p.type,
        p.amount,
      ]);
    }
    rows.push(['', '', '', '', 'TOTAL', d.totalIngresos]);
    rows.push([]);
  }

  // Detalle de gastos individuales
  if (d.expenses.length > 0) {
    rows.push([`DETALLE DE GASTOS (${d.expenses.length} registros)`]);
    rows.push(['Fecha', 'Descripción', 'Categoría', 'Monto']);
    for (const e of d.expenses) {
      rows.push([
        formatDateCL(e.date),
        e.description,
        EXPENSE_LABELS[e.category] ?? e.category,
        e.amount,
      ]);
    }
    rows.push(['', 'TOTAL', '', d.totalGastos]);
  }

  const filename = `ReporteContable_${d.desde.replace(/-/g, '')}_${d.hasta.replace(/-/g, '')}`;
  return { sheetName: 'Reporte Contable', headers: [], rows, filename };
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
    rgb(0.13, 0.33, 0.68);
    R(0, PH - 56, PW, 56, true);
    ops.push('1 g 1 G');
    T(M, PH - 18, 'REPORTE CONTABLE', 13, true);
    T(M, PH - 30, `${data.branchName}`, 8);
    T(M, PH - 41, `Período: ${formatDateCL(data.desde)} — ${formatDateCL(data.hasta)}`, 7);
    T(
      M,
      PH - 51,
      `Generado por: ${data.generatedBy}  —  ${formatDateTimeCL(new Date().toISOString())}`,
      6,
    );
    black();
    y = TOP;
  }

  function drawContHeader(section: string) {
    gray(0.3);
    R(0, PH - 26, PW, 26, true);
    ops.push('1 g 1 G');
    T(M, PH - 16, `REPORTE CONTABLE — ${section} (continuación)`, 8, true);
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

  // ── 1. Primera página: cabecera + KPI boxes ───────────────────────────────
  drawHeader();
  y -= 20;

  const kpiW = (CW - 6) / 4;
  const kpiH = 52;
  const margenLabel = `${data.margen.toFixed(1)}%`;
  const netoLabel = data.totalNeto >= 0 ? clp(data.totalNeto) : `-${clp(Math.abs(data.totalNeto))}`;

  const kpiAccents: [number, number, number][] = [
    [0.18, 0.55, 0.32], // verde — ingresos
    [0.72, 0.18, 0.18], // rojo  — gastos
    [0.13, 0.33, 0.68], // azul  — neto
    [0.49, 0.23, 0.93], // morado— margen
  ];
  const kpis = [
    {
      label: 'Total Ingresos',
      value: clp(data.totalIngresos),
      sub: `${data.payments.length} operaciones`,
      accent: kpiAccents[0],
    },
    {
      label: 'Total Gastos',
      value: clp(data.totalGastos),
      sub: `${data.expenses.length} registros`,
      accent: kpiAccents[1],
    },
    { label: 'Total Neto', value: netoLabel, sub: 'Ingresos menos Gastos', accent: kpiAccents[2] },
    { label: 'Margen', value: margenLabel, sub: 'sobre ingresos totales', accent: kpiAccents[3] },
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

  y -= kpiH + 18;

  // ── 2. Ingresos por Categoría ─────────────────────────────────────────────
  if (data.ingresosCategoria.length > 0) {
    need(40, 'Ingresos');
    sectionBar(`Ingresos por Categoría (${data.ingresosCategoria.length} categorías)`);
    y -= 4;

    const iCols = [200, 115, 80, 120];
    const iHeaders = ['Categoría', 'Monto', 'Operaciones', '% del Total'];
    tblHeader(iCols, iHeaders);

    for (let i = 0; i < data.ingresosCategoria.length; i++) {
      need(14, 'Ingresos');
      if (y === TOP - 10) tblHeader(iCols, iHeaders);

      const cat = data.ingresosCategoria[i];
      if (i % 2 === 0) {
        gray(0.965);
        R(M, y - 12, CW, 14, true);
        black();
      }

      let xc = M;
      const cells = [
        cat.nombre,
        clp(cat.monto),
        String(cat.operaciones),
        `${cat.porcentaje.toFixed(1)}%`,
      ];
      for (let j = 0; j < cells.length; j++) {
        if (j === 1) {
          rgb(0.18, 0.55, 0.32);
          T(xc + 2, y - 9, cells[j], 6.5, true);
          black();
        } else T(xc + 2, y - 9, cells[j], 6.5);
        xc += iCols[j];
      }
      y -= 14;
    }

    L(M, y + 2, M + CW, y + 2);
    y -= 4;
    gray(0.92);
    R(M, y - 13, CW, 15, true);
    black();
    rgb(0.18, 0.55, 0.32);
    T(
      CW + M - 220,
      y - 9,
      `Total Ingresos: ${clp(data.totalIngresos)}  (${data.payments.length} operaciones)`,
      7.5,
      true,
    );
    black();
    y -= 22;
  }

  // ── 3. Gastos por Categoría ───────────────────────────────────────────────
  if (data.gastosCategoria.length > 0) {
    need(40, 'Gastos');
    y -= 4;
    sectionBar(`Gastos por Categoría (${data.gastosCategoria.length} categorías)`);
    y -= 4;

    const gCols = [200, 115, 80, 120];
    const gHeaders = ['Categoría', 'Monto', 'Registros', '% del Total'];
    tblHeader(gCols, gHeaders);

    for (let i = 0; i < data.gastosCategoria.length; i++) {
      need(14, 'Gastos');
      if (y === TOP - 10) tblHeader(gCols, gHeaders);

      const cat = data.gastosCategoria[i];
      if (i % 2 === 0) {
        gray(0.965);
        R(M, y - 12, CW, 14, true);
        black();
      }

      let xc = M;
      const cells = [
        cat.nombre,
        clp(cat.monto),
        String(cat.registros),
        `${cat.porcentaje.toFixed(1)}%`,
      ];
      for (let j = 0; j < cells.length; j++) {
        if (j === 1) {
          rgb(0.72, 0.18, 0.18);
          T(xc + 2, y - 9, cells[j], 6.5, true);
          black();
        } else T(xc + 2, y - 9, cells[j], 6.5);
        xc += gCols[j];
      }
      y -= 14;
    }

    L(M, y + 2, M + CW, y + 2);
    y -= 4;
    gray(0.92);
    R(M, y - 13, CW, 15, true);
    black();
    rgb(0.72, 0.18, 0.18);
    T(
      CW + M - 220,
      y - 9,
      `Total Gastos: ${clp(data.totalGastos)}  (${data.expenses.length} registros)`,
      7.5,
      true,
    );
    black();
    y -= 22;
  }

  // ── 4. Evolución Mensual (si hay más de un mes) ───────────────────────────
  if (data.evolucionMensual.length > 1) {
    need(40, 'Evolución');
    y -= 4;
    sectionBar('Evolución Mensual');
    y -= 4;

    const eCols = [130, 95, 95, 95, 100];
    const eHeaders = ['Mes', 'Ingresos', 'Gastos', 'Neto', 'Margen'];
    tblHeader(eCols, eHeaders);

    for (let i = 0; i < data.evolucionMensual.length; i++) {
      need(14, 'Evolución');
      if (y === TOP - 10) tblHeader(eCols, eHeaders);

      const row = data.evolucionMensual[i];
      if (i % 2 === 0) {
        gray(0.965);
        R(M, y - 12, CW, 14, true);
        black();
      }

      let xc = M;
      T(xc + 2, y - 9, row.mes, 6.5, true);
      xc += eCols[0];
      rgb(0.18, 0.55, 0.32);
      T(xc + 2, y - 9, clp(row.ingresos), 6.5);
      xc += eCols[1];
      black();
      rgb(0.72, 0.18, 0.18);
      T(xc + 2, y - 9, clp(row.gastos), 6.5);
      xc += eCols[2];
      black();
      rgb(0.13, 0.33, 0.68);
      T(xc + 2, y - 9, clp(row.neto), 6.5, true);
      xc += eCols[3];
      black();
      T(xc + 2, y - 9, `${row.margen.toFixed(1)}%`, 6.5);
      y -= 14;
    }

    L(M, y + 2, M + CW, y + 2);
    y -= 16;
  }

  // ── 5. Detalle Diario ─────────────────────────────────────────────────────
  if (data.detalleDiario.length > 0) {
    need(40, 'Detalle Diario');
    y -= 4;
    sectionBar(`Detalle Diario (${data.detalleDiario.length} días con movimientos)`);
    y -= 4;

    const dCols = [100, 70, 110, 110, 125];
    const dHeaders = ['Fecha', 'Operaciones', 'Ingresos', 'Gastos', 'Neto'];
    tblHeader(dCols, dHeaders);

    for (let i = 0; i < data.detalleDiario.length; i++) {
      need(14, 'Detalle');
      if (y === TOP - 10) tblHeader(dCols, dHeaders);

      const row = data.detalleDiario[i];
      if (i % 2 === 0) {
        gray(0.965);
        R(M, y - 12, CW, 14, true);
        black();
      }

      let xc = M;
      T(xc + 2, y - 9, row.fecha, 6.5);
      xc += dCols[0];
      T(xc + 2, y - 9, String(row.operaciones), 6.5);
      xc += dCols[1];
      rgb(0.18, 0.55, 0.32);
      T(xc + 2, y - 9, clp(row.ingresos), 6.5);
      xc += dCols[2];
      black();
      rgb(0.72, 0.18, 0.18);
      T(xc + 2, y - 9, clp(row.gastos), 6.5);
      xc += dCols[3];
      black();
      rgb(0.13, 0.33, 0.68);
      T(xc + 2, y - 9, clp(row.neto), 6.5, true);
      black();
      y -= 14;
    }

    L(M, y + 2, M + CW, y + 2);
    y -= 4;
    gray(0.92);
    R(M, y - 13, CW, 15, true);
    black();
    rgb(0.13, 0.33, 0.68);
    T(
      CW + M - 300,
      y - 9,
      `Total: ${clp(data.totalIngresos)} ingresos  —  ${clp(data.totalGastos)} gastos  —  Neto: ${clp(data.totalNeto)}`,
      7,
      true,
    );
    black();
    y -= 16;
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

function formatName(u: any): string {
  if (!u) return '—';
  return `${u.paternal_last_name ?? ''} ${u.first_names ?? ''}`.trim() || '—';
}

function pdfStr(s: string): string {
  return s
    .replace(/[   ⁠·]/g, ' ')
    .replace(/[   ]/g, ' ')
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

function formatDateTimeCL(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Santiago',
  });
}

function formatMonthLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
}

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 80);
}
