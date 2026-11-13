// supabase/functions/_shared/student-invite-email.ts
//
// Correo de activación de la cuenta del alumno (spec 0061-b, AC6).
//
// Lo usan los dos caminos que crean la cuenta de un alumno: `activate-student-account` (la
// secretaria activa desde la matrícula o la ficha, primera vez y reenvío) y `public-enrollment`
// (matrícula online). Antes la primera vez de ambos usaba `inviteUserByEmail`, que manda el correo
// desde Supabase Auth con su remitente y la plantilla del panel (`invite-user.html`); desde
// 0061-b los dos crean el enlace con `generateLink` y envían este HTML por SMTP propio, con el
// remitente de la escuela.
//
// El cuerpo es el de `supabase/email-templates/invite-user.html` portado a TS (fix-254-m), sin
// rediseño. Cambia solo el pie (el común de `school-email.ts`, sin "© 2026" fijo) y la línea que
// explica el dominio (AC8). `invite-user.html` ya no se usa y no hace falta mantenerlo en sync.

import { domainLineHtml, escapeHtml, schoolFooterHtml, type SchoolSender } from './school-email.ts';

// Colores de webs/src/styles/themes/{azul,roja}.css.
export const STUDENT_INVITE_THEMES = {
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

export type StudentInviteColors =
  (typeof STUDENT_INVITE_THEMES)[keyof typeof STUDENT_INVITE_THEMES];

export const STUDENT_INVITE_SUBJECT = 'Activa tu cuenta';

export function schoolInitials(name: string): string {
  return name
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/**
 * Colores de la cabecera desde `website_config.config` de la escuela. El nombre es el de la escuela
 * (`branches.name`, el mismo del remitente y el pie, AC13 de 0061-b); el de la web solo si falta.
 */
export function resolveStudentInviteBrand(
  // deno-lint-ignore no-explicit-any
  config: any,
  branchName?: string | null,
): {
  colors: StudentInviteColors;
  schoolName: string;
  initials: string;
} {
  const theme = config?.brand?.theme as keyof typeof STUDENT_INVITE_THEMES;
  const colors = STUDENT_INVITE_THEMES[theme] ?? STUDENT_INVITE_THEMES.azul;
  const schoolName = String(branchName?.trim() || config?.brand?.name || 'Autoescuela').normalize(
    'NFC',
  );
  return { colors, schoolName, initials: schoolInitials(schoolName) };
}

export function buildStudentInviteEmailHtml(
  actionLink: string,
  colors: StudentInviteColors,
  brandName: string,
  initials: string,
  sender: SchoolSender,
): string {
  const name = escapeHtml(brandName);
  const href = escapeHtml(actionLink);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activa tu cuenta - ${name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif; background-color: #f1f5f9; line-height: 1.6; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; margin-top: 24px; margin-bottom: 24px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); }
    .email-header { padding: 44px 36px 40px; text-align: center; position: relative; overflow: hidden; }
    .email-header::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px); background-size: 36px 36px; }
    .logo-badge { box-sizing: content-box; width: 56px; height: 56px; line-height: 56px; text-align: center; background-color: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 14px; display: inline-block; margin-bottom: 14px; }
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
    .footer-divider { width: 40px; height: 2px; border-radius: 2px; margin: 0 auto 14px; }
  </style>
</head>
<body>
<div class="email-wrapper">

  <div class="email-header" style="background-color: ${colors.brandColor}; background: ${colors.gradientHero};">
    <div class="logo-badge">
      <span>${escapeHtml(initials)}</span>
    </div>
    <p class="company-name">${name}</p>
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
            <a href="${href}" class="cta-link" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 16px 48px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; border-radius: 12px;">
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

    ${domainLineHtml(sender)}

  </div>

  <div class="email-footer">
    <div class="footer-divider" style="background-color: ${colors.brandColor}; background: ${colors.gradientFooter};"></div>
${schoolFooterHtml(sender)}
  </div>

</div>
</body>
</html>`;
}
