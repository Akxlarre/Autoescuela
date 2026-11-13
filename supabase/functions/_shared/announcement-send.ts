// supabase/functions/_shared/announcement-send.ts
//
// Núcleo de envío de un comunicado global (specs 0041-b y 0042-b).
//
// POR QUÉ ESTE MÓDULO EXISTE: dos entradas distintas necesitan el mismo envío.
//   - `send-announcement`   → la dispara una persona; valida que sea admin/secretaría.
//   - `dispatch-scheduled-announcements` → la dispara el cron; no hay usuario.
//
// LA VALIDACIÓN DE USUARIO **NO** VIVE ACÁ, A PROPÓSITO. Si viviera, el dispatcher
// tendría que saltearla con un flag, y la única barrera de autorización de la función que
// decide a qué alumnos les llega un correo pasaría a ser un `if`. Queda en el borde HTTP
// de `send-announcement`; el dispatcher no la necesita porque la autorización ya se
// decidió cuando la persona programó el comunicado (quedó en `sent_by` y `branch_id`).
//
// spec 0061-b: un destinatario es un par (alumno, escuela) — `announcement_recipients.branch_id`.
// La marca, el remitente, el pie y el consentimiento promocional son los de ESA escuela, la que
// envía. La parte pura (plantilla, pares, consentimiento) vive en `announcement-email.ts`.
//
// @ts-nocheck

import {
  CONSENT_REVOKED_MARK,
  DRY_RUN_MARK,
  summarizeRecipients,
} from './announcement-progress.ts';
import {
  buildEmailHtml,
  consentedPairKeys,
  pairKey,
  recipientPairs,
  renderTemplate,
  type RecipientPair,
} from './announcement-email.ts';
import { loadSchoolSender, withSchool } from './school-email.ts';
import type { ContractEmailTheme } from './contract-email.ts';
import { loadSchoolTheme } from './school-theme.ts';
import { createSmtpTransport, platformAddress, sendSchoolMail } from './school-mailer.ts';

// Los bordes HTTP importan la plantilla desde acá (preview de send-announcement).
export { buildEmailHtml, escapeHtml, renderTemplate } from './announcement-email.ts';
// Colores de la escuela que envía (AC5 de 0061-b).
export { loadSchoolTheme } from './school-theme.ts';

/** Carga el comunicado con todo lo que el envío necesita. */
export async function loadAnnouncement(service, announcementId: number) {
  const { data, error } = await service
    .from('announcements')
    .select('id, subject, body, kind, branch_id, segment_filters, recipients_total, status')
    .eq('id', announcementId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Deja solo los pares (alumno, escuela) cuyo consentimiento promocional MÁS RECIENTE ANTE ESA
 * ESCUELA está otorgado y sin revocar (AC10 de 0061-b; regla en `consentedPairKeys`).
 */
export async function filterByPromotionalConsent(
  service,
  pairs: RecipientPair[],
): Promise<RecipientPair[]> {
  if (pairs.length === 0) return [];

  const userIds = [...new Set(pairs.map((p) => p.userId))];
  const { data, error } = await service
    .from('consents')
    .select('user_id, branch_id, granted, revoked_at, granted_at')
    .eq('consent_type', 'comunicaciones_promocionales')
    .in('user_id', userIds);
  if (error) throw error;

  const allowed = consentedPairKeys(data ?? []);
  return pairs.filter((p) => allowed.has(pairKey(p.userId, p.branchId)));
}

/**
 * Resuelve el segmento contra la BD y materializa una fila por destinatario (alumno, escuela) en
 * `announcement_recipients`. Se corre una sola vez, en el primer lote.
 *
 * Materializar (en vez de re-consultar con OFFSET en cada lote) evita que la lista se
 * mueva entre lotes: si alguien revocara su consentimiento a mitad del envío, el OFFSET
 * de los lotes siguientes se correría y saltearía destinatarios que sí correspondían.
 */
export async function materializeRecipients(service, announcement): Promise<number> {
  const filters = announcement.segment_filters ?? {};

  // `students.status <> 'archived'`: archivar es el soft-delete del alumno, y un comunicado
  // no puede seguir llegándole a quien la escuela ya sacó de su base (fix-361-m).
  let query = service
    .from('enrollments')
    .select('student_id, branch_id, status, courses!inner(type), students!inner(user_id, status)')
    .neq('students.status', 'archived');

  // La sede del comunicado manda; `NULL` = todas las escuelas (solo admin) y ahí vale el filtro
  // que se haya pedido al segmentar.
  const branchId = announcement.branch_id ?? filters.branchId ?? null;
  if (branchId !== null) query = query.eq('branch_id', branchId);

  if (filters.courseType) query = query.eq('courses.type', filters.courseType);
  if (filters.enrollmentStatus) query = query.eq('status', filters.enrollmentStatus);

  const { data: enrollments, error } = await query;
  if (error) throw error;

  // Un par por (alumno, escuela): con "todas las escuelas", un alumno de las dos recibe una copia
  // de cada una (AC-E5); dos matrículas en la misma escuela siguen siendo un destinatario.
  let pairs = recipientPairs(enrollments ?? [], filters.excludedUserIds ?? []);
  if (pairs.length === 0) return 0;

  // El promocional solo alcanza a quien lo consintió ante esa escuela y no lo revocó (AC10).
  // El operativo NO se filtra: es necesario para ejecutar el contrato (Art. 13 c).
  if (announcement.kind === 'promocional') {
    pairs = await filterByPromotionalConsent(service, pairs);
  }
  if (pairs.length === 0) return 0;

  const { data: users, error: usersError } = await service
    .from('users')
    .select('id, email')
    .in('id', [...new Set(pairs.map((p) => p.userId))])
    .eq('active', true);
  if (usersError) throw usersError;

  const emailByUser = new Map<number, string | null>();
  for (const u of users ?? []) {
    // `users.email` es NOT NULL en el esquema, pero NOT NULL no garantiza no-vacío:
    // un string en blanco es tan inalcanzable como un NULL (AC-E2 de 0041-b).
    emailByUser.set(u.id, u.email?.trim() ? u.email.trim() : null);
  }

  const rows = pairs
    .filter((p) => emailByUser.has(p.userId))
    .sort((a, b) => a.userId - b.userId || a.branchId - b.branchId)
    .map((p) => ({
      announcement_id: announcement.id,
      user_id: p.userId,
      branch_id: p.branchId,
      email: emailByUser.get(p.userId) ?? null,
    }));
  if (rows.length === 0) return 0;

  // `onConflict` sobre el UNIQUE (announcement_id, user_id, branch_id): reintentar el primer
  // lote no duplica destinatarios.
  const { error: insertError } = await service
    .from('announcement_recipients')
    .upsert(rows, { onConflict: 'announcement_id,user_id,branch_id', ignoreDuplicates: true });
  if (insertError) throw insertError;

  await service
    .from('announcements')
    .update({ recipients_total: rows.length })
    .eq('id', announcement.id);

  return rows.length;
}

export interface SendBatchOptions {
  offset: number;
  batchSize: number;
  /**
   * Corre TODO menos la entrega SMTP. Existe porque la BD de desarrollo tiene 200 alumnos
   * sembrados con dominio inexistente: un envío de prueba serían 200 rebotes duros contra
   * el dominio de la escuela, que es justo el daño que este feature evita.
   */
  dryRun?: boolean;
}

export interface SendBatchResult {
  recipientsTotal: number;
  processed: number;
  sent: number;
  failed: number;
  done: boolean;
  dryRun: boolean;
}

const RECIPIENT_BATCH_COLUMNS =
  'id, user_id, branch_id, email, email_sent_ok, notification_id, users!inner(first_names, paternal_last_name)';

/**
 * Materializa los destinatarios solo si todavía no existen, y devuelve cuántos hay.
 *
 * Re-materializar al reanudar (lo que pasaba antes de fix-361-m cada vez que una corrida
 * partía de cero) no duplicaba filas, pero sí podía sumar alumnos que entraron al segmento
 * a mitad del envío: la lista tiene que ser la del momento en que el envío empezó.
 */
export async function ensureRecipients(service, announcement): Promise<number> {
  const { count, error } = await service
    .from('announcement_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('announcement_id', announcement.id);
  if (error) throw error;

  if ((count ?? 0) > 0) return count;
  return materializeRecipients(service, announcement);
}

/**
 * Deja constancia de que alguien sigue avanzando este envío. El dispatcher solo rescata
 * un `enviando` sin latido reciente (`announcement-progress.ts` → `isDispatchOrphaned`).
 */
export async function touchDispatchHeartbeat(service, announcementId: number): Promise<void> {
  await service
    .from('announcements')
    .update({ dispatch_heartbeat_at: new Date().toISOString() })
    .eq('id', announcementId);
}

/**
 * Cierra el comunicado como `enviado` si ya no le quedan destinatarios pendientes, con los
 * conteos del comunicado ENTERO (leídos de `announcement_recipients`, no de la corrida).
 *
 * Devuelve `false` si todavía quedan pendientes: el comunicado sigue en `enviando` y el
 * dispatcher lo termina. El `eq('status', 'enviando')` evita cerrar dos veces si el
 * navegador y el cron terminan casi a la vez.
 */
export async function finalizeAnnouncement(service, announcementId: number) {
  const { data, error } = await service
    .from('announcement_recipients')
    .select('email_sent_ok, send_error')
    .eq('announcement_id', announcementId);
  if (error) throw error;

  const summary = summarizeRecipients(data ?? []);
  if (summary.pending > 0) return { finalized: false, ...summary };

  await service
    .from('announcements')
    .update({
      status: 'enviado',
      sent_at: new Date().toISOString(),
      email_ok_count: summary.ok,
      email_failed_count: summary.failed,
    })
    .eq('id', announcementId)
    .eq('status', 'enviando');

  return { finalized: true, ...summary };
}

/**
 * Procesa UN lote de destinatarios por posición. Lo usa el navegador, que necesita el
 * total y el avance para la barra de progreso. Sin autenticación: quien llama ya decidió
 * que este envío corresponde.
 */
export async function sendAnnouncementBatch(
  service,
  announcement,
  { offset, batchSize, dryRun = false }: SendBatchOptions,
): Promise<SendBatchResult> {
  let recipientsTotal = announcement.recipients_total;
  if (offset === 0) {
    recipientsTotal = await ensureRecipients(service, announcement);
  }
  if (recipientsTotal === 0) {
    return { recipientsTotal: 0, processed: 0, sent: 0, failed: 0, done: true, dryRun };
  }

  await touchDispatchHeartbeat(service, announcement.id);

  const { data: batch, error: batchError } = await service
    .from('announcement_recipients')
    .select(RECIPIENT_BATCH_COLUMNS)
    .eq('announcement_id', announcement.id)
    .order('id', { ascending: true })
    .range(offset, offset + batchSize - 1);
  if (batchError) throw batchError;

  const { sent, failed } = await processRecipients(service, announcement, batch ?? [], dryRun);

  const processed = (batch ?? []).length;
  return {
    recipientsTotal,
    processed,
    sent,
    failed,
    done: offset + processed >= recipientsTotal,
    dryRun,
  };
}

/**
 * Procesa el siguiente lote de destinatarios PENDIENTES. Lo usa el dispatcher.
 *
 * POR QUÉ NO POR POSICIÓN (fix-361-m): el dispatcher partía cada corrida en `offset = 0`
 * con un tope de 8 lotes. Los ya enviados se saltaban pero igual consumían lote, así que
 * cada corrida recorría los mismos 200 y del 201 en adelante nunca recibían. Pedir "los
 * que faltan" hace que cada lote avance, venga de la corrida que venga.
 */
export async function sendPendingBatch(
  service,
  announcement,
  { batchSize, dryRun = false }: Omit<SendBatchOptions, 'offset'>,
): Promise<SendBatchResult> {
  const recipientsTotal = await ensureRecipients(service, announcement);
  if (recipientsTotal === 0) {
    return { recipientsTotal: 0, processed: 0, sent: 0, failed: 0, done: true, dryRun };
  }

  await touchDispatchHeartbeat(service, announcement.id);

  const { data: batch, error: batchError } = await service
    .from('announcement_recipients')
    .select(RECIPIENT_BATCH_COLUMNS)
    .eq('announcement_id', announcement.id)
    .eq('email_sent_ok', false)
    .is('send_error', null)
    .order('id', { ascending: true })
    .limit(batchSize);
  if (batchError) throw batchError;

  const { sent, failed } = await processRecipients(service, announcement, batch ?? [], dryRun);

  const processed = (batch ?? []).length;
  return {
    recipientsTotal,
    processed,
    sent,
    failed,
    // Un lote incompleto es el último: no quedaban más pendientes que esos.
    done: processed < batchSize,
    dryRun,
  };
}

/** Entrega el comunicado a un lote ya leído y deja el resultado en cada fila. */
async function processRecipients(service, announcement, batch, dryRun: boolean) {
  const promocional = announcement.kind === 'promocional';

  // Re-chequeo por lote: si alguien revocó (ante esa escuela) mientras el envío avanzaba, no le
  // llega el resto del comunicado.
  let allowed: Set<string> | null = null;
  if (promocional) {
    const stillEligible = await filterByPromotionalConsent(
      service,
      batch.map((r) => ({ userId: r.user_id, branchId: r.branch_id })),
    );
    allowed = new Set(stillEligible.map((p) => pairKey(p.userId, p.branchId)));
  }

  const transporter = dryRun ? null : createSmtpTransport();
  const fromAddress = platformAddress();

  // Remitente de la escuela que envía, uno por escuela del lote (AC1–AC4 de 0061-b).
  const senders = new Map<number, Awaited<ReturnType<typeof loadSchoolSender>>>();
  const senderFor = async (branchId: number) => {
    if (!senders.has(branchId)) {
      senders.set(branchId, await loadSchoolSender(service, branchId, fromAddress));
    }
    return senders.get(branchId);
  };

  const themes = new Map<number, ContractEmailTheme>();
  const themeFor = async (branchId: number) => {
    if (!themes.has(branchId)) themes.set(branchId, await loadSchoolTheme(service, branchId));
    return themes.get(branchId)!;
  };

  let sent = 0;
  let failed = 0;

  for (const recipient of batch) {
    // Un lote reintentado (timeout de red, corte a mitad del envío) NO vuelve a
    // entregarle a quien ya recibió: reintentar tiene que reanudar, no reenviar.
    if (recipient.email_sent_ok) {
      sent++;
      continue;
    }

    if (allowed && !allowed.has(pairKey(recipient.user_id, recipient.branch_id))) {
      await service
        .from('announcement_recipients')
        .update({ send_error: CONSENT_REVOKED_MARK })
        .eq('id', recipient.id);
      continue;
    }

    const sender = await senderFor(recipient.branch_id);
    const nombre = recipient.users?.first_names ?? 'Alumno';
    // Las variables se resuelven por destinatario. `{{sede}}` es la escuela que ENVÍA
    // (0061-b): antes era la escuela donde se registró el alumno. El cuerpo guardado en
    // `announcements` conserva los marcadores intactos: el registro tiene que reflejar lo que
    // se redactó, no lo que vio un alumno puntual.
    const values = { nombre, sede: sender.schoolName };
    const subject = renderTemplate(announcement.subject, values);
    const body = renderTemplate(announcement.body, values);

    // La notificación in-app se crea aunque el correo falle o no haya dirección: es la
    // red de contención del canal email. Pero solo una vez por fila — si ya tiene una, este
    // lote se está reintentando y volver a insertar le duplicaría el aviso al alumno.
    let notificationId = recipient.notification_id;
    if (notificationId === null) {
      const { data: notification } = await service
        .from('notifications')
        .insert({
          recipient_id: recipient.user_id,
          type: 'system',
          subject,
          message: body,
          reference_type: 'announcement',
          reference_id: announcement.id,
          sent_at: new Date().toISOString(),
          sent_ok: true,
        })
        .select('id')
        .maybeSingle();
      notificationId = notification?.id ?? null;
    }

    if (!recipient.email) {
      failed++;
      await service
        .from('announcement_recipients')
        .update({ send_error: 'sin_email', notification_id: notificationId })
        .eq('id', recipient.id);
      continue;
    }

    try {
      // El HTML se arma también en dry-run: así el escapado y la sustitución se
      // ejercitan igual, y un error de plantilla no queda escondido hasta el primer
      // envío real.
      const html = buildEmailHtml(
        subject,
        body,
        sender,
        promocional,
        await themeFor(recipient.branch_id),
      );
      if (dryRun) {
        sent++;
        await service
          .from('announcement_recipients')
          .update({
            email_sent_ok: false,
            send_error: DRY_RUN_MARK,
            notification_id: notificationId,
          })
          .eq('id', recipient.id);
        continue;
      }

      await sendSchoolMail(transporter, sender, {
        to: recipient.email,
        subject: withSchool(subject, sender),
        html,
      });
      sent++;
      await service
        .from('announcement_recipients')
        .update({ email_sent_ok: true, send_error: null, notification_id: notificationId })
        .eq('id', recipient.id);
    } catch (err) {
      failed++;
      console.error(`Error enviando a ${recipient.email}:`, err);
      await service
        .from('announcement_recipients')
        .update({
          email_sent_ok: false,
          send_error: String(err?.message ?? 'error desconocido').slice(0, 500),
          notification_id: notificationId,
        })
        .eq('id', recipient.id);
    }
  }

  return { sent, failed };
}
