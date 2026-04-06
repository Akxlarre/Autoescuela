import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EnrollmentFacade } from './enrollment.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { EnrollmentDocumentsFacade } from '@core/facades/enrollment-documents.facade';
import { EnrollmentPaymentFacade } from '@core/facades/enrollment-payment.facade';

// ── Mock Supabase client ──

function createMockQueryBuilder(responseData: any = null, responseError: any = null) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: responseData, error: responseError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: responseData, error: responseError }),
    // Make builder directly awaitable (for patterns like: await supabase.from(...).select(...).eq(...))
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: responseData, error: responseError }).then(resolve, reject),
  };
  return builder;
}

function createMockSupabaseService() {
  let channelCallback: (() => void) | null = null;

  const mockChannel = {
    on: vi.fn().mockImplementation((_event: string, _opts: any, cb: () => void) => {
      channelCallback = cb;
      return mockChannel;
    }),
    subscribe: vi.fn().mockReturnThis(),
  };

  const mockBuilder = createMockQueryBuilder();

  return {
    client: {
      from: vi.fn().mockReturnValue(mockBuilder),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi
            .fn()
            .mockReturnValue({ data: { publicUrl: 'https://example.com/file.pdf' } }),
        }),
      },
      functions: {
        invoke: vi
          .fn()
          .mockResolvedValue({ data: { pdfUrl: 'https://example.com/contract.pdf' }, error: null }),
      },
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    },
    _mockBuilder: mockBuilder,
    _mockChannel: mockChannel,
    _getChannelCallback: () => channelCallback,
  };
}

function createMockService(methods: string[]) {
  const mock: any = {};
  methods.forEach((m) => (mock[m] = vi.fn()));
  return mock;
}

describe('EnrollmentFacade', () => {
  let facade: EnrollmentFacade;
  let mockSupabase: ReturnType<typeof createMockSupabaseService>;
  let mockConfirm: any;
  let mockViewer: any;
  let mockAuth: any;
  let mockDocs: any;
  let mockPayment: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseService();
    mockConfirm = createMockService(['confirm']);
    mockViewer = createMockService(['openByUrl']);
    mockAuth = { whenReady: Promise.resolve(), currentUser: vi.fn() };
    mockDocs = createMockService(['reset']);
    mockPayment = createMockService(['reset']);

    TestBed.configureTestingModule({
      providers: [
        EnrollmentFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfirmModalService, useValue: mockConfirm },
        { provide: DmsViewerService, useValue: mockViewer },
        { provide: AuthFacade, useValue: mockAuth },
        { provide: EnrollmentDocumentsFacade, useValue: mockDocs },
        { provide: EnrollmentPaymentFacade, useValue: mockPayment },
      ],
    });

    facade = TestBed.inject(EnrollmentFacade);
  });

  afterEach(() => {
    facade.reset();
    vi.restoreAllMocks();
  });

  // ── Initialization ──

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialize with step 1', () => {
    expect(facade.currentStep()).toBe(1);
  });

  it('should initialize with null personal data', () => {
    expect(facade.personalData()).toBeNull();
  });

  it('should initialize with empty sence options', () => {
    expect(facade.senceOptions()).toEqual([]);
  });

  it('should initialize with no loading state', () => {
    expect(facade.isLoading()).toBe(false);
    expect(facade.isSubmitting()).toBe(false);
  });

  it('should initialize with no error', () => {
    expect(facade.error()).toBeNull();
  });

  it('should initialize with null enrollment status', () => {
    expect(facade.enrollmentStatus()).toBeNull();
    expect(facade.enrollmentNumber()).toBeNull();
    expect(facade.docsComplete()).toBe(false);
    expect(facade.contractAccepted()).toBe(false);
  });

  it('should have 6 steps configured', () => {
    expect(facade.steps().length).toBe(6);
    expect(facade.steps()[0].status).toBe('active');
    expect(facade.steps()[1].status).toBe('pending');
  });

  // ── Wizard Navigation ──

  describe('Wizard Navigation', () => {
    it('should navigate to a specific step', () => {
      facade.goToStep(3);
      expect(facade.currentStep()).toBe(3);
    });

    it('should update step status when navigating', () => {
      facade.goToStep(2);
      expect(facade.steps().find((s) => s.step === 2)?.status).toBe('active');
    });

    it('should go back one step', () => {
      facade.goToStep(3);
      facade.goBack();
      expect(facade.currentStep()).toBe(2);
    });

    it('should not go back from step 1', () => {
      facade.goBack();
      expect(facade.currentStep()).toBe(1);
    });
  });

  // ── Reset ──

  describe('Reset', () => {
    it('should reset all state to initial values', () => {
      facade.goToStep(3);
      facade.reset();

      expect(facade.currentStep()).toBe(1);
      expect(facade.personalData()).toBeNull();
      expect(facade.enrollmentStatus()).toBeNull();
      expect(facade.senceOptions()).toEqual([]);
      expect(facade.instructors()).toEqual([]);
      expect(facade.selectedSlotIds()).toEqual([]);
      expect(facade.paymentMode()).toBeNull();
      expect(facade.error()).toBeNull();
      expect(facade.isLoading()).toBe(false);
    });
  });

  // ── Slot Selection ──

  describe('Slot Selection', () => {
    it('should toggle slot selection on', () => {
      facade.toggleSlot('2026-03-10T09:00');
      expect(facade.selectedSlotIds()).toContain('2026-03-10T09:00');
    });

    it('should toggle slot selection off', () => {
      facade.toggleSlot('2026-03-10T09:00');
      facade.toggleSlot('2026-03-10T09:00');
      expect(facade.selectedSlotIds()).not.toContain('2026-03-10T09:00');
    });

    it('should accumulate multiple slot selections', () => {
      facade.toggleSlot('2026-03-10T09:00');
      facade.toggleSlot('2026-03-10T10:00');
      expect(facade.selectedSlotIds().length).toBe(2);
    });
  });

  // ── Payment Mode ──

  describe('Payment Mode', () => {
    it('should set payment mode to total', () => {
      facade.setPaymentMode('total');
      expect(facade.paymentMode()).toBe('total');
    });

    it('should set payment mode to partial', () => {
      facade.setPaymentMode('partial');
      expect(facade.paymentMode()).toBe('partial');
    });
  });

  // ── Promotion Selection ──

  describe('Promotion Selection', () => {
    it('should select a promotion course', () => {
      facade.selectPromotion(42);
      expect(facade.selectedPromotionCourseId()).toBe(42);
    });
  });

  // ── Error Handling ──

  describe('Error Handling', () => {
    it('should clear error', () => {
      facade.clearError();
      expect(facade.error()).toBeNull();
    });
  });

  // ── UI Wrappers ──

  describe('UI Wrappers', () => {
    it('should call confirmModal.confirm on confirm', async () => {
      const config = { title: 'Test', message: 'Msg' };
      mockConfirm.confirm.mockResolvedValue(true);
      const result = await facade.confirm(config);
      expect(mockConfirm.confirm).toHaveBeenCalledWith(config);
      expect(result).toBe(true);
    });

    it('should call dmsViewer.openByUrl on openDocument', () => {
      facade.openDocument('http://test.com', 'File');
      expect(mockViewer.openByUrl).toHaveBeenCalledWith('http://test.com', 'File');
    });

    it('should use default filename in openDocument if not provided', () => {
      facade.openDocument('http://test.com');
      expect(mockViewer.openByUrl).toHaveBeenCalledWith('http://test.com', 'Documento');
    });
  });

  // ── Student Summary (Computed) ──

  describe('Student Summary', () => {
    it('should return null when no personal data', () => {
      expect(facade.studentSummary()).toBeNull();
    });
  });

  // ── Sidebar Summary (Computed) ──

  describe('Sidebar Summary', () => {
    it('should return empty requirements when no data', () => {
      const summary = facade.sidebarSummary();
      expect(summary.course).toBeNull();
      expect(summary.requirements.length).toBe(5);
      expect(summary.requirements[0].fulfilled).toBe(false);
    });
  });

  // ── canAdvance (Computed) ──

  describe('canAdvance', () => {
    it('should not allow advance from step 1 without personal data', () => {
      expect(facade.canAdvance()).toBe(false);
    });
  });

  // ── Load Courses ──

  describe('loadCourses', () => {
    it('should call supabase to load courses', async () => {
      const mockCourses = [
        { id: 1, name: 'Clase B', license_class: 'B', active: true, branch_id: 1 },
      ];

      // loadCourses chains .order() mid-chain then does `await query` at the end —
      // so order must return `this` and the builder must be awaitable via `then`.
      const builder = createMockQueryBuilder(mockCourses, null);
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadCourses(1);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('courses');
    });

    it('should set error on failure', async () => {
      const builder = createMockQueryBuilder(null, { message: 'Connection failed' });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadCourses(1);

      expect(facade.error()).toContain('Error al cargar cursos');
    });
  });

  // ── Find User by RUT ──

  describe('findUserByRut', () => {
    it('should return null when user not found', async () => {
      const builder = createMockQueryBuilder(null);
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      const result = await facade.findUserByRut('12345678-9');
      expect(result).toBeNull();
    });
  });

  // ── Generate Contract ──

  describe('generateContract', () => {
    it('should return null when no draft enrollment', async () => {
      const result = await facade.generateContract();
      expect(result).toBeNull();
    });
  });

  // ── Confirm Enrollment ──

  describe('confirmEnrollment', () => {
    it('should return null when no draft enrollment', async () => {
      const result = await facade.confirmEnrollment();
      expect(result).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // REALTIME — Schedule subscription tests
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Realtime Schedule Subscription', () => {
    const INSTRUCTOR_ID = 5;

    const mockSlots = [
      {
        instructor_id: INSTRUCTOR_ID,
        vehicle_id: 1,
        slot_start: '2026-03-16T09:00:00-03:00',
        slot_end: '2026-03-16T09:45:00-03:00',
        slot_status: 'available',
      },
      {
        instructor_id: INSTRUCTOR_ID,
        vehicle_id: 1,
        slot_start: '2026-03-16T09:45:00-03:00',
        slot_end: '2026-03-16T10:30:00-03:00',
        slot_status: 'available',
      },
    ];

    function setupScheduleQuery(data: any[] = mockSlots, error: any = null) {
      const builder = createMockQueryBuilder();
      builder.order = vi.fn().mockResolvedValue({ data, error });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);
    }

    it('should create a realtime channel when loadScheduleGrid is called', async () => {
      setupScheduleQuery();

      await facade.loadScheduleGrid(INSTRUCTOR_ID);

      expect(mockSupabase.client.channel).toHaveBeenCalledWith(
        `schedule-instructor-${INSTRUCTOR_ID}`,
      );
      expect(mockSupabase._mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'class_b_sessions',
          filter: `instructor_id=eq.${INSTRUCTOR_ID}`,
        }),
        expect.any(Function),
      );
      expect(mockSupabase._mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should remove previous channel when switching instructor', async () => {
      setupScheduleQuery();

      await facade.loadScheduleGrid(INSTRUCTOR_ID);
      await facade.loadScheduleGrid(INSTRUCTOR_ID + 1);

      expect(mockSupabase.client.removeChannel).toHaveBeenCalledTimes(1);
      expect(mockSupabase.client.channel).toHaveBeenCalledWith(
        `schedule-instructor-${INSTRUCTOR_ID + 1}`,
      );
    });

    it('should unsubscribe from channel on reset', async () => {
      setupScheduleQuery();

      await facade.loadScheduleGrid(INSTRUCTOR_ID);
      facade.reset();

      expect(mockSupabase.client.removeChannel).toHaveBeenCalled();
    });

    it('should debounce realtime events and re-query the view', async () => {
      vi.useFakeTimers();
      setupScheduleQuery();

      await facade.loadScheduleGrid(INSTRUCTOR_ID);

      // Simulate realtime event
      const callback = mockSupabase._getChannelCallback();
      expect(callback).not.toBeNull();

      // Reset mock to track re-query
      mockSupabase.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockSlots, error: null }),
      });

      // Fire 3 rapid events — should debounce to 1 re-query
      callback!();
      callback!();
      callback!();

      // Before debounce period: no re-query
      expect(mockSupabase.client.from).not.toHaveBeenCalled();

      // After debounce period
      await vi.advanceTimersByTimeAsync(350);

      expect(mockSupabase.client.from).toHaveBeenCalledTimes(1);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('v_class_b_schedule_availability');

      vi.useRealTimers();
    });

    it('should auto-deselect slots that become occupied after realtime update', async () => {
      vi.useFakeTimers();
      setupScheduleQuery();

      await facade.loadScheduleGrid(INSTRUCTOR_ID);

      // Select a slot
      facade.toggleSlot('2026-03-16T09:00:00-03:00');
      expect(facade.selectedSlotIds()).toContain('2026-03-16T09:00:00-03:00');

      // Simulate the slot becoming occupied in the re-query
      const occupiedSlots = mockSlots.map((s) =>
        s.slot_start === '2026-03-16T09:00:00-03:00' ? { ...s, slot_status: 'occupied' } : s,
      );

      mockSupabase.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: occupiedSlots, error: null }),
      });

      // Fire realtime event
      const callback = mockSupabase._getChannelCallback();
      callback!();

      await vi.advanceTimersByTimeAsync(350);

      // The selected slot should be auto-deselected
      expect(facade.selectedSlotIds()).not.toContain('2026-03-16T09:00:00-03:00');

      vi.useRealTimers();
    });
  });
});
