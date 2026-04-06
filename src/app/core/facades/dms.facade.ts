import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type {
  StudentWithDocsRow,
  DmsStudentDocRow,
  SchoolDocRow,
  TemplateCard,
  DmsKpis,
  TemplateCategory,
  UploadStudentDocPayload,
  UploadSchoolDocPayload,
  UploadTemplatePayload,
} from '@core/models/ui/dms.model';
import { LayoutDrawerService } from '@core/services/ui/layout-drawer.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';

// ─── Labels ──────────────────────────────────────────────────────────────────

const LABELS_TIPO_ALUMNO: Record<string, string> = {
  contrato: 'Contrato',
  foto_licencia: 'Foto Licencia',
  hoja_vida: 'Hoja de Vida',
  cedula: 'Cédula',
  certificado_antecedentes: 'Cert. Antecedentes',
  autorizacion_notarial: 'Autorización Notarial',
  foto_carnet: 'Foto Carnet',
  cedula_identidad: 'Cédula Identidad',
  certificado_medico: 'Certificado Médico',
  semep: 'SEMEP',
};

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

interface RawStudentUser {
  id: number;
  rut: string;
  first_names: string;
  paternal_last_name: string;
}

interface RawStudent {
  id: number;
  users: RawStudentUser | RawStudentUser[] | null;
}

interface RawSchoolDoc {
  id: number;
  type: string;
  file_name: string;
  storage_url: string;
  description: string | null;
  branch_id: number | null;
  created_at: string;
  users: { first_names: string; paternal_last_name: string } | { first_names: string; paternal_last_name: string }[] | null;
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
  private readonly supabase = inject(SupabaseService);
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

  openDocument(url: string, fileName?: string): void {
    this.dmsViewer.openByUrl(url, fileName || 'Documento');
  }

  closeDrawer(): void {
    this.layoutDrawer.close();
  }

  // ── Estado Privado ───────────────────────────────────────────────────────────

  private readonly _studentsWithDocs = signal<StudentWithDocsRow[]>([]);
  private readonly _recentDocs = signal<DmsStudentDocRow[]>([]);
  private readonly _schoolDocs = signal<SchoolDocRow[]>([]);
  private readonly _templates = signal<TemplateCard[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;

  // Sub-ruta: detalle de alumno
  private readonly _studentDetail = signal<{ name: string; rut: string; studentId: number } | null>(null);
  private readonly _studentDocs = signal<DmsStudentDocRow[]>([]);
  private readonly _studentDocsLoading = signal(false);

  // Estado para el Drawer dinámico
  private readonly _currentUploadMode = signal<'student' | 'school'>('student');
  private readonly _preselectedStudentId = signal<number | null>(null);
  private readonly _uploadSaved = signal<boolean>(false);

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

  readonly currentUploadMode = this._currentUploadMode.asReadonly();
  readonly preselectedStudentId = this._preselectedStudentId.asReadonly();
  readonly uploadSaved = this._uploadSaved.asReadonly();

  readonly kpis = computed((): DmsKpis => ({
    totalStudentDocs: this._recentDocs().length,      // proxy; backend contaría mejor
    totalSchoolDocs: this._schoolDocs().length,
    totalTemplates: this._templates().length,
    recentUploads: this._studentsWithDocs().reduce((acc, s) => acc + s.docCount, 0),
  }));

  // ── Métodos de Acción ────────────────────────────────────────────────────────

  /**
   * Initialize con SWR: primera visita carga con skeleton;
   * re-visitas revalidan silenciosamente.
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    this._error.set(null);
    await this.fetchAllData();
    this._isLoading.set(false);
  }

  async refreshSilently(): Promise<void> {
    await this.fetchAllData();
  }

  /**
   * Abre el drawer de subida de documentos integrado en el layout.
   */
  openUpload(mode: 'student' | 'school', studentId: number | null = null): void {
    this._currentUploadMode.set(mode);
    this._preselectedStudentId.set(studentId);
    this._uploadSaved.set(false);

    // Importación dinámica para evitar ciclos circulares si fuera necesario, 
    // pero aquí usaremos el componente directamente (se cargará al abrir el drawer).
    // Nota: El componente se llamará DmsUploadDrawerComponent por ahora, 
    // pero actuará como contenido puro.
    import('../../features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component').then(m => {
      this.layoutDrawer.open(m.DmsUploadDrawerComponent, 
        mode === 'student' ? 'Subir documento de alumno' : 'Subir documento institucional',
        'upload'
      );
    });
  }

  /**
   * Abre el drawer para crear una nueva plantilla.
   */
  openTemplate(): void {
    import('../../features/admin/documentos/dms-template-drawer/dms-template-drawer.component').then(m => {
      this.layoutDrawer.open(m.DmsTemplateDrawerComponent, 
        'Nueva plantilla institucional',
        'folder'
      );
    });
  }

  /**
   * Notifica que se ha guardado un documento (llamado desde el drawer).
   */
  notifyUploadSaved(): void {
    const studentId = this._preselectedStudentId();
    this._uploadSaved.set(true);
    void this.initialize();
    if (studentId) {
      void this.loadStudentDocuments(studentId);
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
          .select('id, users!inner(id, rut, first_names, paternal_last_name)')
          .eq('id', studentId)
          .single();

        const rawStudent = studentData as unknown as RawStudent | null;
        const user = rawStudent
          ? (Array.isArray(rawStudent.users) ? rawStudent.users[0] : rawStudent.users)
          : null;
        if (user) {
          this._studentDetail.set({
            name: `${user.first_names} ${user.paternal_last_name}`.trim(),
            rut: user.rut,
            studentId,
          });
        }
        this._studentDocs.set(docs.map((d) => this.mapVDocToStudentDocRow(d, user)));
      } else {
        // Sin docs: cargar solo info de alumno
        const { data: studentData } = await this.supabase.client
          .from('students')
          .select('id, users!inner(id, rut, first_names, paternal_last_name)')
          .eq('id', studentId)
          .single();
        const rawStudent = studentData as unknown as RawStudent | null;
        const user = rawStudent
          ? (Array.isArray(rawStudent.users) ? rawStudent.users[0] : rawStudent.users)
          : null;
        if (user) {
          this._studentDetail.set({
            name: `${user.first_names} ${user.paternal_last_name}`.trim(),
            rut: user.rut,
            studentId,
          });
        }
        this._studentDocs.set([]);
      }
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al cargar documentos del alumno');
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

    const { data: urlData } = this.supabase.client.storage
      .from('documents')
      .getPublicUrl(path);

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

    const { error: insertError } = await this.supabase.client
      .from('student_documents')
      .insert({
        enrollment_id: enrollmentId,
        type: payload.type,
        file_name: payload.file.name,
        storage_url: urlData.publicUrl,
        status: 'pending',
      });
    if (insertError) throw insertError;

    await this.refreshSilently();
  }

  async deleteStudentDocument(docId: string, source: 'student_document' | 'digital_contract'): Promise<void> {
    const table = source === 'student_document' ? 'student_documents' : 'digital_contracts';
    const numericId = parseInt(docId, 10);
    const { error } = await this.supabase.client
      .from(table)
      .delete()
      .eq('id', numericId);
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

    const { data: urlData } = this.supabase.client.storage
      .from('documents')
      .getPublicUrl(path);

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

    const { error: insertError } = await this.supabase.client
      .from('school_documents')
      .insert({
        type: payload.type,
        file_name: payload.file.name,
        storage_url: urlData.publicUrl,
        description: payload.description ?? null,
        uploaded_by: numericUserId,
      });
    if (insertError) throw insertError;

    await this.refreshSilently();
  }

  async deleteSchoolDocument(docId: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('school_documents')
      .delete()
      .eq('id', docId);
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

    const { data: urlData } = this.supabase.client.storage
      .from('documents')
      .getPublicUrl(path);

    const { error: insertError } = await this.supabase.client
      .from('document_templates')
      .insert({
        name: payload.name,
        description: payload.description ?? null,
        category: payload.category,
        format: ext === 'docx' ? 'docx' : ext === 'xlsx' ? 'xlsx' : 'pdf',
        version: 'v1.0',
        file_url: urlData.publicUrl,
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
    try {
      const [vDocsRes, schoolDocsRes, templatesRes, studentsRes] = await Promise.all([
        // Últimos 5 docs de alumnos (para la card "Últimos subidos")
        this.supabase.client
          .from('v_dms_student_documents')
          .select('*')
          .order('document_at', { ascending: false })
          .limit(100),

        // Documentos institucionales
        this.supabase.client
          .from('school_documents')
          .select(`
            id,
            type,
            file_name,
            storage_url,
            description,
            branch_id,
            created_at,
            users(first_names, paternal_last_name)
          `)
          .order('created_at', { ascending: false }),

        // Plantillas activas
        this.supabase.client
          .from('document_templates')
          .select('id, name, description, category, format, version, file_url, download_count, active')
          .eq('active', true)
          .order('category', { ascending: true })
          .order('name', { ascending: true }),

        // Alumnos con info para cruzar con docs
        this.supabase.client
          .from('students')
          .select('id, users!inner(id, rut, first_names, paternal_last_name)'),
      ]);

      // Construir mapa studentId → info
      const studentMap = new Map<number, { name: string; rut: string }>();
      const rawStudents = ((studentsRes.data ?? []) as unknown as RawStudent[]);
      for (const s of rawStudents) {
        const user = Array.isArray(s.users) ? s.users[0] : s.users;
        if (user) {
          studentMap.set(s.id, {
            name: `${user.first_names} ${user.paternal_last_name}`.trim(),
            rut: user.rut,
          });
        }
      }

      // Procesar docs de alumnos
      const allVDocs = ((vDocsRes.data ?? []) as unknown as RawVDmsDoc[]);
      const recentDocs = allVDocs.slice(0, 5).map((d) => {
        const student = studentMap.get(d.student_id);
        return this.mapVDocToStudentDocRow(d, student ? { ...student, id: d.student_id, rut: student.rut, first_names: student.name.split(' ')[0], paternal_last_name: student.name.split(' ').slice(1).join(' ') } : null);
      });

      // Agrupar por alumno para studentsWithDocs
      const studentDocCount = new Map<number, number>();
      for (const d of allVDocs) {
        studentDocCount.set(d.student_id, (studentDocCount.get(d.student_id) ?? 0) + 1);
      }
      const studentsWithDocs: StudentWithDocsRow[] = [];
      for (const [studentId, docCount] of studentDocCount) {
        const student = studentMap.get(studentId);
        if (student) {
          studentsWithDocs.push({
            studentId,
            name: student.name,
            rut: student.rut,
            docCount,
          });
        }
      }
      studentsWithDocs.sort((a, b) => a.name.localeCompare(b.name));

      // Procesar school docs
      const rawSchoolDocs = ((schoolDocsRes.data ?? []) as unknown as RawSchoolDoc[]);
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
      const rawTemplates = ((templatesRes.data ?? []) as unknown as RawTemplate[]);
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
      this._schoolDocs.set(schoolDocs);
      this._templates.set(templates);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al cargar documentos');
    }
  }

  private mapVDocToStudentDocRow(
    d: RawVDmsDoc,
    user: { id?: number; rut: string; first_names?: string; paternal_last_name?: string; name?: string } | null,
  ): DmsStudentDocRow {
    const studentName = user
      ? (user.name ?? `${user.first_names ?? ''} ${user.paternal_last_name ?? ''}`.trim())
      : 'Alumno';
    return {
      id: d.id,
      source: (d.source as 'student_document' | 'digital_contract'),
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
