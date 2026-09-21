// supabase/functions/send-announcement/index.ts
//
// Edge Function: send-announcement (specs 0041-b y 0042-b)
//
// BORDE HTTP del envío de un comunicado disparado por una persona. Su responsabilidad
// exclusiva es la AUTORIZACIÓN: que quien llama sea admin o secretaría, y que no esté
// mandando comunicados de otra sede. El envío en sí vive en
// `_shared/announcement-send.ts`, compartido con el dispatcher del cron.
//
// Esa separación es deliberada: el dispatcher corre sin usuario autenticado, y meterle a
// esta función un "si viene con service_role, saltea la validación" convertiría la única
// barrera de autorización del envío en un `if`.
//
// LA REGLA QUE SOSTIENE TODO ESTO: el cliente manda la DEFINICIÓN DEL SEGMENTO, nunca una
// lista de destinatarios. El núcleo resuelve la lista contra la BD y, si el comunicado es
// promocional, la filtra por consentimiento vigente al momento del envío. Un compositor
// con un preview viejo no puede alcanzar a alguien que ya revocó.
//
// Body esperado:
//   announcementId : number   — el comunicado ya insertado por la Facade
//   offset         : number   — desplazamiento dentro de la lista materializada
//   batchSize      : number   — destinatarios de este lote
//   dryRun         : boolean? — corre todo menos la entrega SMTP
//
// Respuestas:
//   200  { recipientsTotal, processed, sent, failed, done, dryRun }
//   400  { error: '...' }
//   401  { error: 'No autorizado' }
//   403  { error: '...' }
//   500  { error: '...' }
//
// Secrets requeridos: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildEmailHtml,
  loadAnnouncement,
  renderTemplate,
  sendAnnouncementBatch,
} from '../_shared/announcement-send.ts';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Autenticación ────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'No autorizado' }, 401);

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) return jsonResponse({ error: 'No autorizado' }, 401);

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: caller } = await service
      .from('users')
      .select('id, branch_id, roles!inner(name)')
      .eq('supabase_uid', user.id)
      .maybeSingle();

    const callerRole = caller?.roles?.name;
    if (callerRole !== 'admin' && callerRole !== 'secretary') {
      return jsonResponse({ error: 'Solo admin o secretaría pueden enviar comunicados' }, 403);
    }

    // ── Body ─────────────────────────────────────────────────────────────────
    const { announcementId, offset, batchSize, dryRun, previewOnly, preview } = await req.json();

    // ── Preview: PRIMERA GUARDA, antes de cualquier efecto ───────────────────
    //
    // Va acá arriba y no como una rama al final a propósito: un preview no puede, ni por un
    // error de orden al editar esta función, materializar destinatarios ni mandar un correo.
    // Devuelve el MISMO HTML que sale de verdad, armado con los helpers compartidos — el
    // valor entero de un preview es que lo que se ve sea lo que se manda, así que duplicar
    // la plantilla en el cliente estaba descartado.
    if (previewOnly === true) {
      const subject = String(preview?.subject ?? '').trim();
      const body = String(preview?.body ?? '').trim();
      if (!subject || !body) {
        return jsonResponse({ error: 'Falta asunto o mensaje para previsualizar' }, 400);
      }

      // Datos de ejemplo: el preview muestra cómo lo lee UN alumno, con las variables
      // resueltas. Ver `{{nombre}}` literal no diría nada sobre el resultado real.
      const ejemplo = { nombre: 'Ana Pérez', sede: 'Autoescuela Chillán' };
      return jsonResponse({
        html: buildEmailHtml(renderTemplate(subject, ejemplo), renderTemplate(body, ejemplo)),
        subject: renderTemplate(subject, ejemplo),
      });
    }

    if (
      typeof announcementId !== 'number' ||
      typeof offset !== 'number' ||
      typeof batchSize !== 'number' ||
      offset < 0 ||
      batchSize <= 0
    ) {
      return jsonResponse({ error: 'Parámetros inválidos' }, 400);
    }

    const announcement = await loadAnnouncement(service, announcementId);
    if (!announcement) return jsonResponse({ error: 'Comunicado no encontrado' }, 400);

    // La RLS no protege al service_role: la autorización de sede se comprueba acá.
    if (callerRole === 'secretary' && announcement.branch_id !== caller.branch_id) {
      return jsonResponse({ error: 'No puedes enviar comunicados de otra sede' }, 403);
    }

    // ── Envío ────────────────────────────────────────────────────────────────
    const result = await sendAnnouncementBatch(service, announcement, {
      offset,
      batchSize,
      dryRun: dryRun === true,
    });

    return jsonResponse(result);
  } catch (err) {
    console.error('send-announcement error:', err);
    return jsonResponse({ error: `Error interno: ${err?.message ?? 'desconocido'}` }, 500);
  }
});
