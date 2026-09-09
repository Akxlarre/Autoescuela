// Núcleo funcional del comunicado global (spec 0041-b).
//
// Funciones puras: el compositor y la Facade deciden con estas reglas y no cada uno a su
// manera. Lo que más importa acá es el LÍMITE DE VOLUMEN, y no es una preferencia de UX:
//
//   Con SMTP propio, la reputación del dominio es de la escuela. Un envío masivo mal
//   calibrado no solo hace que el comunicado caiga en spam: arrastra a los correos
//   normales (contratos, certificados, facturas) con él.
//
// Ver indices/NOTIFICATIONS-MAP.md §9.4.

import type { AnnouncementDraft, RecipientPreview } from '@core/models/ui/announcement.model';

/**
 * Destinatarios por invocación de la Edge Function.
 *
 * Nace de un límite duro, no de una preferencia: la EF envía por SMTP secuencialmente
 * (~200-500 ms por correo) y tiene tope de tiempo de ejecución. La Facade itera estos
 * lotes, y la pausa natural entre llamadas es además el throttling del envío.
 */
export const ANNOUNCEMENT_BATCH_SIZE = 25;

/** Tope duro por comunicado. Por encima, el envío se bloquea. */
export const ANNOUNCEMENT_MAX_RECIPIENTS = 500;

/** A partir de acá se advierte al emisor, pero se lo deja enviar. */
export const ANNOUNCEMENT_WARN_RECIPIENTS = 200;

export interface AnnouncementBatch {
  offset: number;
  size: number;
}

export type AnnouncementDraftError =
  | 'kind_requerido'
  | 'asunto_requerido'
  | 'cuerpo_requerido'
  | 'sin_destinatarios'
  | 'excede_tope';

export interface AnnouncementDraftValidation {
  valid: boolean;
  errors: AnnouncementDraftError[];
  /** Muchos destinatarios: no invalida, pero el emisor tiene que verlo antes de confirmar. */
  warnsHighVolume: boolean;
}

export interface ExclusionCounts {
  included: number;
  sinConsentimiento: number;
  excluidoManualmente: number;
}

/**
 * Parte `total` destinatarios en lotes consecutivos que lo cubren exacto.
 * Con `total = 0` devuelve `[]`: no tiene sentido invocar la Edge Function.
 */
export function buildBatches(
  total: number,
  size: number = ANNOUNCEMENT_BATCH_SIZE,
): AnnouncementBatch[] {
  const batches: AnnouncementBatch[] = [];

  for (let offset = 0; offset < total; offset += size) {
    batches.push({ offset, size: Math.min(size, total - offset) });
  }

  return batches;
}

/**
 * Valida el draft contra `includedCount`, la cantidad de destinatarios que efectivamente
 * quedarían alcanzados. Acumula todos los errores en vez de cortar en el primero: el
 * compositor los muestra juntos.
 */
export function validateAnnouncementDraft(
  draft: AnnouncementDraft,
  includedCount: number,
): AnnouncementDraftValidation {
  const errors: AnnouncementDraftError[] = [];

  // Sin default a propósito (AC2): el tipo decide si el consentimiento promocional
  // se respeta, así que declararlo es un acto deliberado del emisor.
  if (draft.kind === null) errors.push('kind_requerido');

  if (draft.subject.trim().length === 0) errors.push('asunto_requerido');
  if (draft.body.trim().length === 0) errors.push('cuerpo_requerido');

  // AC-E1 — un comunicado que no le llega a nadie no se registra.
  if (includedCount === 0) errors.push('sin_destinatarios');
  if (includedCount > ANNOUNCEMENT_MAX_RECIPIENTS) errors.push('excede_tope');

  return {
    valid: errors.length === 0,
    errors,
    warnsHighVolume: includedCount > ANNOUNCEMENT_WARN_RECIPIENTS,
  };
}

/**
 * Cuenta el preview por resultado. Un destinatario sin email sigue contando como
 * incluido: recibe la notificación in-app aunque el correo no salga (AC-E2).
 */
export function countExclusions(previews: readonly RecipientPreview[]): ExclusionCounts {
  const counts: ExclusionCounts = {
    included: 0,
    sinConsentimiento: 0,
    excluidoManualmente: 0,
  };

  for (const preview of previews) {
    if (preview.included) {
      counts.included++;
      continue;
    }

    if (preview.exclusionReason === 'sin_consentimiento') counts.sinConsentimiento++;
    else if (preview.exclusionReason === 'excluido_manualmente') counts.excluidoManualmente++;
  }

  return counts;
}
