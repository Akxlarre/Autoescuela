// supabase/functions/sync-holidays/index.ts
//
// Edge Function: sync-holidays (spec 0052-b)
//
// Mantiene `public.holidays` al día para que la vista de horarios de Clase B no ofrezca bloques
// en feriados. La invoca pg_cron una vez al mes (migración `20261019120000_spec0052_feriados.sql`)
// y una vez a mano al desplegarla.
//
// Por cada año (el actual y el siguiente, en hora de Chile):
//   1. Trae los feriados nacionales con `fetchHolidaysForYear` (_shared/holidays.ts: API oficial →
//      boostr → nager, el primero que responda con fechas de ESE año).
//   2. Agrega el 20 de agosto: natalicio de Bernardo O'Higgins, feriado solo en Chillán y Chillán
//      Viejo — las dos sedes están en Chillán. Ninguna de las fuentes lo trae (es regional por
//      comuna). Si se abre una sede en otra comuna, ver la nota de la spec 0052-b.
//   3. `upsert` por fecha: correrla dos veces no duplica.
// Si ninguna fuente responde para un año, ese año no se toca (AC-E1): los feriados ya cargados
// siguen valiendo y el resultado lo informa.
//
// Body: sin parámetros. Respuesta: { years: { year, national, local, source_ok }[] }
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isServiceRoleRequest } from '../_shared/service-role-auth.ts';
import { fetchHolidaysForYear } from '../_shared/holidays.ts';
import { chileToday } from '../_shared/chile-time.ts';

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

/** Feriados locales de las comunas de las sedes (hoy: Chillán y Chillán Viejo). */
function localHolidays(year: number) {
  return [
    {
      date: `${year}-08-20`,
      name: "Natalicio de Bernardo O'Higgins (Chillán y Chillán Viejo)",
      scope: 'local',
      source: 'sync-holidays',
    },
  ];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (
      !isServiceRoleRequest(
        req.headers.get('Authorization'),
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      )
    ) {
      return jsonResponse({ error: 'No autorizado' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const currentYear = Number(chileToday().slice(0, 4));
    const results = [];

    for (const year of [currentYear, currentYear + 1]) {
      const national = await fetchHolidaysForYear(year);
      const rows = [
        ...(national ?? []).map((date) => ({
          date,
          name: 'Feriado nacional',
          scope: 'national',
          source: 'sync-holidays',
        })),
        ...localHolidays(year),
      ];
      // Un feriado nacional que cae el 20 de agosto gana (no se pisa con el local).
      const byDate = new Map(rows.map((r) => [r.date, r]));
      for (const r of rows) if (r.scope === 'national') byDate.set(r.date, r);

      if (national === null) {
        console.warn(
          `sync-holidays: ninguna fuente respondió para ${year}; solo se asegura el local`,
        );
      }

      const { error } = await supabase.from('holidays').upsert(
        [...byDate.values()].map((r) => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: 'date' },
      );
      if (error) throw error;

      results.push({
        year,
        national: national?.length ?? 0,
        local: localHolidays(year).length,
        source_ok: national !== null,
      });
    }

    return jsonResponse({ years: results });
  } catch (err) {
    console.error('sync-holidays error:', err);
    return jsonResponse({ error: (err as Error).message ?? 'Error' }, 500);
  }
});
