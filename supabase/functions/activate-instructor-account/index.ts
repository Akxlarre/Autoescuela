// supabase/functions/activate-instructor-account/index.ts
//
// Edge Function: activate-instructor-account
//
// (Re)envía la invitación de activación de cuenta a un instructor que todavía no
// seteó su contraseña. Cubre DOS casos con la misma función (fix-169-m):
//   - Reenvío normal: el instructor ya tiene cuenta de Auth (creada por
//     `create-instructor`) pero `first_login = true` — nunca activó, o el correo
//     original no llegó.
//   - Primera activación tardía: el instructor NO tiene cuenta de Auth
//     (`supabase_uid IS NULL`) porque su fila se insertó fuera del flujo normal
//     (seed, SQL directo) — `create-instructor` es la única vía que garantiza
//     `supabase_uid` seteado desde la creación; una fila insertada por fuera de
//     ese camino no tiene esa garantía.
//
// Body esperado:
//   userId : number  — ID numérico en public.users (requerido)
//   email  : string  — correo del instructor (requerido, debe coincidir con users.email)
//
// Respuestas:
//   200  { success: true, status: 'reinvited' }  — (re)envío exitoso
//   409  { error: '...' }                        — el instructor ya activó su cuenta
//   400 / 401 / 403 / 404 / 500                  — errores estándar
//
// Flujo:
//   1. Valida que el llamador sea admin o secretaria
//   2. Busca el instructor en public.users, valida rol
//   3. Solo rechaza (409) si REALMENTE ya activó: tiene `supabase_uid` Y ya cambió
//      su contraseña (`first_login = false`). `first_login = false` sin
//      `supabase_uid` es dato inconsistente de una fila que nunca tuvo cuenta, no
//      de una ya activada — no debe bloquear.
//   4. auth.admin.generateLink({ type: 'magiclink' }) → crea la cuenta de Auth si
//      no existía, o genera un link para la existente si ya la tenía (a diferencia
//      de `type: 'invite'`, que falla con "already registered" para un usuario
//      existente — ver DG-066 en indices/DOMAIN-GOTCHAS.md)
//   5. Sincroniza `public.users.supabase_uid`/`first_login` con el resultado —
//      necesario para el caso de "cuenta recién creada", inocuo para el reenvío
//   6. Envía el correo con el mismo copy que create-instructor vía SMTP propio
//
// Secrets requeridos (Supabase Dashboard → Edge Functions → Secrets):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
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

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

// Copy idéntico al de create-instructor (buildInviteEmailHtml) — mismo template,
// mismo asunto, para que el instructor no note diferencia entre la primera
// invitación y un reenvío.
function buildInviteEmailHtml(name: string, actionLink: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activa tu cuenta de instructor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif; background-color: #f1f5f9; line-height: 1.6; }
    .email-wrapper { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .email-header { background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 60%, #8b5cf6 100%); padding: 44px 36px 40px; text-align: center; position: relative; overflow: hidden; }
    .email-header::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px); background-size: 36px 36px; }
    .logo-badge { width: 60px; height: 60px; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; backdrop-filter: blur(8px); }
    .logo-badge span { color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .company-name { color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .email-body { padding: 44px 36px 36px; }
    .greeting { font-size: 13px; font-weight: 600; color: #0ea5e9; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
    .title { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-bottom: 12px; }
    .subtitle { font-size: 15px; color: #64748b; margin-bottom: 28px; line-height: 1.7; }
    .divider { height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent); margin: 24px 0; }
    .cta-section { text-align: center; margin: 28px 0 20px; }
    .cta-label { font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); color: #ffffff !important; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; box-shadow: 0 4px 20px rgba(14,165,233,0.35); }
    .expiry-note { font-size: 13px; color: #94a3b8; margin-top: 14px; }
    .fallback-label { font-size: 12px; color: #94a3b8; margin: 20px 0 8px; text-align: center; }
    .fallback-link { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #475569; word-break: break-all; }
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
    <p class="greeting">Cuenta de instructor</p>
    <h1 class="title">Tu cuenta está<br>lista para activar</h1>
    <p class="subtitle">Hola <strong>${name}</strong>, se ha creado tu cuenta de instructor. Activa tu acceso para entrar a tu portal, donde podrás ver tu agenda de clases y gestionar tus alumnos.</p>
    <div class="divider"></div>
    <div class="cta-section">
      <p class="cta-label">Paso único</p>
      <a href="${actionLink}" class="cta-button">Activar mi cuenta</a>
      <p class="expiry-note">Al hacer clic podrás crear tu contraseña personal.</p>
    </div>
    <p class="fallback-label">O copia este enlace en tu navegador:</p>
    <p class="fallback-link">${actionLink}</p>
  </div>
  <div class="email-footer">
    <div class="footer-divider"></div>
    <p class="footer-brand">Conductores Chillán</p>
    <p class="footer-text">Este correo fue enviado automáticamente tras crear tu cuenta de instructor.<br>Si no esperabas este correo, puedes ignorarlo con seguridad.</p>
  </div>
</div>
</body>
</html>`;
}

async function sendInstructorInviteEmail(
  name: string,
  email: string,
  actionLink: string,
): Promise<void> {
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

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Activa tu cuenta de instructor',
    html: buildInviteEmailHtml(name, actionLink),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Cliente admin (bypasea RLS, puede llamar auth.admin.*) ────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Validar que el llamador es admin o secretaria ─────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('No autorizado', 401);

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user: caller },
    } = await supabaseUser.auth.getUser();
    if (!caller) return errorResponse('No autorizado', 401);

    const { data: callerRow } = await supabaseAdmin
      .from('users')
      .select('id, roles(name)')
      .eq('supabase_uid', caller.id)
      .maybeSingle();

    const callerRole = callerRow?.roles?.name;
    if (callerRole !== 'admin' && callerRole !== 'secretary') {
      return errorResponse('Solo administradores y secretarias pueden realizar esta acción', 403);
    }

    // ── Leer y validar body ───────────────────────────────────────────────────
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return errorResponse('Se requieren userId y email');
    }

    // ── Buscar el instructor en la tabla users ────────────────────────────────
    const { data: targetUser, error: findError } = await supabaseAdmin
      .from('users')
      .select(
        'id, email, first_names, paternal_last_name, maternal_last_name, first_login, supabase_uid, roles(name)',
      )
      .eq('id', userId)
      .maybeSingle();

    if (findError || !targetUser) {
      return errorResponse('Usuario no encontrado en la base de datos', 404);
    }

    // Verificar que el email coincide (evita reenviar la invitación equivocada)
    if (targetUser.email?.toLowerCase() !== email.toLowerCase()) {
      return errorResponse('El email no coincide con el registrado para este usuario', 400);
    }

    // Verificar que sea instructor (nombre del rol en BD: 'instructor')
    if (targetUser.roles?.name !== 'instructor') {
      return errorResponse('Esta acción solo aplica a usuarios con rol instructor', 400);
    }

    // ── Caso: ya activó su cuenta (no reenviar) ───────────────────────────────
    // OJO: `first_login` solo, sin `supabase_uid`, no basta (fix-169-m) — un
    // instructor insertado directo por SQL/seed puede tener `first_login = false`
    // sin haber tenido nunca una cuenta de Auth. Solo se rechaza cuando REALMENTE
    // ya activó su cuenta: tiene `supabase_uid` Y ya cambió su contraseña.
    if (targetUser.supabase_uid && !targetUser.first_login) {
      return errorResponse('Este instructor ya activó su cuenta.', 409);
    }

    // ── Generar nuevo link de activación (no envía correo nativo) ─────────────
    const fullName = [
      targetUser.first_names,
      targetUser.paternal_last_name,
      targetUser.maternal_last_name,
    ]
      .filter(Boolean)
      .join(' ');
    const siteUrl = Deno.env.get('SITE_URL') ?? '';

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: siteUrl,
        data: { role: 'instructor', full_name: fullName },
      },
    });

    if (linkError) {
      return errorResponse(`Error al generar el link de activación: ${linkError.message}`, 500);
    }

    const actionLink = linkData.properties.action_link;
    const authUserId = linkData.user?.id;

    // ── Sincronizar public.users con el usuario de Auth (fix-169-m) ──────────
    // `generateLink({ type: 'magiclink' })` crea la cuenta de Auth si no existía
    // (instructor sin cuenta previa: `supabase_uid IS NULL`), o reutiliza la
    // existente (reenvío normal). En ambos casos hay que dejar `public.users`
    // apuntando al `id` de Auth vigente — si no, `AuthFacade.buildUserFromDb()`
    // no encuentra la fila al hacer clic en el link, resuelve `role: 'unknown'`
    // y `roleRedirectGuard` fuerza logout de vuelta a /login. Idempotente: si ya
    // coincidía, el UPDATE no cambia nada.
    if (authUserId) {
      const { error: linkUpdateError } = await supabaseAdmin
        .from('users')
        .update({ supabase_uid: authUserId, first_login: true })
        .eq('id', userId);

      if (linkUpdateError) {
        console.error('Error vinculando supabase_uid:', linkUpdateError);
        return errorResponse(
          'Invitación generada pero no se pudo vincular la cuenta. Reintente.',
          500,
        );
      }
    }

    // ── Enviar correo de invitación ───────────────────────────────────────────
    try {
      await sendInstructorInviteEmail(fullName, email, actionLink);
    } catch (emailError) {
      console.error('Error al enviar correo de invitación:', emailError?.message ?? emailError);
      return errorResponse('No se pudo enviar el correo de invitación. Intente nuevamente.', 500);
    }

    return jsonResponse({ success: true, status: 'reinvited' });
  } catch (err) {
    console.error('activate-instructor-account error:', err);
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
