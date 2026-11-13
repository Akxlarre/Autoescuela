import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { assertReadOk, assertWriteOk, toFriendlyDbMessage } from '@core/utils/db-error.utils';
import { edgeFunctionUserMessage } from '@core/utils/edge-function-error.utils';
import {
  normalizeBranchEmailForm,
  validateBranchEmailForm,
} from '@core/utils/branch-email.utils';
import type { BranchEmailConfigRow } from '@core/models/dto/branch-email-config.model';
import type {
  BranchEmailConfig,
  BranchEmailForm,
} from '@core/models/ui/branch-email-config.model';

const COLUMNS = 'id, name, email_sender_name, email_sender_address, email, phone';

function toConfig(row: BranchEmailConfigRow): BranchEmailConfig {
  return {
    branchId: row.id,
    branchName: row.name,
    senderName: row.email_sender_name ?? null,
    senderAddress: row.email_sender_address ?? null,
    replyTo: row.email ?? null,
    phone: row.phone ?? null,
  };
}

/**
 * BranchEmailFacade — spec 0061-b (AC11, AC12, AC-E6).
 *
 * Lee y escribe la configuración de correo de cada escuela: nombre visible del remitente,
 * dirección de envío, correo de respuesta y teléfono del pie. Viven en `branches` (D1 del plan):
 * `email` y `phone` ya existían y son la única fuente del contacto de la escuela en los correos.
 * Los usa `_shared/school-email.ts` en cada envío, así que un cambio vale desde el correo
 * siguiente, sin redesplegar.
 *
 * Solo admin: la policy `update_branches` exige `auth_user_role() = 'admin'`, y el drawer solo se
 * abre desde Ajustes bajo `isAdmin()`.
 *
 * NO es branch-scoped: el admin edita todas las escuelas, como `PayrollConfigFacade`.
 * Sin SWR: es una pantalla de configuración que se abre a propósito; cada apertura lee de nuevo.
 */
@Injectable({ providedIn: 'root' })
export class BranchEmailFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _configs = signal<BranchEmailConfig[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _isSendingTest = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // ── Estado expuesto ───────────────────────────────────────────────────────
  readonly configs = this._configs.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly isSendingTest = this._isSendingTest.asReadonly();
  readonly error = this._error.asReadonly();

  // ── Acciones ──────────────────────────────────────────────────────────────

  async load(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const rows = assertReadOk(
        await this.supabase.client.from('branches').select(COLUMNS).order('id'),
      );
      this._configs.set(((rows ?? []) as BranchEmailConfigRow[]).map(toConfig));
    } catch {
      // Una lectura fallida no puede verse como "sin configuración" (spec 0060-b).
      this._configs.set([]);
      this._error.set('No se pudo cargar la configuración de correo de las escuelas.');
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Guarda los 4 campos de una escuela. Devuelve `true` si quedó guardado. */
  async save(branchId: number, form: BranchEmailForm): Promise<boolean> {
    const clean = normalizeBranchEmailForm(form);
    const errors = validateBranchEmailForm(clean);
    const firstError = errors.senderAddress ?? errors.replyTo;
    if (firstError) {
      this._error.set(firstError);
      return false;
    }

    this._isSaving.set(true);
    this._error.set(null);
    try {
      // `.select()` + `requireRows`: un UPDATE que la RLS filtra no da error, da 0 filas.
      assertWriteOk(
        await this.supabase.client
          .from('branches')
          .update({
            email_sender_name: clean.senderName,
            email_sender_address: clean.senderAddress,
            email: clean.replyTo,
            phone: clean.phone,
          })
          .eq('id', branchId)
          .select('id'),
        { requireRows: true },
      );

      this._configs.update((list) =>
        list.map((c) => (c.branchId === branchId ? { ...c, ...clean } : c)),
      );
      this.toast.success('Configuración de correo guardada.');
      return true;
    } catch (err) {
      const message = toFriendlyDbMessage(err, 'No se pudo guardar la configuración de correo.');
      this._error.set(message);
      this.toast.error('No se pudo guardar', message);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * AC12: manda al admin un correo con el remitente, la respuesta y el pie de la escuela. Si el
   * servidor de correo lo rechaza, la función responde 422 con su mensaje y se muestra tal cual.
   */
  async enviarPrueba(branchId: number): Promise<boolean> {
    this._isSendingTest.set(true);
    this._error.set(null);
    try {
      const { data, error } = await this.supabase.client.functions.invoke(
        'send-branch-test-email',
        { body: { branchId } },
      );
      if (error) {
        const message = await edgeFunctionUserMessage(
          error,
          'No se pudo enviar el correo de prueba.',
        );
        this._error.set(message);
        this.toast.error('No se pudo enviar el correo de prueba', message);
        return false;
      }
      this.toast.success(
        'Correo de prueba enviado',
        `Revisa la bandeja de ${data?.recipientEmail ?? 'tu correo'}.`,
      );
      return true;
    } catch {
      const message = 'No se pudo enviar el correo de prueba. Revisa tu conexión.';
      this._error.set(message);
      this.toast.error('No se pudo enviar el correo de prueba', message);
      return false;
    } finally {
      this._isSendingTest.set(false);
    }
  }
}
