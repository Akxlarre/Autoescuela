import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PublicEnrollmentFacade } from './public-enrollment.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('PublicEnrollmentFacade', () => {
  let facade: PublicEnrollmentFacade;

  const mockSupabaseClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };

  beforeEach(() => {
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
    vi.clearAllMocks();
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

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
  });

  describe('selectFlowType', () => {
    it('should set flow type and build class_b steps', () => {
      facade.selectFlowType('class_b');
      expect(facade.flowType()).toBe('class_b');
      expect(facade.steps().length).toBe(7);
      expect(facade.steps()[0].id).toBe('branch');
      expect(facade.steps()[1].id).toBe('personal-data');
      expect(facade.steps()[6].id).toBe('confirmation');
    });

    it('should set flow type and build professional steps', () => {
      facade.selectFlowType('professional');
      expect(facade.flowType()).toBe('professional');
      expect(facade.steps().length).toBe(4);
      expect(facade.steps()[0].id).toBe('branch');
      expect(facade.steps()[3].id).toBe('pre-confirmation');
    });
  });

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

  describe('savePersonalData', () => {
    it('should advance to payment-mode for class_b', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();

      facade.savePersonalData({
        rut: '12345678-9',
        firstNames: 'Juan',
        paternalLastName: 'Pérez',
        maternalLastName: 'López',
        email: 'juan@test.com',
        phone: '+56912345678',
        birthDate: '1990-01-01',
        gender: 'M',
        address: 'Calle 123',
        courseCategory: 'non-professional',
        courseType: 'class_b',
        singularCourseCode: null,
        senceCode: null,
        currentLicense: null,
        licenseDate: null,
        convalidatesSimultaneously: false,
        historicalPromotionId: null,
        validationBook: null,
        courses: [],
      });

      expect(facade.currentStep()).toBe('payment-mode');
      expect(facade.personalData()).not.toBeNull();
    });

    it('should advance to course-selection for professional', () => {
      facade.selectFlowType('professional');
      facade.confirmBranchSelection();

      facade.savePersonalData({
        rut: '12345678-9',
        firstNames: 'Juan',
        paternalLastName: 'Pérez',
        maternalLastName: 'López',
        email: 'juan@test.com',
        phone: '+56912345678',
        birthDate: '1990-01-01',
        gender: 'M',
        address: 'Calle 123',
        courseCategory: 'professional',
        courseType: 'professional_a2',
        singularCourseCode: null,
        senceCode: null,
        currentLicense: null,
        licenseDate: null,
        convalidatesSimultaneously: false,
        historicalPromotionId: null,
        validationBook: null,
        courses: [],
      });

      expect(facade.currentStep()).toBe('course-selection');
    });
  });

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
  });

  describe('reset', () => {
    it('should reset all state', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.setPaymentMode('total');

      facade.reset();

      expect(facade.selectedBranch()).toBeNull();
      expect(facade.flowType()).toBeNull();
      expect(facade.currentStep()).toBe('branch');
      expect(facade.steps()).toEqual([]);
      expect(facade.paymentMode()).toBeNull();
    });
  });

  describe('canAdvance', () => {
    it('should be false at branch step without selections', () => {
      expect(facade.canAdvance()).toBe(false);
    });

    it('should be false at payment-mode without selection', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.savePersonalData({
        rut: '12345678-9',
        firstNames: 'Test',
        paternalLastName: 'User',
        maternalLastName: '',
        email: 'test@test.com',
        phone: '',
        birthDate: '1990-01-01',
        gender: 'M',
        address: '',
        courseCategory: 'non-professional',
        courseType: 'class_b',
        singularCourseCode: null,
        senceCode: null,
        currentLicense: null,
        licenseDate: null,
        convalidatesSimultaneously: false,
        historicalPromotionId: null,
        validationBook: null,
        courses: [],
      });

      expect(facade.currentStep()).toBe('payment-mode');
      expect(facade.canAdvance()).toBe(false);
    });

    it('should be true at payment-mode with selection', () => {
      facade.selectFlowType('class_b');
      facade.confirmBranchSelection();
      facade.savePersonalData({
        rut: '12345678-9',
        firstNames: 'Test',
        paternalLastName: 'User',
        maternalLastName: '',
        email: 'test@test.com',
        phone: '',
        birthDate: '1990-01-01',
        gender: 'M',
        address: '',
        courseCategory: 'non-professional',
        courseType: 'class_b',
        singularCourseCode: null,
        senceCode: null,
        currentLicense: null,
        licenseDate: null,
        convalidatesSimultaneously: false,
        historicalPromotionId: null,
        validationBook: null,
        courses: [],
      });
      facade.setPaymentMode('total');
      expect(facade.canAdvance()).toBe(true);
    });
  });

  describe('clearError', () => {
    it('should clear error signal', () => {
      facade.clearError();
      expect(facade.error()).toBeNull();
    });
  });

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
  // POLLING — Schedule polling tests
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

      // Polling should re-invoke Edge Function after 15s
      mockSupabaseClient.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: { grid: mockGrid }, error: null });

      await vi.advanceTimersByTimeAsync(15_000);

      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('public-enrollment', {
        body: { action: 'load-schedule', instructorId: INSTRUCTOR_ID },
      });

      vi.useRealTimers();
    });

    it('should stop polling on reset', async () => {
      vi.useFakeTimers();
      mockSupabaseClient.functions.invoke = vi
        .fn()
        .mockResolvedValue({ data: { grid: mockGrid }, error: null });

      await facade.loadScheduleGrid(INSTRUCTOR_ID);
      facade.reset();

      // Clear mock and advance — should NOT call invoke
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

      // Next poll returns the slot as occupied
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
