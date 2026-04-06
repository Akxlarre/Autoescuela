import { TestBed } from '@angular/core/testing';
import { NotificationsFacade } from './notifications.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';

describe('NotificationsFacade', () => {
  let facade: NotificationsFacade;
  let supabaseSpy: any;
  let authSpy: any;
  let toastSpy: any;

  const mockSelectChain = (data: unknown[] | null, error: unknown = null) => {
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(Promise.resolve({ data, error }));
    return chain;
  };

  const mockUpdateChain = (error: unknown = null) => {
    const chain: any = {};
    chain.update = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(Promise.resolve({ error }));
    return chain;
  };

  beforeEach(() => {
    const fromSpy = vi.fn();
    const channelSpy = vi.fn().mockReturnValue({
      on: vi.fn().mockReturnValue({
        subscribe: vi.fn(),
      }),
    });
    const removeChannelSpy = vi.fn();

    supabaseSpy = {
      client: {
        from: fromSpy,
        channel: channelSpy,
        removeChannel: removeChannelSpy,
      },
    } as unknown as any;

    authSpy = {
      whenReady: Promise.resolve(),
      currentUser: vi.fn().mockReturnValue({
        id: 'auth-uuid',
        dbId: 1,
        name: 'Test',
        email: 'test@test.com',
        role: 'admin',
        initials: 'T',
      }),
      isAuthenticated: vi.fn().mockReturnValue(true),
    } as unknown as any;

    toastSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        NotificationsFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: authSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    });

    facade = TestBed.inject(NotificationsFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should start with empty notifications', () => {
    expect(facade.notifications()).toEqual([]);
    expect(facade.unreadCount()).toBe(0);
  });

  it('should default filter to "all"', () => {
    expect(facade.filter()).toBe('all');
  });

  it('setFilter should update the filter signal', () => {
    facade.setFilter('unread');
    expect(facade.filter()).toBe('unread');
  });

  describe('loadNotifications', () => {
    it('should load and map notifications from DB', async () => {
      const mockData = [
        {
          id: 1,
          recipient_id: 1,
          type: 'system',
          subject: 'Hello',
          message: 'World',
          read: false,
          sent_at: null,
          sent_ok: true,
          send_error: null,
          reference_type: 'class_b',
          reference_id: null,
          created_at: '2026-03-10T10:00:00Z',
        },
      ];

      const chain = mockSelectChain(mockData);
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

      await facade.loadNotifications();

      expect(facade.notifications().length).toBe(1);
      expect(facade.notifications()[0].title).toBe('Hello');
      expect(facade.notifications()[0].id).toBe('1');
      expect(facade.unreadCount()).toBe(1);
      expect(facade.isLoading()).toBe(false);
    });

    it('should set error on failure', async () => {
      const chain = mockSelectChain(null, { message: 'DB error' });
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

      await facade.loadNotifications();

      expect(facade.error()).toBe('Error al cargar notificaciones');
      expect(facade.isLoading()).toBe(false);
    });
  });

  describe('markAsRead', () => {
    it('should optimistically mark a notification as read', async () => {
      // Seed a notification
      const chain = mockSelectChain([
        {
          id: 5,
          recipient_id: 1,
          type: 'system',
          subject: 'Test',
          message: 'Msg',
          read: false,
          sent_at: null,
          sent_ok: true,
          send_error: null,
          reference_type: null,
          reference_id: null,
          created_at: '2026-03-10T10:00:00Z',
        },
      ]);
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
      await facade.loadNotifications();

      // Now mock update
      const updateChain = mockUpdateChain();
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

      await facade.markAsRead('5');

      expect(facade.notifications()[0].read).toBe(true);
      expect(facade.unreadCount()).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should reset all signals', () => {
      facade.setFilter('warning');
      facade.dispose();

      expect(facade.notifications()).toEqual([]);
      expect(facade.filter()).toBe('all');
      expect(facade.error()).toBeNull();
      expect(facade.isLoading()).toBe(false);
    });
  });

  describe('filteredNotifications', () => {
    beforeEach(async () => {
      const mockData = [
        {
          id: 1,
          recipient_id: 1,
          subject: 'Info',
          message: 'M1',
          read: false,
          sent_ok: true,
          reference_type: null,
          reference_id: null,
          created_at: '2026-03-10T10:00:00Z',
        },
        {
          id: 2,
          recipient_id: 1,
          subject: 'Warning',
          message: 'M2',
          read: true,
          sent_ok: true,
          reference_type: 'document_expiry',
          reference_id: null,
          created_at: '2026-03-10T11:00:00Z',
        },
      ];
      const chain = mockSelectChain(mockData);
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
      await facade.loadNotifications();
    });

    it('should return all by default', () => {
      expect(facade.filteredNotifications().length).toBe(2);
    });

    it('should filter by "unread"', () => {
      facade.setFilter('unread');
      expect(facade.filteredNotifications().length).toBe(1);
      expect(facade.filteredNotifications()[0].title).toBe('Info');
    });

    it('should filter by type "warning"', () => {
      facade.setFilter('warning');
      const filtered = facade.filteredNotifications();
      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe('Warning');
    });
  });
});
