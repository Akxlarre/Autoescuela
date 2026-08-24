// supabase/functions/generate-ficha-tecnica-pdf/index.ts
//
// Edge Function: generate-ficha-tecnica-pdf
//
// Genera el informe "Ficha Técnica" (detalle de clases prácticas Clase B de un alumno) en
// PDF on-demand. Reemplaza `buildFichaTecnicaPrintHtml` (HTML client-side, ver spec 0011-m).
// Replica la misma query/mapeo que hoy arma `AdminAlumnoDetalleFacade._clasesPracticas`.
// Nunca se almacena — mismo patrón que `generate-enrollment-sheet`.
//
// Invocación desde el frontend:
//   const { data, error } = await supabase.functions.invoke('generate-ficha-tecnica-pdf', {
//     body: { enrollment_id: 42 }
//   })
//   // data es un Blob con el PDF
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { escapePdfWinAnsi as esc, assemblePdf, wrapLines } from '../_shared/pdf-utils.ts';

// ─── CORS ───────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Misma fórmula que `core/utils/class-count.utils.ts` (`classCountFromPracticalHours`) —
// no se comparte el módulo (Deno no puede importar `src/app/`), pero es una fórmula de 2
// líneas sin historial de cambios, a diferencia de EPQ_QUESTIONS (81 líneas de contenido de
// negocio) que sí justificó un espejo + test de paridad (ver `_shared/epq-questions.ts`).
function classCountFromPracticalHours(practicalHours: number | null, sessionMinutes = 45): number {
  if (!practicalHours) return 0;
  return Math.round((practicalHours * 60) / sessionMinutes);
}
const PRACTICAS_REQUERIDAS_B_FALLBACK = 12;

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

    // JWT del usuario invocante — mismas policies que ya usa el drawer Angular para leer
    // estos datos (Admin/Secretaria de la sede del alumno). Ver AC-E1 / plan.md §4.
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
      },
    );

    const { data: enrollment, error: enrollErr } = await supabase
      .from('enrollments')
      .select(
        `id, number, student_id,
         students!inner(users!inner(first_names, paternal_last_name, maternal_last_name)),
         courses!inner(practical_hours)`,
      )
      .eq('id', enrollment_id)
      .single();

    if (enrollErr || !enrollment) {
      return jsonErr(`Enrollment ${enrollment_id} not found`, 404);
    }

    const user = enrollment.students.users;
    const studentName = [user.first_names, user.paternal_last_name, user.maternal_last_name]
      .filter(Boolean)
      .join(' ');
    const matricula = enrollment.number ? `#${enrollment.number}` : '—';

    const clasesRequeridas =
      classCountFromPracticalHours(enrollment.courses?.practical_hours ?? null) ||
      PRACTICAS_REQUERIDAS_B_FALLBACK;

    const [sessionsRes, attendanceRes] = await Promise.all([
      supabase
        .from('class_b_sessions')
        .select(
          '*, instructors!class_b_sessions_instructor_id_fkey(users(first_names, paternal_last_name))',
        )
        .eq('enrollment_id', enrollment_id),
      supabase
        .from('class_b_practice_attendance')
        .select(
          `id, status, justification, recorded_at, archived_at,
           class_b_sessions!inner(id, enrollment_id)`,
        )
        .eq('class_b_sessions.enrollment_id', enrollment_id)
        .order('recorded_at', { ascending: false }),
    ]);

    const sessionMap = new Map<number, any>(
      (sessionsRes.data ?? []).map((s: any) => [Number(s.class_number), s]),
    );
    const attendanceVigente = (attendanceRes.data ?? []).filter((r: any) => r.archived_at == null);
    const attendanceBySessionId = new Map<number, any>();
    for (const r of attendanceVigente) {
      const sessionId = r.class_b_sessions?.id;
      if (sessionId != null && !attendanceBySessionId.has(sessionId)) {
        attendanceBySessionId.set(sessionId, r);
      }
    }

    const clases = Array.from({ length: clasesRequeridas }, (_, i) => {
      const num = i + 1;
      const ses = sessionMap.get(num);
      if (!ses) {
        return {
          numero: num,
          fecha: null,
          hora: null,
          instructor: null,
          kmInicio: null,
          kmFin: null,
          observaciones: null,
          ausente: false,
          cancelada: false,
          justificada: false,
          justificacion: null,
          alumnoFirmo: false,
          instructorFirmo: false,
        };
      }
      const attendance = attendanceBySessionId.get(ses.id);
      const instRaw = ses.instructors;
      const inst = Array.isArray(instRaw) ? instRaw[0] : instRaw;
      const instUser = inst?.users
        ? Array.isArray(inst.users)
          ? inst.users[0]
          : inst.users
        : null;
      const instructor = instUser
        ? `${instUser.first_names} ${instUser.paternal_last_name}`.trim()
        : null;
      const scheduledAt = ses.scheduled_at ? new Date(ses.scheduled_at) : null;

      return {
        numero: num,
        fecha: scheduledAt
          ? scheduledAt.toLocaleDateString('es-CL', {
              day: '2-digit',
              month: '2-digit',
              timeZone: 'America/Santiago',
            })
          : null,
        hora: scheduledAt
          ? scheduledAt.toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Santiago',
            })
          : null,
        instructor,
        kmInicio: ses.km_start,
        kmFin: ses.km_end,
        observaciones: ses.performance_notes ?? ses.notes ?? null,
        ausente: ses.status === 'no_show',
        cancelada: ses.status === 'cancelled',
        justificada: attendance?.status === 'excused',
        justificacion: attendance?.justification ?? null,
        alumnoFirmo: !!ses.student_signature,
        instructorFirmo: !!ses.instructor_signature,
      };
    });

    const pdfBytes = buildFichaTecnicaPdf(clases, { studentName, matricula });

    const safeName = sanitize(`Ficha_Tecnica_${studentName}_${matricula}`);
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error('generate-ficha-tecnica-pdf error:', err);
    return jsonErr(err instanceof Error ? err.message : 'Internal server error', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PDF Builder
// ══════════════════════════════════════════════════════════════════════════════

interface ClasePractica {
  numero: number;
  fecha: string | null;
  hora: string | null;
  instructor: string | null;
  kmInicio: number | null;
  kmFin: number | null;
  observaciones: string | null;
  ausente: boolean;
  cancelada: boolean;
  justificada: boolean;
  justificacion: string | null;
  alumnoFirmo: boolean;
  instructorFirmo: boolean;
}

const W = 595;
const H = 842;
const M = 40;
const TOP = H - 50;
const BOTTOM = 60;

function estadoTexto(c: ClasePractica): string {
  if (c.ausente) return c.justificada ? 'Inasist. justificada' : 'Inasistencia';
  if (c.cancelada) return 'Cancelada — pend. reagendar';
  return '';
}

function observacionesTexto(c: ClasePractica): string {
  return (
    c.observaciones || c.justificacion || (c.ausente || c.cancelada ? '' : 'Pendiente de sesión')
  );
}

function kilometrajeTexto(c: ClasePractica): string {
  if (c.kmInicio === null) return '-';
  const fin = c.kmFin !== null ? c.kmFin.toLocaleString('es-CL') : '?';
  return `${c.kmInicio.toLocaleString('es-CL')} -> ${fin} km`;
}

function buildFichaTecnicaPdf(
  clases: ClasePractica[],
  opts: { studentName: string; matricula: string },
): Uint8Array {
  const pages: string[] = [];
  let ops: string[] = [];
  let y = TOP;

  const text = (x: number, yPos: number, str: string, size: number, bold = false) => {
    const font = bold ? 'F2' : 'F1';
    ops.push(`BT /${font} ${size} Tf ${x} ${yPos} Td (${esc(str)}) Tj ET`);
  };
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  const rect = (x: number, yPos: number, w: number, h: number, fill = false) =>
    ops.push(`${x} ${yPos} ${w} ${h} re ${fill ? 'f' : 'S'}`);
  const setGray = (g: number) => ops.push(`${g} g ${g} G`);
  const resetColor = () => ops.push('0 g 0 G');

  const cols = [30, 70, 105, 90, 165, 45]; // N°, Fecha/Hora, Instructor, Km, Observ., Valid.
  const headers = ['N°', 'Fecha/Hora', 'Instructor', 'Kilometraje', 'Observaciones', 'Val.'];
  const contentW = cols.reduce((a, b) => a + b, 0);

  const drawTableHeader = () => {
    setGray(0.88);
    rect(M, y - 14, contentW, 14, true);
    resetColor();
    let xCur = M;
    headers.forEach((h, i) => {
      text(xCur + 2, y - 10, h, 8, true);
      xCur += cols[i];
    });
    y -= 14;
    line(M, y, M + contentW, y);
  };

  const flushPage = () => {
    pages.push(ops.join('\n'));
    ops = [];
  };
  const startNewPage = () => {
    y = TOP;
    drawTableHeader();
  };

  // ── Header ───────────────────────────────────────────────────────────────
  text(M, y, 'Ficha Técnica — Clases Prácticas', 15, true);
  y -= 14;
  text(M, y, 'Desempeño en clases prácticas', 9);
  y -= 18;
  text(M, y, `Alumno: ${opts.studentName || '_____________________________'}`, 9);
  y -= 12;
  text(M, y, `Matrícula: ${opts.matricula}`, 9);
  y -= 16;

  drawTableHeader();

  // ── Filas ────────────────────────────────────────────────────────────────
  for (const c of clases) {
    const obsLines = wrapLines(observacionesTexto(c), 42);
    const estado = estadoTexto(c);
    const rowLines = Math.max(1, obsLines.length + (estado ? 1 : 0));
    const rowH = Math.max(22, rowLines * 10 + 6);

    if (y - rowH < BOTTOM) {
      flushPage();
      startNewPage();
    }

    let xCur = M;
    text(xCur + 2, y - 10, `#${c.numero}`, 8, true);
    xCur += cols[0];

    text(xCur + 2, y - 9, c.fecha ?? '-', 8);
    text(xCur + 2, y - 18, c.hora ?? '-', 7);
    xCur += cols[1];

    text(xCur + 2, y - 10, c.instructor ?? 'Sin asignar', 8);
    xCur += cols[2];

    text(xCur + 2, y - 10, kilometrajeTexto(c), 8);
    xCur += cols[3];

    let obsY = y - 9;
    if (estado) {
      text(xCur + 2, obsY, estado, 7, true);
      obsY -= 10;
    }
    obsLines.forEach((l) => {
      text(xCur + 2, obsY, l, 7);
      obsY -= 9;
    });
    xCur += cols[4];

    const validacion = `${c.alumnoFirmo ? '[X]' : '[ ]'}A ${c.instructorFirmo ? '[X]' : '[ ]'}I`;
    text(xCur + 2, y - 10, validacion, 7);

    y -= rowH;
    line(M, y, M + contentW, y);
  }

  flushPage();
  return assemblePdf(pages, W, H);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 80);
}

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
