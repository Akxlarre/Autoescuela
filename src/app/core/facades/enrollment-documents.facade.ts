import { computed, inject, Injectable, signal } from '@angular/core';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';

import type { StudentDocument } from '@core/models/dto/student-document.model';
import type {
  CarnetPhoto,
  CameraState,
  PhotoTab,
  DocumentType,
  DocumentRequirement,
  HvcValidation,
  UploadedDocument,
} from '@core/models/ui/enrollment-documents.model';
import { PROFESSIONAL_DOCUMENTS, HVC_MAX_DAYS } from '@core/models/ui/enrollment-documents.model';
import type { CourseCategory } from '@core/models/ui/enrollment-personal-data.model';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

// ─── Constantes internas ───

const MINOR_DOCUMENT: DocumentRequirement = {
  type: 'autorizacion_notarial',
  label: 'Autorización Notarial',
  hint: 'requerida para menores de 18 años',
  required: true,
  acceptedFormats: '.pdf,.jpg,.png',
  maxSizeMb: 5,
  hasIssueDate: false,
};

const STORAGE_BUCKET = 'documents';

/**
 * EnrollmentDocumentsFacade — Maneja Step 3 del wizard de matrícula.
 *
 * Responsabilidades:
 * - Gestión local de foto carnet (captura de cámara o upload)
 * - Upload de documentos profesionales (HVC, cédula, licencia)
 * - Upload de autorización notarial para menores
 * - Persistencia en Supabase Storage + tabla student_documents
 * - Validación de antigüedad HVC (RF-082.3)
 * - Carga de documentos existentes para re-edición de draft
 */
@Injectable({ providedIn: 'root' })
export class EnrollmentDocumentsFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. ESTADO REACTIVO (Privado)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Carnet photo ──
  private readonly _carnetPhoto = signal<CarnetPhoto | null>(null);
  private readonly _cameraState = signal<CameraState>('idle');
  private readonly _photoTab = signal<PhotoTab>('upload');

  // ── Documents ──
  private readonly _documents = signal<Map<DocumentType, UploadedDocument>>(new Map());
  private readonly _hvcValidation = signal<HvcValidation | null>(null);

  // ── Persisted document records (from student_documents table) ──
  private readonly _persistedDocs = signal<StudentDocument[]>([]);

  // ── Foto de matrícula anterior (re-matrícula, fix-020) ──
  /** Path en Storage de la foto de una matrícula previa, mostrada como preview. */
  private readonly _previousPhotoPath = signal<string | null>(null);
  /** true mientras la foto mostrada es la anterior y aún no se confirma/reemplaza. */
  private readonly _photoNeedsConfirmation = signal<boolean>(false);

  // ── UI state ──
  private readonly _isUploading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. ESTADO EXPUESTO (Público, solo lectura)
  // ══════════════════════════════════════════════════════════════════════════════

  readonly carnetPhoto = this._carnetPhoto.asReadonly();
  readonly cameraState = this._cameraState.asReadonly();
  readonly photoTab = this._photoTab.asReadonly();
  readonly documents = this._documents.asReadonly();
  readonly hvcValidation = this._hvcValidation.asReadonly();
  readonly persistedDocs = this._persistedDocs.asReadonly();
  readonly isUploading = this._isUploading.asReadonly();
  readonly error = this._error.asReadonly();

  /** true = la foto visible viene de una matrícula anterior y debe confirmarse o reemplazarse (fix-020). */
  readonly photoNeedsConfirmation = this._photoNeedsConfirmation.asReadonly();

  // ── Computed: count of uploaded documents ──
  readonly uploadedCount = computed(() => {
    let count = this._documents().size;
    if (this._carnetPhoto()) count++;
    return count;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Carnet Photo
  // ══════════════════════════════════════════════════════════════════════════════

  setCameraState(state: CameraState): void {
    this._cameraState.set(state);
  }

  setPhotoTab(tab: PhotoTab): void {
    this._photoTab.set(tab);
  }

  setCarnetPhoto(photo: CarnetPhoto): void {
    this._carnetPhoto.set(photo);
    this._cameraState.set('captured');
  }

  clearCarnetPhoto(): void {
    this._carnetPhoto.set(null);
    this._cameraState.set('idle');
    this._photoNeedsConfirmation.set(false);
    this._previousPhotoPath.set(null);
  }

  /**
   * Precarga la foto de carnet de una matrícula ANTERIOR del mismo alumno (fix-020).
   *
   * Muestra esa foto como preview pero marca `photoNeedsConfirmation = true`: el
   * operador debe confirmarla (`confirmPreviousPhoto`) o subir una nueva antes de
   * avanzar. No copia ni registra nada todavía — solo display.
   *
   * No hace nada si la matrícula actual ya tiene foto propia, o si el alumno no
   * tiene ninguna foto previa. Devuelve true solo si cargó una foto anterior.
   */
  async loadPreviousPhoto(studentId: number, currentEnrollmentId: number): Promise<boolean> {
    // La matrícula actual ya tiene foto propia → nada que precargar.
    if (this._carnetPhoto()) return false;

    const { data, error } = await this.supabase.client
      .from('student_documents')
      .select('storage_url, file_name, uploaded_at, enrollments!inner(student_id)')
      .eq('type', 'id_photo')
      .eq('enrollments.student_id', studentId)
      .neq('enrollment_id', currentEnrollmentId)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.storage_url) return false;

    const { data: signed } = await this.supabase.client.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(data.storage_url, 3600);

    this._previousPhotoPath.set(data.storage_url);
    this._photoNeedsConfirmation.set(true);
    this._carnetPhoto.set({
      source: 'upload',
      capturedDataUrl: signed?.signedUrl ?? data.storage_url,
      fileName: data.file_name ?? 'foto-anterior.jpg',
    });
    return true;
  }

  /**
   * Confirma reutilizar la foto de la matrícula anterior (fix-020): copia el objeto
   * al destino de la matrícula nueva (`students/{enrollmentId}/id_photo`) y lo
   * registra en student_documents. Tras confirmar deja de requerir confirmación.
   */
  async confirmPreviousPhoto(enrollmentId: number): Promise<boolean> {
    const sourcePath = this._previousPhotoPath();
    if (!sourcePath) return false;

    this._isUploading.set(true);
    this._error.set(null);

    try {
      const destPath = `students/${enrollmentId}/id_photo`;

      if (sourcePath !== destPath) {
        const { error: copyError } = await this.supabase.client.storage
          .from(STORAGE_BUCKET)
          .copy(sourcePath, destPath);

        // Si el destino ya existía (re-confirmación), continuar con el upsert del registro.
        if (copyError && !/exist/i.test(copyError.message)) {
          this._error.set(
            'Error al reutilizar la foto: ' + this.sanitizer.sanitize(copyError).message,
          );
          return false;
        }
      }

      const { error: dbError } = await this.supabase.client.from('student_documents').upsert(
        {
          enrollment_id: enrollmentId,
          type: 'id_photo',
          file_name: 'foto-carnet.jpg',
          storage_url: destPath,
          status: 'approved',
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'enrollment_id,type' },
      );

      if (dbError) {
        this._error.set('Error al registrar la foto: ' + this.sanitizer.sanitize(dbError).message);
        return false;
      }

      this._previousPhotoPath.set(null);
      this._photoNeedsConfirmation.set(false);
      return true;
    } catch {
      this._error.set('Error inesperado al reutilizar la foto');
      return false;
    } finally {
      this._isUploading.set(false);
    }
  }

  /**
   * Sube la foto carnet al storage y registra en student_documents.
   * @param dataUrl - Base64 data URL de la imagen
   * @param fileName - Nombre del archivo
   * @param enrollmentId - ID de la matrícula (null = sin contexto)
   */
  async uploadCarnetPhoto(
    dataUrl: string,
    fileName: string,
    enrollmentId: number | null,
  ): Promise<boolean> {
    if (!enrollmentId) return false;

    this._isUploading.set(true);
    this._error.set(null);

    try {
      // Convert data URL to Blob
      const blob = this.dataUrlToBlob(dataUrl);
      // Fixed path so storage upsert always overwrites the same object.
      const filePath = `students/${enrollmentId}/id_photo`;

      // Upload to storage
      const { error: uploadError } = await this.supabase.client.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, blob, { upsert: true });

      if (uploadError) {
        this._error.set(
          'Error al subir foto carnet: ' + this.sanitizer.sanitize(uploadError).message,
        );
        return false;
      }

      // Upsert student_documents — guardamos el path relativo, no la URL pública.
      // El bucket es privado; las URLs firmadas se generan bajo demanda con TTL.
      const { error: dbError } = await this.supabase.client.from('student_documents').upsert(
        {
          enrollment_id: enrollmentId,
          type: 'id_photo',
          file_name: fileName,
          storage_url: filePath,
          status: 'approved',
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'enrollment_id,type' },
      );

      if (dbError) {
        this._error.set(
          'Error al registrar foto carnet: ' + this.sanitizer.sanitize(dbError).message,
        );
        return false;
      }

      // Para preview inmediato usamos el dataUrl original (ya está en memoria),
      // evitando llamar a Storage para un display que ya tenemos localmente.
      this._carnetPhoto.set({
        source: 'upload',
        capturedDataUrl: dataUrl,
        fileName: fileName,
      });

      // Reemplazo de la foto anterior: ya es una foto nueva confirmada (fix-020).
      this._photoNeedsConfirmation.set(false);
      this._previousPhotoPath.set(null);

      return true;
    } catch {
      this._error.set('Error inesperado al subir foto carnet');
      return false;
    } finally {
      this._isUploading.set(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Document Upload
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Sube un documento al storage y registra en student_documents.
   */
  async uploadDocument(
    type: DocumentType,
    file: File,
    enrollmentId: number | null,
    issueDate?: string | null,
  ): Promise<boolean> {
    if (!enrollmentId) return false;

    this._isUploading.set(true);
    this._error.set(null);

    try {
      // Path fijo por tipo (sin incluir file.name) para que upsert siempre
      // sobreescriba el mismo objeto en storage al reemplazar un documento.
      const filePath = `students/${enrollmentId}/${type}`;

      const { error: uploadError } = await this.supabase.client.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        this._error.set(
          'Error al subir documento: ' + this.sanitizer.sanitize(uploadError).message,
        );
        return false;
      }

      // Guardar path relativo en DB (no URL pública — bucket privado).
      const { error: dbError } = await this.supabase.client.from('student_documents').upsert(
        {
          enrollment_id: enrollmentId,
          type,
          file_name: file.name,
          storage_url: filePath,
          status: 'pending',
          document_issue_date: issueDate ?? null,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'enrollment_id,type' },
      );

      if (dbError) {
        this._error.set(
          'Error al registrar documento: ' + this.sanitizer.sanitize(dbError).message,
        );
        return false;
      }

      // Update local state
      const current = new Map(this._documents());
      current.set(type, {
        type,
        file,
        fileName: file.name,
        issueDate: issueDate ?? null,
      });
      this._documents.set(current);

      return true;
    } catch {
      this._error.set('Error inesperado al subir documento');
      return false;
    } finally {
      this._isUploading.set(false);
    }
  }

  /**
   * Elimina un documento del storage y de student_documents.
   */
  async removeDocument(type: DocumentType, enrollmentId: number): Promise<boolean> {
    this._isUploading.set(true);
    this._error.set(null);

    try {
      // Find the persisted doc to get the storage path
      const persisted = this._persistedDocs().find(
        (d) => d.type === type && d.enrollment_id === enrollmentId,
      );

      if (persisted) {
        // storage_url contiene el path relativo directamente tras la migración SQL.
        if (persisted.storage_url) {
          await this.supabase.client.storage.from(STORAGE_BUCKET).remove([persisted.storage_url]);
        }

        // Remove from DB
        const { error } = await this.supabase.client
          .from('student_documents')
          .delete()
          .eq('enrollment_id', enrollmentId)
          .eq('type', type);

        if (error) {
          this._error.set('Error al eliminar documento: ' + this.sanitizer.sanitize(error).message);
          return false;
        }
      }

      // Update local state
      const current = new Map(this._documents());
      current.delete(type);
      this._documents.set(current);

      // Refresh persisted docs
      await this.loadDocuments(enrollmentId);
      return true;
    } catch {
      this._error.set('Error inesperado al eliminar documento');
      return false;
    } finally {
      this._isUploading.set(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — HVC Validation
  // ══════════════════════════════════════════════════════════════════════════════

  /** Valida la antigüedad de la Hoja de Vida del Conductor (RF-082.3). */
  validateHvcDate(issueDateStr: string): void {
    const issueDate = new Date(issueDateStr);
    const today = new Date();
    const diffMs = today.getTime() - issueDate.getTime();
    const daysSinceIssue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const expired = daysSinceIssue > HVC_MAX_DAYS;

    this._hvcValidation.set({
      expired,
      daysSinceIssue,
      message: expired
        ? `La HVC tiene ${daysSinceIssue} días de antigüedad (máximo ${HVC_MAX_DAYS}). Debe renovarla.`
        : `HVC válida (${daysSinceIssue} días de antigüedad).`,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Load & Query
  // ══════════════════════════════════════════════════════════════════════════════

  /** Carga documentos existentes para un enrollment (re-edición de draft). */
  async loadDocuments(enrollmentId: number): Promise<void> {
    this._error.set(null);

    const { data, error } = await this.supabase.client
      .from('student_documents')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .order('uploaded_at');

    if (error) {
      this._error.set('Error al cargar documentos: ' + this.sanitizer.sanitize(error).message);
      return;
    }

    const docs = (data ?? []) as StudentDocument[];
    this._persistedDocs.set(docs);

    // Reset carnet photo before rebuilding — prevents stale photo from a prior
    // enrollment session persisting when the resumed draft has no id_photo yet.
    this._carnetPhoto.set(null);
    // El estado de la matrícula actual manda: limpiar la confirmación de foto
    // anterior (fix-020). Si esta matrícula tiene su propia foto, no hay nada que confirmar.
    this._photoNeedsConfirmation.set(false);
    this._previousPhotoPath.set(null);

    // Rebuild local document map from persisted records
    const docMap = new Map<DocumentType, UploadedDocument>();
    for (const doc of docs) {
      if (doc.type && doc.type !== 'id_photo') {
        docMap.set(doc.type as DocumentType, {
          type: doc.type as DocumentType,
          file: null as unknown as File, // File not available from DB, only metadata
          fileName: doc.file_name,
          issueDate: doc.document_issue_date ?? null,
        });
      }

      // Restaurar foto carnet: storage_url es ahora un path relativo →
      // generar signed URL (TTL 1h) para que el <img> pueda mostrarlo.
      if (doc.type === 'id_photo') {
        const { data: signedData } = await this.supabase.client.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(doc.storage_url, 3600);
        this._carnetPhoto.set({
          source: 'upload',
          capturedDataUrl: signedData?.signedUrl ?? doc.storage_url,
          fileName: doc.file_name,
        });
      }
    }
    this._documents.set(docMap);
  }

  /**
   * Marca docs_complete en la matrícula cuando todos los documentos requeridos están subidos.
   */
  async markDocsComplete(enrollmentId: number, complete: boolean): Promise<boolean> {
    const { error } = await this.supabase.client
      .from('enrollments')
      .update({
        docs_complete: complete,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    if (error) {
      this._error.set(
        'Error al actualizar estado de documentos: ' + this.sanitizer.sanitize(error).message,
      );
      return false;
    }
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Requirements
  // ══════════════════════════════════════════════════════════════════════════════

  /** Retorna los requisitos de documentos según la categoría del curso y si es menor. */
  getRequirements(courseCategory: CourseCategory, isMinor: boolean): DocumentRequirement[] {
    const reqs: DocumentRequirement[] = [];

    if (courseCategory === 'professional') {
      reqs.push(...PROFESSIONAL_DOCUMENTS);
    }

    if (isMinor) {
      reqs.push(MINOR_DOCUMENT);
    }

    return reqs;
  }

  /**
   * Verifica si todos los documentos requeridos han sido subidos.
   * Carnet photo siempre es requerida.
   */
  allRequiredUploaded(courseCategory: CourseCategory, isMinor: boolean): boolean {
    // Carnet photo is always required
    if (!this._carnetPhoto()) return false;

    const reqs = this.getRequirements(courseCategory, isMinor);
    const requiredTypes = reqs.filter((r) => r.required).map((r) => r.type);
    const uploaded = this._documents();

    return requiredTypes.every((type) => uploaded.has(type));
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 4. RESET & ERROR
  // ══════════════════════════════════════════════════════════════════════════════

  reset(): void {
    this._carnetPhoto.set(null);
    this._cameraState.set('idle');
    this._photoTab.set('upload');
    this._documents.set(new Map());
    this._hvcValidation.set(null);
    this._persistedDocs.set([]);
    this._previousPhotoPath.set(null);
    this._photoNeedsConfirmation.set(false);
    this._isUploading.set(false);
    this._error.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 5. MÉTODOS PRIVADOS
  // ══════════════════════════════════════════════════════════════════════════════

  /** Convierte un data URL (base64) a Blob para upload. */
  private dataUrlToBlob(dataUrl: string): Blob {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const byteString = atob(parts[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mime });
  }
}
