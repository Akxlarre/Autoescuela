import { Injectable, computed, inject, signal } from '@angular/core';
import { BranchFacade } from '@core/facades/branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { ToastService } from '@core/services/ui/toast.service';
import { formatRut } from '@core/utils/rut.utils';
import type {
  CertificacionAlumnoRow,
  CertificacionKpis,
  CertificacionLogRow,
} from '@core/models/ui/certificacion-clase-b.model';

/**
 * CertificacionClaseBFacade — Gestión de certificados para alumnos Clase B.
 *
 * Query: enrollments (license_group='class_b', status='active'|'completed',
 * certificate_enabled=true). El trigger trg_enable_certificate_b activa el flag
 * al completar la clase práctica #12.
 * JOIN v_student_progress_b para pct_theory_attendance.
 * JOIN certificates + certificate_issuance_log para estado y log.
 *
 * Filtra por BranchFacade.selectedBranchId().
 */
@Injectable({ providedIn: 'root' })
export class CertificacionClaseBFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);
  private readonly dmsViewer = inject(DmsViewerService);

  // ── Estado privado ──
  private readonly _alumnos = signal<CertificacionAlumnoRow[]>([]);
  private readonly _log = signal<CertificacionLogRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _generatingId = signal<number | null>(null);
  private _initialized = false;

  // ── Estado público (readonly) ──
  public readonly alumnos = this._alumnos.asReadonly();
  public readonly log = this._log.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly error = this._error.asReadonly();
  /** ID del enrollment cuyo certificado se está generando actualmente. null = ninguno. */
  public readonly generatingId = this._generatingId.asReadonly();

  // ── KPIs computed ──
  public readonly kpis = computed<CertificacionKpis>(() => {
    const rows = this._alumnos();
    const generados = rows.filter((r) => r.certificadoStatus === 'generado').length;
    const pendientesEnvio = rows.filter(
      (r) => r.certificadoStatus === 'generado' && !r.emailEnviado,
    ).length;
    return {
      totalAlumnos: rows.length,
      certificadosGenerados: generados,
      pendientesGeneracion: rows.length - generados,
      pendientesEnvio,
    };
  });

  // ── SWR: initialize ──
  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await this.fetchData();
    } catch (e) {
      this._error.set('Error al cargar certificación');
      this.toast.error('Error al cargar datos de certificación');
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Recarga completa con skeleton (cambio de sede). */
  async reload(): Promise<void> {
    this._isLoading.set(true);
    try {
      await this.fetchData();
    } catch {
      this._error.set('Error al recargar certificación');
    } finally {
      this._isLoading.set(false);
    }
  }

  // ── Acciones placeholder (no hacen nada por ahora) ──

  /**
   * Invoca la Edge Function `generate-certificate-b-pdf`, sube el PDF a storage,
   * persiste el PATH en `enrollments.certificate_b_pdf_url` y abre el visor
   * con la signed URL devuelta directamente por la Edge Function (TTL 1h).
   */
  async generarCertificado(enrollmentId: number): Promise<void> {
    const result = await this.invokeGenerateCertificate(enrollmentId);
    if (!result) return;
    this.toast.success('Certificado generado correctamente');
    void this.refreshSilently();
    this.dmsViewer.openByUrl(result.url, 'Certificado Clase B');
  }

  /**
   * Abre el visor DMS generando una signed URL (TTL 1h) desde el path almacenado.
   * El smart component pasa `row.storagePath`.
   */
  async verCertificado(storagePath: string, nombre: string): Promise<void> {
    try {
      const signedUrl = await this.getSignedUrl(storagePath);
      this.dmsViewer.openByUrl(signedUrl, `Certificado — ${nombre}`);
    } catch {
      this.toast.error('No se pudo abrir el certificado');
    }
  }

  /**
   * Re-invoca la Edge Function (upsert idempotente) y abre el visor.
   * Botón PDF cuando el certificado ya fue generado.
   */
  async descargarPdf(enrollmentId: number): Promise<void> {
    const result = await this.invokeGenerateCertificate(enrollmentId);
    if (!result) return;
    this.dmsViewer.openByUrl(result.url, 'Certificado Clase B');
  }

  private async invokeGenerateCertificate(
    enrollmentId: number,
  ): Promise<{ url: string; path: string } | null> {
    this._generatingId.set(enrollmentId);
    try {
      const { data, error } = await this.supabase.client.functions.invoke(
        'generate-certificate-b-pdf',
        { body: { enrollment_id: enrollmentId } },
      );
      if (error || !data?.pdfUrl) {
        this.toast.error('No se pudo generar el certificado');
        return null;
      }
      return { url: data.pdfUrl as string, path: data.pdfPath as string };
    } catch {
      this.toast.error('Error al generar el certificado');
      return null;
    } finally {
      this._generatingId.set(null);
    }
  }

  /** Genera una signed URL (TTL 1h) para un path relativo en el bucket 'documents'. */
  private async getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await this.supabase.client.storage
      .from('documents')
      .createSignedUrl(path, expiresIn);
    if (error || !data) throw error ?? new Error('No se pudo firmar la URL');
    return data.signedUrl;
  }

  async enviarEmail(_enrollmentId: number): Promise<void> {
    this.toast.info('Envío de email pendiente de implementación');
  }

  async generarPendientes(): Promise<void> {
    this.toast.info('Generación masiva pendiente de implementación');
  }

  async enviarEmailsMasivo(): Promise<void> {
    this.toast.info('Envío masivo de emails pendiente de implementación');
  }

  async exportar(): Promise<void> {
    this.toast.info('Exportación pendiente de implementación');
  }

  // ── Fetch privado ──

  private async fetchData(): Promise<void> {
    await Promise.all([this.fetchAlumnos(), this.fetchLog()]);
  }

  private async fetchAlumnos(): Promise<void> {
    const branchId = this.branchFacade.selectedBranchId();

    // Step 1: Enrollments habilitados para certificado (trigger ya validó 12 prácticas).
    let enrollmentQuery = this.supabase.client
      .from('enrollments')
      .select(
        `
        id,
        branch_id,
        certificate_b_pdf_url,
        courses!inner(name, type),
        students!inner(
          id,
          users!inner(first_names, paternal_last_name, maternal_last_name, rut)
        ),
        certificates(id, folio, status)
      `,
      )
      .eq('certificate_enabled', true)
      .eq('license_group', 'class_b')
      .in('status', ['active', 'completed']);

    if (branchId !== null) {
      enrollmentQuery = enrollmentQuery.eq('branch_id', branchId);
    }

    const { data: enrollments, error: enrollmentError } = await enrollmentQuery;
    if (enrollmentError) throw enrollmentError;
    if (!enrollments || enrollments.length === 0) {
      this._alumnos.set([]);
      return;
    }

    const enrollmentIds = enrollments.map((e: any) => e.id as number);

    // Step 2: Datos de progreso — pct_theory_attendance + fecha última práctica.
    const { data: progressData } = await this.supabase.client
      .from('v_student_progress_b')
      .select('enrollment_id, pct_theory_attendance, last_practice_session')
      .in('enrollment_id', enrollmentIds);

    const progressMap = new Map(
      (progressData ?? []).map((p: any) => [p.enrollment_id as number, p]),
    );

    // Step 3: Qué certificados ya fueron enviados por email.
    const certIds = enrollments
      .filter((e: any) => e.certificates?.length > 0)
      .map((e: any) => e.certificates[0].id as number);

    let emailSentSet = new Set<number>();
    if (certIds.length > 0) {
      const { data: emailLogs } = await this.supabase.client
        .from('certificate_issuance_log')
        .select('certificate_id')
        .in('certificate_id', certIds)
        .eq('action', 'email_sent');
      if (emailLogs) {
        emailSentSet = new Set(emailLogs.map((l: any) => l.certificate_id as number));
      }
    }

    // Step 4: Mapeo DTO → UI model.
    const rows: CertificacionAlumnoRow[] = enrollments.map((e: any) => {
      const student = e.students;
      const user = student.users;
      const progress = progressMap.get(e.id);
      const cert = e.certificates?.length > 0 ? e.certificates[0] : null;
      const nombre = [user.paternal_last_name, user.maternal_last_name, user.first_names]
        .filter(Boolean)
        .join(' ');

      const rawPct = progress?.pct_theory_attendance;
      const pctAsistenciaTeoria: number | null =
        rawPct !== null && rawPct !== undefined ? Number(rawPct) : null;

      return {
        enrollmentId: e.id,
        studentId: student.id,
        nombre,
        rut: formatRut(user.rut || ''),
        curso: e.courses?.name || 'Clase B',
        clasesCompletadas: 12,
        clasesTotales: 12,
        fechaTermino: progress?.last_practice_session
          ? new Date(progress.last_practice_session).toISOString().split('T')[0]
          : null,
        pctAsistenciaTeoria,
        certificadoId: cert?.id ?? null,
        certificadoFolio: cert
          ? `CERT-${new Date().getFullYear()}-${String(cert.folio).padStart(4, '0')}`
          : null,
        storagePath: e.certificate_b_pdf_url ?? null,
        certificadoStatus: e.certificate_b_pdf_url ? 'generado' : 'pendiente',
        emailEnviado: cert ? emailSentSet.has(cert.id) : false,
      } satisfies CertificacionAlumnoRow;
    });

    // Pendientes primero, luego por nombre.
    rows.sort((a, b) => {
      if (a.certificadoStatus !== b.certificadoStatus) {
        return a.certificadoStatus === 'pendiente' ? -1 : 1;
      }
      return a.nombre.localeCompare(b.nombre);
    });

    this._alumnos.set(rows);
  }

  private async fetchLog(): Promise<void> {
    const branchId = this.branchFacade.selectedBranchId();

    // Get issuance log with certificate → enrollment → branch for filtering
    let query = this.supabase.client
      .from('certificate_issuance_log')
      .select(
        `
        id,
        action,
        created_at,
        certificates!inner(
          id,
          type,
          enrollments!inner(
            branch_id,
            students!inner(
              users!inner(first_names, paternal_last_name)
            )
          )
        ),
        users!certificate_issuance_log_user_id_fkey(first_names, paternal_last_name)
      `,
      )
      .eq('certificates.type', 'class_b')
      .order('created_at', { ascending: false })
      .limit(50);

    if (branchId !== null) {
      query = query.eq('certificates.enrollments.branch_id', branchId);
    }

    const { data, error } = await query;

    // If the nested filter errors or returns nothing, just set empty
    if (error || !data) {
      this._log.set([]);
      return;
    }

    const rows: CertificacionLogRow[] = data.map((row: any) => {
      const cert = row.certificates;
      const enrollment = cert?.enrollments;
      const student = enrollment?.students;
      const studentUser = student?.users;
      const actionUser = row.users;

      return {
        id: row.id,
        fecha: row.created_at,
        accion: row.action,
        alumnoNombre: studentUser
          ? `${studentUser.first_names} ${studentUser.paternal_last_name}`
          : '—',
        usuarioNombre: actionUser
          ? `${actionUser.first_names} ${actionUser.paternal_last_name}`
          : '—',
      };
    });

    this._log.set(rows);
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchData();
    } catch {
      // Fail silencioso — datos stale siguen visibles
    }
  }
}
