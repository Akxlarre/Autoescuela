// supabase/functions/auto-create-next-promotions/index.ts
//
// Edge Function: auto-create-next-promotions
//
// Garantiza que siempre exista un colchón de 1 promoción `in_progress` + 2 `planned`
// (branch_id=2) hacia adelante — no solo "la siguiente". Invocada por pg_cron vía pg_net
// (migración `20260807090000_auto_create_next_promotions_cron.sql`), diariamente a las
// 06:00 UTC, DESPUÉS de `auto_transition_promotion_status()` (mismo horario) para que el
// conteo de `in_progress` ya refleje la transición planned→in_progress del día.
//
// Por cada promoción que falte para completar el colchón (cadencia 14 días desde la última
// `start_date` existente):
//   1. Calcula `end_date` con recuperación de feriados (AC6, mismo algoritmo que
//      `core/utils/promotion-end-date.utils.ts`, portado en `_shared/holidays.ts`).
//   2. INSERT `professional_promotions` (status='planned', branch_id=2).
//   3. Por cada curso profesional (type='professional', is_convalidation=false): INSERT
//      `promotion_courses` (dispara el trigger `generate_sessions_from_promotion()`, que
//      genera las sesiones L-S del rango [start_date, end_date] — por eso end_date debe
//      estar correcto ANTES de este insert) + INSERT `class_book` explícito (no depender de
//      los 2 puntos de creación perezosa existentes en el flujo manual).
//   4. Cancela sesiones que caen en feriados dentro del rango extendido.
//
// Idempotente por `start_date` (AC-E1): si ya existe una promoción con ese `start_date`, se
// salta sin duplicar y la cadena avanza igual desde esa fila existente.
//
// Body: sin parámetros (invocada por cron sin payload).
// Respuesta: { created: number, missing: number }
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { computePromotionEndDate, fetchHolidaysForYears } from '../_shared/holidays.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const BRANCH_ID = 2;
// Solo defensa ante tabla vacía (branch_id=2 sin ninguna promoción previa) — no se espera
// que disparen nunca en producción. Ambos valores derivan de la misma promoción real
// (start_date=2026-07-27, code=275, confirmado por el owner 2026-08-07).
const FALLBACK_ANCHOR_START_DATE = '2026-07-27';
const FALLBACK_ANCHOR_CODE = 275;

function licenseClassToSuffix(licenseClass: string): string {
  const m = licenseClass.match(/[2-5]/);
  return m ? m[0] : '';
}

/** Suma `days` días calendario a una fecha ISO (YYYY-MM-DD), sin desfase de timezone. */
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const MONTH_NAMES = [
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

/** Espejo de `generatePromoName()` en `admin-promocion-crear-drawer.component.ts` (creación manual). */
function formatStartDateLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

async function cancelHolidaySessions(
  supabase: ReturnType<typeof createClient>,
  promotionCourseId: number,
  holidays: string[],
): Promise<void> {
  await Promise.all([
    supabase
      .from('professional_theory_sessions')
      .update({ status: 'cancelled' })
      .eq('promotion_course_id', promotionCourseId)
      .in('date', holidays),
    supabase
      .from('professional_practice_sessions')
      .update({ status: 'cancelled' })
      .eq('promotion_course_id', promotionCourseId)
      .in('date', holidays),
  ]);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. ¿Cuántas faltan para completar el colchón (1 in_progress + 2 planned)?
    const [{ count: activeCount }, { count: plannedCount }] = await Promise.all([
      supabase
        .from('professional_promotions')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', BRANCH_ID)
        .eq('status', 'in_progress'),
      supabase
        .from('professional_promotions')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', BRANCH_ID)
        .eq('status', 'planned'),
    ]);

    const missing = Math.max(0, 1 - (activeCount ?? 0)) + Math.max(0, 2 - (plannedCount ?? 0));
    if (missing === 0) {
      return jsonResponse({ created: 0, missing: 0 });
    }

    // 2. Ancla de la cadencia: MAX(start_date) y MAX(code numérico) existentes.
    const { data: allPromos } = await supabase
      .from('professional_promotions')
      .select('start_date, code')
      .eq('branch_id', BRANCH_ID)
      .order('start_date', { ascending: false });

    let lastStart: string = allPromos?.[0]?.start_date ?? FALLBACK_ANCHOR_START_DATE;
    const numericCodes = (allPromos ?? [])
      .map((p) => p.code as string | null)
      .filter((c): c is string => !!c && /^\d+$/.test(c))
      .map(Number);
    let lastCode = numericCodes.length > 0 ? Math.max(...numericCodes) : FALLBACK_ANCHOR_CODE;

    // 3. Cursos profesionales relevantes (mismo filtro que loadProfessionalCourses()).
    const { data: courses } = await supabase
      .from('courses')
      .select('id, license_class')
      .eq('type', 'professional')
      .eq('is_convalidation', false);

    let created = 0;

    for (let i = 0; i < missing; i++) {
      const nextStart = addDaysIso(lastStart, 14);

      // Idempotencia (AC-E1): si ya existe, no duplicar — avanzar la cadena igual.
      const { data: existing } = await supabase
        .from('professional_promotions')
        .select('id, code')
        .eq('branch_id', BRANCH_ID)
        .eq('start_date', nextStart)
        .maybeSingle();

      if (existing) {
        lastStart = nextStart;
        if (existing.code && /^\d+$/.test(existing.code)) lastCode = Number(existing.code);
        continue;
      }

      const nextCode = String(lastCode + 1);

      // Feriados y end_date se resuelven ANTES del insert (AC6): se fetchea el año completo,
      // no se puede filtrar por end_date todavía porque aún no existe.
      const holidays = await fetchHolidaysForYears(nextStart);
      const nextEnd = computePromotionEndDate(nextStart, new Set(holidays));

      const { data: promo, error: promoError } = await supabase
        .from('professional_promotions')
        .insert({
          code: nextCode,
          name: `Promoción ${nextCode} (${formatStartDateLabel(nextStart)})`,
          start_date: nextStart,
          end_date: nextEnd,
          status: 'planned',
          current_day: 0,
          branch_id: BRANCH_ID,
        })
        .select('id')
        .single();
      if (promoError) throw promoError;

      const createdPcIds: number[] = [];
      for (const course of courses ?? []) {
        const suffix = licenseClassToSuffix(course.license_class ?? '');

        // Dispara generate_sessions_from_promotion() — end_date ya debe estar correcto.
        const { data: pc, error: pcError } = await supabase
          .from('promotion_courses')
          .insert({
            promotion_id: promo.id,
            course_id: course.id,
            max_students: 25,
            status: 'planned',
            code: `${nextCode}.${suffix}`,
          })
          .select('id')
          .single();
        if (pcError) throw pcError;
        createdPcIds.push(pc.id);

        // class_book explícito (AC2) — no depender de la creación perezosa existente.
        const { error: cbError } = await supabase.from('class_book').insert({
          branch_id: BRANCH_ID,
          promotion_course_id: pc.id,
          period: nextCode,
          status: 'draft',
        });
        if (cbError) throw cbError;
      }

      const holidaysInRange = holidays.filter((d) => d >= nextStart && d <= nextEnd);
      if (holidaysInRange.length > 0) {
        await Promise.all(
          createdPcIds.map((pcId) => cancelHolidaySessions(supabase, pcId, holidaysInRange)),
        );
      }

      created++;
      lastStart = nextStart;
      lastCode = Number(nextCode);
    }

    return jsonResponse({ created, missing });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
