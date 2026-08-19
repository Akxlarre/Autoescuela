import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { ToastService } from '@core/services/ui/toast.service';
import {
  CONSENT_SOURCE_LABELS,
  CONSENT_TYPE_LABELS,
  type ConsentDraft,
  type ConsentRow,
  type ConsentStatus,
} from '@core/models/ui/consent.model';
import type { Consent } from '@core/models/dto/consent.model';
import { buildMedicalCertificateConsent } from '@core/utils/consent-builder.utils';
import { PRIVACY_POLICY_VERSION } from '@core/models/ui/privacy-policy.model';

/**
 * ConsentsFacade — registro y consulta de consentimientos (spec 0009-m, Ley 21.719).
 *
 * Es un Facade propio y no un método de `EnrollmentFacade` porque lo consumen tres
 * consumidores independientes: el wizard de matrícula de secretaría, el DMS (Art. 16)
 * y la ficha del alumno (consulta y revocación).
 *
 * **No es branch-scoped** (a diferencia de la mayoría): `branch_id` viaja DENTRO de cada
 * registro para dejar constancia de ante qué responsable se otorgó, pero no filtra la
 * vista — un admin que consulta la ficha de un alumno debe ver todos sus consentimientos,
 * no solo los de la sede que tenga seleccionada. Por eso no inyecta `BranchFacade`.
 *
 * **Sin SWR**: los consentimientos se consultan bajo demanda en la ficha de un alumno
 * concreto (`:id`), que es justo el caso que `swr-pattern.md` excluye del cacheo.
 *
 * El flujo público de matrícula NO pasa por acá: escribe a través de la Edge Function
 * `public-enrollment` con `service_role`, porque `consents` no tiene policy para `anon`.
 */
@Injectable({ providedIn: 'root' })
export class ConsentsFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly toast = inject(ToastService);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _consents = signal<ConsentRow[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // ── Estado expuesto ───────────────────────────────────────────────────────
  readonly consents = this._consents.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();

  // ── Acciones ──────────────────────────────────────────────────────────────

  /**
   * Persiste los consentimientos de un flujo. Un INSERT batch para las N filas.
   *
   * Devuelve `false` en vez de lanzar: el llamador decide si eso aborta la matrícula
   * (flujo de secretaría: sí, una matrícula sin consentimiento es un incidente) o solo
   * se reporta.
   *
   * **Nunca envía `ip`**: la escribe el trigger `trg_consents_set_ip`. Una IP que el
   * cliente puede elegir no prueba desde dónde se otorgó el consentimiento.
   */
  async recordMany(drafts: ConsentDraft[]): Promise<boolean> {
    if (drafts.length === 0) return true;

    this._isSaving.set(true);
    this._error.set(null);

    try {
      const rows = drafts.map((d) => ({
        consent_type: d.consentType,
        granted: d.granted,
        branch_id: d.branchId,
        source: d.source,
        user_id: d.userId ?? null,
        subject_rut: d.subjectRut ?? null,
        enrollment_id: d.enrollmentId ?? null,
        granted_by_representative: d.grantedByRepresentative ?? false,
        policy_version: PRIVACY_POLICY_VERSION,
      }));

      const { error } = await this.supabase.client.from('consents').insert(rows);

      if (error) {
        const message = this.sanitizer.sanitize(error).message;
        this._error.set('Error al registrar el consentimiento: ' + message);
        this.toast.error('No se pudo registrar el consentimiento', message);
        return false;
      }

      return true;
    } catch (e) {
      const message = this.sanitizer.sanitize(e).message;
      this._error.set('Error inesperado al registrar el consentimiento: ' + message);
      this.toast.error('No se pudo registrar el consentimiento', message);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /** Atajo para el caso de un único consentimiento (DMS, Art. 16). */
  async record(draft: ConsentDraft): Promise<boolean> {
    return this.recordMany([draft]);
  }

  /**
   * Consentimiento del Art. 16 para el certificado médico (AC4/AC-E1).
   *
   * Resuelve titular y sede desde la matrícula: el drawer del DMS conoce el
   * `enrollmentId`, no el `user_id` — y `consents` exige un titular identificable.
   *
   * `granted: false` **también se registra**: deja constancia de que el alumno exhibió el
   * certificado y NO autorizó digitalizarlo, que es distinto de que nadie se lo haya
   * preguntado.
   */
  async recordMedicalCertificate(enrollmentId: number, granted: boolean): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.client
        .from('enrollments')
        .select('branch_id, students(user_id)')
        .eq('id', enrollmentId)
        .maybeSingle();

      if (error) throw error;

      const studentRel = (data as { students?: { user_id?: number } | { user_id?: number }[] } | null)
        ?.students;
      const student = Array.isArray(studentRel) ? studentRel[0] : studentRel;
      const branchId = (data as { branch_id?: number } | null)?.branch_id ?? null;

      if (branchId === null || !student?.user_id) {
        this._error.set('No se pudo identificar al alumno para registrar el consentimiento.');
        this.toast.error('No se pudo registrar el consentimiento');
        return false;
      }

      return this.record(
        buildMedicalCertificateConsent({
          branchId,
          source: 'secretaria',
          policyAccepted: granted,
          isMinor: false,
          userId: student.user_id,
          enrollmentId,
        }),
      );
    } catch (e) {
      const message = this.sanitizer.sanitize(e).message;
      this._error.set('Error al registrar el consentimiento: ' + message);
      this.toast.error('No se pudo registrar el consentimiento', message);
      return false;
    }
  }

  /** Consentimientos de un titular, del más reciente al más antiguo (AC6). */
  async loadByUser(userId: number): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client
        .from('consents')
        .select(
          'id, consent_type, granted, granted_at, revoked_at, policy_version, source, ip, granted_by_representative',
        )
        .eq('user_id', userId)
        .order('granted_at', { ascending: false });

      if (error) throw error;

      this._consents.set((data ?? []).map(mapConsentRow));
    } catch (e) {
      const message = this.sanitizer.sanitize(e).message;
      this._error.set('Error al cargar los consentimientos: ' + message);
      this._consents.set([]);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Marca un consentimiento como revocado (AC-E3).
   *
   * Deliberadamente actualiza **solo** `revoked_at`: el registro original es prueba
   * legal y no se edita ni se borra. La base lo refuerza con el trigger
   * `trg_consents_append_only`, que rechaza cualquier UPDATE de otra columna.
   */
  async revoke(consentId: number): Promise<boolean> {
    this._isSaving.set(true);
    this._error.set(null);

    try {
      const { error } = await this.supabase.client
        .from('consents')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', consentId);

      if (error) {
        const message = this.sanitizer.sanitize(error).message;
        this._error.set('Error al revocar el consentimiento: ' + message);
        this.toast.error('No se pudo revocar el consentimiento', message);
        return false;
      }

      this._consents.update((rows) =>
        rows.map((r) =>
          r.id === consentId
            ? { ...r, status: 'revocado' as ConsentStatus, revokedAt: new Date().toISOString() }
            : r,
        ),
      );
      this.toast.success('Consentimiento revocado');
      return true;
    } catch (e) {
      const message = this.sanitizer.sanitize(e).message;
      this._error.set('Error inesperado al revocar el consentimiento: ' + message);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }
}

type ConsentSelectRow = Pick<
  Consent,
  | 'id'
  | 'consent_type'
  | 'granted'
  | 'granted_at'
  | 'revoked_at'
  | 'policy_version'
  | 'source'
  | 'ip'
  | 'granted_by_representative'
>;

function mapConsentRow(row: ConsentSelectRow): ConsentRow {
  return {
    id: row.id,
    consentType: row.consent_type,
    typeLabel: CONSENT_TYPE_LABELS[row.consent_type] ?? row.consent_type,
    status: deriveStatus(row),
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
    policyVersion: row.policy_version,
    source: row.source,
    sourceLabel: CONSENT_SOURCE_LABELS[row.source] ?? row.source,
    ip: row.ip,
    grantedByRepresentative: row.granted_by_representative,
  };
}

/**
 * Un consentimiento revocado se muestra como tal aunque en su momento se otorgó:
 * la revocación es posterior y no borra el hecho, solo lo deja sin efecto.
 */
function deriveStatus(row: Pick<Consent, 'granted' | 'revoked_at'>): ConsentStatus {
  if (row.revoked_at) return 'revocado';
  return row.granted ? 'otorgado' : 'rechazado';
}
