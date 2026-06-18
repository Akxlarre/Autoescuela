import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PublicEnrollmentFacade } from './public-enrollment.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

// `normalizePhoto` usa `<img>.onload`, que nunca dispara en el entorno de test
// (happy-dom no decodifica imágenes) → colgaría `uploadCarnetPhoto`. Passthrough.
vi.mock('@core/utils/image.utils', () => ({
  normalizePhoto: vi.fn((file: File) => Promise.resolve(file)),
}));

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

// ── Course fixtures (para resolver flows por sede) ──────────────────────────────
const classBCourse = (branchId: number) => ({
  id: 100 + branchId,
  code: 'CLASEB',
  name: 'Clase B',
  license_class: 'B',
  base_price: 180000,
  type: null,
  duration_weeks: 8,
  practical_hours: 9,
  branch_id: branchId,
  active: true,
  is_convalidation: false,
});

const professionalCourse = (branchId: number) => ({
  id: 200 + branchId,
  code: 'PROFA2',
  name: 'Profesional A2',
  license_class: 'A2',
  base_price: 300000,
  type: null,
  duration_weeks: 12,
  practical_hours: 0,
  branch_id: branchId,
  active: true,
  is_convalidation: false,
});

const sampleBranches = [
  { id: 1, name: 'Autoescuela Azul', slug: 'azul', address: 'Av. Azul 1' },
  { id: 2, name: 'Autoescuela Roja', slug: 'roja', address: 'Av. Roja 2' },
];

describe('PublicEnrollmentFacade', () => {
  let facade: PublicEnrollmentFacade;
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  const mockStorageChain = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    uploadToSignedUrl: vi.fn().mockResolvedValue({ error: null }),
    move: vi.fn().mockResolvedValue({ error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
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
    // jsdom no implementa URL.createObjectURL — mockearlo para que uploadCarnetPhoto funcione.
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue('blob:mock-preview'),
      revokeObjectURL: vi.fn(),
    });

    // Resetear los mocks dinámicos a sus defaults en cada test (determinismo).
    mockSupabaseClient.order = vi.fn().mockResolvedValue({ data: [], error: null });
    mockSupabaseClient.functions.invoke = vi.fn().mockResolvedValue({ data: null, error: null });
    mockStorageChain.uploadToSignedUrl = vi.fn().mockResolvedValue({ error: null });

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

    it('should start at license-type step (no more "branch" step)', () => {
      expect(facade.currentStep()).toBe('license-type');
    });

    it('should start in "orientation" entry state until a valid branch resolves', () => {
      expect(facade.entryState()).toBe('orientation');
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
  // resolveEntry — resolución de entrada por branchId (AC6, AC6b, AC6c, AC6d, AC-E1, AC-E3)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('resolveEntry', () => {
    it('goes to orientation when no branchId is provided (AC-E1)', async () => {
      facade['_branches'].set(sampleBranches);

      await facade.resolveEntry(null, null);

      expect(facade.entryState()).toBe('orientation');
      expect(facade.selectedBranch()).toBeNull();
    });

    it('goes to orientation when branchId is invalid / unknown (AC-E3)', async () => {
      facade['_branches'].set(sampleBranches);

      await facade.resolveEntry(999, null);

      expect(facade.entryState()).toBe('orientation');
    });

    it('auto-skips license-type to personal-data when the sede offers a single flow (AC6b)', async () => {
      facade['_branches'].set(sampleBranches);
      mockSupabaseClient.order = vi
        .fn()
        .mockResolvedValue({ data: [classBCourse(1)], error: null });

      await facade.resolveEntry(1, null);

      expect(facade.entryState()).toBe('ready');
      expect(facade.selectedBranch()?.id).toBe(1);
      expect(facade.flowType()).toBe('class_b');
      expect(facade.currentStep()).toBe('personal-data');
    });

    it('starts at license-type when the sede offers multiple flows and no courseId (AC6c)', async () => {
      facade['_branches'].set(sampleBranches);
      mockSupabaseClient.order = vi
        .fn()
        .mockResolvedValue({ data: [classBCourse(2), professionalCourse(2)], error: null });

      await facade.resolveEntry(2, null);

      expect(facade.entryState()).toBe('ready');
      expect(facade.currentStep()).toBe('license-type');
      expect(facade.flowType()).toBeNull();
    });

    it('resolves the flow from courseId and jumps to personal-data (AC6d)', async () => {
      facade['_branches'].set(sampleBranches);
      mockSupabaseClient.order = vi
        .fn()
        .mockResolvedValue({ data: [classBCourse(2), professionalCourse(2)], error: null });

      await facade.resolveEntry(2, professionalCourse(2).id);

      expect(facade.entryState()).toBe('ready');
      expect(facade.flowType()).toBe('professional');
      expect(facade.currentStep()).toBe('personal-data');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // availableFlows — flujos ofrecidos por la sede (computed)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('availableFlows', () => {
    it('returns [class_b] for a sede with only Class B courses', () => {
      facade['_courses'].set([classBCourse(1)] as never);
      expect(facade.availableFlows()).toEqual(['class_b']);
    });

    it('returns both flows for a sede with Class B + professional courses', () => {
      facade['_courses'].set([classBCourse(2), professionalCourse(2)] as never);
      expect(facade.availableFlows()).toEqual(['class_b', 'professional']);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // selectFlowType / buildSteps
  // ══════════════════════════════════════════════════════════════════════════════

  describe('selectFlowType', () => {
    it('should build 8 steps for class_b starting with license-type (no "branch")', () => {
      facade.selectFlowType('class_b');
      expect(facade.flowType()).toBe('class_b');
      expect(facade.steps().length).toBe(8);
      expect(facade.steps()[0].id).toBe('license-type');
      expect(facade.steps()[1].id).toBe('personal-data');
      expect(facade.steps()[6].id).toBe('payment');
      expect(facade.steps()[7].id).toBe('confirmation');
      expect(facade.steps().some((s) => s.id === ('branch' as never))).toBe(false);
    });

    it('should build 4 steps for professional starting with license-type', () => {
      facade.selectFlowType('professional');
      expect(facade.flowType()).toBe('professional');
      expect(facade.steps().length).toBe(4);
      expect(facade.steps()[0].id).toBe('license-type');
      expect(facade.steps()[3].id).toBe('pre-confirmation');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // confirmLicenseType (reemplaza confirmBranchSelection)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('confirmLicenseType', () => {
    it('should not advance without flow type', () => {
      facade.confirmLicenseType();
      expect(facade.currentStep()).toBe('license-type');
    });

    it('should advance to personal-data with flow type set', () => {
      facade.selectFlowType('class_b');
      facade.confirmLicenseType();
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
      facade.confirmLicenseType();
      facade.savePersonalData(samplePersonalData);
      expect(facade.currentStep()).toBe('payment-mode');
      expect(facade.personalData()).not.toBeNull();
    });

    it('should advance to psych-test-intro for professional', () => {
      facade.selectFlowType('professional');
      facade.confirmLicenseType();
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
      facade.confirmLicenseType();
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
      facade.confirmLicenseType();
      facade.confirmContract();
      expect(facade.currentStep()).toBe('payment');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // goBack
  // ══════════════════════════════════════════════════════════════════════════════

  describe('goBack', () => {
    it('should navigate back from personal-data to license-type (no more "branch")', () => {
      facade.selectFlowType('class_b');
      facade.confirmLicenseType();
      expect(facade.currentStep()).toBe('personal-data');

      facade.goBack();
      expect(facade.currentStep()).toBe('license-type');
    });

    it('should not go back from license-type (first step)', () => {
      facade.selectFlowType('class_b');
      facade.goBack();
      expect(facade.currentStep()).toBe('license-type');
    });

    it('should navigate through payment → contract → documents → schedule', () => {
      facade.selectFlowType('class_b');
      facade.confirmLicenseType();
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
      facade.confirmLicenseType();
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
      facade.confirmLicenseType();
      facade.goToStep('confirmation');

      facade.goBack();

      expect(facade.currentStep()).toBe('confirmation');
    });

    it('should mark current step as pending and previous as active when going back', () => {
      facade.selectFlowType('class_b');
      facade.confirmLicenseType();
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
      facade.confirmLicenseType();
      facade.setPaymentMode('total');

      facade.reset();

      expect(facade.selectedBranch()).toBeNull();
      expect(facade.flowType()).toBeNull();
      expect(facade.currentStep()).toBe('license-type');
      expect(facade.entryState()).toBe('orientation');
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
  // uploadCarnetPhoto — subida vía Signed Upload URL (Edge Function)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('uploadCarnetPhoto', () => {
    const mockFile = new File(['content'], 'foto.jpg', { type: 'image/jpeg' });
    const signedUrlResponse = {
      data: { token: 'signed-token', path: 'public-uploads/carnet/session-xyz' },
      error: null,
    };

    it('should upload via signed URL and set carnetPhotoUrl on success', async () => {
      mockSupabaseClient.functions.invoke = vi.fn().mockResolvedValue(signedUrlResponse);
      mockStorageChain.uploadToSignedUrl = vi.fn().mockResolvedValue({ error: null });

      const result = await facade.uploadCarnetPhoto(mockFile);

      expect(result).toBe(true);
      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
        'public-enrollment',
        expect.objectContaining({
          body: expect.objectContaining({ action: 'get-carnet-upload-url' }),
        }),
      );
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('documents');
      expect(mockStorageChain.uploadToSignedUrl).toHaveBeenCalledWith(
        'public-uploads/carnet/session-xyz',
        'signed-token',
        mockFile,
        expect.objectContaining({ contentType: 'image/jpeg' }),
      );
      expect(facade.carnetPhotoUrl()).toBeTruthy();
    });

    it('should return false and set error when the signed-url request fails', async () => {
      mockSupabaseClient.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'EF down' } });

      const result = await facade.uploadCarnetPhoto(mockFile);

      expect(result).toBe(false);
      expect(facade.error()).toBeTruthy();
      expect(facade.carnetPhotoUrl()).toBeNull();
    });

    it('should return false and set error on upload failure', async () => {
      mockSupabaseClient.functions.invoke = vi.fn().mockResolvedValue(signedUrlResponse);
      mockStorageChain.uploadToSignedUrl = vi
        .fn()
        .mockResolvedValue({ error: { message: 'Quota exceeded' } });

      const result = await facade.uploadCarnetPhoto(mockFile);

      expect(result).toBe(false);
      expect(facade.error()).toBeTruthy();
      expect(facade.carnetPhotoUrl()).toBeNull();
    });

    it('should unblock canAdvance at documents step after upload', async () => {
      // canAdvance en 'documents' solo depende de carnetStoragePath → goToStep basta.
      facade.goToStep('documents');
      mockSupabaseClient.functions.invoke = vi.fn().mockResolvedValue(signedUrlResponse);
      mockStorageChain.uploadToSignedUrl = vi.fn().mockResolvedValue({ error: null });

      expect(facade.canAdvance()).toBe(false);
      await facade.uploadCarnetPhoto(mockFile);
      expect(facade.canAdvance()).toBe(true);
    });

    it('should reset isLoading after upload regardless of result', async () => {
      mockSupabaseClient.functions.invoke = vi.fn().mockResolvedValue(signedUrlResponse);
      mockStorageChain.uploadToSignedUrl = vi.fn().mockResolvedValue({ error: null });
      await facade.uploadCarnetPhoto(mockFile);
      expect(facade.isLoading()).toBe(false);
    });
  });

  describe('canAdvance', () => {
    it('should be false at license-type step without selections', () => {
      expect(facade.canAdvance()).toBe(false);
    });

    it('should be false at payment-mode without selection', () => {
      facade.selectFlowType('class_b');
      facade.confirmLicenseType();
      facade.savePersonalData(samplePersonalData);
      expect(facade.currentStep()).toBe('payment-mode');
      expect(facade.canAdvance()).toBe(false);
    });

    it('should be true at payment-mode with selection', () => {
      facade.selectFlowType('class_b');
      facade.confirmLicenseType();
      facade.savePersonalData(samplePersonalData);
      facade.setPaymentMode('total');
      expect(facade.canAdvance()).toBe(true);
    });

    it('should always be true at payment step', () => {
      facade.selectFlowType('class_b');
      facade.confirmLicenseType();
      facade.goToStep('payment');
      expect(facade.canAdvance()).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // requiredSlotCount — desacople agendamiento/pago (fix-017)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('requiredSlotCount (fix-017)', () => {
    it('agenda SIEMPRE el total de clases, independiente de la modalidad de pago', async () => {
      facade.selectFlowType('class_b');
      facade.confirmLicenseType();
      await facade.savePersonalData(samplePersonalData);

      facade.setPaymentMode('total');
      const totalMode = facade.requiredSlotCount();

      facade.setPaymentMode('partial');
      const partialMode = facade.requiredSlotCount();

      // El abono 50% ya NO reduce a la mitad las clases a agendar.
      expect(partialMode).toBe(totalMode);
      expect(partialMode).toBe(facade.basePracticalSlotCount());
      expect(partialMode).toBeGreaterThan(0);
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
      facade.confirmLicenseType();
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
      facade.confirmLicenseType();
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
    const freshFacadeWithDraft = (draft: Record<string, unknown>) => {
      localStorageMock.setItem('pec_draft', JSON.stringify(draft));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          PublicEnrollmentFacade,
          { provide: SupabaseService, useValue: { client: mockSupabaseClient } },
        ],
      });
      return TestBed.inject(PublicEnrollmentFacade);
    };

    it('should detect a stored draft on initialization', () => {
      const freshFacade = freshFacadeWithDraft({
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
      });

      expect(freshFacade.hasDraftToRestore()).toBe(true);
      expect(freshFacade.sessionToken()).toBe('stored-token-123');
    });

    it('should restore draft state and recreate the carnet photo preview (AC-E2)', async () => {
      const freshFacade = freshFacadeWithDraft({
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
      });

      // La restauración genera una signed URL de preview para la foto subida.
      mockSupabaseClient.functions.invoke = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://signed.example/carnet.jpg' },
        error: null,
      });

      await freshFacade.restoreDraft();

      expect(freshFacade.currentStep()).toBe('documents');
      expect(freshFacade.flowType()).toBe('class_b');
      expect(freshFacade.paymentMode()).toBe('total');
      expect(freshFacade.selectedBranch()?.id).toBe(2);
      expect(freshFacade.hasDraftToRestore()).toBe(false);
      // Foto restaurada → carnetPhotoUrl debe ser no nulo (AC-E2)
      expect(freshFacade.carnetPhotoUrl()).toBeTruthy();
    });

    it('should clear draft on discardDraft and generate new token', () => {
      const freshFacade = freshFacadeWithDraft({ version: 1, sessionToken: 'old-token' });

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

  // ── S5 — generateToken sin fallback inseguro (Spec 0010) ──────────────────────
  describe('generateToken (S5)', () => {
    it('usa crypto.randomUUID → token con formato UUID', () => {
      const token = (facade as unknown as { generateToken(): string }).generateToken();
      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('lanza error si no hay crypto.randomUUID (sin fallback predecible)', () => {
      vi.stubGlobal('crypto', {}); // entorno sin randomUUID
      try {
        expect(() => (facade as unknown as { generateToken(): string }).generateToken()).toThrow();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
