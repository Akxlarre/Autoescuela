// supabase/functions/generate-cash-history-report/index.ts
//
// Edge Function: generate-cash-history-report
//
// Genera un reporte mensual del Historial de Cuadraturas en formato PDF.
// Una fila por cierre de caja del mes. No almacena archivos.
//
// Body esperado:
//   month     : number (1–12)
//   year      : number (ej: 2026)
//   branch_id : number | null  — null = admin (todas las sedes)
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
    let branchName = 'Todas las escuelas';
    if (branchId !== null) {
      const { data: branch } = await adminClient
        .from('branches')
        .select('name')
        .eq('id', branchId)
        .single();
      if (branch) branchName = branch.name;
    }

    // ── Rango de fechas del mes ───────────────────────────────────────────────
    const mm = String(month).padStart(2, '0');
    const yyyy = String(year);
    const fechaInicio = `${yyyy}-${mm}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const fechaFin = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;

    // ── Query cash_closings del mes ───────────────────────────────────────────
    let q = adminClient
      .from('cash_closings')
      .select(
        `date, balance, arqueo_amount, difference, total_income, total_expenses,
         users(first_names, paternal_last_name)`,
      )
      .eq('closed', true)
      .gte('date', fechaInicio)
      .lte('date', fechaFin)
      .order('date', { ascending: true });

    if (branchId !== null) {
      q = q.eq('branch_id', branchId);
    }

    const { data: rawCierres, error: qErr } = await q;
    if (qErr) throw qErr;

    const FONDO_INICIAL = 50_000;

    const cierres: CierreRow[] = (rawCierres ?? []).map((r: any) => {
      const saldoSistema = r.balance ?? 0;
      const saldoFisico = r.arqueo_amount ?? 0;
      const diferencia = r.difference ?? saldoFisico - saldoSistema;
      const cajero = r.users
        ? `${r.users.first_names ?? ''} ${r.users.paternal_last_name ?? ''}`.trim()
        : '—';
      const estado: 'Cuadrado' | 'Sobrante' | 'Faltante' =
        diferencia === 0 ? 'Cuadrado' : diferencia > 0 ? 'Sobrante' : 'Faltante';

      return {
        fecha: r.date,
        cajero,
        fondoInicial: FONDO_INICIAL,
        totalIngresos: r.total_income ?? 0,
        totalEgresos: r.total_expenses ?? 0,
        saldoSistema,
        saldoFisico,
        diferencia,
        estado,
      };
    });

    const totalIngresosMes = cierres.reduce((s, c) => s + c.totalIngresos, 0);
    const totalEgresosMes = cierres.reduce((s, c) => s + c.totalEgresos, 0);
    const diasCuadrados = cierres.filter((c) => c.estado === 'Cuadrado').length;

    const reportData: ReportData = {
      month,
      year,
      branchName,
      generatedBy,
      cierres,
      totalIngresosMes,
      totalEgresosMes,
      diasCuadrados,
    };

    const pdfBytes = buildPdf(reportData);
    const safeName = sanitize(
      `Historial_Cuadraturas_${yyyy}-${mm}${branchId !== null ? `_sede${branchId}` : ''}`,
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
    console.error('[generate-cash-history-report]', err);
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════════════════════════

interface CierreRow {
  fecha: string;
  cajero: string;
  fondoInicial: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoSistema: number;
  saldoFisico: number;
  diferencia: number;
  estado: 'Cuadrado' | 'Sobrante' | 'Faltante';
}

interface ReportData {
  month: number;
  year: number;
  branchName: string;
  generatedBy: string;
  cierres: CierreRow[];
  totalIngresosMes: number;
  totalEgresosMes: number;
  diasCuadrados: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF Builder
// ══════════════════════════════════════════════════════════════════════════════

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

function buildPdf(data: ReportData): Uint8Array {
  const PW = 595;
  const PH = 842;
  const M = 40;
  const CW = 515;
  const TOP = 800;
  const MIN_Y = 60;

  const mesLabel = `${MESES[data.month - 1]} ${data.year}`;

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
    T(PW - M - 60, 26, `Pagina ${pNum}`, 6, true);
    black();
  }

  function drawHeader() {
    rgb(0.13, 0.33, 0.68);
    R(0, PH - 52, PW, 52, true);
    ops.push('1 g 1 G');
    T(M, PH - 20, 'HISTORIAL DE CUADRATURAS', 13, true);
    T(M, PH - 33, `${data.branchName}  —  ${mesLabel}`, 8);
    T(M, PH - 44, `${data.cierres.length} cierres registrados en el mes`, 7);
    T(PW - M - 140, PH - 30, `Generado por: ${data.generatedBy}`, 6);
    T(PW - M - 140, PH - 40, `Fecha: ${formatDateTimeCL(new Date().toISOString())}`, 6);
    black();
    y = TOP;
  }

  function drawContHeader() {
    gray(0.3);
    R(0, PH - 26, PW, 26, true);
    ops.push('1 g 1 G');
    T(M, PH - 16, `HISTORIAL DE CUADRATURAS — ${mesLabel} (continuacion)`, 8, true);
    T(PW - M - 80, PH - 16, data.branchName, 7);
    black();
    y = TOP - 10;
  }

  function newPage() {
    drawFooter(pageNum);
    pages.push(ops.join('\n'));
    ops = [];
    pageNum++;
    drawContHeader();
  }

  function need(h: number) {
    if (y - h < MIN_Y) newPage();
  }

  // ── 1. Primera página: cabecera + KPIs ──────────────────────────────────────
  drawHeader();
  y -= 20;

  // KPI boxes (4: días totales, días cuadrados, ingresos mes, egresos mes)
  const kpiW = (CW - 6) / 4;
  const kpiH = 52;
  const kpis = [
    {
      label: 'Dias con Cierre',
      value: String(data.cierres.length),
      sub: 'en el mes',
      accent: [0.13, 0.33, 0.68] as [number, number, number],
    },
    {
      label: 'Dias Cuadrados',
      value: `${data.diasCuadrados} / ${data.cierres.length}`,
      sub: 'sin diferencia',
      accent: [0.18, 0.55, 0.32] as [number, number, number],
    },
    {
      label: 'Total Ingresos',
      value: clp(data.totalIngresosMes),
      sub: 'acumulado del mes',
      accent: [0.38, 0.18, 0.65] as [number, number, number],
    },
    {
      label: 'Total Egresos',
      value: clp(data.totalEgresosMes),
      sub: 'acumulado del mes',
      accent: [0.72, 0.4, 0.08] as [number, number, number],
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

  y -= kpiH + 18;

  // ── 2. Tabla de cierres ──────────────────────────────────────────────────────
  // Cabecera de sección
  gray(0.18);
  R(M, y - 14, CW, 16, true);
  ops.push('1 g 1 G');
  T(M + 4, y - 9, 'DETALLE DE CIERRES DEL MES', 8, true);
  black();
  y -= 16;
  y -= 4;

  // Anchos de columnas (suma = CW = 515)
  const cols = [58, 110, 70, 70, 70, 70, 67];
  const headers = ['Fecha', 'Cajero', 'Ingresos', 'Egresos', 'Saldo Sist.', 'Saldo Fis.', 'Estado'];

  function drawTableHeader() {
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

  drawTableHeader();

  if (data.cierres.length === 0) {
    need(20);
    gray(0.6);
    T(M + 4, y - 12, 'No se registraron cierres de caja en este mes.', 8);
    black();
    y -= 20;
  } else {
    for (let i = 0; i < data.cierres.length; i++) {
      need(14);
      if (y === TOP - 10) drawTableHeader();

      const c = data.cierres[i];

      if (i % 2 === 0) {
        gray(0.965);
        R(M, y - 12, CW, 14, true);
        black();
      }

      const estadoColor: [number, number, number] =
        c.estado === 'Cuadrado'
          ? [0.18, 0.55, 0.32]
          : c.estado === 'Sobrante'
            ? [0.72, 0.4, 0.08]
            : [0.72, 0.18, 0.18];

      const cells = [
        formatDateCL(c.fecha),
        truncate(c.cajero, 18),
        clp(c.totalIngresos),
        clp(c.totalEgresos),
        clp(c.saldoSistema),
        clp(c.saldoFisico),
      ];

      let xc = M;
      for (let j = 0; j < cells.length; j++) {
        T(xc + 2, y - 9, cells[j], 6.5);
        xc += cols[j];
      }

      // Estado con color
      ops.push(`${estadoColor[0]} ${estadoColor[1]} ${estadoColor[2]} rg`);
      T(xc + 2, y - 9, c.estado, 6.5, true);
      black();

      y -= 14;
    }

    L(M, y + 2, M + CW, y + 2);
    y -= 4;

    // Fila de totales
    gray(0.92);
    R(M, y - 13, CW, 15, true);
    black();
    rgb(0.13, 0.33, 0.68);
    T(M + 4, y - 9, `TOTALES DEL MES`, 7, true);
    T(M + cols[0] + cols[1] + 2, y - 9, clp(data.totalIngresosMes), 7, true);
    T(M + cols[0] + cols[1] + cols[2] + 2, y - 9, clp(data.totalEgresosMes), 7, true);
    black();
    y -= 16;
  }

  drawFooter(pageNum);
  pages.push(ops.join('\n'));

  return assembleMultiPagePdf(pages, PW, PH);
}

// ══════════════════════════════════════════════════════════════════════════════
// Ensamblador PDF multi-página (idéntico al de generate-cash-closing-report)
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

function pdfStr(s: string): string {
  return s
    .replace(/[\t\r\n]/g, ' ')
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
