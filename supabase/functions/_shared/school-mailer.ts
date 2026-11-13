// supabase/functions/_shared/school-mailer.ts
//
// Transporte SMTP de todos los correos de la app (spec 0061-b). Separado de `school-email.ts`
// solo porque importa nodemailer, y un módulo que lo importa no se puede testear en local: toda
// la lógica (quién envía, a quién se responde, qué dice el pie) vive en `school-email.ts`.
//
// Secrets: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM. Desde el 2026-11-12 apuntan a
// `cuentas@gestordeautoescuelas.cl`: una sola cuenta autenticada puede enviar como cualquier
// dirección del dominio (probado ese día: SPF, DKIM y DMARC pasan). SMTP_FROM es la dirección
// neutra: la de los correos de cuenta y la de respaldo de una escuela sin dirección propia.
//
// @ts-nocheck

import nodemailer from 'npm:nodemailer@6';
import { mailFrom, type SchoolSender } from './school-email.ts';

/** Dirección neutra de la plataforma. */
export function platformAddress(): string {
  return Deno.env.get('SMTP_FROM') ?? Deno.env.get('SMTP_USER') ?? '';
}

export function createSmtpTransport() {
  const port = Number(Deno.env.get('SMTP_PORT') ?? 465);
  return nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST'),
    port,
    secure: port === 465,
    auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASS') },
  });
}

export interface SchoolMail {
  to: string;
  subject: string;
  html: string;
  // deno-lint-ignore no-explicit-any
  attachments?: any[];
}

/** Envía a nombre de `sender`: su remitente y, si tiene, su dirección de respuesta (AC1, AC2). */
// deno-lint-ignore no-explicit-any
export function sendSchoolMail(transport: any, sender: SchoolSender, mail: SchoolMail) {
  return transport.sendMail({
    from: mailFrom(sender),
    ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
    ...mail,
  });
}
