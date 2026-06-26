import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { ToastService } from '@core/services/ui/toast.service';
import { formatRut } from '@core/utils/rut.utils';
import { calcAverage } from '@core/utils/professional-modules';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import type {
  CertificacionProfesionalAlumnoRow,
  CertificacionProfesionalKpis,
  CertificacionProfesionalLogRow,
  CursoCertOption,
  ElegibilidadCertProf,
  PromocionCertOption,
} from '@core/models/ui/certificacion-profesional.model';

/** Umbral de asistencia teórica requerido (75 %). */
const PCT_TEORIA_MIN = 75;
/** Nota mínima de aprobación en escala MTT 10-100. */
const NOTA_MIN = 75;

/**
 * CertificacionProfesionalFacade — Certificados Clase Profesional.
 *
 * Flujo de selección en cascada:
 *   initialize() → carga lista de promociones finalizadas.
 *   selectPromocion(id) → carga cursos de esa promoción.
 *   selectCurso(id) → carga alumnos del curso y evalúa elegibilidad.
 *
 * Criterios de elegibilidad según rol:
 *   Admin: elegible=true siempre — sin chequeo de asistencia ni pago.
 *   Secretaria:
 *     1. Asistencia teórica >= 75 % (bloqueante)
 *     2. Pago completo, pending_balance <= 0 (bloqueante)
 *     [Nota promedio] → informativo: se muestra pero NO bloquea.
 *     [Asistencia práctica = 100 %] → flexible: confirmation prompt si < 100.
 *
 * Promociones visibles: status='finished' O end_date=hoy (ambos roles).
 *
 * Filtra alumnos por BranchFacade.selectedBranchId().
 */
@Injectable({ providedIn: 'root' })
export class CertificacionProfesionalFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly authFacade = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);
  private readonly dmsViewer = inject(DmsViewerService);

  // ── Estado privado ──
  private readonly _promociones = signal<PromocionCertOption[]>([]);
  private readonly _cursos = signal<CursoCertOption[]>([]);
  private readonly _selectedPromocionId = signal<number | null>(null);
  private readonly _selectedCursoId = signal<number | null>(null);
  private readonly _alumnos = signal<CertificacionProfesionalAlumnoRow[]>([]);
  private readonly _log = signal<CertificacionProfesionalLogRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isLoadingAlumnos = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _generatingId = signal<number | null>(null);
  private readonly _sendingEmailId = signal<number | null>(null);
  private readonly _sendingMasivo = signal(false);
  private readonly _isExporting = signal(false);
  private readonly _generatingPendientes = signal(false);
  private _initialized = false;
  private _alumnosFetchToken = 0;

  // ── Estado público (readonly) ──
  public readonly promociones = this._promociones.asReadonly();
  public readonly cursos = this._cursos.asReadonly();
  public readonly selectedPromocionId = this._selectedPromocionId.asReadonly();
  public readonly selectedCursoId = this._selectedCursoId.asReadonly();
  public readonly alumnos = this._alumnos.asReadonly();
  public readonly log = this._log.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly isLoadingAlumnos = this._isLoadingAlumnos.asReadonly();
  public readonly error = this._error.asReadonly();
  public readonly generatingId = this._generatingId.asReadonly();
  public readonly sendingEmailId = this._sendingEmailId.asReadonly();
  public readonly sendingMasivo = this._sendingMasivo.asReadonly();
  public readonly isExporting = this._isExporting.asReadonly();
  /** true mientras se están generando los certificados pendientes en lote. */
  public readonly isGeneratingPendientes = this._generatingPendientes.asReadonly();

  // ── KPIs computed ──
  public readonly kpis = computed<CertificacionProfesionalKpis>(() => {
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

  // ── SWR: initialize — carga solo la lista de promociones ──
  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.refreshPromocionesSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await Promise.all([this.fetchPromociones(), this.fetchLog()]);
    } catch {
      this._error.set('Error al cargar promociones');
      this.toast.error('Error al cargar datos de certificación profesional');
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Recarga completa al cambiar sede. Limpia selección actual. */
  async reload(): Promise<void> {
    ++this._alumnosFetchToken; // cancel any in-flight fetchAlumnos
    this._initialized = false;
    this._selectedPromocionId.set(null);
    this._selectedCursoId.set(null);
    this._cursos.set([]);
    this._alumnos.set([]);
    this._isLoading.set(true);
    try {
      await Promise.all([this.fetchPromociones(), this.fetchLog()]);
    } catch {
      this._error.set('Error al recargar certificación profesional');
    } finally {
      this._isLoading.set(false);
      this._initialized = true;
    }
  }

  /** Selecciona una promoción y carga sus cursos. null = deseleccionar (clear). */
  async selectPromocion(promoId: number | null): Promise<void> {
    this._selectedPromocionId.set(promoId);
    this._selectedCursoId.set(null);
    this._alumnos.set([]);
    this._cursos.set([]);
    if (promoId !== null) {
      await this.fetchCursos(promoId);
    }
  }

  /** Selecciona un curso (promotion_course_id) y carga sus alumnos. null = deseleccionar. */
  async selectCurso(cursoId: number | null): Promise<void> {
    this._selectedCursoId.set(cursoId);
    this._alumnos.set([]);
    if (cursoId === null) return;
    this._isLoadingAlumnos.set(true);
    try {
      await this.fetchAlumnos(cursoId);
    } catch {
      this._error.set('Error al cargar alumnos del curso');
      this.toast.error('Error al cargar alumnos');
    } finally {
      this._isLoadingAlumnos.set(false);
    }
  }

  // ── Acciones de certificado ──

  async generarCertificado(enrollmentId: number): Promise<void> {
    const result = await this.invokeGenerateCertificate(enrollmentId);
    if (!result) return;
    this.toast.success('Certificado profesional generado correctamente');
    // Refresh alumnos first so fetchLog picks up the new cert ID
    const cursoId = this._selectedCursoId();
    if (cursoId !== null) {
      await this.fetchAlumnos(cursoId);
      void this.fetchLog();
    }
    this.dmsViewer.openByUrl(result.url, 'Certificado Clase Profesional');
  }

  async verCertificado(storagePath: string, nombre: string): Promise<void> {
    try {
      const signedUrl = await this.getSignedUrl(storagePath);
      this.dmsViewer.openByUrl(signedUrl, `Certificado — ${nombre}`);
    } catch {
      this.toast.error('No se pudo abrir el certificado');
    }
  }

  async descargarPdf(enrollmentId: number): Promise<void> {
    const result = await this.invokeGenerateCertificate(enrollmentId);
    if (!result) return;
    this.dmsViewer.openByUrl(result.url, 'Certificado Clase Profesional');
  }

  async enviarEmail(enrollmentId: number): Promise<void> {
    this._sendingEmailId.set(enrollmentId);
    try {
      const { error } = await this.supabase.client.functions.invoke('send-certificate-email', {
        body: { enrollment_id: enrollmentId, type: 'professional' },
      });
      if (error) {
        this.toast.error('Error al enviar el email del certificado');
        return;
      }
      this.toast.success('Email enviado correctamente');
      const cursoId = this._selectedCursoId();
      if (cursoId !== null) await this.fetchAlumnos(cursoId);
    } catch {
      this.toast.error('Error al enviar el email del certificado');
    } finally {
      this._sendingEmailId.set(null);
    }
  }

  async generarPendientes(): Promise<void> {
    const elegibles = this._alumnos().filter(
      (a) => a.certificadoStatus === 'pendiente' && a.elegible,
    );
    if (elegibles.length === 0) return;

    this._generatingPendientes.set(true);
    let generados = 0;
    const errores: string[] = [];

    for (const alumno of elegibles) {
      this._generatingId.set(alumno.enrollmentId);
      try {
        const { data, error } = await this.supabase.client.functions.invoke(
          'generate-certificate-professional-pdf',
          { body: { enrollment_id: alumno.enrollmentId } },
        );
        if (error || !data?.pdfUrl) {
          errores.push(alumno.nombre);
        } else {
          generados++;
        }
      } catch {
        errores.push(alumno.nombre);
      }
    }

    this._generatingId.set(null);
    this._generatingPendientes.set(false);

    if (errores.length === 0) {
      this.toast.success(
        `${generados} certificado${generados !== 1 ? 's' : ''} generado${generados !== 1 ? 's' : ''} correctamente`,
      );
    } else {
      this.toast.warning(
        `${generados} generado${generados !== 1 ? 's' : ''}, ${errores.length} con error`,
      );
    }

    const cursoId = this._selectedCursoId();
    if (cursoId !== null) {
      await this.fetchAlumnos(cursoId);
      void this.fetchLog();
    }
  }

  async enviarEmailsMasivo(): Promise<void> {
    const eligible = this._alumnos().filter(
      (a) => a.certificadoStatus === 'generado' && !a.emailEnviado,
    );
    if (eligible.length === 0) {
      this.toast.info('No hay certificados pendientes de envío');
      return;
    }
    this._sendingMasivo.set(true);
    let sent = 0;
    let failed = 0;
    try {
      for (const alumno of eligible) {
        const { error } = await this.supabase.client.functions.invoke('send-certificate-email', {
          body: { enrollment_id: alumno.enrollmentId, type: 'professional' },
        });
        if (error) failed++;
        else sent++;
      }
      if (sent > 0)
        this.toast.success(`${sent} email${sent > 1 ? 's' : ''} enviado${sent > 1 ? 's' : ''}`);
      if (failed > 0)
        this.toast.error(`${failed} email${failed > 1 ? 's' : ''} no se pudieron enviar`);
      const cursoId = this._selectedCursoId();
      if (cursoId !== null) await this.fetchAlumnos(cursoId);
    } finally {
      this._sendingMasivo.set(false);
    }
  }

  async exportar(): Promise<void> {
    this._isExporting.set(true);
    try {
      const {
        data: { session },
      } = await this.supabase.client.auth.getSession();
      const token = session?.access_token ?? '';
      const branchId = this.getActiveBranchId();
      const functionsUrl = (this.supabase.client.functions as any).url as string;
      const anonKey = (this.supabase.client as any).supabaseKey as string;

      const response = await fetch(`${functionsUrl}/export-certificates-zip`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'professional', branch_id: branchId }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        this.toast.error((err as any).error ?? 'Error al exportar los certificados');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificados-profesional-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      this.toast.success('Certificados exportados correctamente');
    } catch {
      this.toast.error('Error al exportar los certificados');
    } finally {
      this._isExporting.set(false);
    }
  }

  // ── Fetch privados ──

  /**
   * Carga promociones disponibles para certificación ordenadas por start_date DESC.
   * Incluye: status='finished' O end_date=hoy (el cron de fin de día aún no ha corrido).
   */
  private async fetchPromociones(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await this.supabase.client
      .from('professional_promotions')
      .select('id, name, code, status, start_date, end_date')
      .or(`status.eq.finished,and(status.eq.in_progress,end_date.eq.${today})`)
      .order('start_date', { ascending: false });

    if (error) {
      this._error.set('Error cargando promociones');
      return;
    }

    const opts: PromocionCertOption[] = (data ?? []).map((p: any) => ({
      id: p.id as number,
      code: p.code as string,
      name: p.name as string,
      startDate: p.start_date as string,
      label: `${p.code} — ${p.name}`,
    }));

    this._promociones.set(opts);
  }

  /** Carga cursos de una promoción (promotion_courses JOIN courses). */
  private async fetchCursos(promoId: number): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('promotion_courses')
      .select(
        `
        id,
        courses!inner(name, license_class)
      `,
      )
      .eq('promotion_id', promoId);

    if (error) {
      this.toast.error('Error cargando cursos de la promoción');
      return;
    }

    const opts: CursoCertOption[] = (data ?? []).map((pc: any) => ({
      id: pc.id as number,
      courseName: pc.courses?.name ?? 'Curso',
      licenseClass: pc.courses?.license_class ?? 'A4',
      label: `${pc.courses?.name ?? 'Curso'} (${pc.courses?.license_class ?? ''})`,
    }));

    this._cursos.set(opts);
  }

  /**
   * Carga alumnos de un promotion_course específico y computa elegibilidad.
   * Aplica filtro de sede de BranchFacade.
   * Admin: elegible=true siempre (sin chequeo de asistencia ni pago).
   * Secretaria: elegible = teoria >= 75% && pago correcto.
   */
  /**
   * Sede activa para el scope de queries (fix-027).
   * admin → respeta el selector; secretaria → su sede (misconfig → ninguna fila).
   */
  private getActiveBranchId(): number | null {
    const user = this.authFacade.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  private async fetchAlumnos(promotionCourseId: number): Promise<void> {
    const token = ++this._alumnosFetchToken;
    const branchId = this.getActiveBranchId();
    const isAdmin = this.authFacade.currentUser()?.role === 'admin';

    // Promotion info from already-loaded _promociones (no extra query)
    const promoId = this._selectedPromocionId();
    const promo = promoId !== null ? this._promociones().find((p) => p.id === promoId) : null;
    const promocionLabel = promo ? `${promo.code} — ${promo.name}` : '';
    const fechaInicio = promo?.startDate ?? null;

    // ── Step 1: Enrollments del curso ──
    let enrollmentQuery = this.supabase.client
      .from('enrollments')
      .select(
        `
        id,
        branch_id,
        pending_balance,
        certificate_professional_pdf_url,
        students!inner(
          id,
          users!inner(first_names, paternal_last_name, maternal_last_name, rut, email)
        ),
        courses!inner(name, license_class),
        certificates(id, folio, status, created_at)
      `,
      )
      .eq('promotion_course_id', promotionCourseId)
      .eq('license_group', 'professional')
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

    const enrollmentIds = (enrollments as any[]).map((e) => e.id as number);

    // ── Step 2: Sesiones completadas del curso ──
    const [theorySessionsRes, practiceSessionsRes] = await Promise.all([
      this.supabase.client
        .from('professional_theory_sessions')
        .select('id')
        .eq('promotion_course_id', promotionCourseId)
        .eq('status', 'completed'),
      this.supabase.client
        .from('professional_practice_sessions')
        .select('id')
        .eq('promotion_course_id', promotionCourseId)
        .eq('status', 'completed'),
    ]);

    const theoryIds: number[] = (theorySessionsRes.data ?? []).map((s: any) => s.id);
    const practiceIds: number[] = (practiceSessionsRes.data ?? []).map((s: any) => s.id);

    // ── Step 3: Asistencia ──
    const [theoryAttRes, practiceAttRes] = await Promise.all([
      theoryIds.length > 0
        ? this.supabase.client
            .from('professional_theory_attendance')
            .select('enrollment_id, status')
            .in('theory_session_prof_id', theoryIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      practiceIds.length > 0
        ? this.supabase.client
            .from('professional_practice_attendance')
            .select('enrollment_id, status')
            .in('session_id', practiceIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    const theoryAtt: any[] = theoryAttRes.data ?? [];
    const practiceAtt: any[] = practiceAttRes.data ?? [];

    // ── Step 4: Notas de módulos ──
    const { data: moduleGrades } = await this.supabase.client
      .from('professional_module_grades')
      .select('enrollment_id, grade')
      .in('enrollment_id', enrollmentIds);

    const gradesMap = new Map<number, number[]>();
    for (const g of (moduleGrades ?? []) as any[]) {
      if (!gradesMap.has(g.enrollment_id)) gradesMap.set(g.enrollment_id, []);
      gradesMap.get(g.enrollment_id)!.push(Number(g.grade));
    }

    // ── Step 5: Email enviado ──
    const certIds = (enrollments as any[])
      .filter((e) => e.certificates?.length > 0)
      .map((e) => e.certificates[0].id as number);

    let emailSentSet = new Set<number>();
    if (certIds.length > 0) {
      const { data: emailLogs } = await this.supabase.client
        .from('certificate_issuance_log')
        .select('certificate_id')
        .in('certificate_id', certIds)
        .eq('action', 'email_sent');
      if (emailLogs) {
        emailSentSet = new Set((emailLogs as any[]).map((l) => l.certificate_id as number));
      }
    }

    // ── Step 6: Mapeo DTO → UI ──
    const countPresent = (att: any[], enrollmentId: number): number =>
      att.filter((r) => r.enrollment_id === enrollmentId && r.status === 'present').length;

    const rows: CertificacionProfesionalAlumnoRow[] = (enrollments as any[]).map((e) => {
      const student = e.students;
      const user = student.users;
      const cert = e.certificates?.length > 0 ? e.certificates[0] : null;

      const nombre = [user.paternal_last_name, user.maternal_last_name, user.first_names]
        .filter(Boolean)
        .join(' ');

      const theoryPresent = countPresent(theoryAtt, e.id);
      const practicePresent = countPresent(practiceAtt, e.id);

      const pctAsistenciaTeoria: number | null =
        theoryIds.length > 0 ? Math.round((theoryPresent / theoryIds.length) * 100) : null;
      const pctAsistenciaPractica: number | null =
        practiceIds.length > 0 ? Math.round((practicePresent / practiceIds.length) * 100) : null;

      const grades = gradesMap.get(e.id) ?? [];
      const notaPromedio: number | null = grades.length > 0 ? calcAverage(grades) : null;
      const pagoCorrecto = (e.pending_balance ?? 1) <= 0;

      const elegibilidad: ElegibilidadCertProf = {
        promocion: true,
        teoria: pctAsistenciaTeoria !== null && pctAsistenciaTeoria >= PCT_TEORIA_MIN,
        practica: pctAsistenciaPractica !== null && pctAsistenciaPractica >= 100,
        pago: pagoCorrecto,
        nota: notaPromedio !== null && notaPromedio >= NOTA_MIN,
      };

      // Folio only shown when PDF exists; year derived from issuance date, not today's date
      const hasPdf = !!e.certificate_professional_pdf_url;
      const certYear = cert?.created_at ? new Date(cert.created_at).getFullYear() : null;

      return {
        enrollmentId: e.id,
        studentId: student.id,
        nombre,
        rut: formatRut(user.rut || ''),
        curso: e.courses?.name ?? 'Clase Profesional',
        licenseClass: e.courses?.license_class ?? 'A4',
        promocion: promocionLabel,
        fechaInicio,
        fechaTermino: null,
        pctAsistenciaTeoria,
        pctAsistenciaPractica,
        pagoCorrecto,
        notaPromedio,
        elegibilidad,
        elegible: isAdmin ? true : elegibilidad.teoria && elegibilidad.pago,
        certificadoId: cert?.id ?? null,
        certificadoFolio:
          cert && hasPdf && certYear
            ? `CERT-PROF-${certYear}-${String(cert.folio).padStart(4, '0')}`
            : null,
        storagePath: e.certificate_professional_pdf_url ?? null,
        certificadoStatus: hasPdf ? 'generado' : 'pendiente',
        emailEnviado: cert ? emailSentSet.has(cert.id) : false,
        email: user.email ?? null,
      } satisfies CertificacionProfesionalAlumnoRow;
    });

    rows.sort((a, b) => {
      if (a.certificadoStatus !== b.certificadoStatus) {
        return a.certificadoStatus === 'pendiente' ? -1 : 1;
      }
      return a.nombre.localeCompare(b.nombre);
    });

    // Discard result if a newer fetch was started (e.g., branch changed mid-flight)
    if (this._alumnosFetchToken !== token) return;
    this._alumnos.set(rows);
  }

  private async fetchLog(): Promise<void> {
    // Scope to known cert IDs when available — avoids unreliable deep-nested PostgREST filters.
    // Falls back to type filter on initial load (before any course is selected).
    const certIds = this._alumnos()
      .map((a) => a.certificadoId)
      .filter((id): id is number => id !== null);

    let query = this.supabase.client
      .from('certificate_issuance_log')
      .select(
        `
        id,
        action,
        created_at,
        certificates!inner(
          enrollments!inner(
            students!inner(
              users!inner(first_names, paternal_last_name, maternal_last_name)
            )
          )
        ),
        users!certificate_issuance_log_user_id_fkey(first_names, paternal_last_name)
      `,
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (certIds.length > 0) {
      query = query.in('certificate_id', certIds);
    } else {
      // No course selected yet — filter by type (1-level deep, supported by PostgREST)
      query = query.eq('certificates.type', 'professional');
    }

    const { data, error } = await query;
    if (error || !data) {
      this._log.set([]);
      return;
    }

    const rows: CertificacionProfesionalLogRow[] = (data as any[]).map((row) => {
      const student = row.certificates?.enrollments?.students;
      const actionUser = row.users;
      return {
        id: row.id,
        fecha: row.created_at,
        accion: row.action,
        alumnoNombre: student?.users
          ? [
              student.users.paternal_last_name,
              student.users.maternal_last_name,
              student.users.first_names,
            ]
              .filter(Boolean)
              .join(' ')
          : '—',
        usuarioNombre: actionUser
          ? `${actionUser.first_names} ${actionUser.paternal_last_name}`
          : '—',
      };
    });

    this._log.set(rows);
  }

  private async invokeGenerateCertificate(
    enrollmentId: number,
  ): Promise<{ url: string; path: string } | null> {
    this._generatingId.set(enrollmentId);
    try {
      const { data, error } = await this.supabase.client.functions.invoke(
        'generate-certificate-professional-pdf',
        { body: { enrollment_id: enrollmentId } },
      );
      if (error || !data?.pdfUrl) {
        this.toast.error('No se pudo generar el certificado profesional');
        return null;
      }
      return { url: data.pdfUrl as string, path: data.pdfPath as string };
    } catch {
      this.toast.error('Error al generar el certificado profesional');
      return null;
    } finally {
      this._generatingId.set(null);
    }
  }

  private async getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await this.supabase.client.storage
      .from('documents')
      .createSignedUrl(path, expiresIn);
    if (error || !data) throw error ?? new Error('No se pudo firmar la URL');
    return data.signedUrl;
  }

  private async refreshPromocionesSilently(): Promise<void> {
    try {
      await Promise.all([this.fetchPromociones(), this.fetchLog()]);
    } catch {
      // fail silencioso
    }
  }
}
