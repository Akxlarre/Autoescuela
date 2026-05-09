// supabase/functions/generate-payroll-report/index.ts
//
// Edge Function: generate-payroll-report
//
// Genera un Reporte de Nómina de Instructores en formato Excel (JSON payload)
// o PDF multi-página. No almacena archivos — retorna binario/JSON directamente.
//
// Body esperado:
//   format    : 'excel' | 'pdf'
//   month     : number (1-12)
//   year      : number (ej: 2026)
//   branch_id : number | null  — sede; null = admin (todas las sedes sin filtro)
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

// ─── Helpers de formato ───────────────────────────────────────────────────────

function clp(n: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
}

function padNum(n: number): string {
  return String(n).padStart(2, '0');
}

function monthLabel(month: number, year: number): string {
  const MESES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  return `${MESES[month - 1]} ${year}`;
}

function pdfStr(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, (c) => {
      const cp = c.codePointAt(0)!;
      if (cp > 0xffff) return '?';
      const WIN_ANSI: Record<number, number> = {
        0xe1: 0xe1,
        0xe9: 0xe9,
        0xed: 0xed,
        0xf3: 0xf3,
        0xfa: 0xfa,
        0xc1: 0xc1,
        0xc9: 0xc9,
        0xcd: 0xcd,
        0xd3: 0xd3,
        0xda: 0xda,
        0xf1: 0xf1,
        0xd1: 0xd1,
        0xfc: 0xfc,
        0xdc: 0xdc,
        0xbf: 0xbf,
        0xa1: 0xa1,
      };
      if (WIN_ANSI[cp]) return `\\${WIN_ANSI[cp].toString(8)}`;
      // Fallbacks para guiones tipográficos
      if (cp === 0x2014 || cp === 0x2013) return '-';
      return '-';
    });
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LiqRow {
  instructorId: number;
  nombre: string;
  rut: string;
  totalHours: number;
  amountPerHour: number;
  totalBaseAmount: number;
  totalAdvances: number;
  finalPaymentAmount: number;
  status: 'paid' | 'pending';
  paymentDate: string | null;
}

interface ReportData {
  month: number;
  year: number;
  branchName: string;
  generatedBy: string;
  rows: LiqRow[];
  totalNomina: number;
  totalAnticipos: number;
  totalAPagar: number;
  totalPagados: number;
  totalPendientes: number;
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
    const month: number = body.month ?? new Date().getMonth() + 1;
    const year: number = body.year ?? new Date().getFullYear();
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
    let branchName = 'Todas las sedes';
    if (branchId !== null) {
      const { data: branch } = await adminClient
        .from('branches')
        .select('name')
        .eq('id', branchId)
        .single();
      if (branch) branchName = branch.name;
    }

    // ── Rango de fechas del mes ───────────────────────────────────────────────
    const mm = padNum(month);
    const lastDay = new Date(year, month, 0).getDate();
    const fechaInicio = `${year}-${mm}-01`;
    const fechaFin = `${year}-${mm}-${padNum(lastDay)}`;
    const period = `${year}-${mm}`;

    // ── Queries en paralelo ───────────────────────────────────────────────────
    const [instrRes, hoursRes, advancesRes, paymentsRes] = await Promise.all([
      adminClient
        .from('instructors')
        .select('id, users(id, first_names, paternal_last_name, rut, branch_id)'),
      adminClient
        .from('instructor_monthly_hours')
        .select('instructor_id, total_equivalent')
        .eq('period', period),
      adminClient
        .from('instructor_advances')
        .select('instructor_id, amount')
        .gte('date', fechaInicio)
        .lte('date', fechaFin),
      adminClient
        .from('instructor_monthly_payments')
        .select('instructor_id, payment_status, paid_at, amount_per_hour')
        .eq('period', period),
    ]);

    if (instrRes.error) throw instrRes.error;

    // ── Maps O(1) ─────────────────────────────────────────────────────────────
    const hoursMap = new Map<number, number>(
      (hoursRes.data ?? []).map((h: any) => [h.instructor_id, h.total_equivalent ?? 0]),
    );
    const advancesMap = new Map<number, number>();
    for (const adv of advancesRes.data ?? []) {
      advancesMap.set(adv.instructor_id, (advancesMap.get(adv.instructor_id) ?? 0) + adv.amount);
    }
    const paymentsMap = new Map<number, any>(
      (paymentsRes.data ?? []).map((p: any) => [p.instructor_id, p]),
    );

    // ── Construir rows ────────────────────────────────────────────────────────
    const AMOUNT_DEFAULT = 5_000;

    const rows: LiqRow[] = (instrRes.data ?? [])
      .filter((instr: any) => {
        const u = Array.isArray(instr.users) ? instr.users[0] : instr.users;
        if (branchId !== null && u?.branch_id !== branchId) return false;
        const hours = hoursMap.get(instr.id) ?? 0;
        const advances = advancesMap.get(instr.id) ?? 0;
        const payment = paymentsMap.get(instr.id);
        return hours > 0 || advances > 0 || !!payment;
      })
      .map((instr: any) => {
        const rawU = instr.users;
        const u = Array.isArray(rawU) ? rawU[0] : rawU;
        const nombre = `${u?.first_names ?? ''} ${u?.paternal_last_name ?? ''}`.trim() || '—';
        const totalHours = hoursMap.get(instr.id) ?? 0;
        const totalAdvances = advancesMap.get(instr.id) ?? 0;
        const payment = paymentsMap.get(instr.id);
        const amountPerHour = payment?.amount_per_hour ?? AMOUNT_DEFAULT;
        const totalBaseAmount = totalHours * amountPerHour;
        const finalPaymentAmount = Math.max(0, totalBaseAmount - totalAdvances);
        return {
          instructorId: instr.id,
          nombre,
          rut: u?.rut ?? '—',
          totalHours,
          amountPerHour,
          totalBaseAmount,
          totalAdvances,
          finalPaymentAmount,
          status: payment?.payment_status === 'paid' ? 'paid' : 'pending',
          paymentDate: payment?.paid_at ?? null,
        } as LiqRow;
      })
      .sort((a: LiqRow, b: LiqRow) => a.nombre.localeCompare(b.nombre));

    const totalNomina = rows.reduce((s, r) => s + r.totalBaseAmount, 0);
    const totalAnticipos = rows.reduce((s, r) => s + r.totalAdvances, 0);
    const totalAPagar = rows.reduce((s, r) => s + r.finalPaymentAmount, 0);
    const totalPagados = rows.filter((r) => r.status === 'paid').length;
    const totalPendientes = rows.filter((r) => r.status === 'pending').length;

    const reportData: ReportData = {
      month,
      year,
      branchName,
      generatedBy,
      rows,
      totalNomina,
      totalAnticipos,
      totalAPagar,
      totalPagados,
      totalPendientes,
    };

    if (format === 'excel') {
      const payload = buildExcelPayload(reportData);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pdfBytes = buildPdf(reportData);
    const safeName = sanitize(`Nomina_${year}${mm}${branchId !== null ? `_sede${branchId}` : ''}`);
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[generate-payroll-report]', err);
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Excel payload builder
// ══════════════════════════════════════════════════════════════════════════════

function buildExcelPayload(d: ReportData) {
  const rows: (string | number)[][] = [];
  const periodo = monthLabel(d.month, d.year);

  rows.push(['NÓMINA DE INSTRUCTORES']);
  rows.push([`Período: ${periodo}`]);
  rows.push([`Sede: ${d.branchName}`]);
  rows.push([`Generado por: ${d.generatedBy}`]);
  rows.push([`Fecha de generación: ${new Date().toLocaleString('es-CL')}`]);
  rows.push([]);

  rows.push(['RESUMEN']);
  rows.push(['Concepto', 'Valor']);
  rows.push(['Total Instructores en nómina', d.rows.length]);
  rows.push(['Total Nómina Bruta', d.totalNomina]);
  rows.push(['Total Anticipos a Descontar', d.totalAnticipos]);
  rows.push(['Total a Pagar (Neto)', d.totalAPagar]);
  rows.push(['Instructores Pagados', d.totalPagados]);
  rows.push(['Instructores Pendientes', d.totalPendientes]);
  rows.push([]);

  rows.push(['DETALLE POR INSTRUCTOR']);
  rows.push([
    'Instructor',
    'RUT',
    'Horas Realizadas',
    'Valor Hora',
    'Base (Ganado)',
    'Anticipos (Descuento)',
    'Total a Pagar',
    'Estado',
    'Fecha Pago',
  ]);

  for (const r of d.rows) {
    rows.push([
      r.nombre,
      r.rut,
      r.totalHours,
      r.amountPerHour,
      r.totalBaseAmount,
      r.totalAdvances,
      r.finalPaymentAmount,
      r.status === 'paid' ? 'Pagado' : 'Pendiente',
      r.paymentDate ? new Date(r.paymentDate).toLocaleDateString('es-CL') : '—',
    ]);
  }

  rows.push([
    'TOTALES',
    '',
    d.rows.reduce((s, r) => s + r.totalHours, 0),
    '',
    d.totalNomina,
    d.totalAnticipos,
    d.totalAPagar,
    `${d.totalPagados} pagados / ${d.totalPendientes} pendientes`,
    '',
  ]);

  const mm = padNum(d.month);
  return {
    sheetName: 'Nómina Instructores',
    headers: [],
    rows,
    filename: `Nomina_${d.year}${mm}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF Builder (raw PDF without external deps)
// ══════════════════════════════════════════════════════════════════════════════

function buildPdf(data: ReportData): Uint8Array {
  const PW = 595;
  const PH = 842;
  const M = 40;
  const CW = PW - M * 2;
  const TOP = 768; // inicia el contenido 24px bajo la barra azul de 50px (PH-50=792)
  const MIN_Y = 55;

  const pages: string[] = [];
  let ops: string[] = [];
  let y = TOP;
  let pageNum = 1;

  // Primitivas de dibujo
  const T = (x: number, yp: number, s: string, sz: number, bold = false) =>
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${sz} Tf ${x} ${yp} Td (${pdfStr(s)}) Tj ET`);
  const L = (x1: number, y1: number, x2: number, y2: number) =>
    ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  const R = (x: number, yp: number, w: number, h: number, fill = false) =>
    ops.push(`${x} ${yp} ${w} ${h} re ${fill ? 'f' : 'S'}`);
  const setColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
  };
  const resetColor = () => ops.push('0 0 0 rg 0 0 0 RG');

  function newPage() {
    pages.push(ops.join('\n'));
    ops = [];
    y = TOP;
    pageNum++;
    drawPageHeader();
  }

  function checkY(needed: number) {
    if (y - needed < MIN_Y) newPage();
  }

  function drawPageHeader() {
    // Barra azul superior
    setColor('#1e6fbf');
    R(0, PH - 50, PW, 50, true);
    resetColor();
    ops.push('1 1 1 rg');
    T(M, PH - 32, 'NÓMINA DE INSTRUCTORES', 13, true);
    T(PW - M - 120, PH - 32, `Página ${pageNum}`, 9);
    resetColor();
  }

  // ── Página 1: encabezado ampliado ─────────────────────────────────────────
  drawPageHeader();

  // Título y meta
  y -= 10;
  T(M, y, `Período: ${monthLabel(data.month, data.year)}`, 11, true);
  y -= 18;
  T(M, y, `Sede: ${data.branchName}`, 10);
  y -= 15;
  T(M, y, `Generado por: ${data.generatedBy}`, 10);
  y -= 15;
  T(M, y, `Fecha: ${new Date().toLocaleDateString('es-CL')}`, 9);
  y -= 20;

  L(M, y, M + CW, y);
  y -= 15;

  // ── KPI boxes (4 cajas) ───────────────────────────────────────────────────
  const boxW = (CW - 15) / 4;
  const boxH = 60;
  const kpiData = [
    { label: 'TOTAL NOMINA', value: clp(data.totalNomina), color: '#1e6fbf' },
    { label: 'ANTICIPOS', value: clp(data.totalAnticipos), color: '#ef4444' },
    { label: 'TOTAL A PAGAR', value: clp(data.totalAPagar), color: '#16a34a' },
    { label: 'INSTRUCTORES', value: `${data.rows.length} total`, color: '#7c3aed' },
  ];
  kpiData.forEach((k, i) => {
    const bx = M + i * (boxW + 5);
    const by = y - boxH;
    setColor(k.color);
    R(bx, by, boxW, boxH, false);
    ops.push('0.95 0.95 0.95 rg');
    R(bx + 1, by + 1, boxW - 2, boxH - 2, true);
    resetColor();
    setColor(k.color);
    T(bx + 8, by + boxH - 18, k.label, 7, true);
    T(bx + 8, by + 12, k.value, 11, true);
    resetColor();
  });
  y -= boxH + 20;

  // Progreso pagados/pendientes
  const pct = data.rows.length > 0 ? (data.totalPagados / data.rows.length) * 100 : 0;
  T(
    M,
    y,
    `Progreso: ${data.totalPagados} pagados / ${data.totalPendientes} pendientes (${pct.toFixed(1)}%)`,
    9,
  );
  y -= 25;

  L(M, y, M + CW, y);
  y -= 18;

  // ── Tabla de instructores ──────────────────────────────────────────────────
  // Cabecera: primero dibuja el rect azul, luego pone texto blanco encima
  setColor('#1e6fbf');
  R(M, y - 14, CW, 16, true);

  // Columnas distribuidas en CW=515 (M=40, tabla termina en x=555)
  // nombre(110) + rut(76) + horas(38) + base(68) + anticipos(68) + total(68) + estado(68) = 496 + 4 offset = ok
  const cols = {
    nombre: { x: M + 4, w: 110 },
    rut: { x: M + 118, w: 76 },
    horas: { x: M + 197, w: 38 },
    base: { x: M + 238, w: 68 },
    anticipos: { x: M + 309, w: 68 },
    total: { x: M + 380, w: 68 },
    estado: { x: M + 451, w: 64 }, // termina en 40+451+64=555 = M+CW ✓
  };

  ops.push('1 1 1 rg'); // texto blanco sobre fondo azul
  T(cols.nombre.x, y - 11, 'INSTRUCTOR', 7, true);
  T(cols.rut.x, y - 11, 'RUT', 7, true);
  T(cols.horas.x, y - 11, 'HRS', 7, true);
  T(cols.base.x, y - 11, 'BASE (GANADO)', 7, true);
  T(cols.anticipos.x, y - 11, 'ANTICIPOS', 7, true);
  T(cols.total.x, y - 11, 'A PAGAR', 7, true);
  T(cols.estado.x, y - 11, 'ESTADO', 7, true);
  resetColor();

  y -= 18;

  // Filas
  let rowAlt = false;
  for (const row of data.rows) {
    checkY(18);
    if (rowAlt) {
      ops.push('0.97 0.97 0.97 rg');
      R(M, y - 12, CW, 16, true);
      resetColor();
    }
    rowAlt = !rowAlt;

    const maxNombre = row.nombre.length > 20 ? row.nombre.slice(0, 19) + '.' : row.nombre;
    T(cols.nombre.x, y - 10, maxNombre, 8);
    T(cols.rut.x, y - 10, row.rut, 8);
    T(cols.horas.x, y - 10, String(row.totalHours), 8);
    T(cols.base.x, y - 10, clp(row.totalBaseAmount), 8);

    if (row.totalAdvances > 0) {
      setColor('#ef4444');
      T(cols.anticipos.x, y - 10, clp(row.totalAdvances), 8);
      resetColor();
    } else {
      T(cols.anticipos.x, y - 10, '—', 8);
    }

    setColor(row.status === 'paid' ? '#16a34a' : '#d97706');
    T(cols.total.x, y - 10, clp(row.finalPaymentAmount), 8, true);

    const estadoLabel = row.status === 'paid' ? 'Pagado' : 'Pendiente';
    T(cols.estado.x, y - 10, estadoLabel, 8, true);
    resetColor();

    y -= 16;
  }

  // Fila de totales
  checkY(22);
  y -= 6;
  L(M, y, M + CW, y);
  y -= 4;

  setColor('#1e3a5f');
  ops.push('0.9 0.94 0.98 rg');
  R(M, y - 14, CW, 16, true);
  resetColor();
  ops.push('0.1 0.22 0.38 rg');
  T(cols.nombre.x, y - 10, `TOTALES (${data.rows.length} instructores)`, 8, true);
  T(cols.horas.x, y - 10, String(data.rows.reduce((s, r) => s + r.totalHours, 0)), 8, true);
  T(cols.base.x, y - 10, clp(data.totalNomina), 8, true);
  T(cols.anticipos.x, y - 10, clp(data.totalAnticipos), 8, true);
  T(cols.total.x, y - 10, clp(data.totalAPagar), 8, true);
  resetColor();

  // Volcar última página
  pages.push(ops.join('\n'));

  // ── Ensamblar PDF ─────────────────────────────────────────────────────────
  const enc = new TextEncoder();
  const fonts = '<</Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding>>';
  const fontsB =
    '<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding>>';

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  let offset = body.length;

  const addObj = (n: number, content: string) => {
    offsets[n] = offset;
    const chunk = `${n} 0 obj\n${content}\nendobj\n`;
    body += chunk;
    offset += enc.encode(chunk).length;
  };

  addObj(1, '<</Type /Catalog /Pages 2 0 R>>');
  addObj(
    2,
    `<</Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length}>>`,
  );
  addObj(3, `<</Font <</F1 5 0 R /F2 6 0 R>>>>`);
  addObj(4, ''); // placeholder

  // Font objects
  const fontObjStart = 5;
  offsets[fontObjStart] = offset;
  const f1chunk = `${fontObjStart} 0 obj\n${fonts}\nendobj\n`;
  body += f1chunk;
  offset += enc.encode(f1chunk).length;

  offsets[fontObjStart + 1] = offset;
  const f2chunk = `${fontObjStart + 1} 0 obj\n${fontsB}\nendobj\n`;
  body += f2chunk;
  offset += enc.encode(f2chunk).length;

  let objIdx = fontObjStart + 2;
  const pageObjIds: number[] = [];

  for (const pageOps of pages) {
    const streamBytes = enc.encode(pageOps);
    const streamObjId = objIdx++;
    const pageObjId = objIdx++;
    pageObjIds.push(pageObjId);

    offsets[streamObjId] = offset;
    const streamChunk = `${streamObjId} 0 obj\n<</Length ${streamBytes.length}>>\nstream\n${pageOps}\nendstream\nendobj\n`;
    body += streamChunk;
    offset += enc.encode(streamChunk).length;

    offsets[pageObjId] = offset;
    const pageChunk = `${pageObjId} 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Contents ${streamObjId} 0 R /Resources 3 0 R>>\nendobj\n`;
    body += pageChunk;
    offset += enc.encode(pageChunk).length;
  }

  // Rewrite page tree
  const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  const newPages = `<</Type /Pages /Kids [${kidsStr}] /Count ${pages.length}>>`;
  // Fix obj 2
  body = body.replace(/2 0 obj\n.*?\nendobj\n/s, `2 0 obj\n${newPages}\nendobj\n`);

  const xrefOffset = offset;
  const maxObj = Math.max(...Object.keys(offsets).map(Number));
  let xref = `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxObj; i++) {
    xref +=
      offsets[i] !== undefined
        ? `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
        : '0000000000 65535 f \n';
  }
  body += `${xref}trailer\n<</Size ${maxObj + 1} /Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return enc.encode(body);
}
