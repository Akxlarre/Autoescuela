import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EnrollmentPaymentFacade } from './enrollment-payment.facade';
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
    gte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
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
    },
    _mockBuilder: mockBuilder,
  };
}

describe('EnrollmentPaymentFacade', () => {
  let facade: EnrollmentPaymentFacade;
  let mockSupabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseService();

    TestBed.configureTestingModule({
      providers: [EnrollmentPaymentFacade, { provide: SupabaseService, useValue: mockSupabase }],
    });

    facade = TestBed.inject(EnrollmentPaymentFacade);
  });

  // ── Initialization ──

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialize with no pricing', () => {
    expect(facade.pricing()).toBeNull();
  });

  it('should initialize with no payment method', () => {
    expect(facade.paymentMethod()).toBeNull();
  });

  it('should initialize with discount disabled', () => {
    expect(facade.discount().enabled).toBe(false);
    expect(facade.discount().amount).toBeNull();
  });

  it('should initialize with no loading state', () => {
    expect(facade.isProcessing()).toBe(false);
  });

  it('should initialize with no error', () => {
    expect(facade.error()).toBeNull();
  });

  it('should initialize with empty available discounts', () => {
    expect(facade.availableDiscounts()).toEqual([]);
  });

  // ── Pricing Breakdown ──

  describe('Pricing', () => {
    it('should compute pricing for full payment', () => {
      facade.computePricing({
        courseLabel: 'Clase B',
        basePrice: 300000,
        practicalClassesIncluded: 12,
        isDeposit: false,
      });

      const pricing = facade.pricing();
      expect(pricing).not.toBeNull();
      expect(pricing!.basePrice).toBe(300000);
      expect(pricing!.amountDue).toBe(300000);
      expect(pricing!.isDeposit).toBe(false);
    });

    it('should compute pricing for deposit mode (50%)', () => {
      facade.computePricing({
        courseLabel: 'Clase B',
        basePrice: 300000,
        practicalClassesIncluded: 12,
        isDeposit: true,
      });

      const pricing = facade.pricing();
      expect(pricing!.amountDue).toBe(150000);
      expect(pricing!.isDeposit).toBe(true);
    });
  });

  // ── Payment Method ──

  describe('Payment Method', () => {
    it('should set payment method', () => {
      facade.setPaymentMethod('efectivo');
      expect(facade.paymentMethod()).toBe('efectivo');
    });

    it('should change payment method', () => {
      facade.setPaymentMethod('efectivo');
      facade.setPaymentMethod('transferencia');
      expect(facade.paymentMethod()).toBe('transferencia');
    });
  });

  // ── Discount ──

  describe('Discount', () => {
    it('should enable discount with amount and reason', () => {
      facade.setDiscount({ enabled: true, amount: 50000, reason: 'Familiar' });
      expect(facade.discount().enabled).toBe(true);
      expect(facade.discount().amount).toBe(50000);
      expect(facade.discount().reason).toBe('Familiar');
    });

    it('should disable discount', () => {
      facade.setDiscount({ enabled: true, amount: 50000, reason: 'Test' });
      facade.setDiscount({ enabled: false, amount: null, reason: '' });
      expect(facade.discount().enabled).toBe(false);
    });
  });

  // ── Total to Pay (Computed) ──

  describe('totalToPay', () => {
    it('should return 0 when no pricing set', () => {
      expect(facade.totalToPay()).toBe(0);
    });

    it('should return amountDue when no discount', () => {
      facade.computePricing({
        courseLabel: 'Clase B',
        basePrice: 300000,
        practicalClassesIncluded: 12,
        isDeposit: false,
      });
      expect(facade.totalToPay()).toBe(300000);
    });

    it('should subtract discount from amountDue', () => {
      facade.computePricing({
        courseLabel: 'Clase B',
        basePrice: 300000,
        practicalClassesIncluded: 12,
        isDeposit: false,
      });
      facade.setDiscount({ enabled: true, amount: 50000, reason: 'Descuento' });
      expect(facade.totalToPay()).toBe(250000);
    });

    it('should not go below 0', () => {
      facade.computePricing({
        courseLabel: 'Clase B',
        basePrice: 100000,
        practicalClassesIncluded: 12,
        isDeposit: false,
      });
      facade.setDiscount({ enabled: true, amount: 200000, reason: 'Mega' });
      expect(facade.totalToPay()).toBe(0);
    });
  });

  // ── canConfirmPayment (Computed) ──

  describe('canConfirmPayment', () => {
    it('should be false when no pricing', () => {
      expect(facade.canConfirmPayment()).toBe(false);
    });

    it('should be false when no payment method', () => {
      facade.computePricing({
        courseLabel: 'Clase B',
        basePrice: 300000,
        practicalClassesIncluded: 12,
        isDeposit: false,
      });
      expect(facade.canConfirmPayment()).toBe(false);
    });

    it('should be true when pricing + payment method set', () => {
      facade.computePricing({
        courseLabel: 'Clase B',
        basePrice: 300000,
        practicalClassesIncluded: 12,
        isDeposit: false,
      });
      facade.setPaymentMethod('efectivo');
      expect(facade.canConfirmPayment()).toBe(true);
    });
  });

  // ── Load Available Discounts ──

  describe('loadAvailableDiscounts', () => {
    it('should call supabase to load discounts', async () => {
      const builder = createMockQueryBuilder();
      builder.order = vi.fn().mockResolvedValue({ data: [], error: null });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadAvailableDiscounts('class_b');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('discounts');
    });

    it('should set error on failure', async () => {
      const builder = createMockQueryBuilder();
      builder.order = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Connection failed' } });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadAvailableDiscounts('class_b');
      expect(facade.error()).toContain('Error al cargar descuentos');
    });
  });

  // ── Record Payment ──

  describe('recordPayment', () => {
    it('should return false without enrollmentId', async () => {
      const result = await facade.recordPayment(null, null);
      expect(result).toBe(false);
    });
  });

  // ── Reset ──

  describe('Reset', () => {
    it('should reset all state', () => {
      facade.computePricing({
        courseLabel: 'Clase B',
        basePrice: 300000,
        practicalClassesIncluded: 12,
        isDeposit: false,
      });
      facade.setPaymentMethod('efectivo');
      facade.setDiscount({ enabled: true, amount: 50000, reason: 'Test' });

      facade.reset();

      expect(facade.pricing()).toBeNull();
      expect(facade.paymentMethod()).toBeNull();
      expect(facade.discount().enabled).toBe(false);
      expect(facade.totalToPay()).toBe(0);
      expect(facade.error()).toBeNull();
    });
  });

  // ── Error Handling ──

  describe('Error Handling', () => {
    it('should clear error', () => {
      facade.clearError();
      expect(facade.error()).toBeNull();
    });
  });
});
