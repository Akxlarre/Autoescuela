// Configuración de correo por escuela (spec 0061-b, AC11/AC-E6). Funciones puras.
//
// La dirección de envío solo puede ser de `gestordeautoescuelas.cl`: es el único dominio con SPF,
// DKIM y DMARC configurados, y un correo enviado como `@gmail.com` desde nuestro servidor llega a
// spam o se rechaza. La BD lo exige igual (`branches_email_sender_domain_chk`); esto existe para
// explicárselo al admin antes de guardar. La dirección de RESPUESTA puede ser de cualquier dominio.
//
// Espejo de `supabase/functions/_shared/school-email.ts` → `isAllowedSenderAddress`.

import type { BranchEmailForm } from '@core/models/ui/branch-email-config.model';

export const SENDER_DOMAIN = 'gestordeautoescuelas.cl';

const SENDER_ADDRESS_RE = /^[a-z0-9._%+-]+@gestordeautoescuelas\.cl$/;
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** `null` si es válida o está vacía (AC-E2: sin dirección propia sale desde la neutra). */
export function senderAddressError(value: string | null | undefined): string | null {
  const v = clean(value).toLowerCase();
  if (!v) return null;
  if (SENDER_ADDRESS_RE.test(v)) return null;
  return `Solo se puede enviar desde una dirección @${SENDER_DOMAIN}: es el único dominio autenticado para enviar correos. El correo de respuesta sí puede ser de cualquier dominio.`;
}

/** `null` si es válida o está vacía (AC-E1: sin respuesta, los correos no invitan a responder). */
export function replyToError(value: string | null | undefined): string | null {
  const v = clean(value);
  if (!v) return null;
  return EMAIL_RE.test(v) ? null : 'Escribe un correo válido, por ejemplo contacto@escuela.cl.';
}

export function normalizeBranchEmailForm(form: BranchEmailForm): BranchEmailForm {
  return {
    senderName: clean(form.senderName) || null,
    senderAddress: clean(form.senderAddress).toLowerCase() || null,
    replyTo: clean(form.replyTo).toLowerCase() || null,
    phone: clean(form.phone) || null,
  };
}

export type BranchEmailFormErrors = Partial<Record<keyof BranchEmailForm, string>>;

export function validateBranchEmailForm(form: BranchEmailForm): BranchEmailFormErrors {
  const errors: BranchEmailFormErrors = {};
  const sender = senderAddressError(form.senderAddress);
  if (sender) errors.senderAddress = sender;
  const reply = replyToError(form.replyTo);
  if (reply) errors.replyTo = reply;
  return errors;
}
