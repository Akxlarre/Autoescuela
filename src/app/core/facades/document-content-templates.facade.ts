import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { ToastService } from '@core/services/ui/toast.service';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import type { DocumentType } from '@core/models/dto/document-template.model';
import {
  DOCUMENT_TEMPLATE_SECTIONS,
  DOCUMENT_TYPE_LABELS,
  type DocumentTemplateForm,
  type DocumentTemplateSection,
} from '@core/models/ui/document-content-template.model';

/**
 * Cada tipo de documento lo genera una Edge Function distinta (spec 0016-m). Los tipos de
 * contrato comparten la misma función (distinguen internamente por `document_type` en el body);
 * los certificados tienen una función propia cada uno, así que no necesitan ese campo.
 */
const EDGE_FUNCTION_BY_DOCUMENT_TYPE: Record<DocumentType, string> = {
  contract_b: 'generate-contract-pdf',
  contract_professional: 'generate-contract-pdf',
  certificate_b: 'generate-certificate-b-pdf',
  certificate_professional: 'generate-certificate-professional-pdf',
};

/**
 * DocumentContentTemplatesFacade — dominio del editor de contenido de contratos/certificados
 * (spec 0016-m). No es branch-scoped en el sentido de `facades.md` §7 (no lee
 * `BranchFacade.selectedBranchId()`): la sede a editar la elige el propio selector del editor,
 * igual que `WebsiteConfigFacade.loadConfig(branchId)` — el branchId se recibe explícito en cada
 * método, no se infiere del filtro global de sede del panel admin.
 */
@Injectable({ providedIn: 'root' })
export class DocumentContentTemplatesFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly toast = inject(ToastService);

  private readonly loadGuard = createRequestGuard();

  // ── 1. ESTADO REACTIVO (Privado) ──────────────────────────────────────────
  private readonly _form = signal<DocumentTemplateForm | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _isPublishing = signal(false);
  private readonly _isGeneratingPreview = signal(false);
  private readonly _error = signal<string | null>(null);

  // ── 2. ESTADO EXPUESTO (Público, Solo lectura) ────────────────────────────
  readonly form = this._form.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isPublishing = this._isPublishing.asReadonly();
  readonly isGeneratingPreview = this._isGeneratingPreview.asReadonly();
  readonly error = this._error.asReadonly();

  // ── 3. MÉTODOS DE ACCIÓN ───────────────────────────────────────────────────

  /** Carga el contenido guardado de una sede+tipo y lo mapea a las secciones editables de ese
   * tipo de documento (AC1). Sede/tipo sin fila (AC-E1): arma el form igual, con `body: ''` en
   * cada sección — el admin parte de cero, la Edge Function sigue teniendo su propio fallback
   * hardcodeado para lo que aún no se haya publicado. */
  async load(branchId: number, documentType: DocumentType): Promise<void> {
    const requestToken = this.loadGuard.next();
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client
        .from('document_templates')
        .select('content')
        .eq('branch_id', branchId)
        .eq('document_type', documentType)
        .maybeSingle();

      if (error) throw error;
      if (!this.loadGuard.isCurrent(requestToken)) return;

      const savedContent = (data?.content as Record<string, string>) ?? {};
      const sections: DocumentTemplateSection[] = DOCUMENT_TEMPLATE_SECTIONS[documentType].map(
        (meta) => ({ ...meta, body: savedContent[meta.id] ?? '' }),
      );
      this._form.set({ branchId, documentType, sections });
    } catch (err) {
      if (!this.loadGuard.isCurrent(requestToken)) return;
      const { message } = this.sanitizer.sanitize(err);
      this._error.set(message);
      this.toast.error('Error al cargar la plantilla', message);
    } finally {
      if (this.loadGuard.isCurrent(requestToken)) this._isLoading.set(false);
    }
  }

  /** Actualiza el texto en memoria de una sección (sin persistir) — la UI llama esto en cada
   * cambio del campo, `publish()`/`preview()` recién leen el estado acumulado. */
  updateSection(sectionId: string, body: string): void {
    const form = this._form();
    if (!form) return;
    this._form.set({
      ...form,
      sections: form.sections.map((s) => (s.id === sectionId ? { ...s, body } : s)),
    });
  }

  /** Publica el contenido actual del form (AC3) — UPSERT sobre `document_templates`, sin tocar
   * código ni Edge Function. El próximo documento real generado ya lee este contenido. */
  async publish(): Promise<boolean> {
    const form = this._form();
    if (!form) return false;

    this._isPublishing.set(true);
    this._error.set(null);

    try {
      const { error } = await this.supabase.client.from('document_templates').upsert(
        {
          branch_id: form.branchId,
          document_type: form.documentType,
          name: DOCUMENT_TYPE_LABELS[form.documentType],
          content: this.sectionsToContent(form.sections),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'branch_id,document_type' },
      );

      if (error) throw error;

      this.toast.success(
        'Plantilla publicada',
        'Los próximos documentos generados usarán este contenido.',
      );
      return true;
    } catch (err) {
      const { message } = this.sanitizer.sanitize(err);
      this._error.set(message);
      this.toast.error('Error al publicar la plantilla', message);
      return false;
    } finally {
      this._isPublishing.set(false);
    }
  }

  /** Vista previa con el contenido EN BORRADOR del form actual (AC2) — nunca persiste nada, la
   * Edge Function responde `{ pdfBase64 }` con datos de un alumno ficticio. */
  async preview(): Promise<string | null> {
    const form = this._form();
    if (!form) return null;
    return this.generatePdfBase64(
      form.branchId,
      form.documentType,
      'preview',
      this.sectionsToContent(form.sections),
    );
  }

  /** Vista de solo lectura del documento ya PUBLICADO (AC-E2) — mismo mecanismo, pero sin
   * borrador: la Edge Function lee el `content` real de `document_templates`. */
  async viewPublished(branchId: number, documentType: DocumentType): Promise<string | null> {
    return this.generatePdfBase64(branchId, documentType, 'sample');
  }

  clearError(): void {
    this._error.set(null);
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private async generatePdfBase64(
    branchId: number,
    documentType: DocumentType,
    mode: 'preview' | 'sample',
    content?: Record<string, string>,
  ): Promise<string | null> {
    this._isGeneratingPreview.set(true);
    this._error.set(null);

    try {
      const fnName = EDGE_FUNCTION_BY_DOCUMENT_TYPE[documentType];
      const isContract = documentType === 'contract_b' || documentType === 'contract_professional';
      const body: Record<string, unknown> = { mode, branch_id: branchId };
      if (isContract) body['document_type'] = documentType;
      if (mode === 'preview') body['content'] = content ?? {};

      const { data, error } = await this.supabase.client.functions.invoke(fnName, { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data?.pdfBase64 ?? null;
    } catch (err) {
      const { message } = this.sanitizer.sanitize(err);
      this._error.set(message);
      this.toast.error('Error al generar la vista previa', message);
      return null;
    } finally {
      this._isGeneratingPreview.set(false);
    }
  }

  private sectionsToContent(sections: DocumentTemplateSection[]): Record<string, string> {
    return Object.fromEntries(sections.map((s) => [s.id, s.body]));
  }
}
