import type { Notification as NotificationDto } from '@core/models/dto/notification.model';
import type {
  Notification as NotificationUi,
  NotificationType,
  NotificationPanelEntry,
  NotificationReferenceType,
} from '@core/models/ui/notification.model';

/**
 * Mapea el `reference_type` de BD a un `NotificationType` de UI.
 *
 * - document_expiry → warning
 * - payment, preinscription, document → info
 * - class_b, professional_session, enrollment, certificate → success
 * - default         → info
 */
export function mapReferenceToNotificationType(referenceType?: string | null): NotificationType {
  if (!referenceType) return 'info';

  switch (referenceType) {
    case 'document_expiry':
      return 'warning';
    case 'payment':
    case 'preinscription':
    case 'document':
      return 'info';
    case 'class_b':
    case 'professional_session':
    case 'enrollment':
    case 'certificate':
      return 'success';
    default:
      return 'info';
  }
}

/**
 * Transforma un DTO crudo de la tabla `notifications` al modelo de UI.
 *
 * Mapeos:
 * - `subject` → `title` (fallback: 'Notificación')
 * - `created_at` → `createdAt` (Date)
 * - `id` → `String(id)`
 * - `reference_type` → `type` via `mapReferenceToNotificationType()`
 */
export function mapNotificationDtoToUi(dto: NotificationDto): NotificationUi {
  return {
    id: String(dto.id),
    title: dto.subject || 'Notificación',
    message: dto.message,
    type: mapReferenceToNotificationType(dto.reference_type),
    read: dto.read,
    createdAt: new Date(dto.created_at),
    referenceType: dto.reference_type as NotificationUi['referenceType'],
    referenceId: dto.reference_id ?? null,
  };
}

const GROUP_MIN_SIZE = 3;

const GROUP_LABELS: Partial<Record<NotificationReferenceType, string>> = {
  enrollment: 'matrículas confirmadas',
  certificate: 'certificados listos',
  preinscription: 'pre-inscripciones nuevas',
  class_b: 'clases reprogramadas',
  professional_session: 'sesiones profesionales',
  document: 'documentos',
  document_expiry: 'documentos por vencer',
  payment: 'pagos',
  task: 'tareas',
};

/** Clave de agrupación: mismo `referenceType` + mismo día calendario, solo para no leídas. */
function groupKeyOf(n: NotificationUi): string | null {
  if (n.read || !n.referenceType) return null;
  return `${n.referenceType}__${n.createdAt.toDateString()}`;
}

/**
 * Agrupa 3+ notificaciones no leídas del mismo `referenceType` generadas el mismo día
 * en una sola entrada colapsada (AC8), para mitigar ruido en el panel.
 *
 * Preserva el orden de entrada: el grupo aparece en la posición de su primer miembro
 * en `list`; el resto de sus miembros se omiten del resultado.
 */
export function groupNotifications(list: NotificationUi[]): NotificationPanelEntry[] {
  const counts = new Map<string, number>();
  for (const n of list) {
    const key = groupKeyOf(n);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const entries: NotificationPanelEntry[] = [];
  const consumed = new Set<string>();

  for (const n of list) {
    const key = groupKeyOf(n);
    const groupSize = key ? (counts.get(key) ?? 0) : 0;

    if (key && groupSize >= GROUP_MIN_SIZE) {
      if (consumed.has(key)) continue;
      consumed.add(key);

      const members = list.filter((m) => groupKeyOf(m) === key);
      const referenceType = n.referenceType as NotificationReferenceType;
      const label = GROUP_LABELS[referenceType] ?? 'notificaciones';
      const latestAt = members.reduce(
        (max, m) => (m.createdAt > max ? m.createdAt : max),
        members[0].createdAt,
      );

      entries.push({
        kind: 'group',
        referenceType,
        type: n.type ?? 'info',
        count: members.length,
        ids: members.map((m) => m.id),
        title: `${members.length} ${label}`,
        latestAt,
      });
      continue;
    }

    entries.push({ kind: 'single', notification: n });
  }

  return entries;
}
