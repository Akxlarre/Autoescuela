import { computed, inject, Injectable, signal } from '@angular/core';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type { ScheduleGrid, TimeSlot } from '@core/models/ui/enrollment-assignment.model';
import type {
  StudentPaymentEnrollmentInfo,
  StudentPaymentHistoryItem,
  StudentPaymentInstructor,
  StudentPaymentResult,
  StudentPaymentStatus,
  StudentPaymentStep,
} from '@core/models/ui/student-payment.model';

/**
 * StudentPaymentFacade — Orquesta el wizard de pago de segunda mitad (Clase B).
 *
 * Responsabilidades:
 * - Cargar el estado del enrollment con saldo pendiente del alumno autenticado
 * - Gestionar la selección de 6 horarios con el instructor asignado
 * - Coordinar la reserva de slots y el inicio del pago Webpay
 * - Confirmar el pago tras el retorno de Transbank
 *
 * El alumno NO puede cambiar de instructor en este flujo: el instructor es el
 * mismo que tuvo en las primeras 6 clases. Si quiere cambiarlo debe hacerlo
 * con la secretaria/admin.
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
  private readonly _scheduleGrid = signal<ScheduleGrid | null>(null);
  private readonly _selectedSlotIds = signal<string[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSubmitting = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  /**
   * Token UUID de sesión para idempotencia de pagos.
   * Persistido en localStorage para que, si el usuario recarga o vuelve a la
   * página tras un intento abandonado, sus slot_holds previos sean reconocidos
   * como propios y los slots pre-seleccionados se restauren automáticamente.
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
  readonly scheduleGrid = this._scheduleGrid.asReadonly();
  readonly selectedSlotIds = this._selectedSlotIds.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly error = this._error.asReadonly();

  // ─── Computed ───

  readonly selectedCount = computed(() => this._selectedSlotIds().length);
  readonly requiredCount = 6;

  readonly enrollment = computed<StudentPaymentEnrollmentInfo | null>(
    () => this._status()?.enrollment ?? null,
  );

  readonly instructor = computed<StudentPaymentInstructor | null>(
    () => this._status()?.instructor ?? null,
  );

  readonly selectionComplete = computed(
    () => this._selectedSlotIds().length === this.requiredCount,
  );

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

  /** Avanza al step 2 y carga la grilla de horarios del instructor asignado. */
  async goToSchedule(): Promise<void> {
    const instructorId = this._status()?.instructor?.id;
    if (!instructorId) return;

    this._step.set(2);
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('student-payment', {
        body: {
          action: 'load-instructor-schedule',
          instructorId,
          sessionToken: this._sessionToken(),
        },
      });

      if (error) throw error;
      const response = data as { grid: ScheduleGrid; myHeldSlotIds?: string[] };
      this._scheduleGrid.set(response.grid);
      // Restaurar selección previa si el usuario tenía holds activos de este token
      if (response.myHeldSlotIds?.length) {
        this._selectedSlotIds.set(response.myHeldSlotIds);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar los horarios';
      this._error.set(msg);
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Selecciona o deselecciona un slot. Máximo 1 por día, máximo 6 en total. */
  toggleSlot(slotId: string): void {
    const grid = this._scheduleGrid();
    const current = this._selectedSlotIds();
    if (!grid) return;

    const idx = current.indexOf(slotId);
    if (idx > -1) {
      // Deseleccionar
      this._selectedSlotIds.set(current.filter((_, i) => i !== idx));
      return;
    }

    if (current.length >= this.requiredCount) return;

    // Máximo 1 clase por día
    const slotDate = grid.slots.find((s: TimeSlot) => s.id === slotId)?.date;
    if (slotDate) {
      const hasSameDay = current.some(
        (id) => grid.slots.find((s: TimeSlot) => s.id === id)?.date === slotDate,
      );
      if (hasSameDay) return;
    }

    this._selectedSlotIds.set([...current, slotId]);
  }

  /** Determina si un slot puede ser seleccionado (disponible, sin mismo día ya elegido). */
  isSlotSelectable(slotId: string): boolean {
    const selected = this._selectedSlotIds();
    const grid = this._scheduleGrid();
    if (!grid) return false;
    if (selected.includes(slotId)) return true;
    if (selected.length >= this.requiredCount) return false;

    const slotDate = grid.slots.find((s: TimeSlot) => s.id === slotId)?.date;
    if (slotDate) {
      const hasSameDay = selected.some(
        (id) => grid.slots.find((s: TimeSlot) => s.id === id)?.date === slotDate,
      );
      if (hasSameDay) return false;
    }
    return true;
  }

  /**
   * Reserva los slots seleccionados y avanza al step 3.
   * Si hay conflictos, recarga la grilla y muestra mensaje de error.
   */
  async reserveSlotsAndAdvance(): Promise<void> {
    const instructorId = this._status()?.instructor?.id;
    const slotIds = this._selectedSlotIds();

    if (!instructorId || slotIds.length !== this.requiredCount) return;

    this._isSubmitting.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('student-payment', {
        body: {
          action: 'reserve-slots',
          sessionToken: this._sessionToken(),
          instructorId,
          slotIds,
        },
      });

      if (error) throw error;

      const result = data as { success: boolean; conflictingSlots?: string[] };

      if (!result.success) {
        this._error.set('Algunos horarios ya no están disponibles. Por favor, selecciona otros.');
        this._selectedSlotIds.set([]);
        // Recargar grilla silenciosamente para reflejar slots ocupados
        void this.reloadScheduleSilently();
        return;
      }

      this._step.set(3);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al reservar los horarios';
      this._error.set(msg);
    } finally {
      this._isSubmitting.set(false);
    }
  }

  /** Vuelve al step 2 liberando los holds actuales. */
  async backToSchedule(): Promise<void> {
    // Fire-and-forget — no bloquear la navegación si falla
    void this.supabase.client.functions
      .invoke('student-payment', {
        body: { action: 'release-slots', sessionToken: this._sessionToken() },
      })
      .catch(() => {});

    this._step.set(2);
  }

  /** Vuelve al step 1 desde el step 2, liberando los holds. */
  async backToSummary(): Promise<void> {
    void this.supabase.client.functions
      .invoke('student-payment', {
        body: { action: 'release-slots', sessionToken: this._sessionToken() },
      })
      .catch(() => {});

    this._selectedSlotIds.set([]);
    this._step.set(1);
  }

  /**
   * Inicia el pago Webpay Plus. Crea las class_b_sessions 'reserved',
   * registra el payment_attempt e inicia la transacción Transbank.
   * Si Webpay retorna una URL, redirige al navegador.
   */
  async initiatePayment(): Promise<void> {
    const enrollment = this._status()?.enrollment;
    const instructor = this._status()?.instructor;

    if (!enrollment || !instructor) return;

    this._isSubmitting.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('student-payment', {
        body: {
          action: 'initiate-payment',
          enrollmentId: enrollment.id,
          instructorId: instructor.id,
          selectedSlotIds: this._selectedSlotIds(),
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

  // ─── Helpers privados ───

  private async reloadScheduleSilently(): Promise<void> {
    const instructorId = this._status()?.instructor?.id;
    if (!instructorId) return;

    try {
      const { data } = await this.supabase.client.functions.invoke('student-payment', {
        body: {
          action: 'load-instructor-schedule',
          instructorId,
          sessionToken: this._sessionToken(),
        },
      });
      if (data?.grid) this._scheduleGrid.set(data.grid as ScheduleGrid);
    } catch {
      // Fail silencioso — la grilla anterior sigue visible
    }
  }
}
