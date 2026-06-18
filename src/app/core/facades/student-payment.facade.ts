import { computed, inject, Injectable, signal } from '@angular/core';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type {
  StudentPaymentEnrollmentInfo,
  StudentPaymentHistoryItem,
  StudentPaymentResult,
  StudentPaymentStatus,
  StudentPaymentStep,
} from '@core/models/ui/student-payment.model';

/**
 * StudentPaymentFacade — Orquesta el pago del saldo pendiente de matrícula (Clase B).
 *
 * Desde fix-017, la matrícula de Clase B agenda SIEMPRE las 12 clases (aunque el
 * alumno abone solo la primera mitad), por lo que este flujo es exclusivamente de
 * pago: el alumno NO selecciona horarios. Sus clases ya quedaron agendadas durante
 * la matrícula.
 *
 * Responsabilidades:
 * - Cargar el estado del enrollment con saldo pendiente del alumno autenticado
 * - Iniciar el pago Webpay del saldo y confirmarlo tras el retorno de Transbank
 */
@Injectable({ providedIn: 'root' })
export class StudentPaymentFacade {
  private readonly supabase = inject(SupabaseService);

  // ─── Estado reactivo privado ───

  /** SWR guard: evita re-fetch con skeleton en re-visitas. */
  private _initialized = false;

  private readonly _step = signal<StudentPaymentStep>(1);
  private readonly _status = signal<StudentPaymentStatus | null>(null);
  private readonly _payments = signal<StudentPaymentHistoryItem[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSubmitting = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  /**
   * Token UUID de sesión para idempotencia de pagos (payment_attempts).
   * Persistido en localStorage para que, si el usuario recarga o vuelve a la
   * página tras un intento abandonado, el intento previo sea reconocido como propio.
   */
  private static readonly TOKEN_KEY = 'spt_session_token';

  private readonly _sessionToken = signal<string>(StudentPaymentFacade.restoreOrCreateToken());

  private static restoreOrCreateToken(): string {
    const stored = localStorage.getItem(StudentPaymentFacade.TOKEN_KEY);
    if (stored) return stored;
    const token = crypto.randomUUID();
    localStorage.setItem(StudentPaymentFacade.TOKEN_KEY, token);
    return token;
  }

  private static rotateToken(): string {
    const token = crypto.randomUUID();
    localStorage.setItem(StudentPaymentFacade.TOKEN_KEY, token);
    return token;
  }

  // ─── Estado público readonly ───

  readonly step = this._step.asReadonly();
  readonly status = this._status.asReadonly();
  readonly payments = this._payments.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly error = this._error.asReadonly();

  // ─── Computed ───

  readonly enrollment = computed<StudentPaymentEnrollmentInfo | null>(
    () => this._status()?.enrollment ?? null,
  );

  /** true → alumno Clase B (flujo Webpay habilitado); false → Profesional (pago presencial). */
  readonly isClassB = computed(() => this._status()?.enrollment?.licenseGroup === 'class_b');

  // ─── Métodos ───

  /** Carga el estado del enrollment con saldo pendiente. Llamar en ngOnInit del componente. */
  async initialize(): Promise<void> {
    if (this._initialized) {
      // SWR: mostrar datos cacheados, refrescar en background sin skeleton
      void this.refreshSilently();
      return;
    }
    this._initialized = true;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      await this.fetchStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar el estado del pago';
      this._error.set(msg);
    } finally {
      this._isLoading.set(false);
    }
  }

  private async fetchStatus(): Promise<void> {
    const { data, error } = await this.supabase.client.functions.invoke('student-payment', {
      body: { action: 'load-enrollment-status' },
    });
    if (error) throw error;
    const status = data as StudentPaymentStatus;
    this._status.set(status);
    this._payments.set(status.payments ?? []);
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchStatus();
    } catch {
      // Fail silencioso — datos stale siguen visibles
    }
  }

  /** Avanza al step de pago (las 12 clases ya están agendadas, solo falta pagar). */
  goDirectToConfirm(): void {
    this._step.set(3);
  }

  /** Vuelve al step 1 (resumen) desde el step de pago. */
  backToSummary(): void {
    this._step.set(1);
  }

  /**
   * Inicia el pago Webpay Plus del saldo pendiente. Registra el payment_attempt
   * e inicia la transacción Transbank. NO crea ni agenda clases (ya existen).
   * Si Webpay retorna una URL, redirige al navegador vía POST.
   */
  async initiatePayment(): Promise<void> {
    const enrollment = this._status()?.enrollment;
    if (!enrollment) return;

    this._isSubmitting.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('student-payment', {
        body: {
          action: 'initiate-payment',
          enrollmentId: enrollment.id,
          sessionToken: this._sessionToken(),
        },
      });

      if (error) throw error;

      const result = data as { success: boolean; webpayUrl?: string; webpayToken?: string };

      if (result.webpayUrl && result.webpayToken) {
        // Webpay Plus exige POST con token_ws como campo oculto, no GET redirect.
        // isSubmitting se mantiene true para deshabilitar el botón mientras redirige.
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = result.webpayUrl;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'token_ws';
        input.value = result.webpayToken;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        return;
      }

      // Caso idempotente (ya fue confirmado)
      if (result.success) {
        this._error.set(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al iniciar el pago';
      this._error.set(msg);
      this._isSubmitting.set(false);
    }
  }

  /**
   * Confirma el pago tras el retorno de Webpay.
   * Llamado por AlumnoPagarRetornoComponent con el token recibido en la URL.
   */
  async confirmPayment(tokenWs: string): Promise<StudentPaymentResult> {
    try {
      const { data, error } = await this.supabase.client.functions.invoke('student-payment', {
        body: { action: 'confirm-payment', tokenWs },
      });

      if (error) throw error;
      const result = data as StudentPaymentResult;
      // Rotar el token tras pago exitoso para que un futuro flujo empiece limpio
      if (result.success) {
        this._sessionToken.set(StudentPaymentFacade.rotateToken());
      }
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al confirmar el pago';
      return { success: false, message: msg };
    }
  }

  resetError(): void {
    this._error.set(null);
  }
}
