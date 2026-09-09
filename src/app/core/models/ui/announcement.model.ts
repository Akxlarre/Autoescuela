// Modelos de UI del comunicado global (spec 0041-b).
// El DTO crudo vive en core/models/dto/announcement.model.ts.

import type { Announcement, AnnouncementKind } from '@core/models/dto/announcement.model';

/** Tipo de curso por el que se puede segmentar. Espeja `courses.type`. */
export type AnnouncementCourseType = 'class_b' | 'professional';

/** Estado de matrícula por el que se puede segmentar. Espeja `enrollments.status`. */
export type AnnouncementEnrollmentStatus = 'active' | 'completed';

/**
 * Definición del segmento. Es esto —y no una lista de destinatarios— lo que viaja al
 * servidor: la Edge Function re-resuelve la lista al enviar. Un cliente con una lista
 * vieja no puede alcanzar a alguien que revocó su consentimiento (AC-E4).
 */
export interface RecipientSegmentFilters {
  /** NULL = todas las sedes (solo admin). La secretaria queda fijada a la suya. */
  branchId: number | null;
  /** NULL = ambos tipos de curso. */
  courseType: AnnouncementCourseType | null;
  /** NULL = cualquier estado. */
  enrollmentStatus: AnnouncementEnrollmentStatus | null;
}

/** Por qué un alumno del segmento no va a recibir el comunicado. */
export type RecipientExclusionReason =
  /** Sin consentimiento promocional vigente (solo aplica a `kind: 'promocional'`). */
  | 'sin_consentimiento'
  /** La secretaria lo destildó a mano. */
  | 'excluido_manualmente';

/**
 * Fila del preview de destinatarios. Es informativa: sirve para que la secretaria vea y
 * ajuste, pero la lista final la decide el servidor.
 */
export interface RecipientPreview {
  userId: number;
  name: string;
  /** NULL = sin email registrado. Recibe la notificación in-app igual (AC-E2). */
  email: string | null;
  included: boolean;
  exclusionReason: RecipientExclusionReason | null;
}

/** Lo que edita el compositor antes de enviar. */
export interface AnnouncementDraft {
  /** Sin default a propósito: declararlo es obligatorio (AC2). */
  kind: AnnouncementKind | null;
  subject: string;
  /** Texto plano; los saltos de línea se respetan al renderizar el correo. */
  body: string;
  filters: RecipientSegmentFilters;
  /** Ids destildados a mano en el preview (AC5). */
  excludedUserIds: number[];
}

/** Progreso del envío por lotes, para la barra del compositor. */
export interface SendProgress {
  total: number;
  processed: number;
  ok: number;
  failed: number;
}

/** Fila del historial de comunicados. */
export interface AnnouncementRow extends Pick<
  Announcement,
  'id' | 'subject' | 'kind' | 'recipients_total' | 'email_ok_count' | 'email_failed_count'
> {
  /** Nombre ya resuelto del emisor (el DTO solo trae `sent_by`). */
  sentByName: string;
  /** ISO; NULL mientras el envío no terminó. */
  sentAt: string | null;
  /** Nombre de la sede, o "Todas las sedes" cuando `branch_id` es NULL. */
  branchLabel: string;
}
