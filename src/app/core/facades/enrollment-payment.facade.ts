import { computed, inject, Injectable, signal } from '@angular/core';
import { formatCLP, todayIso } from '@core/utils/date.utils';
import { assertReadOk } from '@core/utils/db-error.utils';
import { createRequestGuard } from '@core/utils/request-guard.utils';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { ToastService } from '@core/services/ui/toast.service';

import type { Discount } from '@core/models/dto/discount.model';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
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

interface DiscountsQuery {
  courseType: string;
  courseId: number;
  branchId: number;
}

const INITIAL_DISCOUNT: DiscountData = { enabled: false, amount: null, reason: '' };
const MANUAL_DISCOUNT_REASON = 'Descuento Manual';

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
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly notifications = inject(NotificationsFacade);
  private readonly toast = inject(ToastService);

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. ESTADO REACTIVO (Privado)
  // ══════════════════════════════════════════════════════════════════════════════

  private readonly _pricing = signal<PricingBreakdown | null>(null);
  private readonly _paymentMethod = signal<PaymentMethod | null>(null);
  private readonly _discount = signal<DiscountData>(INITIAL_DISCOUNT);
  private readonly _selectedDiscountId = signal<number | null>(null);
  private readonly _availableDiscounts = signal<AvailableDiscount[]>([]);
  /** N° de documento de respaldo del pago (boleta, comprobante, etc.) — opcional (fix-036-i) */
  private readonly _documentNumber = signal<string | null>(null);

  // ── UI state ──
  private readonly _isProcessing = signal(false);
  /** Solo el guardado del pago. Cada lectura tiene su error: uno no borra al otro. */
  private readonly _error = signal<string | null>(null);

  // ── Rehidratación de un borrador ──
  private readonly _isRehydrating = signal(false);
  private readonly _rehydrationError = signal<string | null>(null);
  private readonly rehydrationGuard = createRequestGuard();
  private rehydrationEnrollmentId: number | null = null;

  // ── Descuentos disponibles ──
  private readonly _isLoadingDiscounts = signal(false);
  private readonly _discountsError = signal<string | null>(null);
  private readonly discountsGuard = createRequestGuard();
  private discountsQuery: DiscountsQuery | null = null;

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. ESTADO EXPUESTO (Público, solo lectura)
  // ══════════════════════════════════════════════════════════════════════════════

  readonly pricing = this._pricing.asReadonly();
  readonly paymentMethod = this._paymentMethod.asReadonly();
  readonly discount = this._discount.asReadonly();
  readonly selectedDiscountId = this._selectedDiscountId.asReadonly();
  readonly availableDiscounts = this._availableDiscounts.asReadonly();
  readonly documentNumber = this._documentNumber.asReadonly();
  readonly isProcessing = this._isProcessing.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isRehydrating = this._isRehydrating.asReadonly();
  readonly rehydrationError = this._rehydrationError.asReadonly();
  readonly isLoadingDiscounts = this._isLoadingDiscounts.asReadonly();
  readonly discountsError = this._discountsError.asReadonly();

  /** True mientras no se sabe qué pago y descuento tiene guardados el borrador. */
  readonly isPaymentDataBlocked = computed<boolean>(
    () => this._isRehydrating() || this._rehydrationError() !== null,
  );

  // ── Computed: total to pay after discount ──
  readonly totalToPay = computed<number>(() => {
    const p = this._pricing();
    if (!p) return 0;
    const disc = this._discount();
    const discountAmount = disc.enabled && disc.amount ? disc.amount : 0;
    return Math.max(0, p.amountDue - discountAmount);
  });

  // ── Computed: can confirm payment ──
  // fix-057-i: con total $0 (beca que cubre todo) no hay nada que cobrar: no se pide medio de pago.
  // spec 0060-b: la RPC reemplaza el pago y el descuento guardados, así que confirmar sin haberlos
  // leído podría borrarlos. Si la lista de descuentos no cargó, se puede seguir sin descuento o con
  // uno manual; uno predefinido ya aplicado no se puede contrastar con la lista de este curso y
  // sede, y queda detenido hasta reintentar o quitarlo.
  readonly canConfirmPayment = computed<boolean>(() => {
    if (this.isPaymentDataBlocked()) return false;
    if (this._discountsError() !== null && this._selectedDiscountId() !== null) return false;
    if (this._pricing() === null) return false;
    return this.totalToPay() === 0 || this._paymentMethod() !== null;
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

  /** N° de documento de respaldo del pago (boleta, comprobante, etc.) — opcional (fix-036-i) */
  setDocumentNumber(value: string | null): void {
    this._documentNumber.set(value);
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
    this._discount.set(INITIAL_DISCOUNT);
  }

  /**
   * Carga descuentos activos vigentes para la sede y el curso actuales.
   * `courseId`/`branchId` acotan descuentos "curso específico" (incl. CONV) o "sede
   * específica"; `null` en la fila de BD = sin esa restricción (aplica igual).
   *
   * La lista anterior se retira al empezar: puede ser de otro curso o sede, y no debe poder
   * elegirse mientras carga ni quedar visible si esta lectura falla.
   */
  async loadAvailableDiscounts(
    courseType: string,
    courseId: number,
    branchId: number,
  ): Promise<void> {
    const requestToken = this.discountsGuard.next();
    this.discountsQuery = { courseType, courseId, branchId };
    this._availableDiscounts.set([]);
    this._discountsError.set(null);
    this._isLoadingDiscounts.set(true);

    const today = todayIso();
    const applicableFilter = courseType.startsWith('professional') ? 'professional' : 'class_b';

    try {
      const rows = assertReadOk(
        await this.supabase.client
          .from('discounts')
          .select('id, name, discount_type, value, applicable_to, branch_id, course_id')
          .eq('status', 'active')
          .gte('valid_from', '0001-01-01')
          .or(`valid_until.is.null,valid_until.gte.${today}`)
          .or(`branch_id.is.null,branch_id.eq.${branchId}`)
          .order('name'),
      );

      if (!this.discountsGuard.isCurrent(requestToken)) return;

      const discounts: AvailableDiscount[] = (rows ?? [])
        .filter((row: any) =>
          row.course_id
            ? row.course_id === courseId
            : row.applicable_to === 'all' || row.applicable_to === applicableFilter,
        )
        .map((row: any) => ({
          id: row.id,
          name: row.name,
          discountType: row.discount_type as 'percentage' | 'fixed_amount',
          value: row.value,
          applicableTo: row.applicable_to ?? 'all',
        }));

      this._availableDiscounts.set(discounts);
    } catch {
      if (!this.discountsGuard.isCurrent(requestToken)) return;
      this._discountsError.set('No se pudieron cargar los descuentos.');
    } finally {
      if (this.discountsGuard.isCurrent(requestToken)) this._isLoadingDiscounts.set(false);
    }
  }

  /** Repite la última carga de descuentos (mismo curso y sede). */
  async reintentarDescuentos(): Promise<void> {
    const query = this.discountsQuery;
    if (!query) return;
    await this.loadAvailableDiscounts(query.courseType, query.courseId, query.branchId);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Record Payment
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Registra el pago del paso Pago del wizard (y el descuento si corresponde) y actualiza los
   * totales de la matrícula en borrador.
   *
   * fix-050-i: todo lo hace la RPC `record_enrollment_payment` en una transacción. Antes eran
   * DELETE + INSERT + UPDATE sueltos: la RLS no deja borrar pagos a la secretaria y PostgREST
   * responde a ese DELETE sin error y con 0 filas, así que volver al paso Pago duplicaba el pago.
   * La RPC también pone la fecha (hoy en Chile) y `registered_by` (usuario de la sesión), por eso
   * `_registeredBy` ya no se usa.
   */
  async recordPayment(enrollmentId: number | null, _registeredBy: number | null): Promise<boolean> {
    if (!enrollmentId) return false;

    const pricing = this._pricing();
    const method = this._paymentMethod();
    if (!pricing || !this.canConfirmPayment()) return false;

    this._isProcessing.set(true);
    this._error.set(null);

    try {
      const total = this.totalToPay();
      const disc = this._discount();
      const discountAmount = disc.enabled && disc.amount ? disc.amount : 0;

      // fix-057-i: con total $0 la RPC no registra pago (la beca queda como descuento aplicado).
      const { error } = await this.supabase.client.rpc('record_enrollment_payment', {
        p_enrollment_id: enrollmentId,
        p_payment_method: total === 0 ? null : method,
        p_total_amount: total,
        p_discount_id: discountAmount > 0 ? this._selectedDiscountId() : null,
        p_discount_amount: discountAmount,
        p_is_deposit: pricing.isDeposit,
        p_document_number: this._documentNumber() || null,
      });

      if (error) {
        this._error.set('Error al registrar pago: ' + this.sanitizer.sanitize(error).message);
        return false;
      }

      // fix-052-i: "Cobrar después" deja el pago 'pending' — el alumno no pagó nada todavía.
      if (method !== 'pendiente') this.notifyPaymentRegistered(enrollmentId, total);

      return true;
    } catch {
      this._error.set('Error inesperado al registrar pago');
      return false;
    } finally {
      this._isProcessing.set(false);
    }
  }

  /**
   * Notifica al alumno que se registró su pago presencial (spec 0025, AC1, AC7).
   * NUNCA notifica al admin/secretaria (el dashboard ya cubre esa métrica).
   * Fire-and-forget: un fallo nunca revierte el pago ya registrado.
   */
  private notifyPaymentRegistered(enrollmentId: number, amount: number): void {
    if (amount <= 0) return;

    this.resolveStudentUserIdByEnrollment(enrollmentId)
      .then((userId) => {
        if (!userId) return;
        this.notifications
          .notifyUsers([userId], {
            subject: 'Pago registrado',
            message: `Se registró un pago de ${formatCLP(amount)} en tu matrícula.`,
            referenceType: 'payment',
          })
          .catch(() => this.toast.warning('No se pudo notificar al alumno'));
      })
      .catch(() => {
        // Resolución de destinatario falló (red/RLS) — no rompe el registro (AC-E1).
      });
  }

  /** Resuelve `enrollments.student_id → students.user_id` para poder notificar al alumno. */
  private async resolveStudentUserIdByEnrollment(enrollmentId: number): Promise<number | null> {
    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select('students!inner(user_id)')
      .eq('id', enrollmentId)
      .single();
    // A propósito no lanza: esta lectura corre con el pago ya guardado y solo sirve para avisar al
    // alumno. Si falla se omite el aviso; informar un error haría creer que el pago no quedó.
    if (error || !data) return null;
    const students = (data as any).students;
    const student = Array.isArray(students) ? students[0] : students;
    return student?.user_id ?? null;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3b. REHYDRATION — Reconstruir estado desde BD (draft recovery)
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Rehidrata el estado de pago desde un enrollment existente en la BD.
   * Carga el payment record y discount_applications para reconstruir los signals.
   *
   * spec 0060-b: las tres lecturas se aplican juntas y solo si las tres salieron bien. Si alguna
   * falla, el estado queda vacío y `canConfirmPayment` en false hasta que un reintento salga bien:
   * `record_enrollment_payment` borra el pago y el descuento guardados y los reemplaza por lo que
   * recibe, así que confirmar sin haberlos leído perdería el descuento y cobraría de más.
   * Un `maybeSingle()` sin fila no es falla: "sin pago" y "sin descuento" son estados válidos.
   * No lanza: reanudar el borrador sigue, y el error se muestra en el paso Pago.
   */
  async rehydrateFromEnrollment(enrollmentId: number): Promise<void> {
    const requestToken = this.rehydrationGuard.next();
    if (enrollmentId !== this.rehydrationEnrollmentId) this._error.set(null);
    this.rehydrationEnrollmentId = enrollmentId;
    this._isRehydrating.set(true);
    this._rehydrationError.set(null);
    this.clearPaymentState();

    try {
      const [enrollmentResult, paymentResult, discountResult] = await Promise.all([
        // Cargar enrollment para pricing data
        this.supabase.client
          .from('enrollments')
          .select(
            'base_price, discount, total_paid, pending_balance, payment_status, payment_mode, courses!inner(name, practical_hours)',
          )
          .eq('id', enrollmentId)
          .single(),
        // Cargar payment record
        this.supabase.client
          .from('payments')
          .select('*')
          .eq('enrollment_id', enrollmentId)
          .eq('type', 'enrollment')
          // Un pago anulado sigue en la tabla: sin este filtro, uno anulado más uno nuevo son dos
          // filas y maybeSingle() falla (spec 0025-m). 'pending' sí entra: es el "Cobrar después".
          .neq('status', 'anulado')
          .maybeSingle(),
        // Cargar discount application
        this.supabase.client
          .from('discount_applications')
          .select('discount_id, discount_amount, discounts!inner(name)')
          .eq('enrollment_id', enrollmentId)
          .maybeSingle(),
      ]);

      const enrollment = assertReadOk(enrollmentResult);
      const payment = assertReadOk(paymentResult);
      const discApp = assertReadOk(discountResult);

      if (!this.rehydrationGuard.isCurrent(requestToken)) return;

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

      if (payment) {
        // Determinar método de pago desde los montos
        let method: PaymentMethod = 'pendiente';
        if (payment.cash_amount > 0) method = 'efectivo';
        else if (payment.transfer_amount > 0) method = 'transferencia';
        else if (payment.card_amount > 0) method = 'tarjeta';
        else if (payment.status === 'pending') method = 'pendiente';
        this._paymentMethod.set(method);
        this._documentNumber.set(payment.document_number ?? null);
      }

      if (discApp) {
        this._selectedDiscountId.set(discApp.discount_id);
        this._discount.set({
          enabled: true,
          amount: discApp.discount_amount,
          reason: (discApp as any).discounts?.name ?? '',
        });
      } else if (enrollment.discount > 0) {
        // fix-253-b: un descuento manual no tiene discount_id, así que la RPC solo guarda su monto
        // en enrollments.discount. Sin recuperarlo, confirmar lo dejaría en 0. La BD no guarda su
        // motivo. Llegar aquí implica que discount_applications se leyó bien y no tiene fila.
        this._discount.set({
          enabled: true,
          amount: enrollment.discount,
          reason: MANUAL_DISCOUNT_REASON,
        });
      }
    } catch {
      if (!this.rehydrationGuard.isCurrent(requestToken)) return;
      this._rehydrationError.set('No se pudieron cargar los datos del pago de esta matrícula.');
    } finally {
      if (this.rehydrationGuard.isCurrent(requestToken)) this._isRehydrating.set(false);
    }
  }

  /** Repite la rehidratación de la matrícula cuyos datos de pago no cargaron. */
  async reintentarDatosPago(): Promise<void> {
    if (this.rehydrationEnrollmentId === null) return;
    await this.rehydrateFromEnrollment(this.rehydrationEnrollmentId);
  }

  private clearPaymentState(): void {
    this._pricing.set(null);
    this._paymentMethod.set(null);
    this._discount.set(INITIAL_DISCOUNT);
    this._selectedDiscountId.set(null);
    this._documentNumber.set(null);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 4. RESET & ERROR
  // ══════════════════════════════════════════════════════════════════════════════

  reset(): void {
    // Invalida las lecturas en curso: su respuesta ya no corresponde a este wizard.
    this.rehydrationGuard.next();
    this.discountsGuard.next();
    this.rehydrationEnrollmentId = null;
    this.discountsQuery = null;
    this.clearPaymentState();
    this._availableDiscounts.set([]);
    this._isProcessing.set(false);
    this._error.set(null);
    this._isRehydrating.set(false);
    this._rehydrationError.set(null);
    this._isLoadingDiscounts.set(false);
    this._discountsError.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }
}
