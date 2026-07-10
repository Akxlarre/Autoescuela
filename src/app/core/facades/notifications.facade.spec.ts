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

  describe('notifyUsers', () => {
    it('performs a single batch insert for all recipient ids', async () => {
      const insertChain = { insert: vi.fn().mockResolvedValue({ error: null }) };
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

      await facade.notifyUsers([10, 20, 30], {
        message: 'Hola',
        subject: 'Aviso',
        referenceType: 'enrollment',
        referenceId: 1,
      });

      expect(supabaseSpy.client.from).toHaveBeenCalledWith('notifications');
      expect(insertChain.insert).toHaveBeenCalledTimes(1);
      const rows = insertChain.insert.mock.calls[0][0];
      expect(rows).toHaveLength(3);
      expect(rows.map((r: { recipient_id: number }) => r.recipient_id)).toEqual([10, 20, 30]);
      expect(rows[0].reference_type).toBe('enrollment');
    });

    it('does nothing when recipientIds is empty', async () => {
      const insertChain = { insert: vi.fn().mockResolvedValue({ error: null }) };
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

      await facade.notifyUsers([], { message: 'Hola' });

      expect(insertChain.insert).not.toHaveBeenCalled();
    });

    it('does not throw when the insert fails (fire-and-forget)', async () => {
      const insertChain = {
        insert: vi.fn().mockResolvedValue({ error: { message: 'fail' } }),
      };
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

      await expect(facade.notifyUsers([1], { message: 'Hola' })).resolves.toBeUndefined();
    });
  });

  describe('notifyRole', () => {
    const makeUsersQueryBuilder = (rows: unknown[], error: unknown = null) => {
      const builder: Record<string, any> = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve({ data: rows, error }).then(resolve, reject),
      };
      return builder;
    };

    it('notifies only active users with the given role, excluding the actor', async () => {
      const rows = [
        { id: 2, branch_id: 1, roles: { name: 'secretary' } },
        { id: 3, branch_id: 1, roles: { name: 'admin' } },
      ];
      const usersBuilder = makeUsersQueryBuilder(rows);
      const insertChain = { insert: vi.fn().mockResolvedValue({ error: null }) };
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(usersBuilder)
        .mockReturnValueOnce(insertChain);

      // authSpy.currentUser().dbId === 1 (actor)
      await facade.notifyRole('secretary', 1, { message: 'Nueva pre-inscripción' });

      expect(usersBuilder.eq).toHaveBeenCalledWith('active', true);
      expect(usersBuilder.neq).toHaveBeenCalledWith('id', 1);
      const insertedRows = insertChain.insert.mock.calls[0][0];
      expect(insertedRows).toHaveLength(1);
      expect(insertedRows[0].recipient_id).toBe(2);
    });

    it('applies the branch filter for role "secretary"', async () => {
      const usersBuilder = makeUsersQueryBuilder([
        { id: 5, branch_id: 2, roles: { name: 'secretary' } },
      ]);
      const insertChain = { insert: vi.fn().mockResolvedValue({ error: null }) };
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(usersBuilder)
        .mockReturnValueOnce(insertChain);

      await facade.notifyRole('secretary', 2, { message: 'x' });

      expect(usersBuilder.eq).toHaveBeenCalledWith('branch_id', 2);
    });

    it('does not apply a branch filter for role "admin" (branch is always null)', async () => {
      const usersBuilder = makeUsersQueryBuilder([
        { id: 9, branch_id: null, roles: { name: 'admin' } },
      ]);
      const insertChain = { insert: vi.fn().mockResolvedValue({ error: null }) };
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(usersBuilder)
        .mockReturnValueOnce(insertChain);

      await facade.notifyRole('admin', null, { message: 'x' });

      expect(usersBuilder.eq).not.toHaveBeenCalledWith('branch_id', expect.anything());
    });

    it('does not insert and does not throw when there are no matching recipients', async () => {
      const usersBuilder = makeUsersQueryBuilder([]);
      const insertChain = { insert: vi.fn().mockResolvedValue({ error: null }) };
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(usersBuilder)
        .mockReturnValueOnce(insertChain);

      await expect(facade.notifyRole('secretary', 5, { message: 'x' })).resolves.toBeUndefined();
      expect(insertChain.insert).not.toHaveBeenCalled();
    });

    it('does not throw when the users query fails', async () => {
      const usersBuilder = makeUsersQueryBuilder(null as unknown as unknown[], {
        message: 'DB error',
      });
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(usersBuilder);

      await expect(facade.notifyRole('admin', null, { message: 'x' })).resolves.toBeUndefined();
    });
  });

  describe('markManyAsRead', () => {
    const seed3Unread = async () => {
      const mockData = [1, 2, 3].map((id) => ({
        id,
        recipient_id: 1,
        type: 'system',
        subject: `N${id}`,
        message: 'm',
        read: false,
        sent_at: null,
        sent_ok: true,
        send_error: null,
        reference_type: null,
        reference_id: null,
        created_at: '2026-07-06T10:00:00Z',
      }));
      const chain = mockSelectChain(mockData);
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
      await facade.loadNotifications();
    };

    it('optimistically marks multiple notifications as read via a single .in() update', async () => {
      await seed3Unread();

      const updateChain = {
        update: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ error: null }),
      };
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

      await facade.markManyAsRead(['1', '2']);

      expect(facade.notifications().find((n) => n.id === '1')?.read).toBe(true);
      expect(facade.notifications().find((n) => n.id === '2')?.read).toBe(true);
      expect(facade.notifications().find((n) => n.id === '3')?.read).toBe(false);
      expect(updateChain.in).toHaveBeenCalledWith('id', [1, 2]);
    });

    it('rolls back the optimistic update when the update fails', async () => {
      await seed3Unread();

      const updateChain = {
        update: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ error: { message: 'fail' } }),
      };
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

      await facade.markManyAsRead(['1']);

      expect(facade.notifications().find((n) => n.id === '1')?.read).toBe(false);
    });

    it('does nothing for an empty id list', async () => {
      await seed3Unread();
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ error: null }),
      };
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

      await facade.markManyAsRead([]);

      expect(updateChain.in).not.toHaveBeenCalled();
    });
  });

  describe('panelEntries', () => {
    it('groups 3+ unread notifications of the same referenceType/day and caps the result at 15', async () => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        recipient_id: 1,
        type: 'system',
        subject: `N${i}`,
        message: 'm',
        read: false,
        sent_at: null,
        sent_ok: true,
        send_error: null,
        reference_type: i < 5 ? 'enrollment' : null,
        reference_id: null,
        created_at: '2026-07-06T10:00:00Z',
      }));
      const chain = mockSelectChain(mockData);
      (supabaseSpy.client.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
      await facade.loadNotifications();

      const entries = facade.panelEntries();

      expect(entries.length).toBeLessThanOrEqual(15);
      const group = entries.find((e) => e.kind === 'group');
      expect(group).toBeDefined();
      if (group?.kind === 'group') {
        expect(group.count).toBe(5);
      }
    });
  });
});
