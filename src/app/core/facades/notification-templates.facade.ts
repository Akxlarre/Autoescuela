import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import {
  extractUsedVariables,
  validateTemplateDraft,
} from '@core/utils/announcement-template.utils';
import type { TemplateDraft, TemplateRow } from '@core/models/ui/notification-template.model';

/** `notification_templates` es compartida; esto acota las plantillas de comunicado. */
const TEMPLATE_TYPE = 'announcement';

/**
 * Plantillas de comunicado (spec 0042-b).
 *
 * La tabla `notification_templates` existía desde el esquema original pero nunca se había
 * usado. Su RLS ya era la correcta para lo que hace falta —escriben solo los admin, leen
 * también las secretarías— así que esta facade no necesitó migración: **el rechazo a una
 * escritura de secretaría lo hace la base, no un `if` de acá** (AC4).
 */
@Injectable({ providedIn: 'root' })
export class NotificationTemplatesFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(ErrorSanitizerService);

  // ── Estado reactivo (privado) ──────────────────────────────────────────────
  private readonly _templates = signal<TemplateRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isSaving = signal(false);
  private readonly _error = signal<string | null>(null);

  /** SWR: abrir el compositor de nuevo no vuelve a mostrar skeleton. */
  private initialized = false;

  // ── Estado expuesto ────────────────────────────────────────────────────────
  readonly templates = this._templates.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();

  /** Solo las activas se ofrecen al redactar; las archivadas siguen existiendo. */
  readonly activeTemplates = computed(() => this._templates().filter((t) => t.active));

  clearError(): void {
    this._error.set(null);
  }

  // ── Carga (SWR) ────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) {
      await this.refreshSilently();
      return;
    }
    this.initialized = true;

    this._isLoading.set(true);
    try {
      await this.fetchTemplates();
    } catch (err) {
      this.setError(err, 'No se pudieron cargar las plantillas.');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchTemplates();
    } catch {
      // Fail silencioso: la lista stale sirve más que un error en pantalla.
    }
  }

  private async fetchTemplates(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('notification_templates')
      .select('id, name, subject, body, active')
      .order('name', { ascending: true });

    if (error) throw error;

    this._templates.set(
      (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        subject: row.subject ?? '',
        body: row.body ?? '',
        active: row.active ?? true,
        usedVariables: extractUsedVariables(row.body ?? ''),
      })),
    );
  }

  // ── Mutaciones (solo admin: lo hace cumplir la RLS) ────────────────────────

  async save(draft: TemplateDraft): Promise<boolean> {
    const validation = validateTemplateDraft(draft);
    if (!validation.valid) {
      this._error.set('Completá nombre, asunto y mensaje de la plantilla.');
      return false;
    }

    this._isSaving.set(true);
    this._error.set(null);

    const payload = {
      name: draft.name.trim(),
      subject: draft.subject.trim(),
      body: draft.body.trim(),
      active: draft.active,
      type: TEMPLATE_TYPE,
    };

    try {
      const { error } =
        draft.id === null
          ? await this.supabase.client.from('notification_templates').insert(payload)
          : await this.supabase.client
              .from('notification_templates')
              .update(payload)
              .eq('id', draft.id);

      if (error) throw error;

      this.toast.success(draft.id === null ? 'Plantilla creada.' : 'Plantilla actualizada.');
      await this.refreshSilently();
      return true;
    } catch (err) {
      this.setError(err, 'No se pudo guardar la plantilla.');
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async remove(templateId: number): Promise<boolean> {
    this._error.set(null);

    try {
      const { error } = await this.supabase.client
        .from('notification_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      this.toast.success('Plantilla eliminada.');
      await this.refreshSilently();
      return true;
    } catch (err) {
      this.setError(err, 'No se pudo eliminar la plantilla.');
      return false;
    }
  }

  private setError(err: unknown, fallback: string): void {
    const sanitized = this.sanitizer.sanitize(err as Error);
    this._error.set(sanitized?.message ?? fallback);
    this.toast.error(fallback);
  }
}
