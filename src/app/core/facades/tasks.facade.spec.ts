import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TasksFacade } from './tasks.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { ToastService } from '@core/services/ui/toast.service';
import type { CreateTaskPayload } from '@core/models/ui/task.model';

// ─── helpers ────────────────────────────────────────────────────────────────

const PAST_ISO = '2026-05-16T10:00:00Z';
const NOW_ISO = '2026-05-17T10:00:00Z';

/** Simula la fila cruda que Supabase devuelve con JOINs de usuarios y conteo de replies */
function makeRawDbTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'uuid-1',
    branch_id: 1,
    from_user_id: 10,
    from_role: 'admin',
    to_user_id: 20,
    to_role: 'secretary',
    type: 'task',
    subject: 'Revisar documentos',
    body: null,
    status: 'pending',
    due_date: null,
    completed_at: null,
    seen_at: null,
    seen_by: null,
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
    deleted_at: null,
    from_user: { first_names: 'Ana', paternal_last_name: 'Admin', is_active: true },
    to_user: { first_names: 'Sara', paternal_last_name: 'Sec', is_active: true },
    reply_count: [{ count: 0 }],
    ...overrides,
  };
}

function createMockQueryBuilder(responseData: unknown = null, responseError: unknown = null) {
  const builder: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: responseData, error: responseError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: responseData, error: responseError }),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: responseData, error: responseError }).then(resolve, reject),
  };
  return builder;
}

function createMockSupabase(responseData: unknown = null, responseError: unknown = null) {
  const builder = createMockQueryBuilder(responseData, responseError);
  const channel: Record<string, any> = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  return {
    client: {
      from: vi.fn().mockReturnValue(builder),
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    },
    _builder: builder,
    _channel: channel,
  };
}

// ─── users ───────────────────────────────────────────────────────────────────

const ADMIN_USER = {
  id: 'auth-admin',
  dbId: 10,
  name: 'Ana Admin',
  email: 'admin@test.com',
  role: 'admin',
  initials: 'AA',
  branchId: 1,
  isActive: true,
};

const SECRETARY_USER = {
  id: 'auth-sec',
  dbId: 20,
  name: 'Sara Sec',
  email: 'sec@test.com',
  role: 'secretaria', // UI role name (AuthFacade maps 'secretary' → 'secretaria')
  initials: 'SS',
  branchId: 1,
  isActive: true,
};

// ─── suite ───────────────────────────────────────────────────────────────────

describe('TasksFacade', () => {
  let facade: TasksFacade;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockAuth: any;
  let mockBranch: any;
  let mockNotifications: any;
  let mockToast: any;

  beforeEach(() => {
    mockSupabase = createMockSupabase([makeRawDbTask()]);
    mockAuth = { currentUser: vi.fn().mockReturnValue(ADMIN_USER) };
    mockBranch = { selectedBranchId: vi.fn().mockReturnValue(1) };
    mockNotifications = { createNotification: vi.fn().mockResolvedValue(undefined) };
    mockToast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        TasksFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: AuthFacade, useValue: mockAuth },
        { provide: BranchFacade, useValue: mockBranch },
        { provide: NotificationsFacade, useValue: mockNotifications },
        { provide: ToastService, useValue: mockToast },
      ],
    });

    facade = TestBed.inject(TasksFacade);
  });

  afterEach(() => {
    facade.dispose();
    vi.restoreAllMocks();
  });

  // ── estado inicial ──────────────────────────────────────────────────────────

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should start with empty state', () => {
    expect(facade.tasks()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  // ── initialize() — SWR ─────────────────────────────────────────────────────

  describe('initialize()', () => {
    it('shows skeleton (isLoading=true) during the first fetch', async () => {
      let capturedLoading = false;
      mockSupabase.client.from.mockImplementation(() => {
        capturedLoading = facade.isLoading();
        return createMockQueryBuilder([makeRawDbTask()]);
      });
      await facade.initialize();
      expect(capturedLoading).toBe(true);
      expect(facade.isLoading()).toBe(false);
    });

    it('populates tasks() with mapped rows after fetch', async () => {
      await facade.initialize();
      expect(facade.tasks().length).toBe(1);
      expect(facade.tasks()[0].id).toBe('uuid-1');
      expect(facade.tasks()[0].subject).toBe('Revisar documentos');
    });

    it('maps senderName and recipientName from joined user data', async () => {
      await facade.initialize();
      const row = facade.tasks()[0];
      expect(row.senderName).toBe('Ana Admin');
      expect(row.recipientName).toBe('Sara Sec');
    });

    it('SWR: does NOT show skeleton on second call (re-entry)', async () => {
      await facade.initialize();

      let loadingOnSecondCall = false;
      mockSupabase.client.from.mockImplementation(() => {
        loadingOnSecondCall = facade.isLoading();
        return createMockQueryBuilder([makeRawDbTask()]);
      });
      await facade.initialize();

      expect(loadingOnSecondCall).toBe(false);
    });

    it('sets error signal and keeps tasks empty on fetch failure', async () => {
      mockSupabase.client.from.mockReturnValue(
        createMockQueryBuilder(null, { message: 'DB error' }),
      );
      await facade.initialize();
      expect(facade.error()).not.toBeNull();
      expect(facade.tasks()).toEqual([]);
    });
  });

  // ── computed signals ────────────────────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      mockSupabase.client.from.mockReturnValue(
        createMockQueryBuilder([
          makeRawDbTask({
            id: 'uuid-1',
            from_user_id: 10,
            to_user_id: 20,
            status: 'pending',
            type: 'task',
            due_date: null,
          }),
          makeRawDbTask({
            id: 'uuid-2',
            from_user_id: 20,
            to_user_id: 10,
            status: 'in_progress',
            type: 'task',
            due_date: null,
          }),
          makeRawDbTask({
            id: 'uuid-3',
            from_user_id: 10,
            to_user_id: 20,
            status: 'pending',
            type: 'observation',
            due_date: PAST_ISO,
          }),
          makeRawDbTask({
            id: 'uuid-4',
            from_user_id: 10,
            to_user_id: 20,
            status: 'completed',
            type: 'task',
            due_date: null,
          }),
        ]),
      );
      await facade.initialize();
    });

    it('pendingCount reflects tasks with status=pending', () => {
      expect(facade.pendingCount()).toBe(2);
    });

    it('overdueCount reflects tasks with due_date in the past', () => {
      expect(facade.overdueCount()).toBe(1);
    });

    it('sentTasks returns tasks where currentUser is the sender', () => {
      expect(facade.sentTasks().length).toBe(3);
      expect(facade.sentTasks().every((t) => t.from_user_id === ADMIN_USER.dbId)).toBe(true);
    });

    it('receivedTasks returns tasks where currentUser is the recipient', () => {
      expect(facade.receivedTasks().length).toBe(1);
      expect(facade.receivedTasks()[0].to_user_id).toBe(ADMIN_USER.dbId);
    });

    it('observationTasks returns only type=observation tasks', () => {
      expect(facade.observationTasks().length).toBe(1);
      expect(facade.observationTasks()[0].id).toBe('uuid-3');
    });

    it('observationTasks excludes observations where currentUser is not a participant', async () => {
      const thirdPartyObs = createMockQueryBuilder([
        makeRawDbTask({ id: 'uuid-3', from_user_id: 10, to_user_id: 20, type: 'observation' }),
        makeRawDbTask({ id: 'uuid-5', from_user_id: 30, to_user_id: 40, type: 'observation' }),
      ]);
      mockSupabase.client.from.mockReturnValue(thirdPartyObs);
      facade.dispose();
      await facade.initialize();
      const obs = facade.observationTasks();
      expect(obs.length).toBe(1);
      expect(obs[0].id).toBe('uuid-3');
    });
  });

  // ── selectTask() ────────────────────────────────────────────────────────────

  describe('selectTask()', () => {
    beforeEach(() => facade.initialize());

    it('sets selectedTask to the matching row', async () => {
      await facade.initialize();
      facade.selectTask('uuid-1');
      expect(facade.selectedTask()?.id).toBe('uuid-1');
    });

    it('clears selectedTask when null is passed', async () => {
      await facade.initialize();
      facade.selectTask('uuid-1');
      facade.selectTask(null);
      expect(facade.selectedTask()).toBeUndefined();
    });
  });

  // ── createTask() — AC1, AC4, AC-E1 ─────────────────────────────────────────

  describe('createTask()', () => {
    const basePayload: CreateTaskPayload = {
      type: 'task',
      to_user_id: 20,
      to_role: 'secretary',
      subject: 'Nueva tarea',
      body: 'Cuerpo de prueba',
      due_date: '2026-06-01',
    };

    beforeEach(async () => {
      // Populate _recipients so createTask can locate the recipient (dbId: 20).
      // loadRecipients queries 'users'; we return a secretary row before the
      // regular task builder takes over again.
      mockSupabase.client.from.mockReturnValueOnce(
        createMockQueryBuilder([
          {
            id: 20,
            first_names: 'Sara',
            paternal_last_name: 'Sec',
            branch_id: 1,
            roles: { name: 'secretary' },
          },
        ]),
      );
      await facade.loadRecipients();
    });

    it('AC1: calls createNotification after successful insert', async () => {
      await facade.createTask(basePayload);
      expect(mockNotifications.createNotification).toHaveBeenCalledOnce();
    });

    it('AC1: returns true on success', async () => {
      const result = await facade.createTask(basePayload);
      expect(result).toBe(true);
    });

    it('AC4: strips due_date when type=observation', async () => {
      const payload: CreateTaskPayload = {
        ...basePayload,
        type: 'observation',
        due_date: '2026-06-01',
      };
      await facade.createTask(payload);

      const rawArg = mockSupabase._builder.insert.mock.calls[0]?.[0];
      const inserted = Array.isArray(rawArg) ? rawArg[0] : rawArg;
      expect(inserted?.due_date).toBeUndefined();
    });

    it('AC-E1: returns false when secretary tries to send to another secretary', async () => {
      mockAuth.currentUser.mockReturnValue(SECRETARY_USER);
      const result = await facade.createTask({ ...basePayload, to_role: 'secretary' });
      expect(result).toBe(false);
    });

    it('returns false and calls toast.error on insert error', async () => {
      mockSupabase.client.from.mockReturnValue(
        createMockQueryBuilder(null, { message: 'Insert error' }),
      );
      const result = await facade.createTask(basePayload);
      expect(result).toBe(false);
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  // ── updateStatus() — AC2, AC3 ───────────────────────────────────────────────

  describe('updateStatus()', () => {
    it('AC2: calls UPDATE with status=in_progress and returns true', async () => {
      const result = await facade.updateStatus('uuid-1', 'in_progress');
      expect(result).toBe(true);
      expect(mockSupabase._builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'in_progress' }),
      );
    });

    it('AC3: includes completed_at when status=completed', async () => {
      await facade.updateStatus('uuid-1', 'completed');
      expect(mockSupabase._builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', completed_at: expect.any(String) }),
      );
    });

    it('returns false and calls toast.error on update error', async () => {
      mockSupabase.client.from.mockReturnValue(
        createMockQueryBuilder(null, { message: 'Update error' }),
      );
      const result = await facade.updateStatus('uuid-1', 'in_progress');
      expect(result).toBe(false);
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  // ── markSeen() — AC5 ────────────────────────────────────────────────────────

  describe('markSeen()', () => {
    it('AC5: calls UPDATE with status=completed, completed_at, seen_at and seen_by', async () => {
      await facade.markSeen('uuid-1');
      expect(mockSupabase._builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          completed_at: expect.any(String),
          seen_at: expect.any(String),
          seen_by: ADMIN_USER.dbId,
        }),
      );
    });
  });

  // ── addReply() — AC8 ────────────────────────────────────────────────────────

  describe('addReply()', () => {
    it('AC8: inserts into task_replies and returns true', async () => {
      const result = await facade.addReply('uuid-1', 'Respuesta de prueba');
      expect(result).toBe(true);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('task_replies');
    });

    it('AC8: auto-transitions question from pending to in_progress on first reply', async () => {
      const questionBuilder = createMockQueryBuilder([
        makeRawDbTask({ type: 'question', status: 'pending' }),
      ]);
      mockSupabase.client.from.mockReturnValue(questionBuilder);
      await facade.initialize();
      questionBuilder.update.mockClear();
      await facade.addReply('uuid-1', 'Primera respuesta');
      expect(questionBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'in_progress' }),
      );
    });

    it('calls refreshSilently after successful insert', async () => {
      const refreshSpy = vi.spyOn(facade as any, 'refreshSilently');
      await facade.addReply('uuid-1', 'Reply');
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('returns false and calls toast.error on insert error', async () => {
      mockSupabase.client.from.mockReturnValue(
        createMockQueryBuilder(null, { message: 'Insert error' }),
      );
      const result = await facade.addReply('uuid-1', 'Reply');
      expect(result).toBe(false);
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  // ── softDelete() ─────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('calls soft_delete_task RPC and returns true', async () => {
      mockSupabase.client.rpc.mockResolvedValue({ data: true, error: null });
      const result = await facade.softDelete('uuid-1');
      expect(result).toBe(true);
      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('soft_delete_task', {
        p_task_id: 'uuid-1',
      });
    });

    it('returns false when RPC returns false (permission denied)', async () => {
      mockSupabase.client.rpc.mockResolvedValue({ data: false, error: null });
      const result = await facade.softDelete('uuid-1');
      expect(result).toBe(false);
    });

    it('returns false on RPC error', async () => {
      mockSupabase.client.rpc.mockResolvedValue({ data: null, error: { message: 'Error' } });
      const result = await facade.softDelete('uuid-1');
      expect(result).toBe(false);
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  // ── isOverdue — AC-E3 ──────────────────────────────────────────────────────

  describe('isOverdue mapping — AC-E3', () => {
    it('AC-E3: sets isOverdue=true when due_date is in the past', async () => {
      mockSupabase.client.from.mockReturnValue(
        createMockQueryBuilder([makeRawDbTask({ due_date: PAST_ISO })]),
      );
      await facade.initialize();
      expect(facade.tasks()[0].isOverdue).toBe(true);
    });

    it('sets isOverdue=false when due_date is null', async () => {
      await facade.initialize();
      expect(facade.tasks()[0].isOverdue).toBe(false);
    });
  });

  // ── recipientInactive — AC-E4 ─────────────────────────────────────────────

  describe('recipientInactive — AC-E4', () => {
    it('AC-E4: sets recipientInactive=true when to_user.is_active=false', async () => {
      mockSupabase.client.from.mockReturnValue(
        createMockQueryBuilder([
          makeRawDbTask({
            to_user: { first_names: 'Bob', paternal_last_name: 'Inactivo', active: false },
          }),
        ]),
      );
      await facade.initialize();
      expect(facade.tasks()[0].recipientInactive).toBe(true);
    });

    it('sets recipientInactive=false when to_user.is_active=true', async () => {
      await facade.initialize();
      expect(facade.tasks()[0].recipientInactive).toBe(false);
    });
  });

  // ── branch scope — AC-E5 ──────────────────────────────────────────────────

  describe('branch scope — AC-E5', () => {
    it('AC-E5: does NOT filter by branch_id when selectedBranchId is null (admin all-branches)', async () => {
      mockBranch.selectedBranchId.mockReturnValue(null);
      await facade.initialize();
      const branchEqCall = mockSupabase._builder.eq.mock.calls.find(
        (call: unknown[]) => call[0] === 'branch_id',
      );
      expect(branchEqCall).toBeUndefined();
    });

    it('applies branch_id filter when selectedBranchId is set', async () => {
      mockBranch.selectedBranchId.mockReturnValue(1);
      await facade.initialize();
      const branchEqCall = mockSupabase._builder.eq.mock.calls.find(
        (call: unknown[]) => call[0] === 'branch_id',
      );
      expect(branchEqCall).toBeDefined();
    });
  });

  // ── dispose() ────────────────────────────────────────────────────────────────

  describe('dispose()', () => {
    it('resets _initialized so next initialize() shows skeleton again', async () => {
      await facade.initialize();
      facade.dispose();

      let loadingOnReInit = false;
      mockSupabase.client.from.mockImplementation(() => {
        loadingOnReInit = facade.isLoading();
        return createMockQueryBuilder([]);
      });
      await facade.initialize();
      expect(loadingOnReInit).toBe(true);
    });

    it('calls removeChannel to close open realtime channels', async () => {
      await facade.initialize();
      facade.dispose();
      expect(mockSupabase.client.removeChannel).toHaveBeenCalled();
    });
  });
});
