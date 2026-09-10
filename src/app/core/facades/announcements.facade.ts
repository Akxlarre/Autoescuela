import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import { ANNOUNCEMENT_BATCH_SIZE, buildBatches } from '@core/utils/announcement-recipients.utils';
import type {
  AnnouncementDraft,
  AnnouncementRow,
  SendProgress,
} from '@core/models/ui/announcement.model';

const EMPTY_PROGRESS: SendProgress = { total: 0, processed: 0, ok: 0, failed: 0 };

/**
 * Comunicado global a alumnos (spec 0041-b).
 *
 * Orquesta el envío por lotes y expone el historial. Lo que NO hace, a propósito:
 * resolver quién recibe el comunicado. Esta facade manda la definición del segmento y
 * la Edge Function `send-announcement` resuelve la lista contra la BD al enviar. Si el
 * cliente decidiera los destinatarios, un preview viejo podría alcanzar a alguien que
 * ya revocó su consentimiento promocional.
 */
@Injectable({ providedIn: 'root' })
export class AnnouncementsFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(ErrorSanitizerService);

  // ── Estado reactivo (privado) ──────────────────────────────────────────────
  private readonly _announcements = signal<AnnouncementRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isSending = signal(false);
  private readonly _progress = signal<SendProgress>(EMPTY_PROGRESS);
  private readonly _error = signal<string | null>(null);

  /** SWR: evita re-mostrar skeleton al volver a entrar a la pestaña. */
  private initialized = false;
  private readonly historialGuard = createRequestGuard();

  // ── Estado expuesto ────────────────────────────────────────────────────────
  readonly announcements = this._announcements.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSending = this._isSending.asReadonly();
  readonly progress = this._progress.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasAnnouncements = computed(() => this._announcements().length > 0);

  clearError(): void {
    this._error.set(null);
  }

  resetProgress(): void {
    this._progress.set(EMPTY_PROGRESS);
  }

  // ── Historial (SWR) ────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) {
      await this.refreshSilently();
      return;
    }
    this.initialized = true;

    this._isLoading.set(true);
    try {
      await this.fetchAnnouncements();
    } catch (err) {
      this.setError(err, 'No se pudo cargar el historial de comunicados.');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchAnnouncements();
    } catch {
      // Fail silencioso: los datos stale siguen siendo mejores que un error en pantalla.
    }
  }

  private async fetchAnnouncements(): Promise<void> {
    const requestToken = this.historialGuard.next();
    const branchId = this.branchFacade.selectedBranchId();

    let query = this.supabase.client
      .from('announcements')
      .select(
        'id, subject, kind, branch_id, sent_at, recipients_total, email_ok_count, email_failed_count, users:sent_by(first_names, paternal_last_name), branches:branch_id(name)',
      );

    // null = admin en "todas las sedes" → sin filtro.
    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { data, error } = await query.order('sent_at', { ascending: false, nullsFirst: true });
    if (error) throw error;

    if (!this.historialGuard.isCurrent(requestToken)) return;

    this._announcements.set((data ?? []).map((row: any) => this.toRow(row)));
  }

  private toRow(row: any): AnnouncementRow {
    const emisor = row.users;
    return {
      id: row.id,
      subject: row.subject,
      kind: row.kind,
      recipients_total: row.recipients_total,
      email_ok_count: row.email_ok_count,
      email_failed_count: row.email_failed_count,
      sentByName: emisor
        ? `${emisor.first_names} ${emisor.paternal_last_name}`.trim()
        : 'Desconocido',
      sentAt: row.sent_at,
      branchLabel: row.branches?.name ?? 'Todas las sedes',
    };
  }

  // ── Envío ──────────────────────────────────────────────────────────────────

  /**
   * Inserta el comunicado y despacha el envío en lotes secuenciales.
   *
   * El primer lote es el que materializa la lista de destinatarios en el servidor, y
   * su respuesta trae el total real — por eso los lotes siguientes recién se pueden
   * calcular después de esa primera llamada.
   */
  async send(draft: AnnouncementDraft): Promise<boolean> {
    this._isSending.set(true);
    this._error.set(null);
    this._progress.set(EMPTY_PROGRESS);

    try {
      const announcementId = await this.insertAnnouncement(draft);

      const first = await this.runBatch(announcementId, 0, ANNOUNCEMENT_BATCH_SIZE);
      const total = first?.recipientsTotal ?? 0;

      let ok = first?.sent ?? 0;
      let failed = first?.failed ?? 0;
      let processed = first?.processed ?? 0;
      this._progress.set({ total, processed, ok, failed });

      if (total === 0) {
        this.toast.error('El segmento no tiene destinatarios. No se envió el comunicado.');
        return false;
      }

      // El primer lote ya se procesó: se itera el resto.
      const pendientes = buildBatches(total, ANNOUNCEMENT_BATCH_SIZE).slice(1);

      for (const batch of pendientes) {
        const result = await this.runBatch(announcementId, batch.offset, batch.size);

        if (result === null) {
          // AC-E3 — un lote caído no aborta el comunicado: se cuenta como fallido y
          // se sigue. Cortar acá dejaría a la mitad del segmento sin el aviso y sin
          // registro de por qué.
          failed += batch.size;
          processed += batch.size;
        } else {
          ok += result.sent;
          failed += result.failed;
          processed += result.processed;
        }

        this._progress.set({ total, processed, ok, failed });
      }

      await this.closeAnnouncement(announcementId, ok, failed);
      await this.refreshSilently();

      if (failed > 0) {
        this.toast.error(`Comunicado enviado con ${failed} destinatario(s) fallido(s).`);
      } else {
        this.toast.success(`Comunicado enviado a ${ok} destinatario(s).`);
      }
      return true;
    } catch (err) {
      this.setError(err, 'No se pudo enviar el comunicado.');
      return false;
    } finally {
      this._isSending.set(false);
    }
  }

  private async insertAnnouncement(draft: AnnouncementDraft): Promise<number> {
    const user = this.authFacade.currentUser();

    // La secretaria queda fijada a su sede; el admin puede segmentar por una o por todas.
    const branchId = user?.role === 'admin' ? draft.filters.branchId : (user?.branchId ?? null);

    const { data, error } = await this.supabase.client
      .from('announcements')
      .insert({
        subject: draft.subject.trim(),
        body: draft.body.trim(),
        kind: draft.kind,
        branch_id: branchId,
        segment_filters: {
          courseType: draft.filters.courseType,
          enrollmentStatus: draft.filters.enrollmentStatus,
          branchId: draft.filters.branchId,
          excludedUserIds: draft.excludedUserIds,
        },
        sent_by: user?.dbId,
      })
      .select('id')
      .maybeSingle();

    if (error || !data) throw error ?? new Error('No se pudo registrar el comunicado.');
    return data.id;
  }

  /** Devuelve `null` si el lote falló, para que el llamador decida si sigue. */
  private async runBatch(
    announcementId: number,
    offset: number,
    batchSize: number,
  ): Promise<{
    recipientsTotal: number;
    processed: number;
    sent: number;
    failed: number;
  } | null> {
    const { data, error } = await this.supabase.client.functions.invoke('send-announcement', {
      body: { announcementId, offset, batchSize },
    });

    if (error || !data) return null;
    return data;
  }

  private async closeAnnouncement(id: number, ok: number, failed: number): Promise<void> {
    await this.supabase.client
      .from('announcements')
      .update({
        sent_at: new Date().toISOString(),
        email_ok_count: ok,
        email_failed_count: failed,
      })
      .eq('id', id);
  }

  private setError(err: unknown, fallback: string): void {
    const msg = err instanceof Error ? this.sanitizer.sanitize(err).message : fallback;
    this._error.set(msg);
    this.toast.error(msg);
  }
}
