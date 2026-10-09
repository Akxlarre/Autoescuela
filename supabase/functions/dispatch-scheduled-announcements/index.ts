// supabase/functions/dispatch-scheduled-announcements/index.ts
//
// Edge Function: dispatch-scheduled-announcements (spec 0042-b)
//
// Envía los comunicados que quedaron agendados y a los que ya les llegó la hora. La
// invoca `pg_cron` cada 15 minutos (migración `20260910120000_announcements_scheduling.sql`).
//
// NO VALIDA USUARIO, Y ESO ESTÁ BIEN: no hay ninguno. La autorización se decidió cuando
// una persona programó el comunicado, y quedó registrada en `sent_by` y `branch_id`. Esta
// función no decide a quién se le manda nada — ejecuta lo ya autorizado. Por eso el envío
// vive en `_shared/announcement-send.ts` y la validación de usuario se quedó en el borde
// HTTP de `send-announcement`: si estuviera en el núcleo compartido, acá habría que
// saltearla con un flag.
//
// EL CANDADO CONTRA EL DOBLE ENVÍO: cada comunicado se toma con
//
//   UPDATE announcements SET status='enviando' WHERE id=$1 AND status='programado'
//
// Si dos corridas del cron se solapan, la segunda no recibe fila y lo saltea. La
// exclusión mutua la resuelve la base, no la lógica de acá.
//
// TAMBIÉN TERMINA LOS ENVÍOS INMEDIATOS A MEDIAS (fix-361-m): el envío inmediato lo
// avanza el navegador de la secretaria; si cierra la pestaña, el comunicado queda en
// `enviando` sin latido y el rescate de acá lo retoma desde el primer pendiente.
//
// Body: sin parámetros.
// Respuesta: { dispatched, results: [{ id, sent, failed, done }] }
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  finalizeAnnouncement,
  loadAnnouncement,
  sendPendingBatch,
} from '../_shared/announcement-send.ts';
import { isDispatchOrphaned, releasedHeartbeat } from '../_shared/announcement-progress.ts';

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

/** Mismo tamaño que usa el compositor (`core/utils/announcement-recipients.utils.ts`). */
const BATCH_SIZE = 25;

/**
 * Tope de lotes por invocación. Las Edge Functions tienen límite de tiempo: si un
 * comunicado no termina acá, queda en `enviando` con el latido soltado y la corrida
 * siguiente lo reanuda desde el primer destinatario pendiente. Reanudar es seguro porque
 * los destinatarios ya están materializados y los procesados tienen su resultado.
 */
const MAX_BATCHES_PER_RUN = 8;

/** Comunicados por corrida. Más de esto y el tiempo de la función no alcanza. */
const MAX_ANNOUNCEMENTS_PER_RUN = 3;

// Cuándo un `enviando` quedó huérfano lo decide `isDispatchOrphaned`
// (`_shared/announcement-progress.ts`), por el último lote avanzado.

/**
 * ¿El token es el de rol de servicio? Solo mira el claim; la firma la verificó el gateway.
 *
 * Acepta también la coincidencia exacta con la env var para cubrir el formato de key nuevo
 * (`sb_secret_…`), que no es un JWT y por lo tanto no tiene claims que mirar.
 */
function isServiceRole(token: string): boolean {
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return true;

  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Solo el cron. El precedente del proyecto (`auto-create-next-promotions`) no valida
    // llamador, pero acá disparar de más significa mandarle correos a alumnos antes de
    // tiempo, así que se exige rol de servicio.
    //
    // Se valida el CLAIM `role`, no una comparación de strings contra
    // `SUPABASE_SERVICE_ROLE_KEY`: la clave que el cron saca del vault es el JWT legacy y
    // no necesariamente es idéntica a la variable de entorno del runtime (formatos de key
    // distintos conviven). Comparar strings devolvía 401 al propio cron.
    //
    // La AUTENTICIDAD del token ya la garantiza el gateway de Supabase (`verify_jwt` queda
    // en su default `true` para esta función, así que la firma se verifica antes de llegar
    // acá). Lo que se decide en este bloque es la AUTORIZACIÓN: que sea el rol de servicio
    // y no un anon o un usuario logueado.
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    if (!token || !isServiceRole(token)) {
      return jsonResponse({ error: 'No autorizado' }, 401);
    }

    // El cron manda `{}` y despacha de verdad. `dryRun` existe solo para poder ejercitar
    // este camino contra la BD de desarrollo, donde los 200 alumnos sembrados tienen
    // dominio inexistente y un envío de prueba son rebotes duros contra el dominio de la
    // escuela. Solo lo puede pedir quien ya pasó el control de rol de servicio de arriba.
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Rescate de huérfanos ─────────────────────────────────────────────────
    // Sin esto, un comunicado cuyo envío murió a mitad se queda en `enviando` para
    // siempre: nadie lo vuelve a tomar y los destinatarios que faltaban nunca reciben.
    // Cubre también el envío inmediato que la secretaria dejó a medias al cerrar la
    // pestaña (fix-361-m): huérfano = sin un lote avanzado en STUCK_MINUTES.
    const now = new Date();
    const { data: sending, error: sendingError } = await service
      .from('announcements')
      .select('id, dispatch_heartbeat_at, scheduled_for, created_at')
      .eq('status', 'enviando');
    if (sendingError) throw sendingError;

    const orphans = (sending ?? []).filter((row) => isDispatchOrphaned(row, now));
    for (const orphan of orphans) {
      await service
        .from('announcements')
        .update({ status: 'programado' })
        .eq('id', orphan.id)
        .eq('status', 'enviando');
    }

    if (orphans.length) {
      console.log(`Rescatados ${orphans.length} comunicado(s) trabados en 'enviando'`);
    }

    // ── Vencidos ─────────────────────────────────────────────────────────────
    // `<= now()` incluye los atrasados: si el dispatcher estuvo caído, igual salen (AC-E2).
    // `scheduled_for IS NULL` es un envío inmediato rescatado: también le toca ahora.
    const { data: due, error: dueError } = await service
      .from('announcements')
      .select('id')
      .eq('status', 'programado')
      .or(`scheduled_for.is.null,scheduled_for.lte.${now.toISOString()}`)
      .order('scheduled_for', { ascending: true, nullsFirst: true })
      .limit(MAX_ANNOUNCEMENTS_PER_RUN);
    if (dueError) throw dueError;

    const results = [];

    for (const row of due ?? []) {
      // ── El candado ─────────────────────────────────────────────────────────
      const { data: locked } = await service
        .from('announcements')
        .update({ status: 'enviando', dispatch_heartbeat_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', 'programado')
        .select('id')
        .maybeSingle();

      // Otra corrida se lo llevó primero.
      if (!locked) continue;

      try {
        const announcement = await loadAnnouncement(service, row.id);
        let sent = 0;
        let failed = 0;
        let done = false;

        // Cada lote pide los destinatarios que FALTAN, no una posición: así una corrida
        // que reanuda sigue donde quedó la anterior en vez de recorrer de nuevo los
        // primeros (fix-361-m). Un segmento sin nadie devuelve `done` de inmediato y se
        // cierra como enviado con 0, sin quedar reintentándose (AC-E3).
        for (let i = 0; i < MAX_BATCHES_PER_RUN && !done; i++) {
          const result = await sendPendingBatch(service, announcement, {
            batchSize: BATCH_SIZE,
            dryRun,
          });
          sent += result.sent;
          failed += result.failed;
          done = result.done;
        }

        // Los conteos que quedan en el comunicado salen de sus destinatarios, no de esta
        // corrida: un envío grande pasa por varias. Si no terminó, queda en `enviando` y
        // el rescate de la próxima corrida lo reanuda.
        if (done) done = (await finalizeAnnouncement(service, row.id)).finalized;
        if (!done) {
          await service
            .from('announcements')
            .update({ dispatch_heartbeat_at: releasedHeartbeat(new Date()) })
            .eq('id', row.id);
        }

        results.push({ id: row.id, sent, failed, done });
      } catch (err) {
        // Devolverlo a `programado` es lo correcto: reintentar es seguro porque los
        // destinatarios ya entregados tienen `email_sent_ok` y se saltean.
        console.error(`Error despachando comunicado ${row.id}:`, err);
        await service.from('announcements').update({ status: 'programado' }).eq('id', row.id);
        results.push({ id: row.id, error: String(err?.message ?? 'desconocido') });
      }
    }

    return jsonResponse({ dispatched: results.length, results, dryRun });
  } catch (err) {
    console.error('dispatch-scheduled-announcements error:', err);
    return jsonResponse({ error: `Error interno: ${err?.message ?? 'desconocido'}` }, 500);
  }
});
