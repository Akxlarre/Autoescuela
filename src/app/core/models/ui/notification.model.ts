export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationFilter = 'all' | 'unread' | NotificationType;
export type NotificationReferenceType =
  | 'class_b'
  | 'professional_session'
  | 'document_expiry'
  | 'payment'
  | 'task'
  | 'enrollment'
  | 'certificate'
  | 'preinscription'
  | 'document';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type?: NotificationType;
  read: boolean;
  createdAt: Date;
  referenceType?: NotificationReferenceType | null;
  referenceId?: number | null;
}

/**
 * Entrada del panel de notificaciones: una notificación individual, o un grupo
 * colapsado de 3+ no leídas del mismo `referenceType` generadas el mismo día (AC8).
 */
export type NotificationPanelEntry =
  | { kind: 'single'; notification: Notification }
  | {
      kind: 'group';
      referenceType: NotificationReferenceType;
      type: NotificationType;
      count: number;
      ids: string[];
      title: string;
      latestAt: Date;
    };
