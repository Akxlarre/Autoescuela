import type { Notification as NotificationDto } from '@core/models/dto/notification.model';
import { mapReferenceToNotificationType, mapNotificationDtoToUi } from './notification.utils';

describe('notification.utils', () => {
  describe('mapReferenceToNotificationType', () => {
    it('should return "warning" for document_expiry', () => {
      expect(mapReferenceToNotificationType('document_expiry')).toBe('warning');
    });

    it('should return "info" for payment', () => {
      expect(mapReferenceToNotificationType('payment')).toBe('info');
    });

    it('should return "success" for class_b', () => {
      expect(mapReferenceToNotificationType('class_b')).toBe('success');
    });

    it('should return "success" for professional_session', () => {
      expect(mapReferenceToNotificationType('professional_session')).toBe('success');
    });

    it('should return "info" for null', () => {
      expect(mapReferenceToNotificationType(null)).toBe('info');
    });

    it('should return "info" for undefined', () => {
      expect(mapReferenceToNotificationType(undefined)).toBe('info');
    });

    it('should return "info" for unknown reference type', () => {
      expect(mapReferenceToNotificationType('unknown_type')).toBe('info');
    });
  });

  describe('mapNotificationDtoToUi', () => {
    const baseDto: NotificationDto = {
      id: 42,
      recipient_id: 1,
      type: 'system',
      subject: 'Test Subject',
      message: 'Test message body',
      read: false,
      sent_at: null,
      sent_ok: true,
      send_error: null,
      reference_type: 'class_b',
      reference_id: 100,
      created_at: '2026-03-10T15:30:00Z',
    };

    it('should convert id to string', () => {
      const result = mapNotificationDtoToUi(baseDto);
      expect(result.id).toBe('42');
    });

    it('should map subject to title', () => {
      const result = mapNotificationDtoToUi(baseDto);
      expect(result.title).toBe('Test Subject');
    });

    it('should fallback title to "Notificación" when subject is null', () => {
      const result = mapNotificationDtoToUi({ ...baseDto, subject: null });
      expect(result.title).toBe('Notificación');
    });

    it('should fallback title to "Notificación" when subject is empty string', () => {
      const result = mapNotificationDtoToUi({ ...baseDto, subject: '' });
      expect(result.title).toBe('Notificación');
    });

    it('should map message directly', () => {
      const result = mapNotificationDtoToUi(baseDto);
      expect(result.message).toBe('Test message body');
    });

    it('should map read status', () => {
      expect(mapNotificationDtoToUi(baseDto).read).toBe(false);
      expect(mapNotificationDtoToUi({ ...baseDto, read: true }).read).toBe(true);
    });

    it('should convert created_at to Date', () => {
      const result = mapNotificationDtoToUi(baseDto);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.toISOString()).toBe('2026-03-10T15:30:00.000Z');
    });

    it('should derive type from reference_type', () => {
      const result = mapNotificationDtoToUi(baseDto);
      expect(result.type).toBe('success'); // class_b → success
    });

    it('should pass through referenceType and referenceId', () => {
      const result = mapNotificationDtoToUi(baseDto);
      expect(result.referenceType).toBe('class_b');
      expect(result.referenceId).toBe(100);
    });

    it('should handle null referenceId', () => {
      const result = mapNotificationDtoToUi({ ...baseDto, reference_id: null });
      expect(result.referenceId).toBeNull();
    });
  });
});
