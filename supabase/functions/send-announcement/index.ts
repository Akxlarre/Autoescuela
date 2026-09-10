// supabase/functions/send-announcement/index.ts
//
// Edge Function: send-announcement (spec 0041-b)
//
// Envía un comunicado global a un segmento de alumnos, por lotes.
//
// LA REGLA QUE SOSTIENE TODO ESTO: el cliente manda la DEFINICIÓN DEL SEGMENTO, nunca
// una lista de destinatarios. Esta función resuelve la lista contra la BD y, si el
// comunicado es promocional, la filtra por consentimiento vigente. Un compositor con
// un preview viejo no puede alcanzar a alguien que ya revocó (AC-E4).
//
// Body esperado:
//   announcementId : number   — el comunicado ya insertado por la Facade
//   offset         : number   — desplazamiento dentro de la lista materializada
//   batchSize      : number   — destinatarios de este lote
//   dryRun         : boolean? — corre todo menos la entrega SMTP (ver más abajo)
//
// Respuestas:
//   200  { recipientsTotal, processed, sent, failed, done }
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
import nodemailer from 'npm:nodemailer@6';

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

/**
 * El cuerpo es texto plano escrito por una secretaria y termina dentro de un HTML que
 * sale por correo. Sin escapar, cualquier `<` que escriba rompe el mail — y peor, un
 * cuerpo con markup se envía tal cual a cientos de personas.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml(name: string, subject: string, body: string): string {
  const safeBody = escapeHtml(body).replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background-color: #f1f5f9; line-height: 1.6; }
    .email-wrapper { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .email-header { background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 60%, #8b5cf6 100%); padding: 40px 36px; text-align: center; }
    .logo-badge { width: 60px; height: 60px; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; }
    .logo-badge span { color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .company-name { color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .email-body { padding: 40px 36px 36px; }
    .greeting { font-size: 13px; font-weight: 600; color: #0ea5e9; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
    .title { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1.25; margin-bottom: 20px; }
    .divider { height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent); margin: 24px 0; }
    .message { font-size: 15px; color: #334155; line-height: 1.75; }
    .email-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 28px 36px; text-align: center; }
    .footer-divider { width: 40px; height: 2px; background: linear-gradient(to right, #0ea5e9, #6366f1); border-radius: 2px; margin: 0 auto 14px; }
    .footer-brand { font-size: 14px; font-weight: 700; color: #334155; margin-bottom: 6px; }
    .footer-text { font-size: 12px; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-header">
    <div class="logo-badge"><span>CC</span></div>
    <p class="company-name">Conductores Chillán</p>
  </div>
  <div class="email-body">
    <p class="greeting">Comunicado</p>
    <h1 class="title">${escapeHtml(subject)}</h1>
    <p class="message">Hola <strong>${escapeHtml(name)}</strong>,</p>
    <div class="divider"></div>
    <p class="message">${safeBody}</p>
  </div>
  <div class="email-footer">
    <div class="footer-divider"></div>
    <p class="footer-brand">Conductores Chillán</p>
    <p class="footer-text">Este correo fue enviado automáticamente. Por favor no responder.<br>© 2026 Conductores Chillán. Todos los derechos reservados.</p>
  </div>
</div>
</body>
</html>`;
}

/**
 * Resuelve el segmento contra la BD y materializa una fila por destinatario en
 * `announcement_recipients`. Se corre una sola vez, en el primer lote.
 *
 * Materializar (en vez de re-consultar con OFFSET en cada lote) evita que la lista se
 * mueva entre lotes: si alguien revocara su consentimiento a mitad del envío, el OFFSET
 * de los lotes siguientes se correría y saltearía destinatarios que sí correspondían.
 */
async function materializeRecipients(service, announcement): Promise<number> {
  const filters = announcement.segment_filters ?? {};

  let query = service
    .from('enrollments')
    .select('student_id, branch_id, status, courses!inner(type), students!inner(user_id)');

  // La sede del comunicado manda; `NULL` = multi-sede (solo admin) y ahí vale el filtro
  // que se haya pedido al segmentar.
  const branchId = announcement.branch_id ?? filters.branchId ?? null;
  if (branchId !== null) query = query.eq('branch_id', branchId);

  if (filters.courseType) query = query.eq('courses.type', filters.courseType);
  if (filters.enrollmentStatus) query = query.eq('status', filters.enrollmentStatus);

  const { data: enrollments, error } = await query;
  if (error) throw error;

  // Un alumno con dos matrículas aparece dos veces: es un destinatario, no dos.
  const candidateUserIds = [...new Set((enrollments ?? []).map((e) => e.students.user_id))];
  if (candidateUserIds.length === 0) return 0;

  const excluded = new Set<number>(filters.excludedUserIds ?? []);
  let eligibleIds = candidateUserIds.filter((id) => !excluded.has(id));

  // AC3 — el promocional solo alcanza a quien lo consintió y no lo revocó.
  // AC4 — el operativo NO se filtra: es necesario para ejecutar el contrato (Art. 13 c).
  if (announcement.kind === 'promocional') {
    eligibleIds = await filterByPromotionalConsent(service, eligibleIds);
  }
  if (eligibleIds.length === 0) return 0;

  const { data: users, error: usersError } = await service
    .from('users')
    .select('id, email, first_names, paternal_last_name')
    .in('id', eligibleIds)
    .eq('active', true)
    .order('id', { ascending: true });
  if (usersError) throw usersError;

  const rows = (users ?? []).map((u) => ({
    announcement_id: announcement.id,
    user_id: u.id,
    // `users.email` es NOT NULL en el esquema, pero NOT NULL no garantiza no-vacío:
    // un string en blanco es tan inalcanzable como un NULL (AC-E2).
    email: u.email?.trim() ? u.email.trim() : null,
  }));

  // `onConflict` sobre el UNIQUE (announcement_id, user_id): reintentar el primer lote
  // no duplica destinatarios.
  const { error: insertError } = await service
    .from('announcement_recipients')
    .upsert(rows, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true });
  if (insertError) throw insertError;

  await service
    .from('announcements')
    .update({ recipients_total: rows.length })
    .eq('id', announcement.id);

  return rows.length;
}

/**
 * Deja solo los usuarios cuyo consentimiento promocional MÁS RECIENTE está otorgado y
 * sin revocar. Se mira el más reciente y no "alguno otorgado" porque un alumno con dos
 * matrículas tiene una fila por matrícula (spec 0040-b): vale su última expresión de
 * voluntad, no la más conveniente.
 */
async function filterByPromotionalConsent(service, userIds: number[]): Promise<number[]> {
  const { data, error } = await service
    .from('consents')
    .select('user_id, granted, revoked_at, granted_at')
    .eq('consent_type', 'comunicaciones_promocionales')
    .in('user_id', userIds)
    .order('granted_at', { ascending: false });
  if (error) throw error;

  const latestByUser = new Map<number, { granted: boolean; revoked_at: string | null }>();
  for (const row of data ?? []) {
    if (!latestByUser.has(row.user_id)) latestByUser.set(row.user_id, row);
  }

  return userIds.filter((id) => {
    const consent = latestByUser.get(id);
    return Boolean(consent?.granted) && consent?.revoked_at === null;
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
    const { announcementId, offset, batchSize, dryRun } = await req.json();
    if (
      typeof announcementId !== 'number' ||
      typeof offset !== 'number' ||
      typeof batchSize !== 'number' ||
      offset < 0 ||
      batchSize <= 0
    ) {
      return jsonResponse({ error: 'Parámetros inválidos' }, 400);
    }

    const { data: announcement } = await service
      .from('announcements')
      .select('id, subject, body, kind, branch_id, segment_filters, recipients_total')
      .eq('id', announcementId)
      .maybeSingle();
    if (!announcement) return jsonResponse({ error: 'Comunicado no encontrado' }, 400);

    // La RLS no protege al service_role: la autorización de sede se comprueba acá.
    if (callerRole === 'secretary' && announcement.branch_id !== caller.branch_id) {
      return jsonResponse({ error: 'No puedes enviar comunicados de otra sede' }, 403);
    }

    // ── Materialización (solo en el primer lote) ─────────────────────────────
    let recipientsTotal = announcement.recipients_total;
    if (offset === 0) {
      recipientsTotal = await materializeRecipients(service, announcement);
    }
    if (recipientsTotal === 0) {
      return jsonResponse({ recipientsTotal: 0, processed: 0, sent: 0, failed: 0, done: true });
    }

    // ── Lote a procesar ──────────────────────────────────────────────────────
    const { data: batch, error: batchError } = await service
      .from('announcement_recipients')
      .select(
        'id, user_id, email, email_sent_ok, notification_id, users!inner(first_names, paternal_last_name)',
      )
      .eq('announcement_id', announcement.id)
      .order('id', { ascending: true })
      .range(offset, offset + batchSize - 1);
    if (batchError) throw batchError;

    // Re-chequeo por lote: si alguien revocó mientras el envío avanzaba, no le llega
    // el resto del comunicado (AC-E4).
    let allowedIds: Set<number> | null = null;
    if (announcement.kind === 'promocional') {
      const stillEligible = await filterByPromotionalConsent(
        service,
        (batch ?? []).map((r) => r.user_id),
      );
      allowedIds = new Set(stillEligible);
    }

    // ── Transporte SMTP ──────────────────────────────────────────────────────
    //
    // `dryRun` corre TODO menos la entrega: resuelve el segmento, filtra por
    // consentimiento, materializa destinatarios y crea las notificaciones in-app, pero
    // no toca SMTP. Existe porque la BD de desarrollo tiene 200 alumnos sembrados con
    // dominio inexistente (@test-data.local): un envío de prueba serían 200 rebotes
    // duros contra el dominio de la escuela, que es justo el daño que este feature
    // tiene que evitar.
    const isDryRun = dryRun === true;

    const transporter = isDryRun
      ? null
      : nodemailer.createTransport({
          host: Deno.env.get('SMTP_HOST'),
          port: Number(Deno.env.get('SMTP_PORT') ?? 465),
          secure: Number(Deno.env.get('SMTP_PORT') ?? 465) === 465,
          auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASS') },
        });
    const from = Deno.env.get('SMTP_FROM') ?? Deno.env.get('SMTP_USER');

    let sent = 0;
    let failed = 0;

    for (const recipient of batch ?? []) {
      // Un lote reintentado (timeout de red, corte a mitad del envío) NO vuelve a
      // entregarle a quien ya recibió: reintentar tiene que reanudar, no reenviar.
      // El UNIQUE de la tabla protege las filas, no la entrega.
      if (recipient.email_sent_ok) {
        sent++;
        continue;
      }

      if (allowedIds && !allowedIds.has(recipient.user_id)) {
        await service
          .from('announcement_recipients')
          .update({ send_error: 'consentimiento_revocado_durante_envio' })
          .eq('id', recipient.id);
        continue;
      }

      const name = recipient.users?.first_names ?? 'Alumno';

      // La notificación in-app se crea aunque el correo falle o no haya dirección: es la
      // red de contención del canal email (AC-E2, AC-E3). Pero solo una vez por
      // destinatario — si la fila ya tiene una, este lote se está reintentando y
      // volver a insertar le duplicaría el aviso al alumno en su portal.
      let notificationId = recipient.notification_id;
      if (notificationId === null) {
        const { data: notification } = await service
          .from('notifications')
          .insert({
            recipient_id: recipient.user_id,
            type: 'system',
            subject: announcement.subject,
            message: announcement.body,
            reference_type: 'announcement',
            reference_id: announcement.id,
            sent_at: new Date().toISOString(),
            sent_ok: true,
          })
          .select('id')
          .maybeSingle();
        notificationId = notification?.id ?? null;
      }

      if (!recipient.email) {
        failed++;
        await service
          .from('announcement_recipients')
          .update({ send_error: 'sin_email', notification_id: notificationId })
          .eq('id', recipient.id);
        continue;
      }

      try {
        // Se construye el HTML también en dry-run: así el escapado y el armado del
        // correo se ejercitan igual, y un error de plantilla no queda escondido hasta
        // el primer envío real.
        const html = buildEmailHtml(name, announcement.subject, announcement.body);
        if (isDryRun) {
          sent++;
          await service
            .from('announcement_recipients')
            .update({
              email_sent_ok: false,
              send_error: 'dry_run',
              notification_id: notificationId,
            })
            .eq('id', recipient.id);
          continue;
        }

        await transporter.sendMail({
          from,
          to: recipient.email,
          subject: announcement.subject,
          html,
        });
        sent++;
        await service
          .from('announcement_recipients')
          .update({
            email_sent_ok: true,
            send_error: null,
            notification_id: notificationId,
          })
          .eq('id', recipient.id);
      } catch (err) {
        failed++;
        console.error(`Error enviando a ${recipient.email}:`, err);
        await service
          .from('announcement_recipients')
          .update({
            email_sent_ok: false,
            send_error: String(err?.message ?? 'error desconocido').slice(0, 500),
            notification_id: notificationId,
          })
          .eq('id', recipient.id);
      }
    }

    const processed = (batch ?? []).length;
    const done = offset + processed >= recipientsTotal;

    return jsonResponse({ recipientsTotal, processed, sent, failed, done, dryRun: isDryRun });
  } catch (err) {
    console.error('send-announcement error:', err);
    return jsonResponse({ error: `Error interno: ${err?.message ?? 'desconocido'}` }, 500);
  }
});
