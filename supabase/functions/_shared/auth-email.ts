// supabase/functions/_shared/auth-email.ts
//
// Contenido de los correos de cuenta que dispara Supabase Auth (spec 0061-b, AC7). Los envía
// `send-auth-email`, que Supabase llama como Send Email Hook en vez de mandarlos él.
//
// POR QUÉ NO LA PLANTILLA DEL PANEL: los correos que manda Supabase llegaban con `dkim=fail`
// (el cuerpo se modifica después de la firma; los de nodemailer pasan por la misma ruta), y la
// plantilla vivía solo en el panel, sin versionar, firmada "Escuela de Conductores Chillán". Un
// usuario puede ser de cualquiera de las dos escuelas: el texto es neutro y firma la plataforma.
//
// Hoy el único que se dispara es `recovery` ("¿Olvidaste tu contraseña?" y el restablecimiento
// de una secretaria). Las invitaciones de alumnos ya no usan `inviteUserByEmail` (AC6). Cualquier
// otro tipo recibe un texto genérico: nunca se deja a alguien sin su enlace.

import { escapeHtml, platformSender, schoolFooterHtml } from './school-email.ts';

/** `email_data` del payload del hook (solo lo que se usa). */
export interface AuthEmailData {
  token_hash: string;
  redirect_to?: string | null;
  email_action_type: string;
  site_url?: string | null;
}

/** Enlace de verificación de GoTrue, el mismo que arma `{{ .ConfirmationURL }}`. */
export function buildAuthVerifyUrl(supabaseUrl: string, data: AuthEmailData): string {
  const url = new URL(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/verify`);
  url.searchParams.set('token', data.token_hash);
  url.searchParams.set('type', data.email_action_type);
  url.searchParams.set('redirect_to', data.redirect_to || data.site_url || '');
  return url.toString();
}

interface Copy {
  subject: string;
  title: string;
  intro: (email: string) => string;
  cta: string;
  outro: string;
}

const RECOVERY: Copy = {
  subject: 'Restablece tu contraseña',
  title: 'Restablece tu contraseña',
  intro: (email) =>
    `Recibimos una solicitud para restablecer la contraseña de tu cuenta (${email}).`,
  cta: 'Crear una contraseña nueva',
  outro: 'Si no pediste este cambio, ignora este correo: tu contraseña actual sigue funcionando.',
};

const GENERIC: Copy = {
  subject: 'Confirma esta acción en tu cuenta',
  title: 'Confirma esta acción en tu cuenta',
  intro: (email) => `Recibimos una solicitud sobre tu cuenta (${email}).`,
  cta: 'Continuar',
  outro: 'Si no fuiste tú, ignora este correo.',
};

export function authEmailContent(
  actionType: string,
  link: string,
  recipientEmail: string,
  platformAddress: string,
): { subject: string; html: string } {
  const copy = actionType === 'recovery' ? RECOVERY : GENERIC;
  const href = escapeHtml(link);
  const footer = schoolFooterHtml(platformSender(platformAddress));

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<!-- Fondo con relleno: Gmail descarta los estilos de <body>, y sin margen lateral la tarjeta
     redondeada toca el borde del fondo en el celular (esquinas recortadas dentro de un rectángulo). -->
<div style="background:#f1f5f9;padding:24px 12px;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="padding:36px 32px 28px;">
      <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">${escapeHtml(copy.title)}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#334155;">Hola,</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#334155;">${escapeHtml(copy.intro(recipientEmail))}</p>
      <p style="margin:0 0 24px;"><a href="${href}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(copy.cta)}</a></p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#64748b;">Si el botón no funciona, copia este enlace en tu navegador:<br><a href="${href}" style="color:#475569;word-break:break-all;">${href}</a></p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#64748b;">${escapeHtml(copy.outro)}</p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
${footer}
    </div>
  </div>
</div>
</body>
</html>`;

  return { subject: copy.subject, html };
}
