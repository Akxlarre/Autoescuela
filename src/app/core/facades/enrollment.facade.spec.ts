/* import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EnrollmentFacade } from './enrollment.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

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
  };
  return builder;
}

function createMockSupabaseService() {
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
    },
    _mockBuilder: mockBuilder,
  };
}

describe('EnrollmentFacade', () => {
  let facade: EnrollmentFacade;
  let mockSupabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseService();

    TestBed.configureTestingModule({
      providers: [EnrollmentFacade, { provide: SupabaseService, useValue: mockSupabase }],
    });

    facade = TestBed.inject(EnrollmentFacade);
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
    it('should set payment mode to full', () => {
      facade.setPaymentMode('full');
      expect(facade.paymentMode()).toBe('full');
    });

    it('should set payment mode to deposit', () => {
      facade.setPaymentMode('deposit');
      expect(facade.paymentMode()).toBe('deposit');
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

      const builder = createMockQueryBuilder();
      builder.order = vi.fn().mockResolvedValue({ data: mockCourses, error: null });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadCourses(1);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('courses');
    });

    it('should set error on failure', async () => {
      const builder = createMockQueryBuilder();
      builder.order = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Connection failed' } });
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
});
 */