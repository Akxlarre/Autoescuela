import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PublicEnrollmentFacade } from './public-enrollment.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

// ── localStorage mock ──────────────────────────────────────────────────────────
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe('PublicEnrollmentFacade', () => {
  let facade: PublicEnrollmentFacade;
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  const mockStorageChain = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    move: vi.fn().mockResolvedValue({ error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: 'https://example.com/public-uploads/carnet/test-token' },
    }),
  };

  const mockSupabaseClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    storage: {
      from: vi.fn().mockReturnValue(mockStorageChain),
    },
  };

  beforeEach(() => {
    // Montar mock de localStorage antes de instanciar el facade
    localStorageMock = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        PublicEnrollmentFacade,
        {
          provide: SupabaseService,
          useValue: { client: mockSupabaseClient },
        },
      ],
    });
    facade = TestBed.inject(PublicEnrollmentFacade);
  });

  afterEach(() => {
    facade.reset();
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Initial state
  // ══════════════════════════════════════════════════════════════════════════════

  describe('initial state', () => {
    it('should have no selected branch', () => {
      expect(facade.selectedBranch()).toBeNull();
    });

    it('should have no flow type', () => {
      expect(facade.flowType()).toBeNull();
    });

    it('should start at branch step', () => {
      expect(facade.currentStep()).toBe('branch');
    });

    it('should have empty steps', () => {
      expect(facade.steps()).toEqual([]);
    });

    it('should not be submitting', () => {
      expect(facade.isSubmitting()).toBe(false);
    });

    it('should have no error', () => {
      expect(facade.error()).toBeNull();
    });

    it('should have a session token', () => {
      expect(facade.sessionToken()).toBeTruthy();
    });

    it('should have no draft to restore when localStorage is empty', () => {
      expect(facade.hasDraftToRestore()).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // selectFlowType / buildSteps
  // ══════════════════════════════════════════════════════════════════════════════

  describe('selectFlowType', () => {
    it('should build 8 steps for class_b (including payment)', () => {
      facade.selectFlowType('class_b');
      expect(facade.flowType()).toBe('class_b');
      expect(facade.steps().length).toBe(8);
      expect(facade.steps()[0].id).toBe('branch');
      expect(facade.steps()[1].id).toBe('personal-data');
      expect(facade.steps()[6].id).toBe('payment');
      expect(facade.steps()[7].id).toBe('confirmation');
    });

    it('should build 4 steps for professional', () => {
      facade.selectFlowType('professional');
      expect(facade.flowType()).toBe('professional');
      expect(facade.steps().length).toBe(4);
      expect(facade.steps()[0].id).toBe('branch');
      expect(facade.steps()[3].id).toBe('pre-confirmation');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // confirmBranchSelection
  // ══════════════════════════════════════════════════════════════════════════════

  describe('confirmBranchSelection', () => {
    it('should not advance without flow type', () => {
      facade.confirmBranchSelection();
      expect(facade.currentStep()).toBe('branch');
    });

    it('should advance to personal-data with flow type set', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      expect(facade.currentStep()).toBe('personal-data');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // savePersonalData
  // ══════════════════════════════════════════════════════════════════════════════

  const samplePersonalData = {
    rut: '12345678-9',
    firstNames: 'Juan',
    paternalLastName: 'Pérez',
    maternalLastName: 'López',
    email: 'juan@test.com',
    phone: '+56912345678',
    birthDate: '1990-01-01',
    gender: 'M' as const,
    address: 'Calle 123',
    courseCategory: 'non-professional' as const,
    courseType: 'class_b' as const,
    singularCourseCode: null,
    senceCode: null,
    currentLicense: null,
    licenseDate: null,
    convalidatesSimultaneously: false,
    historicalPromotionId: null,
    validationBook: null,
    courses: [],
  };

  describe('savePersonalData', () => {
    it('should advance to payment-mode for class_b', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.savePersonalData(samplePersonalData);
      expect(facade.currentStep()).toBe('payment-mode');
      expect(facade.personalData()).not.toBeNull();
    });

    it('should advance to course-selection for professional', () => {
      facade.selectFlowType('professional');
      facade.confirmBranchSelection();
      facade.savePersonalData({
        ...samplePersonalData,
        courseCategory: 'professional',
        courseType: 'professional_a2',
      });
      expect(facade.currentStep()).toBe('psych-test-intro');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Payment mode
  // ══════════════════════════════════════════════════════════════════════════════

  describe('payment mode', () => {
    it('should set payment mode', () => {
      facade.setPaymentMode('total');
      expect(facade.paymentMode()).toBe('total');
    });

    it('should advance to schedule on confirmPaymentMode', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.setPaymentMode('total');
      facade.confirmPaymentMode();
      expect(facade.currentStep()).toBe('schedule');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // confirmContract → payment step
  // ══════════════════════════════════════════════════════════════════════════════

  describe('confirmContract', () => {
    it('should advance to payment step (not confirmation)', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.confirmContract();
      expect(facade.currentStep()).toBe('payment');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // goBack
  // ══════════════════════════════════════════════════════════════════════════════

  describe('goBack', () => {
    it('should navigate back through class_b steps', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      expect(facade.currentStep()).toBe('personal-data');

      facade.goBack();
      expect(facade.currentStep()).toBe('branch');
    });

    it('should not go back from branch', () => {
      facade.selectFlowType('class_b');
      facade.goBack();
      expect(facade.currentStep()).toBe('branch');
    });

    it('should navigate through payment → contract → documents → schedule', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.goToStep('payment');

      facade.goBack(); // payment → contract
      expect(facade.currentStep()).toBe('contract');

      facade.goBack(); // contract → documents
      expect(facade.currentStep()).toBe('documents');

      facade.goBack(); // documents → schedule
      expect(facade.currentStep()).toBe('schedule');
    });

    it('should call releaseSlots (fire & forget) when going back to schedule', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.goToStep('documents');

      mockSupabaseClient.functions.invoke = vi.fn().mockResolvedValue({ data: null, error: null });
      facade.goBack(); // documents → schedule

      expect(facade.currentStep()).toBe('schedule');
      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
        'public-enrollment',
        expect.objectContaining({ body: expect.objectContaining({ action: 'release-slots' }) }),
      );
    });

    it('should not go back from confirmation step', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.goToStep('confirmation');

      facade.goBack();

      expect(facade.currentStep()).toBe('confirmation');
    });

    it('should mark current step as pending and previous as active when going back', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      // Simular que estamos en payment-mode activo
      facade.goToStep('payment-mode');
      facade['updateStepStatus']('payment-mode', 'active');

      facade.goBack(); // payment-mode → personal-data

      const steps = facade.steps();
      const paymentModeStep = steps.find((s) => s.id === 'payment-mode');
      const personalDataStep = steps.find((s) => s.id === 'personal-data');

      expect(paymentModeStep?.status).toBe('pending');
      expect(personalDataStep?.status).toBe('active');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // reset
  // ══════════════════════════════════════════════════════════════════════════════

  describe('reset', () => {
    it('should reset all state and generate a new session token', () => {
      const tokenBefore = facade.sessionToken();
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.setPaymentMode('total');

      facade.reset();

      expect(facade.selectedBranch()).toBeNull();
      expect(facade.flowType()).toBeNull();
      expect(facade.currentStep()).toBe('branch');
      expect(facade.steps()).toEqual([]);
      expect(facade.paymentMode()).toBeNull();
      // Token regenerado
      expect(facade.sessionToken()).not.toBe(tokenBefore);
    });

    it('should clear the localStorage draft on reset', () => {
      localStorageMock.setItem('pec_draft', JSON.stringify({ version: 1, sessionToken: 'abc' }));
      facade.reset();
      expect(localStorageMock.getItem('pec_draft')).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // canAdvance
  // ══════════════════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════════════════════
  // uploadCarnetPhoto
  // ══════════════════════════════════════════════════════════════════════════════

  describe('uploadCarnetPhoto', () => {
    const mockFile = new File(['content'], 'foto.jpg', { type: 'image/jpeg' });

    it('should upload to temp path and set carnetPhotoUrl on success', async () => {
      mockStorageChain.upload = vi.fn().mockResolvedValue({ error: null });

      const result = await facade.uploadCarnetPhoto(mockFile);

      expect(result).toBe(true);
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('documents');
      expect(mockStorageChain.upload).toHaveBeenCalledWith(
        expect.stringContaining('public-uploads/carnet/'),
        mockFile,
        expect.objectContaining({ upsert: true }),
      );
      expect(facade.carnetPhotoUrl()).toBeTruthy();
    });

    it('should return false and set error on upload failure', async () => {
      mockStorageChain.upload = vi.fn().mockResolvedValue({ error: { message: 'Quota exceeded' } });

      const result = await facade.uploadCarnetPhoto(mockFile);

      expect(result).toBe(false);
      expect(facade.error()).toBeTruthy();
      expect(facade.carnetPhotoUrl()).toBeNull();
    });

    it('should unblock canAdvance at documents step after upload', async () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.goToStep('documents');
      mockStorageChain.upload = vi.fn().mockResolvedValue({ error: null });

      expect(facade.canAdvance()).toBe(false);
      await facade.uploadCarnetPhoto(mockFile);
      expect(facade.canAdvance()).toBe(true);
    });

    it('should reset isLoading after upload regardless of result', async () => {
      mockStorageChain.upload = vi.fn().mockResolvedValue({ error: null });
      await facade.uploadCarnetPhoto(mockFile);
      expect(facade.isLoading()).toBe(false);
    });
  });

  describe('canAdvance', () => {
    it('should be false at branch step without selections', () => {
      expect(facade.canAdvance()).toBe(false);
    });

    it('should be false at payment-mode without selection', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.savePersonalData(samplePersonalData);
      expect(facade.currentStep()).toBe('payment-mode');
      expect(facade.canAdvance()).toBe(false);
    });

    it('should be true at payment-mode with selection', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.savePersonalData(samplePersonalData);
      facade.setPaymentMode('total');
      expect(facade.canAdvance()).toBe(true);
    });

    it('should always be true at payment step', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.goToStep('payment');
      expect(facade.canAdvance()).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // clearError
  // ══════════════════════════════════════════════════════════════════════════════

  describe('clearError', () => {
    it('should clear error signal', () => {
      facade.clearError();
      expect(facade.error()).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Slot management
  // ══════════════════════════════════════════════════════════════════════════════

  describe('slot management', () => {
    it('should toggle slots', () => {
      facade.toggleSlot('2026-03-15T09:00:00-03:00');
      expect(facade.selectedSlotIds()).toEqual(['2026-03-15T09:00:00-03:00']);

      facade.toggleSlot('2026-03-15T09:00:00-03:00');
      expect(facade.selectedSlotIds()).toEqual([]);
    });

    it('should set slots directly', () => {
      facade.setSelectedSlots(['a', 'b', 'c']);
      expect(facade.selectedSlotIds()).toEqual(['a', 'b', 'c']);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // reserveSlots / confirmSchedule
  // ══════════════════════════════════════════════════════════════════════════════

  describe('reserveSlots', () => {
    it('should return true when Edge Function succeeds', async () => {
      mockSupabaseClient.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: { success: true }, error: null });

      facade.setSelectedSlots(['slot-1', 'slot-2']);
      facade['_selectedInstructorId'].set(5);

      const result = await facade.reserveSlots();
      expect(result).toBe(true);
    });

    it('should return false and set error on conflict', async () => {
      mockSupabaseClient.functions.invoke = vi.fn().mockResolvedValue({
        data: { success: false, conflictingSlots: ['slot-1'] },
        error: null,
      });

      facade.setSelectedSlots(['slot-1', 'slot-2']);
      facade['_selectedInstructorId'].set(5);

      const result = await facade.reserveSlots();
      expect(result).toBe(false);
      expect(facade.error()).toBeTruthy();
      // slot-1 debe haber sido deseleccionado
      expect(facade.selectedSlotIds()).not.toContain('slot-1');
      expect(facade.selectedSlotIds()).toContain('slot-2');
    });

    it('should return true immediately when no slots selected', async () => {
      const result = await facade.reserveSlots();
      expect(result).toBe(true);
      expect(mockSupabaseClient.functions.invoke).not.toHaveBeenCalled();
    });
  });

  describe('confirmSchedule', () => {
    it('should advance to documents on successful reservation', async () => {
      mockSupabaseClient.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: { success: true }, error: null });

      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.setSelectedSlots(['slot-1']);
      facade['_selectedInstructorId'].set(5);

      await facade.confirmSchedule();

      expect(facade.currentStep()).toBe('documents');
    });

    it('should stay on schedule if reservation fails', async () => {
      mockSupabaseClient.functions.invoke = vi.fn().mockResolvedValue({
        data: { success: false, conflictingSlots: ['slot-1'] },
        error: null,
      });

      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.goToStep('schedule');
      facade.setSelectedSlots(['slot-1']);
      facade['_selectedInstructorId'].set(5);

      await facade.confirmSchedule();

      expect(facade.currentStep()).toBe('schedule');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Draft persistence
  // ══════════════════════════════════════════════════════════════════════════════

  describe('draft persistence', () => {
    it('should detect a stored draft on initialization', () => {
      const draft = {
        version: 1,
        sessionToken: 'stored-token-123',
        savedAt: new Date().toISOString(),
        flowType: 'class_b',
        branchId: 1,
        branchSlug: 'test',
        branchName: 'Sede Test',
        branchAddress: '',
        currentStep: 'payment-mode',
        personalData: null,
        paymentMode: null,
        instructorId: null,
        selectedSlotIds: [],
        selectedCourseType: null,
        convalidatesSimultaneously: false,
        carnetStoragePath: null,
      };
      localStorageMock.setItem('pec_draft', JSON.stringify(draft));

      // Crear nueva instancia del facade (simula nueva carga de página)
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          PublicEnrollmentFacade,
          { provide: SupabaseService, useValue: { client: mockSupabaseClient } },
        ],
      });
      const freshFacade = TestBed.inject(PublicEnrollmentFacade);

      expect(freshFacade.hasDraftToRestore()).toBe(true);
      // Debe usar el sessionToken del draft
      expect(freshFacade.sessionToken()).toBe('stored-token-123');
    });

    it('should restore draft state', () => {
      const draft = {
        version: 1,
        sessionToken: 'restore-token',
        savedAt: new Date().toISOString(),
        flowType: 'class_b',
        branchId: 2,
        branchSlug: 'chillan',
        branchName: 'Conductores Chillán',
        branchAddress: 'Calle 456',
        currentStep: 'documents',
        personalData: null,
        paymentMode: 'total',
        instructorId: null,
        selectedSlotIds: [],
        selectedCourseType: null,
        convalidatesSimultaneously: false,
        carnetStoragePath: 'public-uploads/carnet/restore-token',
      };
      localStorageMock.setItem('pec_draft', JSON.stringify(draft));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          PublicEnrollmentFacade,
          { provide: SupabaseService, useValue: { client: mockSupabaseClient } },
        ],
      });
      const freshFacade = TestBed.inject(PublicEnrollmentFacade);
      freshFacade.restoreDraft();

      expect(freshFacade.currentStep()).toBe('documents');
      expect(freshFacade.flowType()).toBe('class_b');
      expect(freshFacade.paymentMode()).toBe('total');
      expect(freshFacade.selectedBranch()?.id).toBe(2);
      expect(freshFacade.hasDraftToRestore()).toBe(false);
      // Foto restaurada → carnetPhotoUrl debe ser no nulo
      expect(freshFacade.carnetPhotoUrl()).toBeTruthy();
    });

    it('should clear draft on discardDraft and generate new token', () => {
      localStorageMock.setItem(
        'pec_draft',
        JSON.stringify({ version: 1, sessionToken: 'old-token' }),
      );

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          PublicEnrollmentFacade,
          { provide: SupabaseService, useValue: { client: mockSupabaseClient } },
        ],
      });
      const freshFacade = TestBed.inject(PublicEnrollmentFacade);

      freshFacade.discardDraft();

      expect(localStorageMock.getItem('pec_draft')).toBeNull();
      expect(freshFacade.hasDraftToRestore()).toBe(false);
      expect(freshFacade.sessionToken()).not.toBe('old-token');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Professional course selection
  // ══════════════════════════════════════════════════════════════════════════════

  describe('professional course selection', () => {
    it('should select professional course', () => {
      facade.selectProfessionalCourse('professional_a2', false);
      expect(facade.selectedCourseType()).toBe('professional_a2');
      expect(facade.convalidatesSimultaneously()).toBe(false);
    });

    it('should select with convalidation', () => {
      facade.selectProfessionalCourse('professional_a2', true);
      expect(facade.selectedCourseType()).toBe('professional_a2');
      expect(facade.convalidatesSimultaneously()).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Schedule Polling
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Schedule Polling', () => {
    const INSTRUCTOR_ID = 5;

    const mockGrid = {
      week: {
        startDate: '2026-03-16',
        endDate: '2026-03-20',
        label: '16 mar – 20 mar',
        days: [{ date: '2026-03-16', dayOfWeek: 'lun', label: '16 mar' }],
      },
      timeRows: ['09:00', '09:45'],
      slots: [
        {
          id: '2026-03-16T09:00:00-03:00',
          date: '2026-03-16',
          startTime: '09:00',
          endTime: '09:45',
          status: 'available',
        },
        {
          id: '2026-03-16T09:45:00-03:00',
          date: '2026-03-16',
          startTime: '09:45',
          endTime: '10:30',
          status: 'available',
        },
      ],
    };

    it('should start polling after loadScheduleGrid succeeds', async () => {
      vi.useFakeTimers();
      mockSupabaseClient.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: { grid: mockGrid }, error: null });

      await facade.loadScheduleGrid(INSTRUCTOR_ID);
      expect(facade.scheduleGrid()).not.toBeNull();

      mockSupabaseClient.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: { grid: mockGrid }, error: null });

      await vi.advanceTimersByTimeAsync(15_000);

      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
        'public-enrollment',
        expect.objectContaining({
          body: expect.objectContaining({
            action: 'load-schedule',
            instructorId: INSTRUCTOR_ID,
          }),
        }),
      );

      vi.useRealTimers();
    });

    it('should pass sessionToken on load-schedule calls', async () => {
      vi.useFakeTimers();
      mockSupabaseClient.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: { grid: mockGrid }, error: null });

      await facade.loadScheduleGrid(INSTRUCTOR_ID);

      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
        'public-enrollment',
        expect.objectContaining({
          body: expect.objectContaining({
            action: 'load-schedule',
            sessionToken: facade.sessionToken(),
          }),
        }),
      );

      vi.useRealTimers();
    });

    it('should stop polling on reset', async () => {
      vi.useFakeTimers();
      mockSupabaseClient.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: { grid: mockGrid }, error: null });

      await facade.loadScheduleGrid(INSTRUCTOR_ID);
      facade.reset();

      mockSupabaseClient.functions.invoke = vi.fn();
      await vi.advanceTimersByTimeAsync(15_000);

      expect(mockSupabaseClient.functions.invoke).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should auto-deselect occupied slots during polling', async () => {
      vi.useFakeTimers();
      mockSupabaseClient.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: { grid: mockGrid }, error: null });

      await facade.loadScheduleGrid(INSTRUCTOR_ID);
      facade.toggleSlot('2026-03-16T09:00:00-03:00');
      expect(facade.selectedSlotIds()).toContain('2026-03-16T09:00:00-03:00');

      const occupiedGrid = {
        ...mockGrid,
        slots: mockGrid.slots.map((s) =>
          s.id === '2026-03-16T09:00:00-03:00' ? { ...s, status: 'occupied' } : s,
        ),
      };
      mockSupabaseClient.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: { grid: occupiedGrid }, error: null });

      await vi.advanceTimersByTimeAsync(15_000);

      expect(facade.selectedSlotIds()).not.toContain('2026-03-16T09:00:00-03:00');
      vi.useRealTimers();
    });
  });
});
