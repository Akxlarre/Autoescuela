// supabase/functions/_shared/announcement-email.ts
//
// Parte PURA del envío de comunicados (specs 0041-b, 0042-b, 0061-b): la plantilla del correo,
// los destinatarios por (alumno, escuela) y el consentimiento promocional por escuela. El I/O
// (BD, SMTP, lotes) vive en `announcement-send.ts`, que importa nodemailer y por eso no se puede
// testear en local; esto sí.
//
// spec 0061-b — POR ESCUELA, NO POR ALUMNO:
//   - La marca, el pie y el correo para darse de baja son de la ESCUELA QUE ENVÍA. Antes eran los
//     de la escuela donde se registró el destinatario (fix-232-b), y un comunicado de Autoescuela
//     Chillán le llegaba a un alumno de las dos con la marca de Conductores Chillán.
//   - Un destinatario es un par (alumno, escuela). Un comunicado de todas las escuelas llega una
//     vez por cada escuela en la que el alumno cumple el segmento (AC-E5): son razones sociales
//     distintas y ninguna escribe a nombre de la otra.
//   - El consentimiento promocional que vale es el último ANTE ESA ESCUELA (AC10). Antes era el
//     último en general, y una aceptación ante una escuela habilitaba las promociones de la otra.

import { PLATFORM_NAME, escapeHtml, schoolFooterHtml, type SchoolSender } from './school-email.ts';
import { CONTRACT_EMAIL_THEMES, type ContractEmailTheme } from './contract-email.ts';

export { escapeHtml };

/** `{{variable}}` con espacios opcionales. Espeja `core/utils/announcement-template.utils.ts`. */
const PLACEHOLDER = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/**
 * Resuelve los marcadores con los datos de UN destinatario (spec 0042-b). Un marcador
 * desconocido se vacía y no lanza: un envío a cientos de personas no se cae por un typo (AC-E1).
 */
export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (_m, key: string) => values[key] ?? '');
}

/** Iniciales para el logo del correo: "Autoescuela Chillán" → "AC". */
export function brandInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return letters || 'AE';
}

export function buildEmailHtml(
  subject: string,
  body: string,
  sender: SchoolSender,
  promocional: boolean,
  /** Colores de la escuela que envía (AC5 de 0061-b); el azul si no tiene tema. */
  theme: ContractEmailTheme = CONTRACT_EMAIL_THEMES.azul,
): string {
  const safeBody = escapeHtml(body).replace(/\n/g, '<br>');
  const brand = sender.schoolName || PLATFORM_NAME;
  const brandName = escapeHtml(brand);
  const initials = escapeHtml(brandInitials(sender.schoolName));

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
    .email-header { background-color: ${theme.brandColor}; background: ${theme.gradientHero}; padding: 40px 36px; text-align: center; }
    .logo-badge { box-sizing: content-box; width: 56px; height: 56px; line-height: 56px; text-align: center; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3); border-radius: 14px; display: inline-block; margin-bottom: 14px; }
    .logo-badge span { color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .company-name { color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .email-body { padding: 40px 36px 36px; }
    .greeting { font-size: 13px; font-weight: 600; color: ${theme.brandColor}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
    .title { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1.25; margin-bottom: 20px; }
    .divider { height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent); margin: 24px 0; }
    .message { font-size: 15px; color: #334155; line-height: 1.75; }
    .email-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 28px 36px; text-align: center; }
    .footer-divider { width: 40px; height: 2px; background: ${theme.brandColor}; border-radius: 2px; margin: 0 auto 14px; }
  </style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-header">
    <div class="logo-badge"><span>${initials}</span></div>
    <p class="company-name">${brandName}</p>
  </div>
  <div class="email-body">
    <p class="greeting">Comunicado</p>
    <h1 class="title">${escapeHtml(subject)}</h1>
    <div class="divider"></div>
    <p class="message">${safeBody}</p>
  </div>
  <div class="email-footer">
    <div class="footer-divider"></div>
${schoolFooterHtml(sender, { promocional })}
  </div>
</div>
</body>
</html>`;
}

// ── Destinatarios ───────────────────────────────────────────────────────────────────────────

export interface RecipientPair {
  userId: number;
  branchId: number;
}

export const pairKey = (userId: number, branchId: number): string => `${userId}:${branchId}`;

/**
 * Pares únicos (alumno, escuela) de las matrículas del segmento, en orden de aparición. Un alumno
 * con dos matrículas en la misma escuela es un destinatario; con una en cada escuela, dos.
 */
export function recipientPairs(
  enrollments: { branch_id: number; students: { user_id: number } }[],
  excludedUserIds: number[],
): RecipientPair[] {
  const excluded = new Set(excludedUserIds);
  const seen = new Set<string>();
  const pairs: RecipientPair[] = [];
  for (const e of enrollments) {
    const userId = e.students?.user_id;
    if (userId == null || e.branch_id == null || excluded.has(userId)) continue;
    const key = pairKey(userId, e.branch_id);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ userId, branchId: e.branch_id });
  }
  return pairs;
}

export interface PromotionalConsentRow {
  user_id: number;
  branch_id: number;
  granted: boolean;
  revoked_at: string | null;
  granted_at: string;
}

/**
 * Pares (alumno, escuela) cuyo consentimiento promocional MÁS RECIENTE ANTE ESA ESCUELA está
 * otorgado y sin revocar (AC10). Se mira el más reciente y no "alguno otorgado": vale la última
 * expresión de voluntad ante cada responsable (spec 0040-b).
 */
export function consentedPairKeys(rows: PromotionalConsentRow[]): Set<string> {
  const latest = new Map<string, PromotionalConsentRow>();
  for (const row of rows) {
    const key = pairKey(row.user_id, row.branch_id);
    const current = latest.get(key);
    if (!current || Date.parse(row.granted_at) > Date.parse(current.granted_at)) {
      latest.set(key, row);
    }
  }
  const keys = new Set<string>();
  for (const [key, row] of latest) {
    if (row.granted && row.revoked_at === null) keys.add(key);
  }
  return keys;
}
