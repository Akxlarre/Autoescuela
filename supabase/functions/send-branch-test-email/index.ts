// supabase/functions/send-branch-test-email/index.ts
//
// Edge Function: send-branch-test-email (spec 0061-b, AC12)
//
// "Enviar correo de prueba" de la configuración de correo de una escuela. Le manda al ADMIN QUE
// LLAMA un correo con el remitente, la dirección de respuesta y el pie de esa escuela, tal como
// salen los correos reales, para que vea el resultado antes de que lo reciba un alumno.
//
// El destinatario es siempre el correo del admin, leído de `users`, nunca uno que venga en el
// body: si no, esta función serviría para mandar correos a nombre de la escuela a cualquiera.
//
// Body esperado:
//   branchId : number — escuela cuya configuración se prueba
//
// Respuestas:
//   200  { success: true, recipientEmail, from, replyTo }
//   400  { error: '...' }   — body inválido o el admin no tiene correo
//   401 / 403               — sin sesión o no es admin
//   404  { error: '...' }   — la escuela no existe
//   422  { error: '...' }   — el servidor de correo rechazó el envío (su mensaje, tal cual)
//   500  { error: '...' }
//
// Secrets: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (ver _shared/school-mailer.ts)
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authErrorResponse, requireStaff } from '../_shared/staff-auth.ts';
import {
  BRANCH_EMAIL_COLUMNS,
  domainLineHtml,
  escapeHtml,
  resolveSender,
  schoolFooterHtml,
  withSchool,
} from '../_shared/school-email.ts';
import { createSmtpTransport, platformAddress, sendSchoolMail } from '../_shared/school-mailer.ts';

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

function buildTestEmailHtml(sender): string {
  const school = escapeHtml(sender.schoolName);
  const from = escapeHtml(`${sender.fromName} <${sender.fromAddress}>`);
  const reply = sender.replyTo ? escapeHtml(sender.replyTo) : 'sin dirección de respuesta';
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Correo de prueba</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<!-- Fondo con relleno: Gmail descarta los estilos de <body>, y sin margen lateral la tarjeta
     redondeada toca el borde del fondo en el celular (esquinas recortadas dentro de un rectángulo). -->
<div style="background:#f1f5f9;padding:24px 12px;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="padding:32px;">
      <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">Correo de prueba de ${school}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155;">Así ven los alumnos el remitente y el pie de los correos de esta escuela. Si respondes este correo, la respuesta debería llegar al correo de respuesta configurado.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size:13px;color:#334155;border:1px solid #e2e8f0;border-radius:10px;">
        <tr><td style="padding:8px 12px;color:#64748b;">Remitente</td><td style="padding:8px 12px;">${from}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;">Respuesta</td><td style="padding:8px 12px;">${reply}</td></tr>
      </table>
      ${domainLineHtml(sender)}
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
${schoolFooterHtml(sender)}
    </div>
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
    const access = await requireStaff(req, ['admin']);
    if (!access.ok) return authErrorResponse(access, corsHeaders);

    const body = await req.json().catch(() => null);
    const branchId = Number(body?.branchId);
    if (!Number.isInteger(branchId) || branchId <= 0) {
      return jsonResponse({ error: 'Parámetros inválidos' }, 400);
    }

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [{ data: branch, error: branchError }, { data: admin, error: adminError }] =
      await Promise.all([
        service.from('branches').select(BRANCH_EMAIL_COLUMNS).eq('id', branchId).maybeSingle(),
        service.from('users').select('email').eq('id', access.userId).maybeSingle(),
      ]);
    if (branchError) throw branchError;
    if (adminError) throw adminError;
    if (!branch) return jsonResponse({ error: 'Escuela no encontrada' }, 404);

    const to = admin?.email?.trim();
    if (!to) return jsonResponse({ error: 'Tu usuario no tiene un correo registrado' }, 400);

    // Sin pasar por loadSchoolSender: acá un error de lectura tiene que verse, no degradarse a
    // la dirección neutra como en un envío real.
    const sender = resolveSender(branch, platformAddress());

    try {
      await sendSchoolMail(createSmtpTransport(), sender, {
        to,
        subject: withSchool('Correo de prueba', sender),
        html: buildTestEmailHtml(sender),
      });
    } catch (smtpError) {
      console.error('send-branch-test-email: el servidor de correo rechazó el envío', smtpError);
      return jsonResponse(
        {
          error: `El servidor de correo rechazó el envío: ${String(smtpError?.message ?? 'error desconocido').slice(0, 300)}`,
        },
        422,
      );
    }

    return jsonResponse({
      success: true,
      recipientEmail: to,
      from: `${sender.fromName} <${sender.fromAddress}>`,
      replyTo: sender.replyTo,
    });
  } catch (err) {
    console.error('send-branch-test-email error:', err);
    return jsonResponse({ error: `Error interno: ${err?.message ?? 'desconocido'}` }, 500);
  }
});
