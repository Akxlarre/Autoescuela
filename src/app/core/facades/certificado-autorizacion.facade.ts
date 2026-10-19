import { Injectable, inject } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';
import { assertWriteOk, toFriendlyDbMessage } from '@core/utils/db-error.utils';
import {
  buildCertificateConfirmation,
  type CertificateConfirmationInput,
} from '@core/utils/certificate-confirmation.utils';

/** Lo que el caller sabe del alumno; el saldo y la habilitación previa se leen de la BD. */
export type CertificateEmissionRequest = Omit<
  CertificateConfirmationInput,
  'saldoPendiente' | 'deudaAutorizada'
> & { enrollmentId: number };

const MOTIVO_MIN_LENGTH = 5;

/**
 * CertificadoAutorizacionFacade — confirmación previa a emitir un certificado (fix-466-m).
 *
 * Toda emisión (Clase B y Profesional, desde la lista o la ficha) pasa por `confirmarEmision()`:
 * un modal con los avisos del alumno y, si tiene saldo, la convención de la spec 0010-i (AC8):
 * motivo obligatorio, registro en `enrollment_payment_overrides` (`kind = 'certificado'`) y aviso
 * a los admins (trigger `notify_payment_override`). Las edge functions exigen esa habilitación.
 *
 * Sin estado: cada llamada lee el saldo vigente de la matrícula.
 */
@Injectable({ providedIn: 'root' })
export class CertificadoAutorizacionFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly authFacade = inject(AuthFacade);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly toast = inject(ToastService);

  /** Muestra el modal y, si hace falta, registra la habilitación por deuda. true = emitir. */
  async confirmarEmision(request: CertificateEmissionRequest): Promise<boolean> {
    const deuda = await this.leerDeuda(request.enrollmentId);
    if (!deuda) return false;

    const { enrollmentId, ...datos } = request;
    const confirmacion = buildCertificateConfirmation({ ...datos, ...deuda });
    const config = {
      title: confirmacion.title,
      message: confirmacion.message,
      severity: confirmacion.severity,
      confirmLabel: confirmacion.confirmLabel,
    };

    if (!confirmacion.requiresReason) return this.confirmModal.confirm(config);

    const motivo = await this.confirmModal.confirmWithReason({
      ...config,
      reason: {
        label: 'Motivo',
        placeholder: 'Ej. Paga el viernes, acordado con el admin',
        minLength: MOTIVO_MIN_LENGTH,
      },
    });
    if (motivo === null) return false;
    return this.registrarHabilitacion(enrollmentId, motivo);
  }

  /**
   * Respaldo cuando la edge function rechaza por `DEUDA_PENDIENTE` aunque el modal previo no viera
   * deuda (p. ej. el saldo cambió entre medio). Pide el motivo y registra la habilitación.
   */
  async autorizarDeuda(enrollmentId: number, mensajeDeuda: string): Promise<boolean> {
    const motivo = await this.confirmModal.confirmWithReason({
      title: 'Certificado con deuda',
      message: `${mensajeDeuda}\n¿Emitir el certificado igual? Quedará registrado quién lo autorizó y por qué, y se avisará a los administradores.`,
      severity: 'warn',
      confirmLabel: 'Emitir igual',
      reason: {
        label: 'Motivo',
        placeholder: 'Ej. Paga el viernes, acordado con el admin',
        minLength: MOTIVO_MIN_LENGTH,
      },
    });
    if (motivo === null) return false;
    return this.registrarHabilitacion(enrollmentId, motivo);
  }

  /** Saldo de la matrícula y si ya existe una habilitación `certificado`. null = error (con toast). */
  private async leerDeuda(
    enrollmentId: number,
  ): Promise<{ saldoPendiente: number; deudaAutorizada: boolean } | null> {
    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select('pending_balance')
      .eq('id', enrollmentId)
      .single();
    if (error || !data) {
      this.toast.error('No se pudo revisar el saldo del alumno');
      return null;
    }

    const saldoPendiente = Math.max(0, Number(data.pending_balance ?? 0));
    if (saldoPendiente === 0) return { saldoPendiente, deudaAutorizada: false };

    const { count, error: overrideError } = await this.supabase.client
      .from('enrollment_payment_overrides')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('kind', 'certificado');
    if (overrideError) {
      this.toast.error('No se pudo revisar el saldo del alumno');
      return null;
    }
    return { saldoPendiente, deudaAutorizada: (count ?? 0) > 0 };
  }

  /** Spec 0010-i (AC8). true solo si la habilitación quedó guardada. */
  private async registrarHabilitacion(enrollmentId: number, motivo: string): Promise<boolean> {
    const createdBy = this.authFacade.currentUser()?.dbId ?? null;
    if (createdBy === null) {
      this.toast.error('No se pudo identificar tu usuario. Vuelve a iniciar sesión.');
      return false;
    }

    try {
      assertWriteOk(
        await this.supabase.client
          .from('enrollment_payment_overrides')
          .insert({
            enrollment_id: enrollmentId,
            kind: 'certificado',
            reason: motivo,
            created_by: createdBy,
          })
          .select('id'),
        { requireRows: true },
      );
      return true;
    } catch (err) {
      this.toast.error(toFriendlyDbMessage(err, 'No se pudo registrar la autorización'));
      return false;
    }
  }
}
