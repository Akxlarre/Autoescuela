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
// fix-228-m: la reserva del slot (contar colchón + decidir si falta una promoción +
// INSERT del placeholder) vive en la función atómica `reserve_next_promotion_slot()`
// (migración `20260829110000_...`), protegida con `pg_advisory_xact_lock`. Antes, este
// archivo calculaba `missing` con dos SELECT sueltos y recién insertaba varios pasos
// async después (fetch de feriados externo) — una segunda invocación solapada podía leer
// el mismo conteo desactualizado y crear una promoción de más. Ahora cada iteración pide
// un slot ya reservado/insertado atómicamente; si el RPC no devuelve fila, el colchón ya
// está completo (por esta invocación o por otra concurrente) y el loop corta ahí.
//
// Por cada slot reservado:
//   1. Calcula `end_date` con recuperación de feriados (AC6, mismo algoritmo que
//      `core/utils/promotion-end-date.utils.ts`, portado en `_shared/holidays.ts`).
//   2. UPDATE `professional_promotions` (name + end_date reales sobre el placeholder ya
//      insertado por el RPC).
//   3. Por cada curso profesional (type='professional', is_convalidation=false): INSERT
//      `promotion_courses` (dispara el trigger `generate_sessions_from_promotion()`, que
//      genera las sesiones L-S del rango [start_date, end_date] — por eso end_date debe
//      estar correcto ANTES de este insert) + INSERT `class_book` explícito (no depender de
//      los 2 puntos de creación perezosa existentes en el flujo manual).
//   4. Cancela sesiones que caen en feriados dentro del rango extendido.
//
// Body: sin parámetros (invocada por cron sin payload).
// Respuesta: { created: number }
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

function licenseClassToSuffix(licenseClass: string): string {
  const m = licenseClass.match(/[2-5]/);
  return m ? m[0] : '';
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

    // Cursos profesionales relevantes (mismo filtro que loadProfessionalCourses()).
    const { data: courses } = await supabase
      .from('courses')
      .select('id, license_class')
      .eq('type', 'professional')
      .eq('is_convalidation', false);

    let created = 0;

    // fix-228-m: cada iteración pide un slot ya reservado/insertado atómicamente por
    // reserve_next_promotion_slot() (advisory lock). Si no devuelve fila, el colchón
    // (1 in_progress + 2 planned) ya está completo — corta el loop. Tope defensivo de 10
    // iteraciones: el colchón real nunca necesita más de 2-3 slots por corrida.
    for (let i = 0; i < 10; i++) {
      const { data: slot, error: slotError } = await supabase
        .rpc('reserve_next_promotion_slot', { p_branch_id: BRANCH_ID })
        .maybeSingle();
      if (slotError) throw slotError;
      if (!slot) break;

      const promoId = slot.promotion_id as number;
      const nextCode = slot.reserved_code as string;
      const nextStart = slot.reserved_start_date as string;

      // Feriados y end_date se resuelven DESPUÉS de reservar el slot (AC6): se fetchea el
      // año completo, no se puede filtrar por end_date todavía porque aún no existe.
      const holidays = await fetchHolidaysForYears(nextStart);
      const nextEnd = computePromotionEndDate(nextStart, new Set(holidays));

      const { error: updateError } = await supabase
        .from('professional_promotions')
        .update({
          name: `Promoción ${nextCode} (${formatStartDateLabel(nextStart)})`,
          end_date: nextEnd,
        })
        .eq('id', promoId);
      if (updateError) throw updateError;

      const promo = { id: promoId };
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
    }

    return jsonResponse({ created });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
