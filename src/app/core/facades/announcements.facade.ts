import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import {
  NO_BRANCH_SCOPE,
  canChooseBranch,
  resolveBranchScope,
} from '@core/utils/branch-scope.utils';
import { ANNOUNCEMENT_BATCH_SIZE, buildBatches } from '@core/utils/announcement-recipients.utils';
import { isScheduledForValid } from '@core/utils/announcement-template.utils';
import type {
  AnnouncementDraft,
  AnnouncementRow,
  RecipientPreview,
  RecipientSegmentFilters,
  SendProgress,
} from '@core/models/ui/announcement.model';
import type { AnnouncementKind } from '@core/models/dto/announcement.model';

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
  private readonly _preview = signal<RecipientPreview[]>([]);
  private readonly _isLoadingPreview = signal(false);
  private readonly _previewHtml = signal<string | null>(null);
  private readonly _isLoadingPreviewHtml = signal(false);
  private readonly _isLoading = signal(false);
  private readonly _isSending = signal(false);
  private readonly _progress = signal<SendProgress>(EMPTY_PROGRESS);
  private readonly _error = signal<string | null>(null);

  /** SWR: evita re-mostrar skeleton al volver a entrar a la pestaña. */
  private initialized = false;
  private readonly historialGuard = createRequestGuard();

  // ── Estado expuesto ────────────────────────────────────────────────────────
  readonly announcements = this._announcements.asReadonly();
  readonly preview = this._preview.asReadonly();
  readonly isLoadingPreview = this._isLoadingPreview.asReadonly();
  readonly previewHtml = this._previewHtml.asReadonly();
  readonly isLoadingPreviewHtml = this._isLoadingPreviewHtml.asReadonly();
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
    const branchId = this.branchScope();

    let query = this.supabase.client
      .from('announcements')
      .select(
        'id, subject, kind, branch_id, sent_at, status, scheduled_for, recipients_total, email_ok_count, email_failed_count, users:sent_by(first_names, paternal_last_name), branches:branch_id(name)',
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
      status: row.status,
      scheduledFor: row.scheduled_for,
      // Solo lo programado se cancela: uno en 'enviando' ya está saliendo, y cortarlo
      // a mitad dejaría a unos alumnos con el correo y a otros sin él.
      canCancel: row.status === 'programado',
    };
  }

  // ── Preview de destinatarios ───────────────────────────────────────────────

  /**
   * Resuelve el segmento para MOSTRARLO. Es informativo: la lista que vale la calcula
   * la Edge Function al enviar.
   *
   * Sí, esto duplica la resolución que ya vive en el servidor, y es a propósito: la
   * secretaria necesita ver a quién le va a llegar antes de confirmar, pero dejar que
   * esa lista decidiera el envío sería confiarle al cliente el filtro de consentimiento.
   */
  async loadPreview(filters: RecipientSegmentFilters, kind: AnnouncementKind): Promise<void> {
    this._isLoadingPreview.set(true);
    this._error.set(null);

    try {
      const branchId = this.effectiveBranchId(filters);

      let query = this.supabase.client
        .from('enrollments')
        .select(
          'students!inner(user_id, users!inner(id, first_names, paternal_last_name, email, active)), courses!inner(type), status, branch_id',
        );

      if (branchId !== null) query = query.eq('branch_id', branchId);
      if (filters.courseType) query = query.eq('courses.type', filters.courseType);
      if (filters.enrollmentStatus) query = query.eq('status', filters.enrollmentStatus);

      const { data, error } = await query;
      if (error) throw error;

      // Un alumno con dos matrículas es un destinatario, no dos.
      const byUserId = new Map<number, RecipientPreview>();
      for (const row of (data ?? []) as any[]) {
        const u = row.students?.users;
        if (!u?.active || byUserId.has(u.id)) continue;
        byUserId.set(u.id, {
          userId: u.id,
          name: `${u.first_names} ${u.paternal_last_name}`.trim(),
          email: u.email?.trim() ? u.email.trim() : null,
          included: true,
          exclusionReason: null,
        });
      }

      const recipients = [...byUserId.values()].sort((a, b) => a.name.localeCompare(b.name));

      if (kind === 'promocional') {
        const consented = await this.loadPromotionalConsentIds([...byUserId.keys()]);
        for (const recipient of recipients) {
          if (!consented.has(recipient.userId)) {
            recipient.included = false;
            recipient.exclusionReason = 'sin_consentimiento';
          }
        }
      }

      this._preview.set(recipients);
    } catch (err) {
      this._preview.set([]);
      this.setError(err, 'No se pudo resolver la lista de destinatarios.');
    } finally {
      this._isLoadingPreview.set(false);
    }
  }

  /** Ids con consentimiento promocional vigente, mirando el registro más reciente de cada uno. */
  private async loadPromotionalConsentIds(userIds: number[]): Promise<Set<number>> {
    if (userIds.length === 0) return new Set();

    const { data, error } = await this.supabase.client
      .from('consents')
      .select('user_id, granted, revoked_at, granted_at')
      .eq('consent_type', 'comunicaciones_promocionales')
      .in('user_id', userIds)
      .order('granted_at', { ascending: false });
    if (error) throw error;

    const vigentes = new Set<number>();
    const visto = new Set<number>();
    for (const row of (data ?? []) as any[]) {
      if (visto.has(row.user_id)) continue;
      visto.add(row.user_id);
      if (row.granted && row.revoked_at === null) vigentes.add(row.user_id);
    }
    return vigentes;
  }

  clearPreview(): void {
    this._preview.set([]);
  }

  /**
   * Scope de sede del historial y del segmento (fix-168-b).
   *
   * Delega en `resolveBranchScope()` en vez de decidir por rol acá. La versión escrita a
   * mano que había antes leía `selectedBranchId` para todos, y esa selección vive en
   * `localStorage` bajo una clave sin namespacing por usuario que nadie limpia al cerrar
   * sesión: una secretaria heredaba la sede que otro había elegido en ese navegador y su
   * historial quedaba vacío, sin error y sin selector con el que darse cuenta.
   *
   * `selected` se pasa aparte porque el historial no tiene filtros de segmento: lee la
   * sede del selector, mientras que el compositor lee la del draft.
   */
  private resolveScope(selected: number | null): number | null {
    const user = this.authFacade.currentUser();
    // Sin `canAccessBothBranches` a propósito: el grant de spec 0017 amplía lo que se
    // puede LEER, no lo que se puede escribir acá. La policy `insert_announcements`
    // exige `branch_id = auth_user_branch_id()` para todo rol `secretary`, con grant o
    // sin él, así que pasarle el grant al helper haría que el compositor mandara una
    // sede que la BD va a rechazar con 403.
    return resolveBranchScope(user?.role, user?.branchId, selected);
  }

  /**
   * Sede del historial. **No** usa `resolveBranchScope()` a propósito.
   *
   * En `announcements`, `branch_id IS NULL` significa "a todas las sedes", no "sin sede":
   * anclar a la secretaria con `eq(branch_id, la suya)` le escondería los comunicados que
   * administración mandó a todos y que llegaron a sus propios alumnos. Para ella el scope
   * correcto ya lo pone la RLS (`branch_visible`: su sede **o** NULL), así que el cliente
   * solo debe filtrar cuando hay un selector de sede real que respetar.
   */
  private branchScope(): number | null {
    const user = this.authFacade.currentUser();
    if (!canChooseBranch(user?.role, user?.canAccessBothBranches)) return null;
    return this.branchFacade.selectedBranchId();
  }

  /** Sede del segmento: la del draft para quien puede elegirla. */
  private effectiveBranchId(filters: RecipientSegmentFilters): number | null {
    return this.resolveScope(filters.branchId);
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
    const branchId = this.effectiveBranchId(draft.filters);

    // `NO_BRANCH_SCOPE` es un centinela para FILTRAR, no un valor para guardar: acá
    // `branch_id` es una FK, así que mandarlo produciría un error de integridad crudo en
    // vez de decir lo que pasa. Se corta antes, con el motivo real (fix-168-b).
    if (branchId === NO_BRANCH_SCOPE) {
      throw new Error(
        'Tu usuario no tiene una sede asignada. Pedile a administración que te la asigne.',
      );
    }

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
        template_id: draft.templateId,
        // `enviado` es el default de la columna, así que un envío inmediato no necesita
        // decir nada; programar sí.
        status: draft.scheduledFor ? 'programado' : 'enviado',
        scheduled_for: draft.scheduledFor,
      })
      .select('id')
      .maybeSingle();

    if (error || !data) throw error ?? new Error('No se pudo registrar el comunicado.');
    return data.id;
  }

  // ── Preview del correo (spec 0043-b) ───────────────────────────────────────

  /**
   * Pide a la Edge Function el HTML del correo tal como va a salir.
   *
   * El HTML lo arma el servidor, no el cliente: el wrapper de marca tiene una sola fuente
   * en `_shared/announcement-send.ts`, y duplicarlo acá haría que las dos versiones
   * divergieran en el primer cambio de diseño. Un preview que miente es peor que no tener
   * preview.
   *
   * Se mandan asunto y cuerpo **con los marcadores sin resolver**: el servidor los sustituye
   * con datos de ejemplo. Resolverlos acá mostraría algo distinto de lo que se persiste.
   */
  async loadPreviewHtml(draft: AnnouncementDraft): Promise<boolean> {
    if (draft.subject.trim().length === 0 || draft.body.trim().length === 0) {
      this._error.set('Escribí el asunto y el mensaje antes de previsualizar.');
      return false;
    }

    this._isLoadingPreviewHtml.set(true);
    this._error.set(null);
    this._previewHtml.set(null);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('send-announcement', {
        body: {
          previewOnly: true,
          preview: { subject: draft.subject, body: draft.body },
        },
      });

      if (error || !data?.html) throw error ?? new Error('No se pudo generar la vista previa.');

      this._previewHtml.set(data.html);
      return true;
    } catch (err) {
      this.setError(err, 'No se pudo generar la vista previa.');
      return false;
    } finally {
      this._isLoadingPreviewHtml.set(false);
    }
  }

  clearPreviewHtml(): void {
    this._previewHtml.set(null);
  }

  // ── Programación (spec 0042-b) ─────────────────────────────────────────────

  /**
   * Deja el comunicado agendado y NO envía nada: el dispatcher lo tomará cuando llegue la
   * hora. Se guardan los filtros del segmento, no una lista de destinatarios — la lista se
   * resuelve recién al enviar, así que quien revoque su consentimiento entre medio queda
   * fuera (AC6).
   */
  async schedule(draft: AnnouncementDraft): Promise<boolean> {
    if (!draft.scheduledFor) {
      this._error.set('Falta la fecha de envío. Para enviar ahora, usá "Enviar comunicado".');
      return false;
    }
    if (!isScheduledForValid(draft.scheduledFor)) {
      this._error.set('La fecha de envío tiene que ser futura.');
      return false;
    }

    this._isSending.set(true);
    this._error.set(null);

    try {
      await this.insertAnnouncement(draft);
      this.toast.success('Comunicado programado.');
      await this.refreshSilently();
      return true;
    } catch (err) {
      this.setError(err, 'No se pudo programar el comunicado.');
      return false;
    } finally {
      this._isSending.set(false);
    }
  }

  /**
   * Cancela un comunicado que todavía no salió. No borra la fila: queda como `cancelado`
   * porque es parte del registro de qué se decidió comunicar y qué no.
   *
   * El filtro por `status='programado'` no es redundante: sin él, cancelar podría pisar un
   * comunicado que el dispatcher ya empezó a despachar, y quedaría a mitad de camino con
   * unos alumnos avisados y otros no.
   */
  async cancelScheduled(announcementId: number): Promise<boolean> {
    this._error.set(null);

    try {
      const { error } = await this.supabase.client
        .from('announcements')
        .update({ status: 'cancelado' })
        .eq('id', announcementId)
        .eq('status', 'programado');

      if (error) throw error;

      this.toast.success('Comunicado cancelado.');
      await this.refreshSilently();
      return true;
    } catch (err) {
      this.setError(err, 'No se pudo cancelar el comunicado.');
      return false;
    }
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
