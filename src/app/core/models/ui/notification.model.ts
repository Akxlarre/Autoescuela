export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationFilter = 'all' | 'unread' | NotificationType;
export type NotificationReferenceType =
  | 'class_b'
  | 'professional_session'
  | 'document_expiry'
  | 'payment';

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
