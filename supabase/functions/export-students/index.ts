// supabase/functions/export-alumnos/index.ts
//
// Edge Function: export-alumnos
//
// Genera un listado de alumnos en formato Excel (xlsx) o PDF y lo retorna
// como respuesta binaria para descarga directa.
//
// Body esperado:
//   format     : 'excel' | 'pdf'      — formato de salida
//   branch_id  : number | null         — filtrar por sede; null = todas
//   search     : string                — texto libre (nombre, rut, expediente)
//   curso      : string                — nombre del curso exacto; '' = todos
//   estado     : string                — estado del alumno; '' = todos
//   expediente : string                — 'Completo'|'Parcial'|'Pendiente'|'' = todos
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

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

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface RawRow {
  id: number;
  status: string | null;
  users: {
    rut: string;
    first_names: string;
    paternal_last_name: string;
    maternal_last_name: string;
    email: string;
    phone: string | null;
    branch_id: number | null;
  };
  enrollments: {
    number: string | null;
    status: string | null;
    payment_status: string | null;
    pending_balance: number | null;
    created_at: string;
    courses: { name: string } | null;
    student_documents: { type: string | null }[];
  }[];
}

interface AlumnoRow {
  nombre: string;
  rut: string;
  email: string;
  telefono: string;
  curso: string;
  nroExpediente: string;
  fechaIngreso: string;
  estado: string;
  expediente: string;
  saldoPendiente: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveEstado(
  enrollment: RawRow['enrollments'][0] | null,
  studentStatus: string | null,
): string {
  if (!enrollment) return studentStatus === 'inactive' ? 'Inactivo' : 'Pre-inscrito';
  switch (enrollment.status) {
    case 'active':
      if (enrollment.payment_status === 'pending') return 'Pendiente Pago';
      return 'Activo';
    case 'completed':
      return 'Finalizado';
    case 'withdrawn':
      return 'Retirado';
    case 'draft':
      return 'Pre-inscrito';
    default:
      return studentStatus === 'inactive' ? 'Inactivo' : 'Pre-inscrito';
  }
}

function deriveExpediente(docs: { type: string | null }[]): string {
  const types = new Set(docs.map((d) => d.type).filter(Boolean));
  const fields = ['cedula_identidad', 'foto_carnet', 'certificado_medico', 'semep'];
  const ok = fields.filter((f) => types.has(f)).length;
  if (ok === fields.length) return 'Completo';
  if (ok === 0) return 'Pendiente';
  return 'Parcial';
}

function mapRow(s: RawRow): AlumnoRow {
  const u = s.users;
  const enrollment =
    s.enrollments.length > 0
      ? s.enrollments.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0]
      : null;
  return {
    nombre: `${u.paternal_last_name} ${u.maternal_last_name} ${u.first_names}`.trim(),
    rut: u.rut,
    email: u.email,
    telefono: u.phone ?? '',
    curso: enrollment?.courses?.name ?? '—',
    nroExpediente: enrollment?.number ?? '—',
    fechaIngreso: enrollment ? enrollment.created_at.slice(0, 10) : '—',
    estado: deriveEstado(enrollment, s.status),
    expediente: deriveExpediente(enrollment?.student_documents ?? []),
    saldoPendiente: enrollment?.pending_balance ?? 0,
  };
}

function matchesFilters(
  row: AlumnoRow,
  search: string,
  curso: string,
  estado: string,
  expediente: string,
): boolean {
  if (curso && row.curso !== curso) return false;
  if (estado && row.estado !== estado) return false;
  if (expediente && row.expediente !== expediente) return false;
  if (search) {
    const term = search.toLowerCase();
    const matches =
      row.nombre.toLowerCase().includes(term) ||
      row.rut.toLowerCase().includes(term) ||
      row.nroExpediente.toLowerCase().includes(term);
    if (!matches) return false;
  }
  return true;
}

// ── Generadores de archivo ────────────────────────────────────────────────────

function buildExcelPayload(rows: AlumnoRow[]): { headers: string[]; rows: (string | number)[][] } {
  const headers = [
    'Nombre',
    'RUT',
    'Email',
    'Teléfono',
    'Curso',
    'Nº Expediente',
    'Fecha Ingreso',
    'Estado',
    'Expediente',
    'Saldo Pendiente',
  ];
  const data = rows.map((r) => [
    r.nombre,
    r.rut,
    r.email,
    r.telefono,
    r.curso,
    r.nroExpediente,
    r.fechaIngreso,
    r.estado,
    r.expediente,
    r.saldoPendiente,
  ]);
  return { headers, rows: data };
}

async function buildPdf(rows: AlumnoRow[], fecha: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);

  const PAGE_W = 842; // A4 landscape width
  const PAGE_H = 595;
  const MARGIN = 36;
  const ROW_H = 18;
  const HEADER_H = 24;
  const COL_WIDTHS = [140, 80, 90, 90, 80, 90, 80];
  const COL_LABELS = ['Nombre', 'RUT', 'Curso', 'Nº Exp.', 'Ingreso', 'Estado', 'Expediente'];

  const ROWS_PER_PAGE = Math.floor((PAGE_H - MARGIN * 2 - HEADER_H - 40) / ROW_H);

  const addPage = () => {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    return p;
  };

  const drawTableHeader = (page: ReturnType<typeof addPage>, y: number) => {
    let x = MARGIN;
    page.drawRectangle({
      x: MARGIN,
      y,
      width: PAGE_W - MARGIN * 2,
      height: HEADER_H,
      color: rgb(0.18, 0.18, 0.22),
    });
    COL_LABELS.forEach((label, i) => {
      page.drawText(label, { x: x + 4, y: y + 7, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
      x += COL_WIDTHS[i];
    });
  };

  const chunks = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    chunks.push(rows.slice(i, i + ROWS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);

  chunks.forEach((chunk, pageIdx) => {
    const page = addPage();
    const usableTop = PAGE_H - MARGIN;

    // Title
    page.drawText('Listado de Alumnos', {
      x: MARGIN,
      y: usableTop - 14,
      size: 14,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(`Generado: ${fecha}  ·  Página ${pageIdx + 1} de ${chunks.length}`, {
      x: MARGIN,
      y: usableTop - 26,
      size: 7.5,
      font: fontReg,
      color: rgb(0.5, 0.5, 0.5),
    });

    const tableTop = usableTop - 40;
    drawTableHeader(page, tableTop);

    chunk.forEach((row, ri) => {
      const rowY = tableTop - HEADER_H - ri * ROW_H;
      const bg = ri % 2 === 0 ? rgb(0.97, 0.97, 0.98) : rgb(1, 1, 1);
      page.drawRectangle({
        x: MARGIN,
        y: rowY,
        width: PAGE_W - MARGIN * 2,
        height: ROW_H,
        color: bg,
      });

      const cells = [
        row.nombre,
        row.rut,
        row.curso,
        row.nroExpediente,
        row.fechaIngreso,
        row.estado,
        row.expediente,
      ];
      let cx = MARGIN;
      cells.forEach((cell, ci) => {
        const maxChars = Math.floor(COL_WIDTHS[ci] / 4.8);
        const text = String(cell ?? '').slice(0, maxChars);
        page.drawText(text, {
          x: cx + 4,
          y: rowY + 5,
          size: 7,
          font: fontReg,
          color: rgb(0.15, 0.15, 0.15),
        });
        cx += COL_WIDTHS[ci];
      });
    });

    // Footer line
    page.drawLine({
      start: { x: MARGIN, y: MARGIN },
      end: { x: PAGE_W - MARGIN, y: MARGIN },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    page.drawText(`Total: ${rows.length} alumno${rows.length !== 1 ? 's' : ''}`, {
      x: MARGIN,
      y: MARGIN - 12,
      size: 7,
      font: fontReg,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  return doc.save();
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonError('No autorizado', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verificar usuario autenticado
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
    const search: string = (body.search ?? '').trim();
    const curso: string = body.curso ?? '';
    const estado: string = body.estado ?? '';
    const expediente: string = body.expediente ?? '';

    // ── Query ─────────────────────────────────────────────────────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    let query = adminClient
      .from('students')
      .select(
        `
        id, status,
        users!inner(rut, first_names, paternal_last_name, maternal_last_name, email, phone, branch_id),
        enrollments(number, status, payment_status, pending_balance, created_at,
          courses(name),
          student_documents(type)
        )
      `,
      )
      .neq('status', 'archived')
      .order('id', { ascending: false });

    if (branchId !== null) {
      query = query.eq('users.branch_id', branchId);
    }

    const { data, error: dbError } = await query;
    if (dbError) throw dbError;

    const rows = ((data ?? []) as unknown as RawRow[])
      .map(mapRow)
      .filter((r) => matchesFilters(r, search, curso, estado, expediente));

    // ── Generar archivo ───────────────────────────────────────────────────────
    const fecha = new Date().toISOString().slice(0, 10);

    if (format === 'excel') {
      const payload = buildExcelPayload(rows);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileBytes = await buildPdf(rows, fecha);
    return new Response(fileBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="alumnos_${fecha}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[export-alumnos]', err);
    return jsonError('Error interno al generar el archivo');
  }
});
