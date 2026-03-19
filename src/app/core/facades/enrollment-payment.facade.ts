import { computed, inject, Injectable, signal } from '@angular/core';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';

import type { Discount } from '@core/models/dto/discount.model';
import type {
  PaymentMethod,
  PricingBreakdown,
  DiscountData,
} from '@core/models/ui/enrollment-payment.model';

// ─── Tipos internos ───

interface PricingInput {
  courseLabel: string;
  basePrice: number;
  practicalClassesIncluded: number;
  isDeposit: boolean;
}

interface AvailableDiscount {
  id: number;
  name: string;
  discountType: 'percentage' | 'fixed_amount';
  value: number;
  applicableTo: string;
}

/**
 * EnrollmentPaymentFacade — Maneja Step 4 del wizard de matrícula.
 *
 * Responsabilidades:
 * - Calcular pricing breakdown (base price, deposit mode, amount due)
 * - Cargar y aplicar descuentos (porcentaje o monto fijo)
 * - Registrar pago en tabla `payments`
 * - Registrar descuento aplicado en `discount_applications`
 * - Actualizar enrollment (payment_status, total_paid, discount, pending_balance)
 */
@Injectable({ providedIn: 'root' })
export class EnrollmentPaymentFacade {
  private readonly supabase = inject(SupabaseService);

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. ESTADO REACTIVO (Privado)
  // ══════════════════════════════════════════════════════════════════════════════

  private readonly _pricing = signal<PricingBreakdown | null>(null);
  private readonly _paymentMethod = signal<PaymentMethod | null>(null);
  private readonly _discount = signal<DiscountData>({
    enabled: false,
    amount: null,
    reason: '',
  });
  private readonly _selectedDiscountId = signal<number | null>(null);
  private readonly _availableDiscounts = signal<AvailableDiscount[]>([]);

  // ── UI state ──
  private readonly _isProcessing = signal(false);
  private readonly _error = signal<string | null>(null);

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. ESTADO EXPUESTO (Público, solo lectura)
  // ══════════════════════════════════════════════════════════════════════════════

  readonly pricing = this._pricing.asReadonly();
  readonly paymentMethod = this._paymentMethod.asReadonly();
  readonly discount = this._discount.asReadonly();
  readonly selectedDiscountId = this._selectedDiscountId.asReadonly();
  readonly availableDiscounts = this._availableDiscounts.asReadonly();
  readonly isProcessing = this._isProcessing.asReadonly();
  readonly error = this._error.asReadonly();

  // ── Computed: total to pay after discount ──
  readonly totalToPay = computed<number>(() => {
    const p = this._pricing();
    if (!p) return 0;
    const disc = this._discount();
    const discountAmount = disc.enabled && disc.amount ? disc.amount : 0;
    return Math.max(0, p.amountDue - discountAmount);
  });

  // ── Computed: can confirm payment ──
  readonly canConfirmPayment = computed<boolean>(() => {
    return this._pricing() !== null && this._paymentMethod() !== null;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Pricing
  // ══════════════════════════════════════════════════════════════════════════════

  /** Calcula el desglose de precios para el enrollment. */
  computePricing(input: PricingInput): void {
    const amountDue = input.isDeposit ? Math.round(input.basePrice / 2) : input.basePrice;

    this._pricing.set({
      courseLabel: input.courseLabel,
      basePrice: input.basePrice,
      practicalClassesIncluded: input.practicalClassesIncluded,
      isDeposit: input.isDeposit,
      amountDue,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Payment Method
  // ══════════════════════════════════════════════════════════════════════════════

  setPaymentMethod(method: PaymentMethod): void {
    this._paymentMethod.set(method);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Discounts
  // ══════════════════════════════════════════════════════════════════════════════

  setDiscount(data: DiscountData): void {
    this._discount.set(data);
  }

  /** Selecciona un descuento predefinido y calcula su monto. */
  applyPredefinedDiscount(discountId: number): void {
    const disc = this._availableDiscounts().find((d) => d.id === discountId);
    if (!disc) return;

    const pricing = this._pricing();
    if (!pricing) return;

    let amount: number;
    if (disc.discountType === 'percentage') {
      amount = Math.round((pricing.amountDue * disc.value) / 100);
    } else {
      amount = disc.value;
    }

    this._selectedDiscountId.set(discountId);
    this._discount.set({
      enabled: true,
      amount,
      reason: disc.name,
    });
  }

  /** Limpia el descuento seleccionado. */
  clearDiscount(): void {
    this._selectedDiscountId.set(null);
    this._discount.set({ enabled: false, amount: null, reason: '' });
  }

  /** Carga descuentos activos vigentes, filtrando por tipo de curso. */
  async loadAvailableDiscounts(courseType: string): Promise<void> {
    this._error.set(null);

    const today = new Date().toISOString().split('T')[0];
    const applicableFilter = courseType.startsWith('professional') ? 'professional' : 'class_b';

    const { data, error } = await this.supabase.client
      .from('discounts')
      .select('id, name, discount_type, value, applicable_to')
      .eq('status', 'active')
      .gte('valid_from', '0001-01-01')
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .or(`applicable_to.eq.all,applicable_to.eq.${applicableFilter}`)
      .order('name');

    if (error) {
      this._error.set('Error al cargar descuentos: ' + error.message);
      return;
    }

    const discounts: AvailableDiscount[] = (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      discountType: row.discount_type as 'percentage' | 'fixed_amount',
      value: row.value,
      applicableTo: row.applicable_to ?? 'all',
    }));

    this._availableDiscounts.set(discounts);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Record Payment
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Registra el pago en la tabla `payments`, aplica descuento si corresponde,
   * y actualiza el enrollment con los totales.
   */
  async recordPayment(enrollmentId: number | null, registeredBy: number | null): Promise<boolean> {
    if (!enrollmentId) return false;

    const pricing = this._pricing();
    const method = this._paymentMethod();
    if (!pricing || !method) return false;

    this._isProcessing.set(true);
    this._error.set(null);

    try {
      const total = this.totalToPay();
      const isPending = method === 'pendiente';
      const paymentStatus = isPending ? 'pending' : 'paid';

      // 0. Delete previous enrollment payment records (idempotencia: back-button safe)
      await this.supabase.client
        .from('discount_applications')
        .delete()
        .eq('enrollment_id', enrollmentId);

      await this.supabase.client
        .from('payments')
        .delete()
        .eq('enrollment_id', enrollmentId)
        .eq('type', 'enrollment');

      // 1. Insert payment record
      const paymentRecord = {
        enrollment_id: enrollmentId,
        type: 'enrollment',
        total_amount: total,
        cash_amount: method === 'efectivo' ? total : 0,
        transfer_amount: method === 'transferencia' ? total : 0,
        card_amount: method === 'tarjeta' ? total : 0,
        voucher_amount: 0,
        status: paymentStatus,
        payment_date: isPending ? null : new Date().toISOString().split('T')[0],
        requires_receipt: true,
        registered_by: registeredBy,
      };

      const { error: paymentError } = await this.supabase.client
        .from('payments')
        .insert(paymentRecord);

      if (paymentError) {
        this._error.set('Error al registrar pago: ' + paymentError.message);
        return false;
      }

      // 2. Apply discount if selected
      const discountId = this._selectedDiscountId();
      const disc = this._discount();
      if (discountId && disc.enabled && disc.amount) {
        const { error: discountError } = await this.supabase.client
          .from('discount_applications')
          .insert({
            discount_id: discountId,
            enrollment_id: enrollmentId,
            discount_amount: disc.amount,
            applied_by: registeredBy,
          });

        if (discountError) {
          this._error.set('Error al aplicar descuento: ' + discountError.message);
          return false;
        }
      }

      // 3. Update enrollment totals
      const discountAmount = disc.enabled && disc.amount ? disc.amount : 0;
      const totalPaid = isPending ? 0 : total;
      const pendingBalance = isPending
        ? pricing.basePrice - discountAmount
        : pricing.basePrice - discountAmount - totalPaid;
      const enrollmentPaymentStatus = isPending
        ? 'pending'
        : pricing.isDeposit
          ? 'partial'
          : 'paid_full';

      const { error: updateError } = await this.supabase.client
        .from('enrollments')
        .update({
          discount: discountAmount,
          total_paid: totalPaid,
          pending_balance: pendingBalance,
          payment_status: enrollmentPaymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId);

      if (updateError) {
        this._error.set('Error al actualizar matrícula: ' + updateError.message);
        return false;
      }

      return true;
    } catch {
      this._error.set('Error inesperado al registrar pago');
      return false;
    } finally {
      this._isProcessing.set(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3b. REHYDRATION — Reconstruir estado desde BD (draft recovery)
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Rehidrata el estado de pago desde un enrollment existente en la BD.
   * Carga el payment record y discount_applications para reconstruir los signals.
   */
  async rehydrateFromEnrollment(enrollmentId: number): Promise<void> {
    this._error.set(null);

    // Cargar enrollment para pricing data
    const { data: enrollment } = await this.supabase.client
      .from('enrollments')
      .select(
        'base_price, discount, total_paid, pending_balance, payment_status, payment_mode, courses!inner(name, practical_hours)',
      )
      .eq('id', enrollmentId)
      .single();

    if (!enrollment) return;

    const course = (enrollment as any).courses;
    // payment_mode es la fuente canónica (persiste desde paso 2 antes de registrar pago).
    // payment_status === 'partial' es el fallback para drafts previos a esta migración.
    const isDeposit =
      (enrollment as any).payment_mode === 'partial' || enrollment.payment_status === 'partial';
    const basePrice = enrollment.base_price ?? 0;
    const amountDue = isDeposit ? Math.round(basePrice / 2) : basePrice;
    const practicalClasses = course?.practical_hours
      ? Math.round((course.practical_hours * 60) / 45)
      : 0;

    this._pricing.set({
      courseLabel: course?.name ?? '',
      basePrice,
      practicalClassesIncluded: practicalClasses,
      isDeposit,
      amountDue,
    });

    // Cargar payment record
    const { data: payment } = await this.supabase.client
      .from('payments')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .eq('type', 'enrollment')
      .maybeSingle();

    if (payment) {
      // Determinar método de pago desde los montos
      let method: PaymentMethod = 'pendiente';
      if (payment.cash_amount > 0) method = 'efectivo';
      else if (payment.transfer_amount > 0) method = 'transferencia';
      else if (payment.card_amount > 0) method = 'tarjeta';
      else if (payment.status === 'pending') method = 'pendiente';
      this._paymentMethod.set(method);
    }

    // Cargar discount application
    const { data: discApp } = await this.supabase.client
      .from('discount_applications')
      .select('discount_id, discount_amount, discounts!inner(name)')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle();

    if (discApp) {
      this._selectedDiscountId.set(discApp.discount_id);
      this._discount.set({
        enabled: true,
        amount: discApp.discount_amount,
        reason: (discApp as any).discounts?.name ?? '',
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 4. RESET & ERROR
  // ══════════════════════════════════════════════════════════════════════════════

  reset(): void {
    this._pricing.set(null);
    this._paymentMethod.set(null);
    this._discount.set({ enabled: false, amount: null, reason: '' });
    this._selectedDiscountId.set(null);
    this._availableDiscounts.set([]);
    this._isProcessing.set(false);
    this._error.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }
}
