import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from './auth.facade';
import { BranchFacade } from './branch.facade';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import { buildStudentDisplayName, sortByPaternalLastNameAsc } from '@core/utils/student-name.util';
import { INSTRUCTOR_DOC_TYPES } from '@core/utils/instructor-doc-types.util';
import type {
  StudentWithDocsRow,
  DmsStudentDocRow,
  InstructorWithDocsRow,
  DmsInstructorDocRow,
  SchoolDocRow,
  TemplateCard,
  DmsKpis,
  TemplateCategory,
  UploadStudentDocPayload,
  UploadInstructorDocPayload,
  UploadSchoolDocPayload,
  UploadTemplatePayload,
} from '@core/models/ui/dms.model';
import { LayoutDrawerService } from '@core/services/ui/layout-drawer.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

// ─── Labels ──────────────────────────────────────────────────────────────────

const LABELS_TIPO_ALUMNO: Record<string, string> = {
  contrato: 'Contrato',
  contract: 'Contrato',
  id_photo: 'Foto (Carnet)',
  cedula_identidad: 'Cédula de Identidad',
  certificado_medico: 'Certificado Médico',
  hoja_vida_conductor: 'Hoja de Vida del Conductor',
  autorizacion_notarial: 'Autorización Notarial',
  certificado_antecedentes: 'Cert. Antecedentes',
  semep: 'SEMEP',
  carnet_inicial: 'Carnet Inicial (6 clases)',
  carnet_completo: 'Carnet Completo (12 clases)',
  // Legacy — quedan solo para mostrar documentos ya subidos con estas claves antiguas
  // (dms-upload-drawer.component.ts ya no las ofrece como opción, DG-038).
  foto_licencia: 'Foto Licencia (legacy)',
  hoja_vida: 'Hoja de Vida (legacy)',
  cedula: 'Cédula (legacy)',
  foto_carnet: 'Foto Carnet (legacy)',
};

// Única fuente de verdad del enum en @core/utils/instructor-doc-types.util.ts — reutilizado
// también por dms-upload-drawer y admin-instructor-crear-drawer.
const LABELS_TIPO_INSTRUCTOR: Record<string, string> = Object.fromEntries(
  INSTRUCTOR_DOC_TYPES.map((t) => [t.value, t.label]),
);

const LABELS_TIPO_ESCUELA: Record<string, string> = {
  factura_folios: 'Factura Folios',
  resolucion_mtt: 'Resolución MTT',
  decreto: 'Decreto',
  otro: 'Otro',
};

const LABELS_CATEGORIA_PLANTILLA: Record<string, string> = {
  clase_b: 'Clase B',
  clase_profesional: 'Clase Profesional',
  administrativo: 'Administrativo',
  general: 'General',
};

// ─── Raw Supabase types ───────────────────────────────────────────────────────

interface RawVDmsDoc {
  id: string;
  source: string;
  student_id: number;
  enrollment_id: number;
  type: string | null;
  file_name: string;
  file_url: string | null;
  status: string | null;
  document_at: string;
  managed_by: number | null;
}

interface RawBranch {
  name: string;
}

interface RawStudentUser {
  id: number;
  rut: string;
  first_names: string;
  paternal_last_name: string;
  maternal_last_name: string | null;
  branch_id: number | null;
  branches: RawBranch | RawBranch[] | null;
}

interface RawStudentEnrollment {
  number: string | null;
  created_at: string;
}

interface RawStudent {
  id: number;
  users: RawStudentUser | RawStudentUser[] | null;
  enrollments: RawStudentEnrollment[] | null;
}

interface RawInstructorUser {
  id: number;
  first_names: string;
  paternal_last_name: string;
  maternal_last_name: string | null;
  branches: RawBranch | RawBranch[] | null;
}

interface RawInstructor {
  id: number;
  license_number: string | null;
  users: RawInstructorUser | RawInstructorUser[] | null;
}

interface RawInstructorDoc {
  id: number;
  instructor_id: number;
  type: string;
  file_name: string;
  storage_url: string;
  status: string;
  created_at: string;
}

interface RawSchoolDoc {
  id: number;
  type: string;
  file_name: string;
  storage_url: string;
  description: string | null;
  branch_id: number | null;
  created_at: string;
  users:
    | { first_names: string; paternal_last_name: string }
    | { first_names: string; paternal_last_name: string }[]
    | null;
}

interface RawTemplate {
  id: number;
  name: string;
  description: string | null;
  category: string;
  format: string;
  version: string | null;
  file_url: string;
  download_count: number;
  active: boolean;
}

// ─── Facade ───────────────────────────────────────────────────────────────────

/**
 * DmsFacade — gestiona el Repositorio de Documentos (DMS).
 *
 * Patrón SWR (Stale-While-Revalidate):
 *   - Primera visita: skeleton + fetch
 *   - Re-visitas: render cacheado + refetch silencioso
 *
 * Cubre 3 dominios: Documentos del alumno, Documentos de la escuela, Plantillas.
 * NUNCA inyectar SupabaseService directamente en la UI.
 */
@Injectable({ providedIn: 'root' })
export class DmsFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly toast = inject(ToastService);
  private readonly dmsViewer = inject(DmsViewerService);

  showSuccess(summary: string, detail?: string): void {
    this.toast.success(summary, detail);
  }

  showError(summary: string, detail?: string): void {
    this.toast.error(summary, detail);
  }

  async confirm(config: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    severity?: 'info' | 'warn' | 'success' | 'danger' | 'secondary';
  }): Promise<boolean> {
    return this.confirmModal.confirm(config);
  }

  /**
   * Abre el visor de documentos generando una signed URL (TTL 1h) desde el
   * path relativo almacenado en DB. El bucket 'documents' es privado.
   */
  async openDocument(path: string, fileName?: string): Promise<void> {
    try {
      const url = await this.getSignedDocumentUrl(path);
      if (!url) throw new Error('No signed URL');
      this.dmsViewer.openByUrl(url, fileName || 'Documento');
    } catch {
      this.toast.error('No se pudo abrir el documento');
    }
  }

  /**
   * Obtiene la signed URL de un documento (TTL 1h) sin abrir el visor modal.
   * Utilizado para previsualización en línea (Split View).
   */
  async getSignedDocumentUrl(path: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.client.storage
        .from('documents')
        .createSignedUrl(path, 3600);
      if (error || !data) return null;
      return data.signedUrl;
    } catch {
      return null;
    }
  }

  /**
   * Cierra el drawer. Si hay historial de navegación interna (push/back —
   * ej. venimos de una previsualización o de subir un documento dentro del
   * drawer de lista), vuelve al nivel anterior en vez de cerrar todo.
   */
  closeDrawer(): void {
    if (this.layoutDrawer.canGoBack()) {
      this.layoutDrawer.back();
    } else {
      this.layoutDrawer.close();
    }
  }

  // ── Estado Privado ───────────────────────────────────────────────────────────

  private readonly _studentsWithDocs = signal<StudentWithDocsRow[]>([]);
  private readonly _recentDocs = signal<DmsStudentDocRow[]>([]);
  private readonly _schoolDocs = signal<SchoolDocRow[]>([]);
  private readonly _templates = signal<TemplateCard[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;

  // Sub-ruta: detalle de alumno
  private readonly _studentDetail = signal<{ name: string; rut: string; studentId: number } | null>(
    null,
  );
  private readonly _studentDocs = signal<DmsStudentDocRow[]>([]);
  private readonly _studentDocsLoading = signal(false);

  // Sub-ruta: detalle de instructor
  private readonly _instructorsWithDocs = signal<InstructorWithDocsRow[]>([]);
  private readonly _instructorDetail = signal<{
    name: string;
    licenseNumber: string;
    instructorId: number;
  } | null>(null);
  private readonly _instructorDocs = signal<DmsInstructorDocRow[]>([]);
  private readonly _instructorDocsLoading = signal(false);

  // Estado para el Drawer dinámico
  private readonly _currentUploadMode = signal<'student' | 'school' | 'instructor'>('student');
  private readonly _preselectedStudentId = signal<number | null>(null);
  private readonly _preselectedInstructorId = signal<number | null>(null);
  private readonly _uploadSaved = signal<boolean>(false);

  // Previsualización de documento dentro del drawer (push sobre la lista)
  private readonly _previewDoc = signal<{
    url: string;
    name: string;
    type: 'pdf' | 'image' | 'unknown';
  } | null>(null);
  private readonly _previewDocLoading = signal(false);

  // ── Estado Público ───────────────────────────────────────────────────────────

  readonly studentsWithDocs = this._studentsWithDocs.asReadonly();
  readonly recentDocs = this._recentDocs.asReadonly();
  readonly schoolDocs = this._schoolDocs.asReadonly();
  readonly templates = this._templates.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly studentDetail = this._studentDetail.asReadonly();
  readonly studentDocs = this._studentDocs.asReadonly();
  readonly studentDocsLoading = this._studentDocsLoading.asReadonly();

  readonly instructorsWithDocs = this._instructorsWithDocs.asReadonly();
  readonly instructorDetail = this._instructorDetail.asReadonly();
  readonly instructorDocs = this._instructorDocs.asReadonly();
  readonly instructorDocsLoading = this._instructorDocsLoading.asReadonly();

  readonly currentUploadMode = this._currentUploadMode.asReadonly();
  readonly preselectedStudentId = this._preselectedStudentId.asReadonly();
  readonly preselectedInstructorId = this._preselectedInstructorId.asReadonly();
  readonly uploadSaved = this._uploadSaved.asReadonly();

  readonly previewDoc = this._previewDoc.asReadonly();
  readonly previewDocLoading = this._previewDocLoading.asReadonly();

  readonly kpis = computed(
    (): DmsKpis => ({
      totalStudentDocs: this._recentDocs().length, // proxy; backend contaría mejor
      totalSchoolDocs: this._schoolDocs().length,
      totalTemplates: this._templates().length,
      recentUploads: this._studentsWithDocs().reduce((acc, s) => acc + s.docCount, 0),
    }),
  );

  // ── Métodos de Acción ────────────────────────────────────────────────────────

  /**
   * Initialize con SWR: primera visita carga con skeleton;
   * re-visitas revalidan silenciosamente.
   */
  async initialize(): Promise<void> {
    const branchId = this.getActiveBranchId();

    if (this._initialized && branchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }

    this._initialized = true;
    this._lastBranchId = branchId;
    this._isLoading.set(true);
    this._error.set(null);
    await this.fetchAllData();
    this._isLoading.set(false);
  }

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  async refreshSilently(): Promise<void> {
    await this.fetchAllData();
  }

  /**
   * Abre el drawer de subida de documentos integrado en el layout.
   */
  openUpload(mode: 'student' | 'school' | 'instructor', preselectedId: number | null = null): void {
    this._currentUploadMode.set(mode);
    this._preselectedStudentId.set(mode === 'student' ? preselectedId : null);
    this._preselectedInstructorId.set(mode === 'instructor' ? preselectedId : null);
    this._uploadSaved.set(false);

    // Importación dinámica para evitar ciclos circulares si fuera necesario,
    // pero aquí usaremos el componente directamente (se cargará al abrir el drawer).
    // Nota: El componente se llamará DmsUploadDrawerComponent por ahora,
    // pero actuará como contenido puro.
    // push(): si ya hay un drawer abierto (ej. la lista de docs de un alumno/instructor),
    // apila el de subida encima y "Cancelar"/guardar exitoso vuelven a la lista (closeDrawer()
    // es "smart" — back si hay historial). Si no hay nada abierto, push() actúa como open().
    import('../../features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component').then(
      (m) => {
        const title =
          mode === 'student'
            ? 'Subir documento de alumno'
            : mode === 'instructor'
              ? 'Subir documento de instructor'
              : 'Subir documento institucional';
        this.layoutDrawer.push(m.DmsUploadDrawerComponent, title, 'upload');
      },
    );
  }

  /**
   * Abre el drawer para crear una nueva plantilla.
   */
  openTemplate(): void {
    import('../../features/admin/documentos/dms-template-drawer/dms-template-drawer.component').then(
      (m) => {
        this.layoutDrawer.open(
          m.DmsTemplateDrawerComponent,
          'Nueva plantilla institucional',
          'folder',
        );
      },
    );
  }

  /**
   * Abre el drawer con la lista de documentos de un alumno (reemplaza la antigua
   * subruta de página completa /documentos/alumnos/:id). Usa push(): si ya hay un drawer
   * abierto (ej. Ver/Editar Alumno), se apila encima y el back button del header regresa a
   * él; si no hay nada abierto, push() degrada a open() (entrada directa desde DMS).
   */
  openStudentDocsDrawer(studentId: number, name: string): void {
    void this.loadStudentDocuments(studentId);
    import('../../features/admin/documentos/dms-student-docs-drawer/dms-student-docs-drawer.component').then(
      (m) => {
        this.layoutDrawer.push(m.DmsStudentDocsDrawerComponent, name, 'user');
      },
    );
  }

  /**
   * Abre el drawer con la lista de documentos de un instructor (spec 0003-m). Mismo push()
   * que openStudentDocsDrawer — permite abrirlo apilado desde Ver/Editar/Crear Instructor.
   */
  openInstructorDocsDrawer(instructorId: number, name: string): void {
    void this.loadInstructorDocuments(instructorId);
    import('../../features/admin/documentos/dms-instructor-docs-drawer/dms-instructor-docs-drawer.component').then(
      (m) => {
        this.layoutDrawer.push(m.DmsInstructorDocsDrawerComponent, name, 'shield-check');
      },
    );
  }

  /**
   * Previsualiza un documento apilando (push) un sub-drawer sobre la lista actual.
   * El botón "volver" del header del drawer (LayoutDrawerService.canGoBack) regresa
   * a la lista sin cerrar todo el panel.
   */
  openDocPreview(path: string | null, fileName: string): void {
    if (!path) return;
    void this.previewDocument(path, fileName);
    import('../../features/admin/documentos/dms-doc-preview-drawer/dms-doc-preview-drawer.component').then(
      (m) => {
        this.layoutDrawer.push(m.DmsDocPreviewDrawerComponent, fileName, 'eye');
      },
    );
  }

  private async previewDocument(path: string, fileName: string): Promise<void> {
    this._previewDoc.set(null);
    this._previewDocLoading.set(true);
    try {
      const signedUrl = await this.getSignedDocumentUrl(path);
      if (!signedUrl) throw new Error('No se pudo obtener URL');

      const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
      let type: 'pdf' | 'image' | 'unknown' = 'unknown';
      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
        type = 'image';
      } else if (ext === 'pdf') {
        type = 'pdf';
      }

      this._previewDoc.set({ url: signedUrl, name: fileName, type });
    } catch {
      this.toast.error('No se pudo cargar la vista previa del documento');
    } finally {
      this._previewDocLoading.set(false);
    }
  }

  /**
   * Notifica que se ha guardado un documento (llamado desde el drawer).
   */
  notifyUploadSaved(): void {
    const studentId = this._preselectedStudentId();
    const instructorId = this._preselectedInstructorId();
    this._uploadSaved.set(true);
    void this.initialize();
    if (studentId) {
      void this.loadStudentDocuments(studentId);
    }
    if (instructorId) {
      void this.loadInstructorDocuments(instructorId);
    }
  }

  // ── Tab 1 — Documentos del Alumno ───────────────────────────────────────────

  async loadStudentDocuments(studentId: number): Promise<void> {
    this._studentDocsLoading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('v_dms_student_documents')
        .select('*')
        .eq('student_id', studentId)
        .order('document_at', { ascending: false });

      if (error) throw error;

      const docs = (data ?? []) as unknown as RawVDmsDoc[];
      // Obtener info del alumno
      if (docs.length > 0) {
        const { data: studentData } = await this.supabase.client
          .from('students')
          .select('id, users!inner(id, rut, first_names, paternal_last_name, maternal_last_name)')
          .eq('id', studentId)
          .single();

        const rawStudent = studentData as unknown as RawStudent | null;
        const user = rawStudent
          ? Array.isArray(rawStudent.users)
            ? rawStudent.users[0]
            : rawStudent.users
          : null;
        if (user) {
          this._studentDetail.set({
            name: buildStudentDisplayName({
              firstNames: user.first_names,
              paternalLastName: user.paternal_last_name,
              maternalLastName: user.maternal_last_name,
            }),
            rut: user.rut,
            studentId,
          });
        }
        this._studentDocs.set(docs.map((d) => this.mapVDocToStudentDocRow(d, user)));
      } else {
        // Sin docs: cargar solo info de alumno
        const { data: studentData } = await this.supabase.client
          .from('students')
          .select('id, users!inner(id, rut, first_names, paternal_last_name, maternal_last_name)')
          .eq('id', studentId)
          .single();
        const rawStudent = studentData as unknown as RawStudent | null;
        const user = rawStudent
          ? Array.isArray(rawStudent.users)
            ? rawStudent.users[0]
            : rawStudent.users
          : null;
        if (user) {
          this._studentDetail.set({
            name: buildStudentDisplayName({
              firstNames: user.first_names,
              paternalLastName: user.paternal_last_name,
              maternalLastName: user.maternal_last_name,
            }),
            rut: user.rut,
            studentId,
          });
        }
        this._studentDocs.set([]);
      }
    } catch (err) {
      this._error.set(
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al cargar documentos del alumno',
      );
    } finally {
      this._studentDocsLoading.set(false);
    }
  }

  async uploadStudentDocument(payload: UploadStudentDocPayload): Promise<void> {
    const ext = payload.file.name.split('.').pop() ?? 'pdf';
    const path = `student-docs/${payload.studentId}/${Date.now()}_${payload.type}.${ext}`;

    const { error: uploadError } = await this.supabase.client.storage
      .from('documents')
      .upload(path, payload.file, { upsert: true });
    if (uploadError) throw uploadError;

    let enrollmentId = payload.enrollmentId;

    // Si no viene enrollmentId (o es dummy 0), buscamos el último del alumno
    if (!enrollmentId || enrollmentId <= 0) {
      const { data: enrollmentData, error: enrollmentError } = await this.supabase.client
        .from('enrollments')
        .select('id')
        .eq('student_id', payload.studentId)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (enrollmentError) throw enrollmentError;
      if (!enrollmentData) {
        throw new Error('El alumno no tiene ninguna matrícula activa para asociar el documento.');
      }
      enrollmentId = enrollmentData.id;
    }

    const { error: insertError } = await this.supabase.client.from('student_documents').insert({
      enrollment_id: enrollmentId,
      type: payload.type,
      file_name: payload.file.name,
      storage_url: path,
      status: 'pending',
    });
    if (insertError) throw insertError;

    await this.refreshSilently();
  }

  async deleteStudentDocument(
    docId: string,
    source: 'student_document' | 'digital_contract' | 'enrollment_license',
  ): Promise<void> {
    if (source === 'enrollment_license') {
      // Fila sintética derivada de enrollments.license_*_url — no existe como registro
      // propio que borrar. El carnet se regenera/reemplaza desde la ficha del alumno.
      throw new Error('El Carnet no se puede eliminar desde el DMS. Ve a la ficha del alumno.');
    }
    const table = source === 'student_document' ? 'student_documents' : 'digital_contracts';
    const numericId = parseInt(docId, 10);
    const { error } = await this.supabase.client.from(table).delete().eq('id', numericId);
    if (error) throw error;
    await this.refreshSilently();
  }

  // ── Tab 4 — Documentos del Instructor ───────────────────────────────────────

  async loadInstructorDocuments(instructorId: number): Promise<void> {
    this._instructorDocsLoading.set(true);
    try {
      const { data: instructorData } = await this.supabase.client
        .from('instructors')
        .select(
          'id, license_number, users!inner(id, first_names, paternal_last_name, maternal_last_name)',
        )
        .eq('id', instructorId)
        .single();

      const rawInstructor = instructorData as unknown as RawInstructor | null;
      const user = rawInstructor
        ? Array.isArray(rawInstructor.users)
          ? rawInstructor.users[0]
          : rawInstructor.users
        : null;
      const instructorName = user
        ? [user.first_names, user.paternal_last_name, user.maternal_last_name]
            .map((p) => p?.trim() ?? '')
            .filter(Boolean)
            .join(' ')
        : 'Instructor';

      if (rawInstructor) {
        this._instructorDetail.set({
          name: instructorName,
          licenseNumber: rawInstructor.license_number ?? '',
          instructorId,
        });
      }

      const { data, error } = await this.supabase.client
        .from('instructor_documents')
        .select('id, instructor_id, type, file_name, storage_url, status, created_at')
        .eq('instructor_id', instructorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const docs = (data ?? []) as unknown as RawInstructorDoc[];
      this._instructorDocs.set(docs.map((d) => this.mapRawToInstructorDocRow(d, instructorName)));
    } catch (err) {
      this._error.set(
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al cargar documentos del instructor',
      );
    } finally {
      this._instructorDocsLoading.set(false);
    }
  }

  async uploadInstructorDocument(payload: UploadInstructorDocPayload): Promise<void> {
    const ext = payload.file.name.split('.').pop() ?? 'pdf';
    const path = `instructor-docs/${payload.instructorId}/${Date.now()}_${payload.type}.${ext}`;

    const { error: uploadError } = await this.supabase.client.storage
      .from('documents')
      .upload(path, payload.file, { upsert: true });
    if (uploadError) throw uploadError;

    const sessionRes = await this.supabase.client.auth.getUser();
    const authUid = sessionRes.data.user?.id;

    let numericUserId: number | null = null;
    if (authUid) {
      const { data: userData } = await this.supabase.client
        .from('users')
        .select('id')
        .eq('supabase_uid', authUid)
        .single();
      numericUserId = (userData as { id: number } | null)?.id ?? null;
    }

    const { error: insertError } = await this.supabase.client.from('instructor_documents').insert({
      instructor_id: payload.instructorId,
      type: payload.type,
      file_name: payload.file.name,
      storage_url: path,
      status: 'pending',
      uploaded_by: numericUserId,
    });
    if (insertError) throw insertError;

    await this.refreshSilently();
  }

  async deleteInstructorDocument(docId: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('instructor_documents')
      .delete()
      .eq('id', docId);
    if (error) throw error;
    await this.refreshSilently();
  }

  // ── Tab 2 — Documentos de la Escuela ────────────────────────────────────────

  async uploadSchoolDocument(payload: UploadSchoolDocPayload): Promise<void> {
    const ext = payload.file.name.split('.').pop() ?? 'pdf';
    const path = `school-docs/${Date.now()}_${payload.type}.${ext}`;

    const { error: uploadError } = await this.supabase.client.storage
      .from('documents')
      .upload(path, payload.file, { upsert: true });
    if (uploadError) throw uploadError;

    const sessionRes = await this.supabase.client.auth.getUser();
    const userId = sessionRes.data.user?.id;

    // Obtener numeric user id
    let numericUserId: number | null = null;
    if (userId) {
      const { data: userData } = await this.supabase.client
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .single();
      numericUserId = (userData as { id: number } | null)?.id ?? null;
    }

    const { error: insertError } = await this.supabase.client.from('school_documents').insert({
      type: payload.type,
      file_name: payload.file.name,
      storage_url: path,
      description: payload.description ?? null,
      uploaded_by: numericUserId,
    });
    if (insertError) throw insertError;

    await this.refreshSilently();
  }

  async deleteSchoolDocument(docId: number): Promise<void> {
    const { error } = await this.supabase.client.from('school_documents').delete().eq('id', docId);
    if (error) throw error;
    await this.refreshSilently();
  }

  // ── Tab 3 — Plantillas ───────────────────────────────────────────────────────

  async uploadTemplate(payload: UploadTemplatePayload): Promise<void> {
    const ext = payload.file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
    const path = `templates/${Date.now()}_${payload.name.replace(/\s+/g, '_')}.${ext}`;

    const { error: uploadError } = await this.supabase.client.storage
      .from('documents')
      .upload(path, payload.file, { upsert: false });
    if (uploadError) throw uploadError;

    const { error: insertError } = await this.supabase.client.from('document_templates').insert({
      name: payload.name,
      description: payload.description ?? null,
      category: payload.category,
      format: ext === 'docx' ? 'docx' : ext === 'xlsx' ? 'xlsx' : 'pdf',
      version: 'v1.0',
      file_url: path,
      download_count: 0,
      active: true,
    });
    if (insertError) throw insertError;

    await this.refreshSilently();
  }

  async deleteTemplate(templateId: number): Promise<void> {
    // Soft delete
    const { error } = await this.supabase.client
      .from('document_templates')
      .update({ active: false })
      .eq('id', templateId);
    if (error) throw error;
    await this.refreshSilently();
  }

  /** Fire-and-forget: incrementa contador de descargas */
  incrementDownload(templateId: number): void {
    void this.supabase.client.rpc('increment_template_download', { template_id: templateId });
    // Actualización optimista local
    this._templates.update((ts) =>
      ts.map((t) => (t.id === templateId ? { ...t, downloadCount: t.downloadCount + 1 } : t)),
    );
  }

  clearError(): void {
    this._error.set(null);
  }

  // ── Helpers Privados ─────────────────────────────────────────────────────────

  private async fetchAllData(): Promise<void> {
    const branchId = this.getActiveBranchId();

    try {
      let schoolDocsQuery: any = this.supabase.client
        .from('school_documents')
        .select(
          `
          id, type, file_name, storage_url, description,
          branch_id, created_at,
          users(first_names, paternal_last_name)
        `,
        )
        .order('created_at', { ascending: false });
      if (branchId !== null) schoolDocsQuery = schoolDocsQuery.eq('branch_id', branchId);

      let studentsQuery: any = this.supabase.client.from('students').select(
        `
          id,
          users!inner(id, rut, first_names, paternal_last_name, maternal_last_name, branch_id, branches(name)),
          enrollments(number, created_at)
        `,
      );
      if (branchId !== null) studentsQuery = studentsQuery.eq('users.branch_id', branchId);

      let instructorsQuery: any = this.supabase.client
        .from('instructors')
        .select(
          'id, license_number, users!inner(id, first_names, paternal_last_name, maternal_last_name, branches(name))',
        );
      if (branchId !== null) instructorsQuery = instructorsQuery.eq('users.branch_id', branchId);

      const [
        vDocsRes,
        schoolDocsRes,
        templatesRes,
        studentsRes,
        instructorsRes,
        instructorDocsRes,
      ] = await Promise.all([
        this.supabase.client
          .from('v_dms_student_documents')
          .select('*')
          .order('document_at', { ascending: false })
          .limit(100),

        schoolDocsQuery,

        this.supabase.client
          .from('document_templates')
          .select(
            'id, name, description, category, format, version, file_url, download_count, active',
          )
          .eq('active', true)
          .order('category', { ascending: true })
          .order('name', { ascending: true }),

        studentsQuery,

        instructorsQuery,

        this.supabase.client
          .from('instructor_documents')
          .select('id, instructor_id, type, file_name, storage_url, status, created_at'),
      ]);

      // Construir mapa studentId → info
      const studentMap = new Map<
        number,
        { name: string; rut: string; matriculaNumber: string; branchName: string | null }
      >();
      const rawStudents = (studentsRes.data ?? []) as unknown as RawStudent[];
      for (const s of rawStudents) {
        const user = Array.isArray(s.users) ? s.users[0] : s.users;
        if (user) {
          const branch = Array.isArray(user.branches) ? user.branches[0] : user.branches;
          const enrollments = s.enrollments ?? [];
          const latestEnrollment =
            enrollments.length > 0
              ? [...enrollments].sort((a, b) =>
                  (b.created_at ?? '').localeCompare(a.created_at ?? ''),
                )[0]
              : null;
          studentMap.set(s.id, {
            name: buildStudentDisplayName({
              firstNames: user.first_names,
              paternalLastName: user.paternal_last_name,
              maternalLastName: user.maternal_last_name,
            }),
            rut: user.rut,
            matriculaNumber: latestEnrollment?.number ? `#${latestEnrollment.number}` : '—',
            branchName: branch?.name ?? null,
          });
        }
      }

      // Procesar docs de alumnos — filtrar por sede si aplica
      const allVDocsRaw = (vDocsRes.data ?? []) as unknown as RawVDmsDoc[];
      const allVDocs =
        branchId !== null ? allVDocsRaw.filter((d) => studentMap.has(d.student_id)) : allVDocsRaw;

      const recentDocs = allVDocs.slice(0, 5).map((d) => {
        const student = studentMap.get(d.student_id);
        return this.mapVDocToStudentDocRow(
          d,
          student
            ? {
                ...student,
                id: d.student_id,
                rut: student.rut,
                first_names: student.name.split(' ')[0],
                paternal_last_name: student.name.split(' ').slice(1).join(' '),
              }
            : null,
        );
      });

      // Agrupar por alumno para studentsWithDocs
      const studentDocCount = new Map<number, number>();
      for (const d of allVDocs) {
        studentDocCount.set(d.student_id, (studentDocCount.get(d.student_id) ?? 0) + 1);
      }
      const studentsWithDocsUnsorted: StudentWithDocsRow[] = [];
      for (const [studentId, docCount] of studentDocCount) {
        const student = studentMap.get(studentId);
        if (student) {
          studentsWithDocsUnsorted.push({
            studentId,
            name: student.name,
            rut: student.rut,
            matriculaNumber: student.matriculaNumber,
            branchName: student.branchName,
            docCount,
          });
        }
      }
      // Orden paterno - materno - nombre, igual que Base de Alumnos.
      const studentsWithDocs = sortByPaternalLastNameAsc(studentsWithDocsUnsorted, (s) => s.name);

      // Construir mapa instructorId → info
      const instructorMap = new Map<
        number,
        { name: string; licenseNumber: string; branchName: string | null }
      >();
      const rawInstructors = (instructorsRes.data ?? []) as unknown as RawInstructor[];
      for (const i of rawInstructors) {
        const user = Array.isArray(i.users) ? i.users[0] : i.users;
        if (user) {
          const branch = Array.isArray(user.branches) ? user.branches[0] : user.branches;
          instructorMap.set(i.id, {
            // Orden actual del instructor (nombre primero) + apellido materno agregado al final.
            name: [user.first_names, user.paternal_last_name, user.maternal_last_name]
              .map((p) => p?.trim() ?? '')
              .filter(Boolean)
              .join(' '),
            licenseNumber: i.license_number ?? '',
            branchName: branch?.name ?? null,
          });
        }
      }

      // Contar documentos por instructor — filtrar por sede si aplica
      const allInstructorDocsRaw = (instructorDocsRes.data ?? []) as unknown as RawInstructorDoc[];
      const allInstructorDocs =
        branchId !== null
          ? allInstructorDocsRaw.filter((d) => instructorMap.has(d.instructor_id))
          : allInstructorDocsRaw;
      const instructorDocCount = new Map<number, number>();
      for (const d of allInstructorDocs) {
        instructorDocCount.set(d.instructor_id, (instructorDocCount.get(d.instructor_id) ?? 0) + 1);
      }

      // instructorsWithDocs lista TODOS los instructores del scope (con docCount 0 incluido),
      // a diferencia de studentsWithDocs — necesario para poder subir el primer documento.
      const instructorsWithDocs: InstructorWithDocsRow[] = [];
      for (const [instructorId, info] of instructorMap) {
        instructorsWithDocs.push({
          instructorId,
          name: info.name,
          licenseNumber: info.licenseNumber,
          branchName: info.branchName,
          docCount: instructorDocCount.get(instructorId) ?? 0,
        });
      }
      instructorsWithDocs.sort((a, b) => a.name.localeCompare(b.name));

      // Procesar school docs
      const rawSchoolDocs = (schoolDocsRes.data ?? []) as unknown as RawSchoolDoc[];
      const schoolDocs: SchoolDocRow[] = rawSchoolDocs.map((d) => {
        const userRaw = Array.isArray(d.users) ? d.users[0] : d.users;
        const uploaderName = userRaw
          ? `${userRaw.first_names} ${userRaw.paternal_last_name}`.trim()
          : 'Sistema';
        return {
          id: d.id,
          type: d.type,
          fileName: d.file_name,
          storageUrl: d.storage_url,
          description: d.description,
          branchId: d.branch_id ?? 0,
          createdAt: d.created_at,
          uploaderName,
          typeLabel: LABELS_TIPO_ESCUELA[d.type] ?? d.type,
        };
      });

      // Procesar plantillas
      const rawTemplates = (templatesRes.data ?? []) as unknown as RawTemplate[];
      const templates: TemplateCard[] = rawTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: (t.category as TemplateCategory) ?? 'general',
        format: this.resolveFormat(t.format),
        version: t.version ?? 'v1.0',
        fileUrl: t.file_url,
        downloadCount: t.download_count,
        categoryLabel: LABELS_CATEGORIA_PLANTILLA[t.category] ?? t.category,
        formatColor: this.resolveFormatColor(t.format),
      }));

      this._recentDocs.set(recentDocs);
      this._studentsWithDocs.set(studentsWithDocs);
      this._instructorsWithDocs.set(instructorsWithDocs);
      this._schoolDocs.set(schoolDocs);
      this._templates.set(templates);
    } catch (err) {
      this._error.set(
        err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error al cargar documentos',
      );
    }
  }

  private mapVDocToStudentDocRow(
    d: RawVDmsDoc,
    user: {
      id?: number;
      rut: string;
      first_names?: string;
      paternal_last_name?: string;
      name?: string;
    } | null,
  ): DmsStudentDocRow {
    const studentName = user
      ? (user.name ?? `${user.first_names ?? ''} ${user.paternal_last_name ?? ''}`.trim())
      : 'Alumno';
    return {
      id: d.id,
      source: d.source as 'student_document' | 'digital_contract' | 'enrollment_license',
      studentId: d.student_id,
      enrollmentId: d.enrollment_id,
      type: d.type ?? '',
      fileName: d.file_name,
      fileUrl: d.file_url,
      status: d.status ?? '',
      documentAt: d.document_at,
      managedBy: d.managed_by,
      studentName,
      studentRut: user?.rut ?? '',
      typeLabel: LABELS_TIPO_ALUMNO[d.type ?? ''] ?? d.type ?? 'Documento',
    };
  }

  private mapRawToInstructorDocRow(
    d: RawInstructorDoc,
    instructorName: string,
  ): DmsInstructorDocRow {
    return {
      id: d.id,
      instructorId: d.instructor_id,
      type: d.type,
      fileName: d.file_name,
      fileUrl: d.storage_url,
      status: d.status,
      documentAt: d.created_at,
      instructorName,
      typeLabel: LABELS_TIPO_INSTRUCTOR[d.type] ?? d.type,
    };
  }

  private resolveFormat(raw: string): 'pdf' | 'docx' | 'xlsx' {
    const lower = raw?.toLowerCase() ?? 'pdf';
    if (lower === 'docx') return 'docx';
    if (lower === 'xlsx') return 'xlsx';
    return 'pdf';
  }

  private resolveFormatColor(raw: string): string {
    const lower = raw?.toLowerCase() ?? 'pdf';
    if (lower === 'docx') return 'background: var(--state-info-bg, #EFF6FF); color: #2563EB;';
    if (lower === 'xlsx') return 'background: var(--state-success-bg, #F0FDF4); color: #16A34A;';
    return 'background: var(--state-error-bg, #FEF2F2); color: #DC2626;';
  }
}
