import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EnrollmentPaymentFacade } from './enrollment-payment.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { ToastService } from '@core/services/ui/toast.service';

// ── Mock Supabase client ──

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function createMockQueryBuilder(responseData: any = null, responseError: any = null) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
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
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    _mockBuilder: mockBuilder,
  };
}

describe('EnrollmentPaymentFacade', () => {
  let facade: EnrollmentPaymentFacade;
  let mockSupabase: ReturnType<typeof createMockSupabaseService>;
  let notificationsSpy: any;
  let toastSpy: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseService();
    notificationsSpy = { notifyUsers: vi.fn().mockResolvedValue(undefined) };
    toastSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        EnrollmentPaymentFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: NotificationsFacade, useValue: notificationsSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
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

  // ── Rehidratación con un pago anulado (spec 0025-m, AC-E3) ──

  describe('rehydrateFromEnrollment', () => {
    it('ignora el pago anulado: no lo trae y carga el vigente sin error', async () => {
      const vigente = {
        cash_amount: 0,
        transfer_amount: 50_000,
        card_amount: 0,
        status: 'paid',
        document_number: 'TRF-1',
      };
      // Una fila anulada más una vigente serían dos filas: maybeSingle() devolvería error y
      // data null. El filtro deja solo la vigente.
      mockSupabase._mockBuilder.maybeSingle.mockResolvedValue({ data: vigente, error: null });
      mockSupabase._mockBuilder.single.mockResolvedValue({
        data: {
          base_price: 180_000,
          discount: 0,
          total_paid: 50_000,
          pending_balance: 130_000,
          payment_status: 'partial',
          payment_mode: 'partial',
          courses: { name: 'Clase B', practical_hours: 12 },
        },
        error: null,
      });

      await facade.rehydrateFromEnrollment(77);

      expect(mockSupabase._mockBuilder.neq).toHaveBeenCalledWith('status', 'anulado');
      expect(facade.paymentMethod()).toBe('transferencia');
      expect(facade.error()).toBeNull();
    });
  });

  // ── Rehidratación del descuento (fix-253-b) ──

  describe('rehydrateFromEnrollment — descuento (fix-253-b)', () => {
    function mockBorrador(opts: {
      discount: number | null;
      discountApplication: unknown;
      discountApplicationError?: unknown;
    }): void {
      const rows: Record<string, unknown> = {
        enrollments: {
          base_price: 300_000,
          discount: opts.discount,
          total_paid: 250_000,
          pending_balance: 0,
          payment_status: 'paid_full',
          payment_mode: 'total',
          courses: { name: 'Clase B', practical_hours: 12 },
        },
        payments: {
          cash_amount: 250_000,
          transfer_amount: 0,
          card_amount: 0,
          status: 'paid',
          document_number: null,
        },
        discount_applications: opts.discountApplication,
      };
      mockSupabase.client.from.mockImplementation((table: string) =>
        createMockQueryBuilder(
          rows[table] ?? null,
          table === 'discount_applications' ? (opts.discountApplicationError ?? null) : null,
        ),
      );
    }

    it('un descuento manual conserva monto y total, sin confundirse con uno predefinido', async () => {
      mockBorrador({ discount: 50_000, discountApplication: null });

      await facade.rehydrateFromEnrollment(77);

      expect(facade.discount()).toEqual({
        enabled: true,
        amount: 50_000,
        reason: 'Descuento Manual',
      });
      expect(facade.selectedDiscountId()).toBeNull();
      expect(facade.totalToPay()).toBe(250_000);
    });

    it('confirmar tras reanudar reenvía el descuento manual a la RPC', async () => {
      mockBorrador({ discount: 50_000, discountApplication: null });
      await facade.rehydrateFromEnrollment(77);

      await facade.recordPayment(77, null);

      expect(mockSupabase.client.rpc).toHaveBeenCalledWith(
        'record_enrollment_payment',
        expect.objectContaining({
          p_total_amount: 250_000,
          p_discount_id: null,
          p_discount_amount: 50_000,
        }),
      );
    });

    it('un descuento predefinido conserva su id y su nombre', async () => {
      mockBorrador({
        discount: 30_000,
        discountApplication: {
          discount_id: 4,
          discount_amount: 30_000,
          discounts: { name: 'Convenio' },
        },
      });

      await facade.rehydrateFromEnrollment(77);

      expect(facade.selectedDiscountId()).toBe(4);
      expect(facade.discount()).toEqual({ enabled: true, amount: 30_000, reason: 'Convenio' });
      expect(facade.totalToPay()).toBe(270_000);
    });

    it.each([0, null])('sin descuento guardado (%s) no inventa uno', async (discount) => {
      mockBorrador({ discount, discountApplication: null });

      await facade.rehydrateFromEnrollment(77);

      expect(facade.discount().enabled).toBe(false);
      expect(facade.selectedDiscountId()).toBeNull();
      expect(facade.totalToPay()).toBe(300_000);
    });

    it('si falla discount_applications no toma un predefinido por manual y bloquea', async () => {
      mockBorrador({
        discount: 30_000,
        discountApplication: null,
        discountApplicationError: { message: 'sin red' },
      });

      await facade.rehydrateFromEnrollment(77);

      expect(facade.discount().enabled).toBe(false);
      expect(facade.rehydrationError()).not.toBeNull();
      expect(facade.canConfirmPayment()).toBe(false);
    });
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

      await facade.loadAvailableDiscounts('class_b', 1, 1);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('discounts');
    });

    it('should set error on failure', async () => {
      const builder = createMockQueryBuilder();
      builder.order = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Connection failed' } });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadAvailableDiscounts('class_b', 1, 1);
      // spec 0060-b: esta lectura tiene su propio signal; error() queda para el guardado.
      expect(facade.discountsError()).toContain('No se pudieron cargar los descuentos');
      expect(facade.error()).toBeNull();
    });

    it('excluye un descuento de curso específico que no coincide con el curso actual', async () => {
      const builder = createMockQueryBuilder();
      builder.order = vi.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'Solo A2',
            discount_type: 'fixed_amount',
            value: 5000,
            applicable_to: 'professional',
            branch_id: null,
            course_id: 99,
          },
          {
            id: 2,
            name: 'General Profesional',
            discount_type: 'percentage',
            value: 10,
            applicable_to: 'professional',
            branch_id: null,
            course_id: null,
          },
        ],
        error: null,
      });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadAvailableDiscounts('professional_a3', 5, 1);

      expect(facade.availableDiscounts().map((d) => d.id)).toEqual([2]);
    });
  });

  // ── Record Payment ──

  describe('recordPayment', () => {
    it('should return false without enrollmentId', async () => {
      const result = await facade.recordPayment(null, null);
      expect(result).toBe(false);
    });

    // fix-057-i: con beca del 100 % el paso Pago exigía medio de pago y la BD rechazaba el pago de $0.
    it('fix-057-i: con total $0 confirma sin medio de pago y manda el monto 0 a la RPC', async () => {
      facade.computePricing({
        courseLabel: 'Clase B',
        basePrice: 300000,
        practicalClassesIncluded: 12,
        isDeposit: false,
      });
      facade.setDiscount({ enabled: true, amount: 300000, reason: 'Beca 100%' });
      expect(facade.totalToPay()).toBe(0);
      expect(facade.canConfirmPayment()).toBe(true);

      const ok = await facade.recordPayment(10, 1);
      await flushMicrotasks();

      expect(ok).toBe(true);
      expect(mockSupabase.client.rpc).toHaveBeenCalledWith(
        'record_enrollment_payment',
        expect.objectContaining({
          p_total_amount: 0,
          p_payment_method: null,
          p_discount_amount: 300000,
        }),
      );
      expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
    });

    it('fix-057-i: con total > 0 sigue exigiendo medio de pago', () => {
      facade.computePricing({
        courseLabel: 'Clase B',
        basePrice: 300000,
        practicalClassesIncluded: 12,
        isDeposit: false,
      });
      expect(facade.canConfirmPayment()).toBe(false);
    });

    // ── spec 0025 (T2.1): notificación al alumno tras registrar el pago ──
    describe('notificación al alumno (spec 0025, AC1, AC7, AC-E1)', () => {
      beforeEach(() => {
        facade.computePricing({
          courseLabel: 'Clase B',
          basePrice: 300000,
          practicalClassesIncluded: 12,
          isDeposit: false,
        });
        facade.setPaymentMethod('efectivo');
      });

      it('notifica solo al alumno resolviendo enrollments → students.user_id', async () => {
        const builder = createMockQueryBuilder({ students: { user_id: 55 } }, null);
        mockSupabase.client.from = vi.fn().mockReturnValue(builder);

        const ok = await facade.recordPayment(10, 1);
        await flushMicrotasks();

        expect(ok).toBe(true);
        expect(notificationsSpy.notifyUsers).toHaveBeenCalledTimes(1);
        expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
          [55],
          expect.objectContaining({ referenceType: 'payment' }),
        );
      });

      // fix-050-i: el reemplazo del pago anterior (botón Atrás) lo hace la RPC. Con DELETE
      // sueltos la RLS dejaba a la secretaria con 0 filas borradas sin error y el pago se duplicaba.
      it('fix-050-i: guarda el pago con la RPC record_enrollment_payment, sin DELETE/INSERT sueltos', async () => {
        facade.setDocumentNumber('REC-9');
        const builder = createMockQueryBuilder({ students: { user_id: 55 } }, null);
        mockSupabase.client.from = vi.fn().mockReturnValue(builder);

        const ok = await facade.recordPayment(10, 1);
        await flushMicrotasks();

        expect(ok).toBe(true);
        expect(mockSupabase.client.rpc).toHaveBeenCalledWith('record_enrollment_payment', {
          p_enrollment_id: 10,
          p_payment_method: 'efectivo',
          p_total_amount: 300000,
          p_discount_id: null,
          p_discount_amount: 0,
          p_is_deposit: false,
          p_document_number: 'REC-9',
        });
        expect(builder.delete).not.toHaveBeenCalled();
        expect(builder.insert).not.toHaveBeenCalled();
        expect(builder.update).not.toHaveBeenCalled();
      });

      // fix-052-i: "Cobrar después" deja el pago 'pending'; el alumno no pagó nada.
      it('fix-052-i: con "Cobrar después" no avisa al alumno', async () => {
        facade.setPaymentMethod('pendiente');
        const builder = createMockQueryBuilder({ students: { user_id: 55 } }, null);
        mockSupabase.client.from = vi.fn().mockReturnValue(builder);

        const ok = await facade.recordPayment(10, 1);
        await flushMicrotasks();

        expect(ok).toBe(true);
        expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
      });

      it('fix-052-i: el aviso muestra el monto con separador de miles', async () => {
        const builder = createMockQueryBuilder({ students: { user_id: 55 } }, null);
        mockSupabase.client.from = vi.fn().mockReturnValue(builder);

        await facade.recordPayment(10, 1);
        await flushMicrotasks();

        expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
          [55],
          expect.objectContaining({ message: 'Se registró un pago de $300.000 en tu matrícula.' }),
        );
      });

      it('fix-050-i: si la RPC falla, devuelve false con el error y no notifica', async () => {
        mockSupabase.client.rpc = vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: 'ya no está en borrador' } });

        const ok = await facade.recordPayment(10, 1);
        await flushMicrotasks();

        expect(ok).toBe(false);
        expect(facade.error()).toContain('Error al registrar pago');
        expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
      });

      it('NO notifica al admin en ningún caso (sin ruido, AC7)', async () => {
        const builder = createMockQueryBuilder({ students: { user_id: 55 } }, null);
        mockSupabase.client.from = vi.fn().mockReturnValue(builder);

        await facade.recordPayment(10, 1);
        await flushMicrotasks();

        // Un solo destinatario: el alumno (id 55). Nunca se agrega al admin/secretaria.
        expect(notificationsSpy.notifyUsers).toHaveBeenCalledTimes(1);
        expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([55], expect.anything());
      });

      it('monto $0 no dispara notificación (AC-E1)', async () => {
        facade.setDiscount({ enabled: true, amount: 300000, reason: 'Beca 100%' });
        const builder = createMockQueryBuilder({ students: { user_id: 55 } }, null);
        mockSupabase.client.from = vi.fn().mockReturnValue(builder);

        const ok = await facade.recordPayment(10, 1);
        await flushMicrotasks();

        expect(ok).toBe(true);
        expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
      });

      it('un fallo en notifyUsers no revierte el pago', async () => {
        const builder = createMockQueryBuilder({ students: { user_id: 55 } }, null);
        mockSupabase.client.from = vi.fn().mockReturnValue(builder);
        notificationsSpy.notifyUsers.mockRejectedValue(new Error('network error'));

        const ok = await facade.recordPayment(10, 1);
        await flushMicrotasks();

        expect(ok).toBe(true);
      });
    });

    // ── fix-036-i: N° de documento/boleta en el pago de matrícula nueva ──
    describe('document_number (fix-036-i)', () => {
      beforeEach(() => {
        facade.computePricing({
          courseLabel: 'Clase B',
          basePrice: 300000,
          practicalClassesIncluded: 12,
          isDeposit: false,
        });
        facade.setPaymentMethod('efectivo');
      });

      it('manda el N° de documento a la RPC cuando se seteó', async () => {
        facade.setDocumentNumber('REC-01234');
        const builder = createMockQueryBuilder({ students: { user_id: 55 } }, null);
        mockSupabase.client.from = vi.fn().mockReturnValue(builder);

        await facade.recordPayment(10, 1);
        await flushMicrotasks();

        expect(mockSupabase.client.rpc).toHaveBeenCalledWith(
          'record_enrollment_payment',
          expect.objectContaining({ p_document_number: 'REC-01234' }),
        );
      });

      it('manda p_document_number null cuando no se seteó ninguno', async () => {
        const builder = createMockQueryBuilder({ students: { user_id: 55 } }, null);
        mockSupabase.client.from = vi.fn().mockReturnValue(builder);

        await facade.recordPayment(10, 1);
        await flushMicrotasks();

        expect(mockSupabase.client.rpc).toHaveBeenCalledWith(
          'record_enrollment_payment',
          expect.objectContaining({ p_document_number: null }),
        );
      });
    });
  });

  // ── Lecturas fallidas (spec 0060-b, T1.5) ──

  describe('lecturas fallidas (spec 0060-b T1.5)', () => {
    type Res = { data: unknown; error: unknown };
    const OK_ENROLLMENT: Res = {
      data: {
        base_price: 200_000,
        discount: 30_000,
        total_paid: 0,
        pending_balance: 170_000,
        payment_status: 'pending',
        payment_mode: 'total',
        courses: { name: 'Clase B', practical_hours: 9 },
      },
      error: null,
    };
    const ENROLLMENT_SIN_DESCUENTO: Res = {
      data: { ...(OK_ENROLLMENT.data as object), discount: 0, pending_balance: 200_000 },
      error: null,
    };
    const OK_PAYMENT: Res = {
      data: {
        cash_amount: 170_000,
        transfer_amount: 0,
        card_amount: 0,
        status: 'paid',
        document_number: 'REC-7',
      },
      error: null,
    };
    const OK_DISCOUNT: Res = {
      data: { discount_id: 4, discount_amount: 30_000, discounts: { name: 'Hermanos' } },
      error: null,
    };
    const FALLA: Res = { data: null, error: { message: 'red caída' } };
    const SIN_FILA: Res = { data: null, error: null };

    /** Responde por tabla; un valor puede ser una promesa para controlar el orden de llegada. */
    function responderPorTabla(tablas: Record<string, Res | Promise<Res>>) {
      mockSupabase.client.from = vi.fn().mockImplementation((tabla: string) => {
        const builder = createMockQueryBuilder();
        const respuesta = () => Promise.resolve(tablas[tabla]);
        builder.single = vi.fn().mockImplementation(respuesta);
        builder.maybeSingle = vi.fn().mockImplementation(respuesta);
        builder.order = vi.fn().mockImplementation(respuesta);
        return builder;
      });
    }

    const lecturasOk = () => ({
      enrollments: OK_ENROLLMENT,
      payments: OK_PAYMENT,
      discount_applications: OK_DISCOUNT,
    });

    function diferido<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((r) => (resolve = r));
      return { promise, resolve };
    }

    const fila = (id: number, name: string, courseId: number | null = null) => ({
      id,
      name,
      discount_type: 'fixed_amount',
      value: 10_000,
      applicable_to: 'all',
      branch_id: null,
      course_id: courseId,
    });

    const conPrecio = () =>
      facade.computePricing({
        courseLabel: 'Clase B',
        basePrice: 200_000,
        practicalClassesIncluded: 12,
        isDeposit: false,
      });

    describe('rehydrateFromEnrollment', () => {
      it.each(['enrollments', 'payments', 'discount_applications'])(
        'si falla %s no aplica nada y no se puede confirmar',
        async (tabla) => {
          responderPorTabla({ ...lecturasOk(), [tabla]: FALLA });

          await facade.rehydrateFromEnrollment(77);

          expect(facade.rehydrationError()).toContain('No se pudieron cargar');
          expect(facade.isPaymentDataBlocked()).toBe(true);
          expect(facade.pricing()).toBeNull();
          expect(facade.paymentMethod()).toBeNull();
          expect(facade.documentNumber()).toBeNull();
          expect(facade.discount().enabled).toBe(false);
          expect(facade.selectedDiscountId()).toBeNull();

          // Aunque alguien fije precio y medio de pago, el pago sigue bloqueado.
          conPrecio();
          facade.setPaymentMethod('efectivo');
          expect(facade.canConfirmPayment()).toBe(false);
          expect(await facade.recordPayment(77, 1)).toBe(false);
          expect(mockSupabase.client.rpc).not.toHaveBeenCalled();
        },
      );

      it('una falla retira lo que hubiera de otro borrador', async () => {
        conPrecio();
        facade.setPaymentMethod('tarjeta');
        facade.setDocumentNumber('VIEJO');
        facade.setDiscount({ enabled: true, amount: 5_000, reason: 'Viejo' });
        responderPorTabla({ ...lecturasOk(), payments: FALLA });

        await facade.rehydrateFromEnrollment(77);

        expect(facade.pricing()).toBeNull();
        expect(facade.paymentMethod()).toBeNull();
        expect(facade.documentNumber()).toBeNull();
        expect(facade.discount().enabled).toBe(false);
      });

      it('con las 3 lecturas bien aplica precio, pago y descuento y no bloquea', async () => {
        responderPorTabla(lecturasOk());

        await facade.rehydrateFromEnrollment(77);

        expect(facade.rehydrationError()).toBeNull();
        expect(facade.isPaymentDataBlocked()).toBe(false);
        expect(facade.pricing()?.basePrice).toBe(200_000);
        expect(facade.paymentMethod()).toBe('efectivo');
        expect(facade.documentNumber()).toBe('REC-7');
        expect(facade.selectedDiscountId()).toBe(4);
        expect(facade.totalToPay()).toBe(170_000);
        expect(facade.canConfirmPayment()).toBe(true);
      });

      it('el reintento que sale bien desbloquea y conserva el descuento en la RPC', async () => {
        responderPorTabla({ ...lecturasOk(), discount_applications: FALLA });
        await facade.rehydrateFromEnrollment(77);
        expect(facade.canConfirmPayment()).toBe(false);

        responderPorTabla(lecturasOk());
        await facade.reintentarDatosPago();

        expect(facade.rehydrationError()).toBeNull();
        expect(facade.canConfirmPayment()).toBe(true);
        expect(await facade.recordPayment(77, 1)).toBe(true);
        expect(mockSupabase.client.rpc).toHaveBeenCalledWith(
          'record_enrollment_payment',
          expect.objectContaining({
            p_enrollment_id: 77,
            p_total_amount: 170_000,
            p_discount_id: 4,
            p_discount_amount: 30_000,
          }),
        );
      });

      it('si el reintento vuelve a fallar, sigue bloqueado', async () => {
        responderPorTabla({ ...lecturasOk(), enrollments: FALLA });
        await facade.rehydrateFromEnrollment(77);

        await facade.reintentarDatosPago();

        expect(facade.rehydrationError()).not.toBeNull();
        expect(facade.canConfirmPayment()).toBe(false);
      });

      it('reintentar sin una rehidratación previa no consulta nada', async () => {
        await facade.reintentarDatosPago();
        expect(mockSupabase.client.from).not.toHaveBeenCalled();
      });

      it('sin pago ni descuento es un estado válido: no bloquea', async () => {
        responderPorTabla({
          enrollments: ENROLLMENT_SIN_DESCUENTO,
          payments: SIN_FILA,
          discount_applications: SIN_FILA,
        });

        await facade.rehydrateFromEnrollment(77);

        expect(facade.rehydrationError()).toBeNull();
        expect(facade.isPaymentDataBlocked()).toBe(false);
        expect(facade.paymentMethod()).toBeNull();
        expect(facade.discount().enabled).toBe(false);
        expect(facade.totalToPay()).toBe(200_000);
        facade.setPaymentMethod('efectivo');
        expect(facade.canConfirmPayment()).toBe(true);
      });

      it('sin pago ni descuento no deja los del borrador anterior', async () => {
        responderPorTabla(lecturasOk());
        await facade.rehydrateFromEnrollment(77);

        responderPorTabla({
          enrollments: ENROLLMENT_SIN_DESCUENTO,
          payments: SIN_FILA,
          discount_applications: SIN_FILA,
        });
        await facade.rehydrateFromEnrollment(78);

        expect(facade.paymentMethod()).toBeNull();
        expect(facade.documentNumber()).toBeNull();
        expect(facade.selectedDiscountId()).toBeNull();
        expect(facade.discount().enabled).toBe(false);
      });

      it('mientras carga no se puede confirmar', async () => {
        const pendiente = diferido<Res>();
        responderPorTabla({ ...lecturasOk(), payments: pendiente.promise });

        const carga = facade.rehydrateFromEnrollment(77);
        expect(facade.isRehydrating()).toBe(true);
        conPrecio();
        facade.setPaymentMethod('efectivo');
        expect(facade.canConfirmPayment()).toBe(false);

        pendiente.resolve(OK_PAYMENT);
        await carga;
        expect(facade.isRehydrating()).toBe(false);
        expect(facade.canConfirmPayment()).toBe(true);
      });

      it('descarta la respuesta de una rehidratación reemplazada', async () => {
        const vieja = diferido<Res>();
        responderPorTabla({ ...lecturasOk(), payments: vieja.promise });
        const primera = facade.rehydrateFromEnrollment(77);

        responderPorTabla({ ...lecturasOk(), payments: SIN_FILA });
        await facade.rehydrateFromEnrollment(78);

        vieja.resolve(OK_PAYMENT);
        await primera;
        expect(facade.paymentMethod()).toBeNull();
        expect(facade.isRehydrating()).toBe(false);
      });

      it('una respuesta vieja no levanta el bloqueo de la rehidratación en curso', async () => {
        const vieja = diferido<Res>();
        const vigente = diferido<Res>();
        responderPorTabla({ ...lecturasOk(), payments: vieja.promise });
        const primera = facade.rehydrateFromEnrollment(77);
        responderPorTabla({ ...lecturasOk(), payments: vigente.promise });
        const segunda = facade.rehydrateFromEnrollment(78);

        vieja.resolve(OK_PAYMENT);
        await primera;
        expect(facade.isRehydrating()).toBe(true);
        expect(facade.isPaymentDataBlocked()).toBe(true);

        vigente.resolve(SIN_FILA);
        await segunda;
        expect(facade.isRehydrating()).toBe(false);
      });

      it('la falla de una rehidratación reemplazada no bloquea la vigente', async () => {
        const vieja = diferido<Res>();
        responderPorTabla({ ...lecturasOk(), payments: vieja.promise });
        const primera = facade.rehydrateFromEnrollment(77);

        responderPorTabla(lecturasOk());
        await facade.rehydrateFromEnrollment(78);

        vieja.resolve(FALLA);
        await primera;
        expect(facade.rehydrationError()).toBeNull();
        expect(facade.isPaymentDataBlocked()).toBe(false);
      });

      it('reset() invalida una rehidratación en curso y quita el bloqueo', async () => {
        const pendiente = diferido<Res>();
        responderPorTabla({ ...lecturasOk(), payments: pendiente.promise });
        const carga = facade.rehydrateFromEnrollment(77);

        facade.reset();
        pendiente.resolve(OK_PAYMENT);
        await carga;

        expect(facade.pricing()).toBeNull();
        expect(facade.paymentMethod()).toBeNull();
        expect(facade.isRehydrating()).toBe(false);
        expect(facade.isPaymentDataBlocked()).toBe(false);
      });

      it('reset() limpia el error y olvida la matrícula a reintentar', async () => {
        responderPorTabla({ ...lecturasOk(), payments: FALLA });
        await facade.rehydrateFromEnrollment(77);

        facade.reset();
        expect(facade.rehydrationError()).toBeNull();

        const llamadas = mockSupabase.client.from.mock.calls.length;
        await facade.reintentarDatosPago();
        expect(mockSupabase.client.from.mock.calls.length).toBe(llamadas);
      });
    });

    describe('loadAvailableDiscounts', () => {
      it('una falla retira la lista anterior y deja su propio error', async () => {
        responderPorTabla({ discounts: { data: [fila(1, 'Curso A')], error: null } });
        await facade.loadAvailableDiscounts('class_b', 1, 1);
        expect(facade.availableDiscounts()).toHaveLength(1);

        responderPorTabla({ discounts: FALLA });
        await facade.loadAvailableDiscounts('class_b', 2, 2);

        expect(facade.availableDiscounts()).toEqual([]);
        expect(facade.discountsError()).toContain('No se pudieron cargar los descuentos');
        expect(facade.error()).toBeNull();
        expect(facade.isLoadingDiscounts()).toBe(false);
      });

      it('"no hay descuentos" no es un error', async () => {
        responderPorTabla({ discounts: { data: [], error: null } });
        await facade.loadAvailableDiscounts('class_b', 1, 1);
        expect(facade.availableDiscounts()).toEqual([]);
        expect(facade.discountsError()).toBeNull();
      });

      it('no muestra la lista de otro curso mientras carga la nueva', async () => {
        responderPorTabla({ discounts: { data: [fila(1, 'Curso A')], error: null } });
        await facade.loadAvailableDiscounts('class_b', 1, 1);

        const pendiente = diferido<Res>();
        responderPorTabla({ discounts: pendiente.promise });
        const carga = facade.loadAvailableDiscounts('class_b', 2, 1);

        expect(facade.availableDiscounts()).toEqual([]);
        expect(facade.isLoadingDiscounts()).toBe(true);
        pendiente.resolve({ data: [], error: null });
        await carga;
      });

      it('sin descuento aplicado, la falla no bloquea el pago', async () => {
        conPrecio();
        facade.setPaymentMethod('efectivo');
        responderPorTabla({ discounts: FALLA });

        await facade.loadAvailableDiscounts('class_b', 1, 1);

        expect(facade.canConfirmPayment()).toBe(true);
      });

      it('con un descuento manual, la falla no bloquea: no depende de la lista', async () => {
        conPrecio();
        facade.setPaymentMethod('efectivo');
        facade.setDiscount({ enabled: true, amount: 5_000, reason: 'Manual' });
        responderPorTabla({ discounts: FALLA });

        await facade.loadAvailableDiscounts('class_b', 1, 1);

        expect(facade.canConfirmPayment()).toBe(true);
      });

      it('con un descuento predefinido aplicado bloquea hasta reintentar o quitarlo', async () => {
        conPrecio();
        facade.setPaymentMethod('efectivo');
        responderPorTabla({ discounts: { data: [fila(1, 'Curso A')], error: null } });
        await facade.loadAvailableDiscounts('class_b', 1, 1);
        facade.applyPredefinedDiscount(1);

        responderPorTabla({ discounts: FALLA });
        await facade.loadAvailableDiscounts('class_b', 2, 1);
        expect(facade.canConfirmPayment()).toBe(false);
        expect(await facade.recordPayment(77, 1)).toBe(false);
        expect(mockSupabase.client.rpc).not.toHaveBeenCalled();

        facade.clearDiscount();
        expect(facade.canConfirmPayment()).toBe(true);
      });

      it('el reintento repite la última consulta y limpia el error', async () => {
        responderPorTabla({ discounts: FALLA });
        await facade.loadAvailableDiscounts('class_b', 9, 1);
        expect(facade.discountsError()).not.toBeNull();

        responderPorTabla({
          discounts: { data: [fila(1, 'Del curso', 9), fila(2, 'De otro', 8)], error: null },
        });
        await facade.reintentarDescuentos();

        expect(facade.discountsError()).toBeNull();
        expect(facade.availableDiscounts().map((d) => d.id)).toEqual([1]);
      });

      it('reintentar sin una carga previa no consulta nada', async () => {
        await facade.reintentarDescuentos();
        expect(mockSupabase.client.from).not.toHaveBeenCalled();
      });

      it('descarta la respuesta vieja si cambió el curso o la sede', async () => {
        const vieja = diferido<Res>();
        responderPorTabla({ discounts: vieja.promise });
        const primera = facade.loadAvailableDiscounts('class_b', 1, 1);

        responderPorTabla({ discounts: { data: [fila(2, 'Vigente')], error: null } });
        await facade.loadAvailableDiscounts('class_b', 2, 1);

        vieja.resolve({ data: [fila(1, 'Vieja')], error: null });
        await primera;
        expect(facade.availableDiscounts().map((d) => d.id)).toEqual([2]);
        expect(facade.isLoadingDiscounts()).toBe(false);
      });

      it('una respuesta vieja no apaga el indicador de la carga en curso', async () => {
        const vieja = diferido<Res>();
        const vigente = diferido<Res>();
        responderPorTabla({ discounts: vieja.promise });
        const primera = facade.loadAvailableDiscounts('class_b', 1, 1);
        responderPorTabla({ discounts: vigente.promise });
        const segunda = facade.loadAvailableDiscounts('class_b', 2, 1);

        vieja.resolve({ data: [], error: null });
        await primera;
        expect(facade.isLoadingDiscounts()).toBe(true);

        vigente.resolve({ data: [], error: null });
        await segunda;
        expect(facade.isLoadingDiscounts()).toBe(false);
      });

      it('descarta la falla vieja: no borra la lista vigente', async () => {
        const vieja = diferido<Res>();
        responderPorTabla({ discounts: vieja.promise });
        const primera = facade.loadAvailableDiscounts('class_b', 1, 1);

        responderPorTabla({ discounts: { data: [fila(2, 'Vigente')], error: null } });
        await facade.loadAvailableDiscounts('class_b', 2, 1);

        vieja.resolve(FALLA);
        await primera;
        expect(facade.discountsError()).toBeNull();
        expect(facade.availableDiscounts()).toHaveLength(1);
      });

      it('reset() descarta una carga en curso', async () => {
        const pendiente = diferido<Res>();
        responderPorTabla({ discounts: pendiente.promise });
        const carga = facade.loadAvailableDiscounts('class_b', 1, 1);

        facade.reset();
        pendiente.resolve({ data: [fila(1, 'Tardía')], error: null });
        await carga;

        expect(facade.availableDiscounts()).toEqual([]);
        expect(facade.isLoadingDiscounts()).toBe(false);
      });
    });

    describe('errores separados', () => {
      async function conErrorDeGuardado() {
        conPrecio();
        facade.setPaymentMethod('efectivo');
        mockSupabase.client.rpc = vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: 'caja cerrada' } });
        await facade.recordPayment(77, 1);
        expect(facade.error()).toContain('Error al registrar pago');
      }

      it('cargar descuentos no borra el error del guardado', async () => {
        await conErrorDeGuardado();
        responderPorTabla({ discounts: { data: [], error: null } });

        await facade.loadAvailableDiscounts('class_b', 1, 1);

        expect(facade.error()).toContain('Error al registrar pago');
      });

      it('reintentar la misma matrícula no borra el error del guardado', async () => {
        responderPorTabla(lecturasOk());
        await facade.rehydrateFromEnrollment(77);
        await conErrorDeGuardado();

        await facade.reintentarDatosPago();

        expect(facade.error()).toContain('Error al registrar pago');
      });

      it('abrir otra matrícula sí limpia el error del guardado anterior', async () => {
        responderPorTabla(lecturasOk());
        await facade.rehydrateFromEnrollment(77);
        await conErrorDeGuardado();

        await facade.rehydrateFromEnrollment(78);

        expect(facade.error()).toBeNull();
      });

      it('un guardado no borra el error de los descuentos', async () => {
        conPrecio();
        facade.setPaymentMethod('efectivo');
        responderPorTabla({ discounts: FALLA });
        await facade.loadAvailableDiscounts('class_b', 1, 1);

        expect(await facade.recordPayment(77, 1)).toBe(true);

        expect(facade.discountsError()).not.toBeNull();
      });
    });

    describe('alumno a notificar', () => {
      beforeEach(() => {
        conPrecio();
        facade.setPaymentMethod('efectivo');
      });

      it('si la lectura falla, el pago ya guardado sigue bien y no se notifica', async () => {
        responderPorTabla({ enrollments: FALLA });

        const ok = await facade.recordPayment(10, 1);
        await flushMicrotasks();

        expect(ok).toBe(true);
        expect(facade.error()).toBeNull();
        expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
      });

      it('si la lectura se rechaza, el pago tampoco se ve afectado', async () => {
        mockSupabase.client.from = vi.fn().mockImplementation(() => {
          const builder = createMockQueryBuilder();
          builder.single = vi.fn().mockRejectedValue(new Error('sin red'));
          return builder;
        });

        const ok = await facade.recordPayment(10, 1);
        await flushMicrotasks();

        expect(ok).toBe(true);
        expect(facade.error()).toBeNull();
        expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
      });
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
