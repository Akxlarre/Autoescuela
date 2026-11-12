// supabase/functions/_shared/instructor-invite-email.ts
//
// Correo de activación de la cuenta de un instructor. Lo usan `create-instructor` (alta) y
// `activate-instructor-account` (reenvío); antes cada una tenía su copia idéntica del HTML, con
// "Conductores Chillán" fijo en el encabezado y el pie también para los instructores de la otra
// escuela (spec 0061-b, AC4).
//
// Sin rediseño: es el mismo HTML. Cambian el encabezado (la escuela del instructor), el pie (el
// común de school-email.ts) y la línea del dominio (AC8); además se escapan el nombre y el enlace,
// que antes se interpolaban crudos.

import { domainLineHtml, escapeHtml, schoolFooterHtml, type SchoolSender } from './school-email.ts';
import { CONTRACT_EMAIL_THEMES, type ContractEmailTheme } from './contract-email.ts';

export const INSTRUCTOR_INVITE_SUBJECT = 'Activa tu cuenta de instructor';

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .filter((w) => w.length > 2)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'AE'
  );
}

export function buildInstructorInviteEmailHtml(
  rawName: string,
  rawLink: string,
  sender: SchoolSender,
  /** Colores de la escuela del instructor (0061-b); el azul si no tiene tema. */
  theme: ContractEmailTheme = CONTRACT_EMAIL_THEMES.azul,
): string {
  const name = escapeHtml(rawName);
  const actionLink = escapeHtml(rawLink);
  const brandName = sender.schoolName || sender.fromName;
  const school = escapeHtml(brandName);
  const initials = escapeHtml(initialsOf(brandName));
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
    .email-header { background-color: ${theme.brandColor}; background: ${theme.gradientHero}; padding: 44px 36px 40px; text-align: center; position: relative; overflow: hidden; }
    .email-header::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px); background-size: 36px 36px; }
    .logo-badge { box-sizing: content-box; width: 56px; height: 56px; line-height: 56px; text-align: center; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3); border-radius: 14px; display: inline-block; margin-bottom: 14px; backdrop-filter: blur(8px); }
    .logo-badge span { color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .company-name { color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .email-body { padding: 44px 36px 36px; }
    .greeting { font-size: 13px; font-weight: 600; color: ${theme.brandColor}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
    .title { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-bottom: 12px; }
    .subtitle { font-size: 15px; color: #64748b; margin-bottom: 28px; line-height: 1.7; }
    .divider { height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent); margin: 24px 0; }
    .cta-section { text-align: center; margin: 28px 0 20px; }
    .cta-label { font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    .cta-button { display: inline-block; background-color: ${theme.brandColor}; background: ${theme.gradientHero}; color: #ffffff !important; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; }
    .expiry-note { font-size: 13px; color: #94a3b8; margin-top: 14px; }
    .fallback-label { font-size: 12px; color: #94a3b8; margin: 20px 0 8px; text-align: center; }
    .fallback-link { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #475569; word-break: break-all; }
    .email-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 28px 36px; text-align: center; }
    .footer-divider { width: 40px; height: 2px; background: ${theme.brandColor}; border-radius: 2px; margin: 0 auto 14px; }
  </style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-header">
    <div class="logo-badge"><span>${initials}</span></div>
    <p class="company-name">${school}</p>
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
    ${domainLineHtml(sender, 'personal')}
  </div>
  <div class="email-footer">
    <div class="footer-divider"></div>
${schoolFooterHtml(sender)}
  </div>
</div>
</body>
</html>`;
}
