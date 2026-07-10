import type { Notification as NotificationDto } from '@core/models/dto/notification.model';
import type { Notification as NotificationUi } from '@core/models/ui/notification.model';
import {
  mapReferenceToNotificationType,
  mapNotificationDtoToUi,
  groupNotifications,
} from './notification.utils';

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

    it('should return "success" for enrollment', () => {
      expect(mapReferenceToNotificationType('enrollment')).toBe('success');
    });

    it('should return "success" for certificate', () => {
      expect(mapReferenceToNotificationType('certificate')).toBe('success');
    });

    it('should return "info" for preinscription', () => {
      expect(mapReferenceToNotificationType('preinscription')).toBe('info');
    });

    it('should return "info" for document', () => {
      expect(mapReferenceToNotificationType('document')).toBe('info');
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

  describe('groupNotifications', () => {
    const makeNotif = (overrides: Partial<NotificationUi> = {}): NotificationUi => ({
      id: '1',
      title: 'Título',
      message: 'Mensaje',
      type: 'success',
      read: false,
      createdAt: new Date('2026-07-06T10:00:00Z'),
      referenceType: 'enrollment',
      referenceId: 1,
      ...overrides,
    });

    it('groups 3+ unread notifications of the same referenceType on the same day', () => {
      const list = [
        makeNotif({ id: '1', createdAt: new Date('2026-07-06T12:00:00Z') }),
        makeNotif({ id: '2', createdAt: new Date('2026-07-06T11:00:00Z') }),
        makeNotif({ id: '3', createdAt: new Date('2026-07-06T10:00:00Z') }),
      ];
      const result = groupNotifications(list);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ kind: 'group', referenceType: 'enrollment', count: 3 });
      const group = result[0];
      if (group.kind === 'group') {
        expect(group.ids).toEqual(['1', '2', '3']);
        expect(group.latestAt).toEqual(new Date('2026-07-06T12:00:00Z'));
      }
    });

    it('does not group when there are only 2 matching notifications', () => {
      const list = [makeNotif({ id: '1' }), makeNotif({ id: '2' })];
      const result = groupNotifications(list);
      expect(result).toHaveLength(2);
      expect(result.every((e) => e.kind === 'single')).toBe(true);
    });

    it('does not cross-group different referenceTypes', () => {
      const list = [
        makeNotif({ id: '1', referenceType: 'enrollment' }),
        makeNotif({ id: '2', referenceType: 'enrollment' }),
        makeNotif({ id: '3', referenceType: 'enrollment' }),
        makeNotif({ id: '4', referenceType: 'certificate' }),
        makeNotif({ id: '5', referenceType: 'certificate' }),
        makeNotif({ id: '6', referenceType: 'certificate' }),
      ];
      const result = groupNotifications(list);
      expect(result).toHaveLength(2);
      expect(result.filter((e) => e.kind === 'group')).toHaveLength(2);
    });

    it('does not group notifications from different days even with the same referenceType', () => {
      const list = [
        makeNotif({ id: '1', createdAt: new Date('2026-07-06T10:00:00Z') }),
        makeNotif({ id: '2', createdAt: new Date('2026-07-06T11:00:00Z') }),
        makeNotif({ id: '3', createdAt: new Date('2026-07-05T10:00:00Z') }),
      ];
      const result = groupNotifications(list);
      expect(result).toHaveLength(3);
      expect(result.every((e) => e.kind === 'single')).toBe(true);
    });

    it('does not group read notifications', () => {
      const list = [
        makeNotif({ id: '1', read: true }),
        makeNotif({ id: '2', read: true }),
        makeNotif({ id: '3', read: true }),
      ];
      const result = groupNotifications(list);
      expect(result).toHaveLength(3);
      expect(result.every((e) => e.kind === 'single')).toBe(true);
    });

    it('excludes read notifications from an otherwise-grouped batch', () => {
      const list = [
        makeNotif({ id: '1', read: false }),
        makeNotif({ id: '2', read: false }),
        makeNotif({ id: '3', read: false }),
        makeNotif({ id: '4', read: true }),
      ];
      const result = groupNotifications(list);
      expect(result).toHaveLength(2);
      expect(result.some((e) => e.kind === 'group')).toBe(true);
      expect(result.some((e) => e.kind === 'single')).toBe(true);
    });

    it('does not group notifications without a referenceType', () => {
      const list = [
        makeNotif({ id: '1', referenceType: null }),
        makeNotif({ id: '2', referenceType: null }),
        makeNotif({ id: '3', referenceType: null }),
      ];
      const result = groupNotifications(list);
      expect(result).toHaveLength(3);
      expect(result.every((e) => e.kind === 'single')).toBe(true);
    });

    it('preserves stable order: the group appears at the position of its first (most recent) member', () => {
      const list = [
        makeNotif({
          id: 'g1',
          referenceType: 'enrollment',
          createdAt: new Date('2026-07-06T12:00:00Z'),
        }),
        makeNotif({
          id: 's1',
          referenceType: 'certificate',
          createdAt: new Date('2026-07-06T11:30:00Z'),
        }),
        makeNotif({
          id: 'g2',
          referenceType: 'enrollment',
          createdAt: new Date('2026-07-06T11:00:00Z'),
        }),
        makeNotif({
          id: 'g3',
          referenceType: 'enrollment',
          createdAt: new Date('2026-07-06T10:00:00Z'),
        }),
      ];
      const result = groupNotifications(list);
      expect(result).toHaveLength(2);
      expect(result[0].kind).toBe('group');
      expect(result[1].kind).toBe('single');
    });
  });
});
