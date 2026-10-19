import { Injectable, inject } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';
import { assertWriteOk, toFriendlyDbMessage } from '@core/utils/db-error.utils';
import {
  buildEmailConfirmation,
  buildWarningConfirmation,
  type CertificateWarningInput,
} from '@core/utils/certificate-confirmation.utils';

const MOTIVO_MIN_LENGTH = 5;

/**
 * CertificadoAutorizacionFacade — confirmaciones al emitir certificados (fix-466-m).
 *
 * Compartido por Clase B y Profesional (lista y ficha del alumno). Sin estado.
 * - `confirmarAvisos()`: modal solo si hay algo que avisar (prácticas, asistencia); nunca bloquea.
 * - `confirmarRegeneracion()` / `confirmarEnvioEmail()`: modales de esas acciones.
 * - `autorizarDeuda()`: convención de la spec 0010-i (AC8). Se llama cuando la edge function
 *   rechaza por `DEUDA_PENDIENTE`: pide motivo, registra la habilitación `certificado` en
 *   `enrollment_payment_overrides` (el trigger avisa a los admins) y el caller reintenta.
 */
@Injectable({ providedIn: 'root' })
export class CertificadoAutorizacionFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly authFacade = inject(AuthFacade);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly toast = inject(ToastService);

  /** true = generar. Sin avisos no abre ningún modal. */
  async confirmarAvisos(input: CertificateWarningInput): Promise<boolean> {
    const modal = buildWarningConfirmation(input);
    return modal ? this.confirmModal.confirm(modal) : true;
  }

  /** fix-464-m: regenerar reemite el PDF con los datos y la plantilla actuales. */
  confirmarRegeneracion(): Promise<boolean> {
    return this.confirmModal.confirm({
      title: 'Regenerar certificado',
      message:
        'Se volverá a generar el PDF con los datos del alumno y la plantilla actuales. El folio no cambia.',
      severity: 'warn',
      confirmLabel: 'Regenerar',
    });
  }

  confirmarEnvioEmail(input: {
    nombre: string;
    email: string | null;
    yaEnviado: boolean;
  }): Promise<boolean> {
    return this.confirmModal.confirm(buildEmailConfirmation(input));
  }

  /** Spec 0010-i (AC8). true solo si la habilitación quedó guardada. */
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
