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

/** Clave de un destinatario por escuela (spec 0061-b): un alumno de las dos escuelas son dos. */
export function pairKey(userId: number, branchId: number): string {
  return `${userId}:${branchId}`;
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
 * otorgado y sin revocar (spec 0061-b, AC10). Cada escuela es un responsable distinto: una
 * aceptación ante una no habilita las promociones de la otra.
 *
 * Espejo de `supabase/functions/_shared/announcement-email.ts` → `consentedPairKeys`, que es la
 * que decide el envío; esta solo alimenta la vista previa. Mismos vectores de test.
 */
export function consentedPairKeys(rows: readonly PromotionalConsentRow[]): Set<string> {
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

/** Fila del segmento tal como la lee la vista previa (`enrollments` + alumno + usuario). */
export interface PreviewEnrollmentRow {
  branch_id: number;
  students?: {
    users?: {
      id: number;
      first_names: string;
      paternal_last_name: string;
      email: string | null;
      active: boolean;
    } | null;
  } | null;
}

/**
 * Una fila por persona (la exclusión manual es por persona), con las escuelas a cuyo nombre le
 * llega (spec 0061-b): con "todas las escuelas", un alumno de las dos recibe una copia de cada
 * una; dos matrículas en la misma escuela siguen siendo un destinatario. Ordenado por nombre.
 */
export function groupPreviewRecipients(rows: readonly PreviewEnrollmentRow[]): RecipientPreview[] {
  const byUserId = new Map<number, RecipientPreview & { branchIds: number[] }>();
  for (const row of rows) {
    const u = row.students?.users;
    if (!u?.active) continue;
    const existing = byUserId.get(u.id);
    if (existing) {
      if (!existing.branchIds.includes(row.branch_id)) existing.branchIds.push(row.branch_id);
      continue;
    }
    byUserId.set(u.id, {
      userId: u.id,
      name: `${u.first_names} ${u.paternal_last_name}`.trim(),
      email: u.email?.trim() ? u.email.trim() : null,
      included: true,
      exclusionReason: null,
      branchIds: [row.branch_id],
    });
  }
  return [...byUserId.values()]
    .map((r) => ({ ...r, branchIds: [...r.branchIds].sort((a, b) => a - b) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * AC10 de 0061-b: un promocional le llega a cada persona solo por las escuelas ante las que
 * consintió. Sin ninguna, queda excluida con motivo `sin_consentimiento`.
 */
export function applyPromotionalConsent(
  recipients: readonly RecipientPreview[],
  consented: ReadonlySet<string>,
): RecipientPreview[] {
  return recipients.map((r) => {
    const branchIds = (r.branchIds ?? []).filter((b) => consented.has(pairKey(r.userId, b)));
    return branchIds.length > 0
      ? { ...r, branchIds }
      : { ...r, branchIds, included: false, exclusionReason: 'sin_consentimiento' as const };
  });
}
