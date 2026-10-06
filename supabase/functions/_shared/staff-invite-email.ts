// supabase/functions/_shared/staff-invite-email.ts
//
// Correo de activación de una cuenta de personal (fix-182-b). La cuenta se crea SIN contraseña
// (generateLink 'invite'); este correo lleva el link con el que la persona crea la suya.
//
// Función pura, sin dependencias: el envío SMTP lo hace la Edge Function que la usa.
// Tests: deno test supabase/functions/_shared/staff-invite-email.test.ts

export interface StaffInviteEmailInput {
  /** Nombre completo de la persona invitada (texto plano: se escapa). */
  name: string;
  /** Rol en minúsculas, para el copy: 'secretaria', 'instructor'… */
  roleLabel: string;
  /** action_link de generateLink. Debe ser https. */
  actionLink: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildStaffInviteEmail({ name, roleLabel, actionLink }: StaffInviteEmailInput): {
  subject: string;
  html: string;
} {
  if (!/^https:\/\//i.test(actionLink)) {
    throw new Error('El link de activación debe ser https');
  }
  const safeName = escapeHtml(name);
  const safeRole = escapeHtml(roleLabel);
  const safeLink = escapeHtml(actionLink);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activa tu cuenta de ${safeRole}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; background-color: #f1f5f9; line-height: 1.6; }
    .wrapper { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 60%, #8b5cf6 100%); padding: 40px 36px; text-align: center; }
    .company { color: rgba(255,255,255,0.92); font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .body { padding: 40px 36px 32px; }
    .greeting { font-size: 13px; font-weight: 600; color: #0ea5e9; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
    .title { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-bottom: 12px; }
    .subtitle { font-size: 15px; color: #64748b; margin-bottom: 28px; }
    .cta { text-align: center; margin: 28px 0 20px; }
    .button { display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); color: #ffffff !important; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 700; font-size: 16px; }
    .note { font-size: 13px; color: #94a3b8; margin-top: 14px; }
    .fallback-label { font-size: 12px; color: #94a3b8; margin: 20px 0 8px; text-align: center; }
    .fallback { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #475569; word-break: break-all; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 36px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header"><p class="company">Conductores Chillán</p></div>
  <div class="body">
    <p class="greeting">Cuenta de ${safeRole}</p>
    <h1 class="title">Tu cuenta está lista para activar</h1>
    <p class="subtitle">Hola <strong>${safeName}</strong>, se creó tu cuenta de ${safeRole}. Haz clic en el botón para crear tu contraseña y entrar al sistema.</p>
    <div class="cta">
      <a href="${safeLink}" class="button">Activar mi cuenta</a>
      <p class="note">Al hacer clic podrás crear tu contraseña personal. Nadie más la conocerá.</p>
    </div>
    <p class="fallback-label">O copia este enlace en tu navegador:</p>
    <p class="fallback">${safeLink}</p>
  </div>
  <div class="footer">Este correo se envió automáticamente al crear tu cuenta.<br>Si no esperabas este correo, puedes ignorarlo.</div>
</div>
</body>
</html>`;

  return { subject: `Activa tu cuenta de ${roleLabel}`, html };
}
