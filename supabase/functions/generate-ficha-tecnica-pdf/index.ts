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
import { buildFichaTecnicaPdf, fechaHoraClase } from '../_shared/ficha-tecnica-pdf.ts';

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
          completada: false,
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
      const cuando = ses.scheduled_at ? fechaHoraClase(new Date(ses.scheduled_at)) : null;

      return {
        numero: num,
        fecha: cuando?.fecha ?? null,
        hora: cuando?.hora ?? null,
        instructor,
        kmInicio: ses.km_start,
        kmFin: ses.km_end,
        observaciones: ses.performance_notes ?? ses.notes ?? null,
        // Mismo criterio que AdminAlumnoDetalleFacade (fix-292-m): sin esto, toda clase hecha
        // y sin observaciones salía como "Pendiente de sesión".
        completada: ses.status === 'completed',
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
