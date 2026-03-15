import type { Notification as NotificationDto } from '@core/models/dto/notification.model';
import type {
  Notification as NotificationUi,
  NotificationType,
} from '@core/models/ui/notification.model';

/**
 * Mapea el `reference_type` de BD a un `NotificationType` de UI.
 *
 * - document_expiry → warning
 * - payment         → info
 * - class_b, professional_session → success
 * - default         → info
 */
export function mapReferenceToNotificationType(referenceType?: string | null): NotificationType {
  if (!referenceType) return 'info';

  switch (referenceType) {
    case 'document_expiry':
      return 'warning';
    case 'payment':
      return 'info';
    case 'class_b':
    case 'professional_session':
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
