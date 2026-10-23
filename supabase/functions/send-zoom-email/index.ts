// supabase/functions/send-zoom-email/index.ts
//
// Edge Function: send-zoom-email
//
// Envía el enlace Zoom de una clase teórica por correo a los alumnos indicados.
// Usa el mismo servidor SMTP configurado en Supabase, cargado via Secrets.
//
// fix-367-m: solo admin/secretaria, y el navegador ya NO manda enlace, tema, fecha ni correos.
// Todo sale de la BD leída con la sesión del usuario (la RLS por sede aplica): la sesión teórica
// aporta enlace/tema/fecha y los destinatarios son matrículas activas del mismo ciclo.
//
// Body esperado:
//   classId      : number    — id de class_b_theory_sessions
//   enrollmentIds: number[]  — matrículas seleccionadas (se cruzan con el ciclo de la sesión)
//
// Respuestas:
//   200  { sent: number; errors: string[] }
//   400  { error: '...' }   — body inválido, enlace no https o sin destinatarios válidos
//   401 / 403  { error: '...' }
//   404  { error: '...' }   — la sesión no existe o no es de una sede visible
//   500  { error: '...' }
//
// Secrets requeridos (Supabase Dashboard → Edge Functions → Secrets):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';
import { authErrorResponse, requireStaff } from '../_shared/staff-auth.ts';
import { chileYear } from '../_shared/chile-time.ts';
import {
  buildZoomEmailContent,
  escapeHtml,
  parseEnrollmentIds,
  resolveZoomEmailBrand,
  selectZoomRecipients,
  type ZoomEmailBrand,
} from '../_shared/zoom-email.ts';

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
 * Todos los argumentos se escapan aquí: ninguno se interpola crudo en el HTML (fix-367-m).
 * fix-062-i: nombre, iniciales y colores de la sede del ciclo (antes "Conductores Chillán" fijo).
 */
function buildEmailHtml(
  rawName: string,
  rawTopic: string,
  rawDate: string,
  rawLink: string,
  brand: ZoomEmailBrand,
): string {
  const { theme } = brand;
  const school = escapeHtml(brand.schoolName);
  const initials = escapeHtml(brand.initials);
  const name = escapeHtml(rawName);
  const topic = escapeHtml(rawTopic);
  const date = escapeHtml(rawDate);
  const zoomLink = escapeHtml(rawLink);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enlace Zoom · ${topic}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif; background-color: #f1f5f9; line-height: 1.6; }
    .email-wrapper { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .email-header { background-color: ${theme.brandColor}; background: ${theme.gradientHero}; padding: 44px 36px 40px; text-align: center; position: relative; overflow: hidden; }
    .email-header::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px); background-size: 36px 36px; }
    .logo-badge { width: 60px; height: 60px; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; backdrop-filter: blur(8px); }
    .logo-badge span { color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .company-name { color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .email-body { padding: 44px 36px 36px; }
    .greeting { font-size: 13px; font-weight: 600; color: ${theme.brandColor}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
    .title { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-bottom: 12px; }
    .subtitle { font-size: 15px; color: #64748b; margin-bottom: 28px; line-height: 1.7; }
    .divider { height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent); margin: 24px 0; }
    .info-box { background: ${theme.brandColorLight}; border-left: 3px solid ${theme.brandColor}; padding: 18px 20px; border-radius: 10px; margin-bottom: 28px; }
    .info-box-label { font-size: 11px; font-weight: 700; color: ${theme.brandColorDark}; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
    .info-box-value { font-size: 16px; font-weight: 700; color: ${theme.brandColorDark}; }
    .topic-label { font-size: 12px; font-weight: 600; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .topic-value { font-size: 14px; color: ${theme.brandColorDark}; margin-top: 10px; }
    .cta-section { text-align: center; margin: 28px 0 20px; }
    .cta-label { font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    .cta-button { display: inline-block; background-color: ${theme.brandColor}; background: ${theme.gradientHero}; color: #ffffff !important; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; }
    .fallback-label { font-size: 12px; color: #94a3b8; margin: 20px 0 8px; text-align: center; }
    .fallback-link { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #475569; word-break: break-all; }
    .email-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 28px 36px; text-align: center; }
    .footer-divider { width: 40px; height: 2px; background: ${theme.brandColor}; border-radius: 2px; margin: 0 auto 14px; }
    .footer-brand { font-size: 14px; font-weight: 700; color: #334155; margin-bottom: 6px; }
    .footer-text { font-size: 12px; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-header">
    <div class="logo-badge"><span>${initials}</span></div>
    <p class="company-name">${school}</p>
  </div>
  <div class="email-body">
    <p class="greeting">Clase Teórica · Clase B</p>
    <h1 class="title">Tu enlace Zoom<br>está listo</h1>
    <p class="subtitle">Hola <strong>${name}</strong>, se ha agendado una clase teórica y aquí está tu enlace para conectarte el día de la clase.</p>
    <div class="info-box">
      <p class="info-box-label">Fecha y hora</p>
      <p class="info-box-value">${date}</p>
      <p class="topic-value"><strong>Tema:</strong> ${topic}</p>
    </div>
    <div class="divider"></div>
    <div class="cta-section">
      <p class="cta-label">Acceso a la clase</p>
      <a href="${zoomLink}" class="cta-button">Unirse por Zoom</a>
    </div>
    <p class="fallback-label">O copia este enlace en tu navegador:</p>
    <p class="fallback-link">${zoomLink}</p>
  </div>
  <div class="email-footer">
    <div class="footer-divider"></div>
    <p class="footer-brand">${school}</p>
    <p class="footer-text">Este correo fue enviado automáticamente. Por favor no responder.<br>© ${chileYear()} ${school}. Todos los derechos reservados.</p>
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Validar rol (admin / secretaria) ─────────────────────────────────────
    const access = await requireStaff(req, ['admin', 'secretary']);
    if (!access.ok) return authErrorResponse(access, corsHeaders);

    // ── Validar body: solo ids ───────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    const classId = body?.classId;
    const enrollmentIds = parseEnrollmentIds(body?.enrollmentIds);
    if (!Number.isInteger(classId) || classId <= 0 || !enrollmentIds) {
      return jsonResponse({ error: 'Parámetros inválidos' }, 400);
    }

    // ── Leer sesión y destinatarios con la sesión del usuario (RLS por sede) ─
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );

    const { data: session, error: sessionError } = await supabaseUser
      .from('class_b_theory_sessions')
      .select('id, cycle_id, class_number, class_date, topic, zoom_link')
      .eq('id', classId)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return jsonResponse({ error: 'Clase no encontrada' }, 404);

    const content = buildZoomEmailContent(session);
    if (!content) return jsonResponse({ error: 'La clase no tiene un enlace Zoom válido (https)' }, 400);

    // fix-062-i: marca de la sede del ciclo (website_config es de lectura pública).
    const { data: cycle } = await supabaseUser
      .from('class_b_theory_cycles')
      .select('branch_id')
      .eq('id', session.cycle_id)
      .maybeSingle();
    const { data: websiteConfig } = cycle?.branch_id
      ? await supabaseUser
          .from('website_config')
          .select('config')
          .eq('branch_id', cycle.branch_id)
          .maybeSingle()
      : { data: null };
    const brand = resolveZoomEmailBrand(websiteConfig?.config?.brand);

    const { data: rows, error: rowsError } = await supabaseUser
      .from('enrollments')
      .select('id, theory_cycle_id, status, students!inner(users!inner(first_names, paternal_last_name, email))')
      .in('id', enrollmentIds)
      .eq('theory_cycle_id', session.cycle_id);
    if (rowsError) throw rowsError;

    const recipients = selectZoomRecipients(rows ?? [], session.cycle_id, enrollmentIds);
    if (recipients.length === 0) {
      return jsonResponse({ error: 'Sin destinatarios con correo en este ciclo' }, 400);
    }

    // ── Configurar transporte SMTP ───────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST'),
      port: Number(Deno.env.get('SMTP_PORT') ?? 465),
      secure: Number(Deno.env.get('SMTP_PORT') ?? 465) === 465,
      auth: {
        user: Deno.env.get('SMTP_USER'),
        pass: Deno.env.get('SMTP_PASS'),
      },
    });

    const from = Deno.env.get('SMTP_FROM') ?? Deno.env.get('SMTP_USER');

    // ── Enviar correos ───────────────────────────────────────────────────────
    const result = { sent: 0, errors: [] as string[] };

    for (const recipient of recipients) {
      try {
        await transporter.sendMail({
          from,
          to: recipient.email,
          subject: content.subject,
          html: buildEmailHtml(recipient.name, content.topic, content.date, content.zoomLink, brand),
        });
        result.sent++;
      } catch (err) {
        console.error(`Error enviando a ${recipient.email}:`, err);
        result.errors.push(recipient.email);
      }
    }

    return jsonResponse(result);
  } catch (err) {
    console.error('send-zoom-email error:', err);
    return jsonResponse({ error: `Error interno: ${err?.message ?? 'desconocido'}` }, 500);
  }
});
