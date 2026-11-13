// supabase/functions/_shared/school-email.ts
//
// Único lugar que decide a nombre de quién sale un correo (spec 0061-b): remitente visible,
// dirección de envío, dirección de respuesta, asunto, pie y la línea que explica el dominio.
//
// POR QUÉ EXISTE: antes cada una de las 9 funciones que envían correo armaba su `from` con
// `SMTP_FROM` (un remitente global para las dos escuelas), sin dirección de respuesta, con un pie
// "Por favor no responder" y, en tres de ellas, con "Conductores Chillán" fijo en el código.
// Las dos escuelas son razones sociales distintas: cada correo tiene que salir a nombre de la
// escuela que lo origina (la regla de cuál es esa escuela vive en cada función, AC4).
//
// PURO A PROPÓSITO: este módulo no importa nodemailer. Los módulos que lo importan no se pueden
// testear en local (Deno no resuelve `npm:nodemailer` sin `deno install`), y esto es lo que más
// necesita tests. El transporte vive en `school-mailer.ts`.
//
// La dirección de envío solo puede ser de `gestordeautoescuelas.cl`, el único dominio con SPF,
// DKIM y DMARC. La BD lo exige con `branches_email_sender_domain_chk`; acá se vuelve a mirar para
// que un dato inválido degrade a la dirección neutra en vez de salir sin autenticar (AC-E2).

import { chileYear } from './chile-time.ts';

/** Nombre visible de los correos que no son de una escuela (cuentas, AC7). */
export const PLATFORM_NAME = 'Gestor de Autoescuelas';

/** Único dominio autenticado para enviar (espeja `branches_email_sender_domain_chk`). */
export const SENDER_DOMAIN = 'gestordeautoescuelas.cl';

/** Dominio de la app, el de todos los enlaces de los correos. */
export const APP_HOST = 'app.gestordeautoescuelas.cl';

const SENDER_ADDRESS_RE = /^[a-z0-9._%+-]+@gestordeautoescuelas\.cl$/;
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Columnas de `branches` que necesita un correo. */
export interface BranchEmailRow {
  id: number;
  name: string | null;
  email_sender_name: string | null;
  email_sender_address: string | null;
  /** Correo de contacto = dirección de respuesta (única fuente, AC13). */
  email: string | null;
  phone: string | null;
}

export const BRANCH_EMAIL_COLUMNS =
  'id, name, email_sender_name, email_sender_address, email, phone';

/** A nombre de quién sale un correo. */
export interface SchoolSender {
  /** Nombre de la escuela; vacío en los correos de la plataforma. */
  schoolName: string;
  fromName: string;
  fromAddress: string;
  replyTo: string | null;
  phone: string | null;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clean(value: string | null | undefined): string {
  return (value ?? '').normalize('NFC').trim();
}

export function isAllowedSenderAddress(address: string | null | undefined): boolean {
  return SENDER_ADDRESS_RE.test(clean(address).toLowerCase());
}

/** Remitente de los correos que no pertenecen a una escuela (recuperar contraseña, AC7). */
export function platformSender(platformAddress: string): SchoolSender {
  return {
    schoolName: '',
    fromName: PLATFORM_NAME,
    fromAddress: platformAddress,
    replyTo: null,
    phone: null,
  };
}

/**
 * Remitente de una escuela. Nunca falla por configuración incompleta (AC-E2): sin dirección
 * propia sale desde la neutra con el nombre de la escuela; sin correo de respuesta, sin
 * `replyTo` (AC-E1).
 */
export function resolveSender(row: BranchEmailRow | null, platformAddress: string): SchoolSender {
  if (!row) return platformSender(platformAddress);

  const schoolName = clean(row.name);
  const fromName = clean(row.email_sender_name) || schoolName || PLATFORM_NAME;
  const fromAddress = isAllowedSenderAddress(row.email_sender_address)
    ? clean(row.email_sender_address).toLowerCase()
    : platformAddress;
  const reply = clean(row.email);

  return {
    schoolName: schoolName || fromName,
    fromName,
    fromAddress,
    replyTo: EMAIL_RE.test(reply) ? reply : null,
    phone: clean(row.phone) || null,
  };
}

/** `from` para nodemailer: nombre y dirección separados, así codifica el nombre (AC-E4). */
export function mailFrom(sender: SchoolSender): { name: string; address: string } {
  return { name: sender.fromName, address: sender.fromAddress };
}

/** El asunto lleva el nombre de la escuela (AC3), sin repetirlo si ya está. */
export function withSchool(subject: string, sender: SchoolSender): string {
  const school = sender.schoolName;
  if (!school) return subject;
  if (subject.toLocaleLowerCase('es').includes(school.toLocaleLowerCase('es'))) return subject;
  return `${subject} — ${school}`;
}

const FOOTER_P = 'margin:0 0 6px;font-size:12px;line-height:1.6;color:#64748b;';
const FOOTER_BRAND = 'margin:0 0 6px;font-size:14px;font-weight:700;color:#334155;';

/**
 * Pie común (AC3): nombre, contacto, baja (si es promocional) y "Enviado por … mediante …".
 * Estilos inline: cada plantilla tiene su propio CSS y el pie tiene que verse igual en todas.
 */
export function schoolFooterHtml(
  sender: SchoolSender,
  opts: { promocional?: boolean } = {},
): string {
  const brand = escapeHtml(sender.schoolName || PLATFORM_NAME);
  const reply = sender.replyTo ? escapeHtml(sender.replyTo) : null;
  const phone = sender.phone ? escapeHtml(sender.phone) : null;
  const lines: string[] = [`<p style="${FOOTER_BRAND}">${brand}</p>`];

  if (sender.schoolName) {
    // AC-E1: sin correo de respuesta no se invita a responder; queda el teléfono si existe.
    if (reply && phone) {
      lines.push(
        `<p style="${FOOTER_P}">¿Dudas? Puedes responder este correo o escribir a ${reply} · Tel. ${phone}</p>`,
      );
    } else if (reply) {
      lines.push(
        `<p style="${FOOTER_P}">¿Dudas? Puedes responder este correo o escribir a ${reply}</p>`,
      );
    } else if (phone) {
      lines.push(`<p style="${FOOTER_P}">Contacto: Tel. ${phone}</p>`);
    }
  }

  if (opts.promocional) {
    const canal = reply
      ? `avísanos en la escuela o escríbenos a ${reply}`
      : 'avísanos en la escuela';
    lines.push(
      `<p style="${FOOTER_P}">Si no quieres recibir más promociones, ${canal} y dejamos de enviártelas.</p>`,
    );
  }

  const origin = sender.schoolName
    ? `Enviado por ${brand} mediante ${PLATFORM_NAME}.`
    : `Enviado por ${PLATFORM_NAME}.`;
  lines.push(`<p style="${FOOTER_P}">${origin} © ${chileYear()}</p>`);

  return lines.join('\n');
}

/** AC8: explica por qué los enlaces van a un dominio que no es el de la escuela. */
export function domainLineHtml(
  sender: SchoolSender,
  /** A quién va el correo: un correo al personal no habla del "portal de alumnos". */
  audience: 'alumnos' | 'personal' = 'alumnos',
): string {
  const link = `<a href="https://${APP_HOST}" style="color:inherit;">${APP_HOST}</a>`;
  const school = escapeHtml(sender.schoolName);
  const text = !sender.schoolName
    ? `El portal funciona en ${link}.`
    : audience === 'personal'
      ? `La plataforma de ${school} funciona en ${link}.`
      : `El portal de alumnos de ${school} funciona en ${link}.`;
  return `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b;">${text}</p>`;
}

/**
 * Lee la escuela y devuelve su remitente. Nunca lanza (AC-E2): una lectura fallida se registra y
 * el correo sale igual desde la dirección neutra. Bloquear el envío de un contrato porque falló
 * la lectura de la marca sería peor que mandarlo sin ella.
 */
// deno-lint-ignore no-explicit-any
export async function loadSchoolSender(
  service: any,
  branchId: number | null | undefined,
  platformAddress: string,
): Promise<SchoolSender> {
  if (branchId === null || branchId === undefined) return platformSender(platformAddress);
  try {
    const { data, error } = await service
      .from('branches')
      .select(BRANCH_EMAIL_COLUMNS)
      .eq('id', branchId)
      .maybeSingle();
    if (error) throw error;
    return resolveSender((data as BranchEmailRow | null) ?? null, platformAddress);
  } catch (err) {
    console.error(`school-email: no se pudo leer la escuela ${branchId}`, err);
    return platformSender(platformAddress);
  }
}
