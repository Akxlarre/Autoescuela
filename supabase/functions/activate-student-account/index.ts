// supabase/functions/activate-student-account/index.ts
//
// Edge Function: activate-student-account
//
// Crea la cuenta Supabase Auth para un alumno matriculado y le envía un
// correo de invitación para que establezca su contraseña.
// También sirve como "reenviar invitación" si el alumno no activó su cuenta.
//
// Body esperado:
//   userId : number  — ID numérico en public.users (requerido)
//   email  : string  — correo del alumno (requerido, debe coincidir con users.email)
//
// Respuestas:
//   201  { success: true, status: 'invited' }          — cuenta creada y correo enviado
//   200  { success: true, status: 'reinvited' }        — reenvío de invitación exitoso
//   409  { error: '...' }                              — alumno ya activó su cuenta
//   400 / 401 / 403 / 404 / 500                        — errores estándar
//
// Flujo primera vez (supabase_uid IS NULL):
//   1. auth.admin.inviteUserByEmail → crea auth user + envía email nativo de Supabase
//      (template supabase/email-templates/invite-user.html, configurado en el Dashboard)
//   2. UPDATE users SET supabase_uid = authUser.id
//
// Flujo reenvío (supabase_uid NOT NULL y first_login = true):
//   1. auth.admin.generateLink({ type: 'magiclink' }) — inviteUserByEmail FALLA con
//      "already registered" si el usuario de Auth ya existe (DG-068 en
//      indices/DOMAIN-GOTCHAS.md, mismo gotcha que fix-168-m/fix-169-m resolvieron para
//      instructores). generateLink() no envía correo, así que el envío se hace manual
//      por SMTP (fix-254-m) con una copia exacta del template nativo de invitación.
//   (supabase_uid ya estaba seteado, no se modifica)
//
// Secrets requeridos para el reenvío (Supabase Dashboard → Edge Functions → Secrets):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (mismos que activate-instructor-account)
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';

// Colors sourced from webs/src/styles/themes/{azul,roja}.css — single source of truth.
const THEME_COLORS = {
  azul: {
    brandColor: '#0ea5e9',
    brandColorDark: '#0369a1',
    brandColorLight: '#f0f9ff',
    brandColorMuted: '#e0f2fe',
    gradientHero: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 60%, #8b5cf6 100%)',
    gradientCta: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
    gradientFooter: 'linear-gradient(to right, #0ea5e9, #6366f1)',
    shadowColor: 'rgba(14, 165, 233, 0.35)',
  },
  roja: {
    brandColor: '#fd2018',
    brandColorDark: '#bc0b05',
    brandColorLight: '#fff1f0',
    brandColorMuted: '#ffe2e0',
    gradientHero: 'linear-gradient(160deg, #bc0b05 0%, #fd2018 55%, #f97316 100%)',
    gradientCta: 'linear-gradient(135deg, #fd2018 0%, #f97316 100%)',
    gradientFooter: 'linear-gradient(to right, #fd2018, #f97316)',
    shadowColor: 'rgba(253, 32, 24, 0.35)',
  },
} as const;

function getSchoolInitials(name: string): string {
  return name
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

// Copia exacta de supabase/email-templates/invite-user.html (el template nativo de
// Supabase Auth, disparado por inviteUserByEmail), portada de sintaxis Go
// ({{ index .Data "x" }} / {{ .ConfirmationURL }}) a template literals de TS — fix-254-m.
// El reenvío usa generateLink({ type: 'magiclink' }), que NO envía correo, así que este
// HTML se despacha por SMTP propio. Debe mantenerse en sync con invite-user.html: si se
// edita uno, editar el otro.
function buildStudentInviteEmailHtml(
  actionLink: string,
  colors: ThemeColors,
  schoolName: string,
  schoolInitials: string,
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activa tu cuenta - ${schoolName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif; background-color: #f1f5f9; line-height: 1.6; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; margin-top: 24px; margin-bottom: 24px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); }
    .email-header { padding: 44px 36px 40px; text-align: center; position: relative; overflow: hidden; }
    .email-header::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px); background-size: 36px 36px; }
    .logo-badge { width: 60px; height: 60px; background-color: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; }
    .logo-badge span { color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .company-name { color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .email-body { padding: 44px 36px 36px; }
    .greeting { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
    .title { font-size: 30px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-bottom: 14px; }
    .subtitle { font-size: 15px; color: #64748b; margin-bottom: 32px; line-height: 1.7; }
    .divider { height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent); margin: 28px 0; }
    .features { display: flex; gap: 0; margin-bottom: 32px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .feature-item { flex: 1; padding: 16px 12px; text-align: center; border-right: 1px solid #e2e8f0; }
    .feature-item:last-child { border-right: none; }
    .feature-icon { font-size: 20px; display: block; margin-bottom: 6px; }
    .feature-label { font-size: 12px; font-weight: 600; color: #475569; line-height: 1.3; }
    .cta-section { text-align: center; margin: 28px 0 20px; }
    .cta-label { font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    .cta-link { display: inline-block; color: #ffffff !important; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; }
    .expiry-note { font-size: 13px; color: #94a3b8; margin-top: 14px; }
    .expiry-note strong { color: #64748b; }
    .info-box { padding: 18px 20px; border-radius: 10px; margin-top: 28px; }
    .info-box-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
    .info-box-text { font-size: 14px; line-height: 1.6; }
    .email-footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 28px 36px; text-align: center; }
    .footer-brand { font-size: 14px; font-weight: 700; color: #334155; margin-bottom: 6px; }
    .footer-text { font-size: 12px; color: #94a3b8; margin: 4px 0; line-height: 1.6; }
    .footer-divider { width: 40px; height: 2px; border-radius: 2px; margin: 14px auto; }
  </style>
</head>
<body>
<div class="email-wrapper">

  <div class="email-header" style="background-color: ${colors.brandColor}; background: ${colors.gradientHero};">
    <div class="logo-badge">
      <span>${schoolInitials}</span>
    </div>
    <p class="company-name">${schoolName}</p>
  </div>

  <div class="email-body">

    <p class="greeting" style="color: ${colors.brandColor};">¡Bienvenido(a)!</p>
    <h1 class="title">Tu cuenta está<br>lista para activar</h1>
    <p class="subtitle">
      Tu proceso de matrícula ha sido completado exitosamente. Activa tu
      cuenta para acceder a tu portal de alumno, donde podrás hacer seguimiento
      a todo tu proceso de formación.
    </p>

    <div class="features">
      <div class="feature-item">
        <span class="feature-icon">📅</span>
        <span class="feature-label">Mi horario</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">📊</span>
        <span class="feature-label">Mi progreso</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">💳</span>
        <span class="feature-label">Mis pagos</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="cta-section">
      <p class="cta-label">Paso único</p>
      <table cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
        <tr>
          <td align="center" bgcolor="${colors.brandColor}" style="background-color: ${colors.brandColor}; background: ${colors.gradientCta}; border-radius: 12px;">
            <a href="${actionLink}" class="cta-link" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 16px 48px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; border-radius: 12px;">
              Activar mi cuenta
            </a>
          </td>
        </tr>
      </table>
      <p class="expiry-note">
        Este enlace es válido por <strong>1 día</strong>.<br>
        Al hacer clic podrás crear tu contraseña personal.
      </p>
    </div>

    <div class="info-box" style="background-color: ${colors.brandColorLight}; background: linear-gradient(135deg, ${colors.brandColorLight} 0%, ${colors.brandColorMuted} 100%); border-left: 3px solid ${colors.brandColor};">
      <div class="info-box-title" style="color: ${colors.brandColorDark};">¿Qué sigue?</div>
      <p class="info-box-text" style="color: ${colors.brandColorDark};">
        Una vez activada tu cuenta podrás ver tu calendario de clases y revisar
        tu estado de pagos a través de tu portal personal.
      </p>
    </div>

  </div>

  <div class="email-footer">
    <div class="footer-divider" style="background-color: ${colors.brandColor}; background: ${colors.gradientFooter};"></div>
    <p class="footer-brand">${schoolName}</p>
    <p class="footer-text">
      Este correo fue enviado automáticamente tras completar tu proceso de matrícula.<br>
      Si no esperabas este correo, puedes ignorarlo con seguridad.
    </p>
    <p class="footer-text" style="margin-top: 10px;">© 2026 ${schoolName}. Todos los derechos reservados.</p>
  </div>

</div>
</body>
</html>`;
}

async function sendStudentInviteEmail(email: string, html: string): Promise<void> {
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
    subject: 'Activa tu cuenta',
    html,
  });
}

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

    // ── Buscar el usuario en la tabla users ───────────────────────────────────
    const { data: targetUser, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, email, supabase_uid, first_login, branch_id, roles(name)')
      .eq('id', userId)
      .maybeSingle();

    if (findError || !targetUser) {
      return errorResponse('Usuario no encontrado en la base de datos', 404);
    }

    // Verificar que el email coincide (evita activar la cuenta equivocada)
    if (targetUser.email?.toLowerCase() !== email.toLowerCase()) {
      return errorResponse('El email no coincide con el registrado para este usuario', 400);
    }

    // Verificar que sea alumno (nombre del rol en BD: 'student')
    if (targetUser.roles?.name !== 'student') {
      return errorResponse('Esta acción solo aplica a usuarios con rol alumno', 400);
    }

    // ── Caso: ya activó su cuenta (no reenviar) ───────────────────────────────
    if (targetUser.supabase_uid && !targetUser.first_login) {
      return errorResponse(
        'Este alumno ya activó su cuenta. Si necesita recuperar su contraseña, use la opción de recuperación.',
        409,
      );
    }

    // ── Leer configuración de marca de la sede para personalizar el correo ────
    const { data: websiteConfig } = await supabaseAdmin
      .from('website_config')
      .select('config')
      .eq('branch_id', targetUser.branch_id)
      .maybeSingle();

    const theme = (websiteConfig?.config?.brand?.theme ?? 'azul') as keyof typeof THEME_COLORS;
    const colors = THEME_COLORS[theme] ?? THEME_COLORS.azul;
    const schoolName = (websiteConfig?.config?.brand?.name ?? 'Autoescuela').normalize('NFC');
    const schoolInitials = getSchoolInitials(schoolName);

    // ── Enviar invitación (primera vez o reenvío) ─────────────────────────────
    const siteUrl =
      Deno.env.get('SITE_URL') ?? Deno.env.get('SUPABASE_URL')!.replace('.supabase.co', '');

    // fix-254-m: inviteUserByEmail falla con "already registered" si el usuario de Auth
    // ya existe (DG-068) — solo sirve para la PRIMERA vez. El reenvío usa generateLink
    // con magiclink, que sí funciona sobre un usuario existente pero no envía correo.
    if (targetUser.supabase_uid) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          redirectTo: siteUrl,
          data: { role: 'student', schoolName, schoolInitials, ...colors },
        },
      });

      if (linkError) {
        console.error('generateLink (magiclink) error:', linkError);
        return errorResponse(`Error al generar el link de activación: ${linkError.message}`, 500);
      }

      const actionLink = linkData.properties.action_link;

      try {
        await sendStudentInviteEmail(
          email,
          buildStudentInviteEmailHtml(actionLink, colors, schoolName, schoolInitials),
        );
      } catch (emailError) {
        console.error('Error al enviar correo de reenvío:', emailError?.message ?? emailError);
        return errorResponse('No se pudo enviar el correo de invitación. Intente nuevamente.', 500);
      }

      // ── Reenvío: supabase_uid ya existía (first_login = true) ──────────────
      return jsonResponse({ success: true, status: 'reinvited' });
    }

    // ── Primera vez: inviteUserByEmail crea la cuenta + envía el correo nativo ─
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: siteUrl,
        data: { role: 'student', schoolName, schoolInitials, ...colors },
      });

    if (inviteError) {
      console.error('inviteUserByEmail error:', inviteError);
      return errorResponse(`Error al enviar la invitación: ${inviteError.message}`, 500);
    }

    const authUserId = inviteData.user?.id;
    if (!authUserId) {
      return errorResponse('No se pudo obtener el ID del usuario de Auth', 500);
    }

    // ── Vincular supabase_uid en users ────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ supabase_uid: authUserId })
      .eq('id', userId);

    if (updateError) {
      console.error('Error vinculando supabase_uid:', updateError);
      // No es fatal: la cuenta existe en Auth, pero el vínculo falló.
      // El admin puede reintentar (la función es idempotente en el reenvío).
      return errorResponse(
        'Invitación enviada pero no se pudo vincular la cuenta. Reintente.',
        500,
      );
    }

    // Notificar bienvenida al alumno (Spec 0025, AC6). Solo en la PRIMERA invitación
    // — el reenvío (rama de arriba) no debe duplicar esta notificación.
    // Try/catch propio: un fallo del INSERT jamás afecta la respuesta de la invitación.
    try {
      const { error: notifyError } = await supabaseAdmin.from('notifications').insert({
        recipient_id: userId,
        type: 'system',
        subject: 'Bienvenido al portal',
        message: 'Tu cuenta ya está lista. Revisa tu correo para activar tu contraseña.',
        reference_type: null, // sin subtipo — mapea a severidad 'info' por defecto en el panel
        read: false,
        sent_ok: true,
      });
      if (notifyError) {
        console.error('[activate-student-account] notification insert error:', notifyError);
      }
    } catch (notifyErr) {
      console.error('[activate-student-account] notification dispatch error:', notifyErr);
    }

    return jsonResponse({ success: true, status: 'invited' }, 201);
  } catch (err) {
    console.error('activate-student-account error:', err);
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
