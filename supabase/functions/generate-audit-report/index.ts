// supabase/functions/generate-audit-report/index.ts
//
// Edge Function: generate-audit-report
//
// Genera un Reporte de Log de Auditoría en formato Excel (JSON payload)
// o PDF multi-página. No almacena archivos — retorna binario/JSON directamente.
//
// Body esperado:
//   format       : 'excel' | 'pdf'
//   branch_id    : number | null  — null = admin (todas las sedes)
//   fecha_desde  : string | null  — 'YYYY-MM-DD'
//   fecha_hasta  : string | null  — 'YYYY-MM-DD'
//   secretaria_id: number | null
//   accion       : 'Crear' | 'Actualizar' | 'Eliminar' | null  — label UI
//   modulo       : string | null  — label UI (ej. 'Usuarios', 'Pagos')
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

// ─── Mapeos (espejo de audit-log-row.model.ts) ────────────────────────────────

const ACTION_LABEL_MAP: Record<string, string> = {
  INSERT: 'Crear',
  UPDATE: 'Actualizar',
  DELETE: 'Eliminar',
};

const ENTITY_MODULE_MAP: Record<string, string> = {
  users: 'Usuarios',
  enrollments: 'Matrículas',
  class_b_sessions: 'Agenda',
  class_b_theory_sessions: 'Agenda',
  payments: 'Pagos',
  students: 'Alumnos',
  student_documents: 'Alumnos',
  promotion_courses: 'Clase Profesional',
  professional_theory_sessions: 'Clase Profesional',
  professional_practice_sessions: 'Clase Profesional',
  professional_module_grades: 'Clase Profesional',
  class_book: 'Libro de Clases',
  vehicles: 'Flota',
  vehicle_documents: 'Flota',
  maintenance_records: 'Flota',
  certificates: 'Certificación',
};

const KNOWN_ENTITIES = Object.keys(ENTITY_MODULE_MAP);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pdfStr(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, (c) => {
      const cp = c.codePointAt(0)!;
      if (cp > 0xffff) return '-';
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
      return '-';
    });
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-CL', { timeZone: 'America/Santiago' });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
}

function padNum(n: number): string {
  return String(n).padStart(2, '0');
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AuditRow {
  fechaHora: string;
  usuarioNombre: string;
  usuarioEmail: string;
  accion: string;
  modulo: string;
  detalle: string;
  ip: string;
}

interface ReportData {
  rows: AuditRow[];
  branchName: string;
  generatedBy: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  totalRows: number;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

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
    const branchId: number | null = body.branch_id ?? null;
    const fechaDesde: string | null = body.fecha_desde ?? null;
    const fechaHasta: string | null = body.fecha_hasta ?? null;
    const secretariaId: number | null = body.secretaria_id ?? null;
    const accionLabel: string | null = body.accion ?? null;
    const moduloLabel: string | null = body.modulo ?? null;

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

    // ── Paso 1: obtener IDs de secretarias (evita filtros en joins anidados) ───
    let usersQuery = adminClient
      .from('users')
      .select('id, first_names, paternal_last_name, email, roles!inner(name)')
      .eq('roles.name', 'secretary');

    if (branchId !== null) usersQuery = usersQuery.eq('branch_id', branchId);
    if (secretariaId !== null) usersQuery = usersQuery.eq('id', secretariaId);

    const { data: secretaryUsers, error: usersError } = await usersQuery;
    if (usersError) throw usersError;

    const secretaryUserIds: number[] = (secretaryUsers ?? []).map((u: any) => u.id);
    const usersMap = new Map(
      (secretaryUsers ?? []).map((u: any) => [
        u.id,
        { nombre: `${u.first_names} ${u.paternal_last_name}`, email: u.email },
      ]),
    );

    // ── Paso 2: query audit_log filtrando por user_ids conocidos ─────────────
    let query = adminClient
      .from('audit_log')
      .select('id, action, entity, detail, ip, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (secretaryUserIds.length > 0) {
      query = query.in('user_id', secretaryUserIds);
    } else {
      // Sin secretarias → resultado vacío
      query = query.eq('user_id', -1);
    }

    if (fechaDesde) query = query.gte('created_at', `${fechaDesde}T00:00:00`);
    if (fechaHasta) query = query.lte('created_at', `${fechaHasta}T23:59:59`);

    if (accionLabel) {
      const pgOp = Object.entries(ACTION_LABEL_MAP).find(([, v]) => v === accionLabel)?.[0];
      if (pgOp) query = query.eq('action', pgOp);
    }

    if (moduloLabel) {
      if (moduloLabel === 'Otros') {
        query = query.not('entity', 'in', `(${KNOWN_ENTITIES.join(',')})`);
      } else {
        const entities = Object.entries(ENTITY_MODULE_MAP)
          .filter(([, mod]) => mod === moduloLabel)
          .map(([entity]) => entity);
        if (entities.length > 0) query = query.in('entity', entities);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    // ── Mapear filas ──────────────────────────────────────────────────────────
    const rows: AuditRow[] = (data ?? []).map((raw: any) => {
      const u = usersMap.get(raw.user_id);
      return {
        fechaHora: raw.created_at,
        usuarioNombre: u?.nombre ?? '-',
        usuarioEmail: u?.email ?? '-',
        accion: ACTION_LABEL_MAP[raw.action] ?? raw.action,
        modulo: ENTITY_MODULE_MAP[raw.entity] ?? raw.entity ?? '-',
        detalle: raw.detail ?? '-',
        ip: raw.ip ?? '-',
      };
    });

    const reportData: ReportData = {
      rows,
      branchName,
      generatedBy,
      fechaDesde,
      fechaHasta,
      totalRows: rows.length,
    };

    if (format === 'excel') {
      const payload = buildExcelPayload(reportData);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const pdfBytes = buildPdf(reportData);
    const safeName = sanitize(`Auditoria_${today}${branchId !== null ? `_sede${branchId}` : ''}`);
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[generate-audit-report]', err);
    return jsonError(err instanceof Error ? err.message : 'Error interno', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Excel payload builder
// ══════════════════════════════════════════════════════════════════════════════

function buildExcelPayload(d: ReportData) {
  const rows: (string | number)[][] = [];
  const today = new Date().toLocaleDateString('es-CL');

  rows.push(['LOG DE AUDITORÍA']);
  rows.push([`Sede: ${d.branchName}`]);
  if (d.fechaDesde || d.fechaHasta) {
    rows.push([`Período: ${d.fechaDesde ?? 'Inicio'} al ${d.fechaHasta ?? 'Hoy'}`]);
  } else {
    rows.push(['Período: Todos los registros']);
  }
  rows.push([`Generado por: ${d.generatedBy}`]);
  rows.push([`Fecha de generación: ${today}`]);
  rows.push([`Total registros: ${d.totalRows}`]);
  rows.push([]);

  rows.push(['Fecha/Hora', 'Usuario', 'Email', 'Acción', 'Módulo', 'Detalle', 'IP']);

  for (const r of d.rows) {
    rows.push([
      formatDate(r.fechaHora),
      r.usuarioNombre,
      r.usuarioEmail,
      r.accion,
      r.modulo,
      r.detalle,
      r.ip,
    ]);
  }

  const today2 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return {
    sheetName: 'Log de Auditoría',
    headers: [],
    rows,
    filename: `Auditoria_${today2}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF Builder (raw PDF sin dependencias externas)
// ══════════════════════════════════════════════════════════════════════════════

function wrapText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = maxLen;
    const spaceIdx = remaining.lastIndexOf(' ', maxLen);
    if (spaceIdx > maxLen * 0.4) cut = spaceIdx + 1;
    lines.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) lines.push(remaining);
  return lines;
}

function buildPdf(data: ReportData): Uint8Array {
  const PW = 841; // A4 landscape
  const PH = 595;
  const M = 36;
  const CW = PW - M * 2;
  const TOP = 535;
  const MIN_Y = 50;

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
    setColor('#1e6fbf');
    R(0, PH - 46, PW, 46, true);
    resetColor();
    ops.push('1 1 1 rg');
    T(M, PH - 29, 'LOG DE AUDITORÍA', 12, true);
    T(PW - M - 100, PH - 29, `Página ${pageNum}`, 8);
    resetColor();
  }

  // ── Página 1 ──────────────────────────────────────────────────────────────
  drawPageHeader();

  // Meta
  y -= 10;
  const periodoStr =
    data.fechaDesde || data.fechaHasta
      ? `${data.fechaDesde ?? 'Inicio'} al ${data.fechaHasta ?? 'Hoy'}`
      : 'Todos los registros';
  T(M, y, `Sede: ${data.branchName}`, 9, true);
  T(M + 260, y, `Período: ${periodoStr}`, 9);
  y -= 14;
  T(M, y, `Generado por: ${data.generatedBy}`, 9);
  T(M + 260, y, `Fecha: ${new Date().toLocaleDateString('es-CL')}`, 9);
  T(M + 500, y, `Total: ${data.totalRows} registros`, 9, true);
  y -= 16;

  L(M, y, M + CW, y);
  y -= 14;

  // ── Cabecera de tabla ─────────────────────────────────────────────────────
  const cols = {
    fecha: { x: M + 2, w: 110 },
    usuario: { x: M + 116, w: 120 },
    email: { x: M + 240, w: 140 },
    accion: { x: M + 384, w: 70 },
    modulo: { x: M + 458, w: 100 },
    detalle: { x: M + 562, w: 170 },
    ip: { x: M + 736, w: 73 }, // termina en 36+736+73=845 ≈ PW-M ✓
  };

  setColor('#1e6fbf');
  R(M, y - 14, CW, 16, true);
  ops.push('1 1 1 rg');
  T(cols.fecha.x, y - 11, 'FECHA/HORA', 6, true);
  T(cols.usuario.x, y - 11, 'USUARIO', 6, true);
  T(cols.email.x, y - 11, 'EMAIL', 6, true);
  T(cols.accion.x, y - 11, 'ACCIÓN', 6, true);
  T(cols.modulo.x, y - 11, 'MÓDULO', 6, true);
  T(cols.detalle.x, y - 11, 'DETALLE', 6, true);
  T(cols.ip.x, y - 11, 'IP', 6, true);
  resetColor();
  y -= 18;

  // ── Filas ──────────────────────────────────────────────────────────────────
  const accionColors: Record<string, string> = {
    Crear: '#16a34a',
    Actualizar: '#1e6fbf',
    Eliminar: '#ef4444',
  };

  let rowAlt = false;
  for (const row of data.rows) {
    const detalleLines = wrapText(row.detalle, 40);
    const rowH = Math.max(15, detalleLines.length * 11 + 5);

    checkY(rowH);

    if (rowAlt) {
      ops.push('0.97 0.97 0.97 rg');
      R(M, y - rowH, CW, rowH, true);
      resetColor();
    }
    rowAlt = !rowAlt;

    const fechaStr = formatDate(row.fechaHora).slice(0, 19).replace('T', ' ');
    const truncNombre =
      row.usuarioNombre.length > 18 ? row.usuarioNombre.slice(0, 17) + '.' : row.usuarioNombre;
    const truncEmail =
      row.usuarioEmail.length > 22 ? row.usuarioEmail.slice(0, 21) + '.' : row.usuarioEmail;
    const truncModulo = row.modulo.length > 16 ? row.modulo.slice(0, 15) + '.' : row.modulo;

    const textY = y - 9;
    T(cols.fecha.x, textY, fechaStr, 6.5);
    T(cols.usuario.x, textY, truncNombre, 6.5);
    T(cols.email.x, textY, truncEmail, 6.5);

    const accionColor = accionColors[row.accion] ?? '#333333';
    setColor(accionColor);
    T(cols.accion.x, textY, row.accion, 6.5, true);
    resetColor();

    T(cols.modulo.x, textY, truncModulo, 6.5);

    for (let li = 0; li < detalleLines.length; li++) {
      T(cols.detalle.x, textY - li * 11, detalleLines[li], 6.5);
    }

    T(cols.ip.x, textY, row.ip, 6.5);

    y -= rowH;
  }

  // ── Fila de totales ───────────────────────────────────────────────────────
  checkY(20);
  y -= 4;
  L(M, y, M + CW, y);
  y -= 4;

  setColor('#1e3a5f');
  ops.push('0.9 0.94 0.98 rg');
  R(M, y - 14, CW, 16, true);
  resetColor();
  ops.push('0.1 0.22 0.38 rg');
  T(cols.fecha.x, y - 10, `TOTAL: ${data.totalRows} registros`, 7, true);
  const crear = data.rows.filter((r) => r.accion === 'Crear').length;
  const actualizar = data.rows.filter((r) => r.accion === 'Actualizar').length;
  const eliminar = data.rows.filter((r) => r.accion === 'Eliminar').length;
  T(cols.email.x, y - 10, `Crear: ${crear}   Actualizar: ${actualizar}   Eliminar: ${eliminar}`, 7);
  resetColor();

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
  addObj(4, '');

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

  const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  const newPages = `<</Type /Pages /Kids [${kidsStr}] /Count ${pages.length}>>`;
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
