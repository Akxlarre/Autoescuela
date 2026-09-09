// Comunicado global a alumnos (spec 0041-b) — mapea `announcements` y
// `announcement_recipients` 1:1.
// Migración: supabase/migrations/20260909140000_announcements_create.sql

/**
 * Naturaleza del comunicado. Espeja el CHECK de `announcements.kind`.
 *
 * No es una etiqueta cosmética: decide a quién puede llegar. `operativo` se ampara en
 * Art. 13 c) (necesario para ejecutar la matrícula) y alcanza a todo el segmento;
 * `promocional` requiere consentimiento vigente (Art. 12) y la Edge Function lo filtra
 * contra `consents` en el momento del envío.
 */
export type AnnouncementKind = 'operativo' | 'promocional';

export interface Announcement {
  id: number;

  subject: string;
  /** Texto plano. Se escapa antes de inyectarse en el HTML del correo. */
  body: string;

  kind: AnnouncementKind;

  /** NULL = comunicado multi-sede. Solo admin puede escribirlo; RLS se lo prohíbe a secretaría. */
  branch_id: number | null;

  /**
   * Los filtros que se pidieron al segmentar, para auditoría. NO es la lista de
   * destinatarios: esa la resuelve el servidor al enviar y queda en
   * `announcement_recipients`.
   */
  segment_filters: Record<string, unknown>;

  sent_by: number;
  /** NULL mientras el envío no terminó. */
  sent_at: string | null;

  recipients_total: number;
  email_ok_count: number;
  email_failed_count: number;

  created_at: string;
}

export interface AnnouncementRecipient {
  id: number;
  announcement_id: number;
  user_id: number;

  /**
   * Snapshot del email al momento del envío. NULL = el alumno no tenía email registrado;
   * igual recibe la notificación in-app (AC-E2).
   */
  email: string | null;

  email_sent_ok: boolean;
  send_error: string | null;

  /** Notificación in-app creada para este destinatario. */
  notification_id: number | null;

  created_at: string;
}
