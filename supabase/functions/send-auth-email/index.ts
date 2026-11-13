// supabase/functions/send-auth-email/index.ts
//
// Edge Function: send-auth-email — Send Email Hook de Supabase Auth (spec 0061-b, AC7/AC9).
//
// Supabase Auth, en vez de mandar él sus correos (recuperar contraseña y cualquier otro), llama a
// esta función con el usuario y los datos del enlace; acá se arma el correo y se envía por
// nuestro SMTP. Dos razones:
//   1. Los correos que mandaba Supabase llegaban con `dkim=fail` (el cuerpo se modifica después
//      de la firma; los de nodemailer pasan DKIM por la misma ruta, probado el 2026-11-12).
//   2. La plantilla vivía solo en el panel, sin versionar, firmada por una escuela. Un usuario
//      puede ser de cualquiera de las dos: el texto es neutro y firma la plataforma.
//
// Hoy el único tipo que llega es `recovery` ("¿Olvidaste tu contraseña?" y el restablecimiento
// de la clave de una secretaria). Las invitaciones de alumnos ya no usan `inviteUserByEmail`
// (AC6). Otro tipo recibe un texto genérico neutro: nadie se queda sin su enlace.
//
// Seguridad: la llama Supabase Auth, no un usuario, así que va sin verificación de JWT
// (`verify_jwt = false` en config.toml) y en su lugar se exige la firma `standardwebhooks` con el
// secret del hook. Sin firma válida no se envía nada.
//
// ACTIVACIÓN (la hace Matías, en este orden):
//   1. Desplegar esta función y probarla con una llamada firmada.
//   2. Authentication → Hooks → Send Email → HTTPS → URL de esta función → generar secret.
//   3. Guardar ese secret como SEND_EMAIL_HOOK_SECRET en los secrets de Edge Functions.
//   VUELTA ATRÁS: desactivar el hook en el panel; Supabase vuelve a su SMTP y su plantilla.
//
// Secrets: SEND_EMAIL_HOOK_SECRET, SUPABASE_URL, SMTP_* (ver _shared/school-mailer.ts)
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { Webhook } from 'npm:standardwebhooks@1.0.0';
import { authEmailContent, buildAuthVerifyUrl } from '../_shared/auth-email.ts';
import { platformSender } from '../_shared/school-email.ts';
import { createSmtpTransport, platformAddress, sendSchoolMail } from '../_shared/school-mailer.ts';

function hookError(status: number, message: string) {
  // Formato que espera Supabase Auth para mostrar el error en sus logs.
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return hookError(405, 'Método no permitido');

  const secret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
  if (!secret) {
    console.error('send-auth-email: falta SEND_EMAIL_HOOK_SECRET');
    return hookError(500, 'Hook sin configurar');
  }

  const payload = await req.text();
  let event;
  try {
    const wh = new Webhook(secret.replace(/^v1,whsec_/, ''));
    event = wh.verify(payload, Object.fromEntries(req.headers));
  } catch (err) {
    console.error('send-auth-email: firma inválida', err?.message ?? err);
    return hookError(401, 'Firma inválida');
  }

  const email = event?.user?.email;
  const data = event?.email_data;
  if (!email || !data?.token_hash || !data?.email_action_type) {
    return hookError(400, 'Payload incompleto');
  }

  try {
    const fromAddress = platformAddress();
    const link = buildAuthVerifyUrl(Deno.env.get('SUPABASE_URL')!, data);
    const { subject, html } = authEmailContent(data.email_action_type, link, email, fromAddress);

    await sendSchoolMail(createSmtpTransport(), platformSender(fromAddress), {
      to: email,
      subject,
      html,
    });
  } catch (err) {
    console.error('send-auth-email: no se pudo enviar', err?.message ?? err);
    return hookError(500, 'No se pudo enviar el correo');
  }

  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
});
