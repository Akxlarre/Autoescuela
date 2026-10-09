// supabase/functions/_shared/announcement-progress.ts
//
// Funciones puras sobre el avance de un comunicado (fix-361-m).
//
// Viven aparte de `announcement-send.ts` para poder testearlas sin cargar nodemailer.
//
// LA FUENTE DE VERDAD DEL AVANCE SON LAS FILAS DE `announcement_recipients`, no lo que
// contó cada corrida: un comunicado grande se envía en varias corridas (del cron, o del
// navegador y después del cron), y sumar solo la última dejaba los conteos finales mal.
//
// @ts-nocheck

/** Marca que deja un envío de prueba: no salió correo, pero el destinatario se procesó. */
export const DRY_RUN_MARK = 'dry_run';

/** Revocó el consentimiento a mitad del envío: no le llegó, y no cuenta como falla. */
export const CONSENT_REVOKED_MARK = 'consentimiento_revocado_durante_envio';

export interface RecipientProgressRow {
  email_sent_ok: boolean;
  send_error: string | null;
}

/**
 * ¿Falta procesar a este destinatario? Todo camino del envío deja `email_sent_ok = true`
 * o un `send_error`; una fila sin ninguno de los dos todavía no se tocó.
 */
export function isRecipientPending(row: RecipientProgressRow): boolean {
  return !row.email_sent_ok && row.send_error === null;
}

export interface RecipientSummary {
  total: number;
  ok: number;
  failed: number;
  pending: number;
}

/** Totales del comunicado entero, con la misma semántica que cuenta cada lote. */
export function summarizeRecipients(rows: RecipientProgressRow[]): RecipientSummary {
  let ok = 0;
  let failed = 0;
  let pending = 0;

  for (const row of rows) {
    if (row.email_sent_ok || row.send_error === DRY_RUN_MARK) ok++;
    else if (row.send_error === null) pending++;
    else if (row.send_error !== CONSENT_REVOKED_MARK) failed++;
  }

  return { total: rows.length, ok, failed, pending };
}

/** Un `enviando` sin un lote avanzado en este tiempo quedó huérfano. */
export const STUCK_MINUTES = 30;

export interface DispatchClock {
  dispatch_heartbeat_at: string | null;
  scheduled_for: string | null;
  created_at: string;
}

/**
 * ¿Este comunicado en `enviando` quedó huérfano (nadie lo está enviando)?
 *
 * Decide con el último lote avanzado. Sin latido (filas de antes de fix-361-m) cae a
 * cuándo debía salir: `scheduled_for`, o `created_at` si fue un envío inmediato.
 */
export function isDispatchOrphaned(row: DispatchClock, now: Date): boolean {
  const lastSign = row.dispatch_heartbeat_at ?? row.scheduled_for ?? row.created_at;
  return now.getTime() - new Date(lastSign).getTime() > STUCK_MINUTES * 60_000;
}

/**
 * Latido que deja el dispatcher cuando su corrida termina sin completar el comunicado:
 * uno ya vencido, para que la corrida siguiente lo retome de inmediato.
 *
 * El comunicado sigue en `enviando` (es la verdad: se está enviando por tandas, y así no
 * se puede cancelar a mitad), pero nadie lo está procesando hasta la próxima corrida.
 * Dejar el latido fresco haría esperar los 30 minutos de huérfano entre tanda y tanda.
 */
export function releasedHeartbeat(now: Date): string {
  return new Date(now.getTime() - (STUCK_MINUTES + 1) * 60_000).toISOString();
}
