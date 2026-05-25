import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import type {
  AlumnoDetalleUI,
  ClasePracticaUI,
  ElegibilidadProfUI,
  InasistenciaUI,
  PagoUI,
  ProgresoAsistenciaProf,
  ProgresoUI,
} from '@core/models/ui/alumno-detalle.model';
import { formatChileanDate, to24hTime } from '@core/utils/date.utils';
import type {
  InstructorOption,
  ScheduleGrid,
  SlotStatus,
  TimeSlot,
  WeekDay,
  WeekRange,
} from '@core/models/ui/enrollment-assignment.model';

export interface ReprogramarClasePayload {
  sessionId: number | null;
  enrollmentId: number;
  claseNumero: number;
  instructorId: number;
  /** Timestamptz del slot — usado como scheduled_at y como key del mapa vehicle */
  scheduledAt: string;
}

/** Status de la BD que representa asistencia (ambos flujos escriben 'present' en inglés) */
const STATUS_PRESENTE = 'present';

/** Clases requeridas por defecto para Clase B. */
const PRACTICAS_REQUERIDAS_B = 12;
const TEORICAS_REQUERIDAS_B = 8;

const TEORIA_MIN_PROF = 75;
const NOTA_MIN_PROF = 75;

@Injectable({ providedIn: 'root' })
export class AdminAlumnoDetalleFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly dmsViewer = inject(DmsViewerService);

  // ── 1. ESTADO REACTIVO (Privado) ────────────────────────────────────────────
  private readonly _alumno = signal<AlumnoDetalleUI | null>(null);
  private readonly _inasistencias = signal<InasistenciaUI[]>([]);
  private readonly _clasesPracticas = signal<ClasePracticaUI[]>([]);
  private readonly _historialPagos = signal<PagoUI[]>([]);
  private readonly _progresoPractico = signal<ProgresoUI>({
    completadas: 0,
    requeridas: PRACTICAS_REQUERIDAS_B,
  });
  private readonly _progresoTeorico = signal<ProgresoUI>({
    completadas: 0,
    requeridas: TEORICAS_REQUERIDAS_B,
  });
  private readonly _certPdfPath = signal<string | null>(null);
  private readonly _licensePdfPath = signal<string | null>(null);
  private readonly _isGeneratingLicense = signal(false);
  private readonly _contractGeneratedPath = signal<string | null>(null);
  private readonly _contractSignedPath = signal<string | null>(null);
  private readonly _registrationChannel = signal<'presential' | 'online' | null>(null);
  private readonly _isUploadingContract = signal(false);
  private readonly _isDownloadingContract = signal(false);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ── Estado exclusivo de Clase Profesional ──────────────────────────────────
  private readonly _progresoTeoriaProf = signal<ProgresoAsistenciaProf>({
    pct: null,
    asistidas: 0,
    totales: 0,
  });
  private readonly _progresoPracticaProf = signal<ProgresoAsistenciaProf>({
    pct: null,
    asistidas: 0,
    totales: 0,
  });
  private readonly _notaPromedioProf = signal<number | null>(null);
  private readonly _elegibilidadProf = signal<ElegibilidadProfUI>({
    teoria: false,
    practica: false,
    pago: false,
    nota: false,
  });

  // ── Reprogramar Clase ──────────────────────────────────────────────────────
  private readonly _instructores = signal<InstructorOption[]>([]);
  private readonly _scheduleGrid = signal<ScheduleGrid | null>(null);
  private readonly _isLoadingSchedule = signal(false);
  private readonly _reprogramarTarget = signal<{
    sessionId: number | null;
    claseNumero: number;
    enrollmentId: number;
  } | null>(null);
  /** slot_start (timestamptz) → vehicle_id; rebuilt on each loadScheduleGrid call. */
  private _slotVehicleMap = new Map<string, number>();

  // ── SWR & Realtime State ───────────────────────────────────────────────────
  private _initialized = false;
  private _lastStudentId: number | null = null;
  private _realtimeChannel: any | null = null;

  // ── 2. ESTADO EXPUESTO (Público, solo lectura) ───────────────────────────────
  readonly alumno = this._alumno.asReadonly();
  readonly inasistencias = this._inasistencias.asReadonly();
  readonly clasesPracticas = this._clasesPracticas.asReadonly();
  readonly historialPagos = this._historialPagos.asReadonly();
  readonly progresoPractico = this._progresoPractico.asReadonly();
  readonly progresoTeorico = this._progresoTeorico.asReadonly();
  readonly certPdfPath = this._certPdfPath.asReadonly();
  readonly licensePdfPath = this._licensePdfPath.asReadonly();
  readonly isGeneratingLicense = this._isGeneratingLicense.asReadonly();
  readonly contractGeneratedPath = this._contractGeneratedPath.asReadonly();
  readonly contractSignedPath = this._contractSignedPath.asReadonly();
  readonly registrationChannel = this._registrationChannel.asReadonly();
  readonly isUploadingContract = this._isUploadingContract.asReadonly();
  readonly isDownloadingContract = this._isDownloadingContract.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  // Profesional
  readonly progresoTeoriaProf = this._progresoTeoriaProf.asReadonly();
  readonly progresoPracticaProf = this._progresoPracticaProf.asReadonly();
  readonly notaPromedioProf = this._notaPromedioProf.asReadonly();
  readonly elegibilidadProf = this._elegibilidadProf.asReadonly();
  readonly elegibleProf = computed(() => {
    const e = this._elegibilidadProf();
    return e.teoria && e.pago && e.nota;
  });

  readonly instructores = this._instructores.asReadonly();
  readonly scheduleGrid = this._scheduleGrid.asReadonly();
  readonly isLoadingSchedule = this._isLoadingSchedule.asReadonly();
  readonly reprogramarTarget = this._reprogramarTarget.asReadonly();

  // Computed: porcentajes Clase B
  readonly porcentajePracticas = computed(() => {
    const p = this._progresoPractico();
    return p.requeridas > 0 ? Math.round((p.completadas / p.requeridas) * 100) : 0;
  });

  readonly porcentajeTeoricas = computed(() => {
    const t = this._progresoTeorico();
    return t.requeridas > 0 ? Math.round((t.completadas / t.requeridas) * 100) : 0;
  });

  // ── 3. MÉTODOS DE ACCIÓN ─────────────────────────────────────────────────────

  /**
   * Suscribe a cambios en tiempo real para el estudiante actual.
   * Incluye tablas de Clase B y Clase Profesional para cubrir ambos tipos.
   */
  setupRealtime(studentId: number): void {
    if (this._realtimeChannel) return;

    this._realtimeChannel = this.supabase.client
      .channel(`alumno-detalle-${studentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'absence_evidence' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_b_sessions' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'professional_theory_attendance' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'professional_practice_attendance' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'professional_module_grades' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => void this.refreshSilently(),
      )
      .subscribe();
  }

  destroyRealtime(): void {
    if (this._realtimeChannel) {
      void this.supabase.client.removeChannel(this._realtimeChannel);
      this._realtimeChannel = null;
    }
  }

  /**
   * SWR Initialization for Student detail:
   * If visiting the SAME student, refresh silently in background.
   */
  async initialize(studentId: number): Promise<void> {
    const isSameStudent = this._initialized && studentId === this._lastStudentId;

    this.setupRealtime(studentId);

    if (isSameStudent) {
      void this.refreshSilently();
      return;
    }

    // New student: clear and load
    this._alumno.set(null);
    this._inasistencias.set([]);
    this._clasesPracticas.set([]);
    this._historialPagos.set([]);
    this._progresoPractico.set({ completadas: 0, requeridas: PRACTICAS_REQUERIDAS_B });
    this._progresoTeorico.set({ completadas: 0, requeridas: TEORICAS_REQUERIDAS_B });
    this._certPdfPath.set(null);
    this._licensePdfPath.set(null);
    this._contractGeneratedPath.set(null);
    this._contractSignedPath.set(null);
    this._registrationChannel.set(null);
    this._progresoTeoriaProf.set({ pct: null, asistidas: 0, totales: 0 });
    this._progresoPracticaProf.set({ pct: null, asistidas: 0, totales: 0 });
    this._notaPromedioProf.set(null);
    this._elegibilidadProf.set({ teoria: false, practica: false, pago: false, nota: false });
    this._error.set(null);
    this._isLoading.set(true);

    try {
      await this.fetchDetalleData(studentId);
      this._initialized = true;
      this._lastStudentId = studentId;
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    const sid = this._lastStudentId;
    if (sid == null) return;
    try {
      await this.fetchDetalleData(sid);
    } catch {
      // Swallowed
    }
  }

  /** Refresca la ficha en background (sin skeleton). Útil tras mutaciones externas. */
  async refresh(): Promise<void> {
    return this.refreshSilently();
  }

  /** Legacy wrapper */
  async loadDetalle(studentId: number): Promise<void> {
    return this.initialize(studentId);
  }

  private async fetchDetalleData(studentId: number): Promise<void> {
    try {
      // ── Step 1: Info personal ──
      const { data: s, error: studentError } = await this.supabase.client
        .from('students')
        .select(
          `
          id, status, created_at,
          users!inner(id, rut, first_names, paternal_last_name, maternal_last_name, email, phone),
          enrollments(
            id, number, created_at, total_paid, pending_balance,
            license_group, promotion_course_id, registration_channel,
            certificate_b_pdf_url, certificate_professional_pdf_url,
            license_pdf_url,
            courses!inner(name),
            digital_contracts(file_url, signed_contract_url)
          )
        `,
        )
        .eq('id', studentId)
        .single();

      if (studentError) throw studentError;

      const rawU = s.users as any;
      const u = Array.isArray(rawU) ? rawU[0] : rawU;
      const enrollments = (s.enrollments ?? []) as any[];
      const lastEnrollment =
        enrollments.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0] ?? null;

      const courseName = Array.isArray(lastEnrollment?.courses)
        ? lastEnrollment.courses[0]?.name
        : lastEnrollment?.courses?.name;

      const enrollmentId = lastEnrollment?.id ?? null;
      const licenseGroup: 'class_b' | 'professional' =
        lastEnrollment?.license_group === 'professional' ? 'professional' : 'class_b';
      const promotionCourseId = (lastEnrollment?.promotion_course_id as number | null) ?? null;

      this._certPdfPath.set(
        licenseGroup === 'professional'
          ? (lastEnrollment?.certificate_professional_pdf_url ?? null)
          : (lastEnrollment?.certificate_b_pdf_url ?? null),
      );
      this._licensePdfPath.set(lastEnrollment?.license_pdf_url ?? null);

      const dcRaw = lastEnrollment?.digital_contracts;
      const dc = Array.isArray(dcRaw) ? dcRaw[0] : dcRaw;
      this._contractGeneratedPath.set((dc?.file_url as string) ?? null);
      this._contractSignedPath.set((dc?.signed_contract_url as string) ?? null);
      const rawChannel = lastEnrollment?.registration_channel;

      let normalized: 'presential' | 'online' | null = null;

      if (rawChannel === 'in_person') normalized = 'presential';
      else if (rawChannel === 'online') normalized = 'online';

      this._registrationChannel.set(normalized);

      this._alumno.set({
        id: s.id,
        userId: u.id,
        enrollmentId,
        nombre: `${u.first_names} ${u.paternal_last_name} ${u.maternal_last_name}`
          .replace(/\s+/g, ' ')
          .trim(),
        firstName: u.first_names,
        paternalLastName: u.paternal_last_name,
        maternalLastName: u.maternal_last_name,
        rut: u.rut,
        matricula: lastEnrollment?.number ? `#${lastEnrollment.number}` : '—',
        curso: courseName ?? '—',
        email: u.email,
        telefono: u.phone ?? '—',
        fechaIngreso: s.created_at.slice(0, 10),
        estado: this.formatStatus(s.status),
        licenseGroup,
        totalPagado: lastEnrollment?.total_paid ?? 0,
        saldoPendiente: lastEnrollment?.pending_balance ?? 0,
      });

      // ── Step 2: Queries según tipo de licencia ──
      if (licenseGroup === 'professional') {
        await this.fetchProfessionalProgress(enrollmentId, promotionCourseId);
        return;
      }

      // ── Clase B: queries en paralelo ──
      const [practiceResult, theoryResult, evidenceResult, sessionResult, paymentsResult] =
        await Promise.all([
          this.supabase.client
            .from('class_b_practice_attendance')
            .select('status')
            .eq('student_id', studentId),
          this.supabase.client
            .from('class_b_theory_attendance')
            .select('status')
            .eq('student_id', studentId),
          enrollmentId
            ? this.supabase.client
                .from('absence_evidence')
                .select('*')
                .eq('enrollment_id', enrollmentId)
                .order('document_date', { ascending: false })
            : Promise.resolve({ data: [] }),
          enrollmentId
            ? this.supabase.client
                .from('class_b_sessions')
                .select(
                  '*, instructors!class_b_sessions_instructor_id_fkey(users(first_names, paternal_last_name))',
                )
                .eq('enrollment_id', enrollmentId)
                .order('class_number', { ascending: true })
            : Promise.resolve({ data: [] }),
          enrollmentId
            ? this.supabase.client
                .from('payments')
                .select('*')
                .eq('enrollment_id', enrollmentId)
                .order('payment_date', { ascending: true })
            : Promise.resolve({ data: [] }),
        ]);

      this._progresoPractico.set({
        completadas: (practiceResult.data ?? []).filter((r: any) => r.status === STATUS_PRESENTE)
          .length,
        requeridas: PRACTICAS_REQUERIDAS_B,
      });

      this._progresoTeorico.set({
        completadas: (theoryResult.data ?? []).filter((r: any) => r.status === STATUS_PRESENTE)
          .length,
        requeridas: TEORICAS_REQUERIDAS_B,
      });

      this._inasistencias.set(
        (evidenceResult.data ?? []).map((e: any) => ({
          id: e.id,
          fecha: this.formatDate(e.document_date),
          documentType: e.document_type ?? '—',
          description: e.description ?? null,
          fileUrl: e.file_url ?? null,
          status: e.status ?? 'pending',
        })),
      );

      const sessionMap = new Map<number, any>(
        (sessionResult.data ?? []).map((s: any) => [Number(s.class_number), s]),
      );
      this._clasesPracticas.set(
        Array.from({ length: PRACTICAS_REQUERIDAS_B }, (_, i) => {
          const num = i + 1;
          const ses = sessionMap.get(num);
          if (!ses)
            return {
              numero: num,
              sessionId: null,
              fecha: null,
              scheduledDate: null,
              hora: null,
              instructor: null,
              kmInicio: null,
              kmFin: null,
              observaciones: null,
              completada: false,
              alumnoFirmo: false,
              instructorFirmo: false,
            };

          const instRaw = ses.instructors as any;
          const inst = Array.isArray(instRaw) ? instRaw[0] : instRaw;
          const uRaw = inst?.users as any;
          const uInst = Array.isArray(uRaw) ? uRaw[0] : uRaw;
          const instructor = uInst
            ? `${uInst.first_names} ${uInst.paternal_last_name}`.trim()
            : null;

          return {
            numero: num,
            sessionId: ses.id ?? null,
            fecha: this.formatClassDate(ses.scheduled_at),
            scheduledDate: this.slotDateFromStart(ses.scheduled_at) || null,
            hora: this.formatHour(ses.start_time, ses.end_time),
            instructor,
            kmInicio: ses.km_start,
            kmFin: ses.km_end,
            observaciones: ses.performance_notes ?? ses.notes ?? null,
            completada: !!(ses.student_signature && ses.instructor_signature),
            alumnoFirmo: !!ses.student_signature,
            instructorFirmo: !!ses.instructor_signature,
          };
        }),
      );

      this._historialPagos.set(
        (paymentsResult.data ?? []).map((p: any, idx: number) => ({
          id: p.id,
          fecha: this.formatDate(p.payment_date),
          concepto: p.type?.trim() || `Pago #${idx + 1}`,
          monto: p.total_amount ?? 0,
          metodo: this.derivePaymentMethod(p),
          estado: this.formatPaymentStatus(p.status),
        })),
      );
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al cargar la ficha del alumno');
      throw err;
    }
  }

  /**
   * Obtiene progreso académico para alumnos de Clase Profesional:
   * asistencia teórica/práctica, nota promedio y elegibilidad de certificado.
   */
  private async fetchProfessionalProgress(
    enrollmentId: number | null,
    promotionCourseId: number | null,
  ): Promise<void> {
    if (!enrollmentId || !promotionCourseId) {
      this._progresoTeoriaProf.set({ pct: null, asistidas: 0, totales: 0 });
      this._progresoPracticaProf.set({ pct: null, asistidas: 0, totales: 0 });
      this._notaPromedioProf.set(null);
      this._elegibilidadProf.set({ teoria: false, practica: false, pago: false, nota: false });
      this._inasistencias.set([]);
      this._clasesPracticas.set([]);
      this._historialPagos.set([]);
      return;
    }

    // Sesiones completadas del curso + inasistencias + pagos en paralelo
    const [theorySessionsRes, practiceSessionsRes, evidenceRes, paymentsRes, gradesRes] =
      await Promise.all([
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
        this.supabase.client
          .from('absence_evidence')
          .select('*')
          .eq('enrollment_id', enrollmentId)
          .order('document_date', { ascending: false }),
        this.supabase.client
          .from('payments')
          .select('*')
          .eq('enrollment_id', enrollmentId)
          .order('payment_date', { ascending: true }),
        this.supabase.client
          .from('professional_module_grades')
          .select('grade')
          .eq('enrollment_id', enrollmentId),
      ]);

    const theoryIds = (theorySessionsRes.data ?? []).map((s: any) => s.id as number);
    const practiceIds = (practiceSessionsRes.data ?? []).map((s: any) => s.id as number);

    // Asistencia de este alumno en esas sesiones
    const [theoryAttRes, practiceAttRes] = await Promise.all([
      theoryIds.length > 0
        ? this.supabase.client
            .from('professional_theory_attendance')
            .select('status')
            .eq('enrollment_id', enrollmentId)
            .in('theory_session_prof_id', theoryIds)
        : Promise.resolve({ data: [] as any[] }),
      practiceIds.length > 0
        ? this.supabase.client
            .from('professional_practice_attendance')
            .select('status')
            .eq('enrollment_id', enrollmentId)
            .in('session_id', practiceIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const theoryPresent = (theoryAttRes.data ?? []).filter(
      (r: any) => r.status === STATUS_PRESENTE,
    ).length;
    const practicePresent = (practiceAttRes.data ?? []).filter(
      (r: any) => r.status === STATUS_PRESENTE,
    ).length;

    const pctTeoria =
      theoryIds.length > 0 ? Math.round((theoryPresent / theoryIds.length) * 100) : null;
    const pctPractica =
      practiceIds.length > 0 ? Math.round((practicePresent / practiceIds.length) * 100) : null;

    const grades = (gradesRes.data ?? []).map((g: any) => Number(g.grade));
    const notaPromedio =
      grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;

    const pendingBalance = this._alumno()?.saldoPendiente ?? 1;
    const pagoCorrecto = pendingBalance <= 0;

    this._progresoTeoriaProf.set({
      pct: pctTeoria,
      asistidas: theoryPresent,
      totales: theoryIds.length,
    });
    this._progresoPracticaProf.set({
      pct: pctPractica,
      asistidas: practicePresent,
      totales: practiceIds.length,
    });
    this._notaPromedioProf.set(notaPromedio);
    this._elegibilidadProf.set({
      teoria: pctTeoria !== null && pctTeoria >= TEORIA_MIN_PROF,
      practica: pctPractica !== null && pctPractica >= 100,
      pago: pagoCorrecto,
      nota: notaPromedio !== null && notaPromedio >= NOTA_MIN_PROF,
    });

    this._inasistencias.set(
      (evidenceRes.data ?? []).map((e: any) => ({
        id: e.id,
        fecha: this.formatDate(e.document_date),
        documentType: e.document_type ?? '—',
        description: e.description ?? null,
        fileUrl: e.file_url ?? null,
        status: e.status ?? 'pending',
      })),
    );

    this._historialPagos.set(
      (paymentsRes.data ?? []).map((p: any, idx: number) => ({
        id: p.id,
        fecha: this.formatDate(p.payment_date),
        concepto: p.type?.trim() || `Pago #${idx + 1}`,
        monto: p.total_amount ?? 0,
        metodo: this.derivePaymentMethod(p),
        estado: this.formatPaymentStatus(p.status),
      })),
    );

    // Clase B específicos: vaciar para no mostrar datos obsoletos
    this._clasesPracticas.set([]);
    this._progresoPractico.set({ completadas: 0, requeridas: 0 });
    this._progresoTeorico.set({ completadas: 0, requeridas: 0 });
  }

  /** Genera el carnet PDF via Edge Function y lo muestra en el DmsViewer. */
  async generarCarnet(enrollmentId: number): Promise<void> {
    this._isGeneratingLicense.set(true);
    try {
      const { data, error } = await this.supabase.client.functions.invoke(
        'generate-student-license-pdf',
        { body: { enrollment_id: enrollmentId } },
      );
      if (error || !data?.pdfUrl) {
        this.toast.error('Error al generar el carnet. Intenta de nuevo.');
        return;
      }
      this._licensePdfPath.set(data.pdfPath ?? null);
      this.dmsViewer.openByUrl(data.pdfUrl, 'Carnet del Alumno');
    } catch {
      this.toast.error('Error inesperado al generar el carnet.');
    } finally {
      this._isGeneratingLicense.set(false);
    }
  }

  /** Abre el carnet ya generado usando una signed URL de corta vida. */
  async verCarnet(storagePath: string): Promise<void> {
    const { data, error } = await this.supabase.client.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) {
      this.toast.error('No se pudo abrir el carnet. Intenta de nuevo.');
      return;
    }
    this.dmsViewer.openByUrl(data.signedUrl, 'Carnet del Alumno');
  }

  /** Abre el contrato (firmado o presencial) usando una signed URL de corta vida. */
  async verContrato(path: string): Promise<void> {
    const { data, error } = await this.supabase.client.storage
      .from('documents')
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      this.toast.error('No se pudo abrir el contrato. Intenta de nuevo.');
      return;
    }
    this.dmsViewer.openByUrl(data.signedUrl, 'Contrato del Alumno');
  }

  /** Descarga el contrato generado (sin firmar) como PDF. Solo para flujo online. */
  async descargarContrato(path: string): Promise<void> {
    this._isDownloadingContract.set(true);
    try {
      const { data, error } = await this.supabase.client.storage
        .from('documents')
        .createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) {
        this.toast.error('No se pudo descargar el contrato.');
        return;
      }
      const blob = await fetch(data.signedUrl).then((r) => r.blob());
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'Contrato.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      this.toast.error('No se pudo descargar el contrato.');
    } finally {
      this._isDownloadingContract.set(false);
    }
  }

  /** Sube el contrato firmado escaneado al storage y actualiza digital_contracts. */
  async subirContratoFirmado(enrollmentId: number, file: File): Promise<void> {
    this._isUploadingContract.set(true);
    try {
      const path = `contracts/${enrollmentId}/signed_contract.pdf`;
      const { error: uploadError } = await this.supabase.client.storage
        .from('documents')
        .upload(path, file, { contentType: 'application/pdf', upsert: true });
      if (uploadError) throw uploadError;

      const { error: updateError } = await this.supabase.client
        .from('digital_contracts')
        .update({ signed_contract_url: path })
        .eq('enrollment_id', enrollmentId);
      if (updateError) throw updateError;

      this._contractSignedPath.set(path);
      this.toast.success('Contrato firmado subido correctamente.');
    } catch {
      this.toast.error('Error al subir el contrato firmado. Intenta de nuevo.');
    } finally {
      this._isUploadingContract.set(false);
    }
  }

  async insertAbsenceEvidence(payload: any): Promise<void> {
    const { error } = await this.supabase.client.from('absence_evidence').insert({
      enrollment_id: payload.enrollmentId,
      document_type: payload.documentType,
      description: payload.description,
      file_url: payload.fileUrl,
      document_date: payload.documentDate,
      status: 'pending',
    });
    if (error) throw error;
    void this.refreshSilently();
  }

  async actualizarPerfilAlumno(userId: number, data: any): Promise<void> {
    const { error } = await this.supabase.client
      .from('users')
      .update({
        first_names: data.first_names.trim(),
        paternal_last_name: data.paternal_last_name.trim(),
        maternal_last_name: data.maternal_last_name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim() || null,
      })
      .eq('id', userId);
    if (error) throw error;
    void this.refreshSilently();
  }

  private formatDate(dateStr: string | null | undefined): string {
    return formatChileanDate(dateStr);
  }

  private formatClassDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}`;
  }

  private formatHour(
    start: string | null | undefined,
    end: string | null | undefined,
  ): string | null {
    if (!start || !end) return null;
    return `${start.slice(0, 5)}-${end.slice(0, 5)}`;
  }

  private formatPaymentStatus(status: string | null | undefined): string {
    const map: Record<string, string> = {
      paid: 'Pagado',
      pending: 'Pendiente',
      refunded: 'Reembolsado',
      cancelled: 'Cancelado',
    };
    return map[status?.toLowerCase() ?? ''] ?? 'Pagado';
  }

  private derivePaymentMethod(p: any): string | null {
    if ((p.cash_amount ?? 0) > 0) return 'Efectivo';
    if ((p.transfer_amount ?? 0) > 0) return 'Transferencia';
    if ((p.card_amount ?? 0) > 0) return 'Tarjeta';
    return null;
  }

  private formatStatus(status: string | null | undefined): string {
    const map: Record<string, string> = {
      active: 'Activo',
      inactive: 'Inactivo',
      withdrawn: 'Retirado',
      completed: 'Finalizado',
    };
    return map[status?.toLowerCase() ?? ''] ?? status ?? 'Sin estado';
  }

  // ── Reprogramar Clase ────────────────────────────────────────────────────────

  /** Prepara el target para el drawer de reprogramación y limpia el grid previo. */
  setReprogramarTarget(sessionId: number | null, claseNumero: number, enrollmentId: number): void {
    this._reprogramarTarget.set({ sessionId, claseNumero, enrollmentId });
    this._scheduleGrid.set(null);
    this._slotVehicleMap.clear();
  }

  /** Carga todos los instructores activos con vehículo asignado. */
  async loadInstructores(): Promise<void> {
    const { data } = await this.supabase.client
      .from('instructors')
      .select(
        `id,
         users!inner(first_names, paternal_last_name),
         vehicle_assignments!inner(vehicles!inner(brand, model, license_plate))`,
      )
      .eq('active', true)
      .is('vehicle_assignments.end_date', null);

    this._instructores.set(
      (data ?? []).map((row: any) => ({
        id: row.id,
        name: `${row.users.first_names} ${row.users.paternal_last_name}`,
        vehicleDescription:
          `${row.vehicle_assignments[0]?.vehicles?.brand ?? ''} ${row.vehicle_assignments[0]?.vehicles?.model ?? ''}`.trim(),
        plate: row.vehicle_assignments[0]?.vehicles?.license_plate ?? '',
      })),
    );
  }

  /** Carga la grilla de disponibilidad para un instructor desde la vista Supabase. */
  async loadScheduleGrid(instructorId: number): Promise<void> {
    this._scheduleGrid.set(null);
    this._slotVehicleMap.clear();
    this._isLoadingSchedule.set(true);
    try {
      const { data } = await this.supabase.client
        .from('v_class_b_schedule_availability')
        .select('*')
        .eq('instructor_id', instructorId)
        .order('slot_start', { ascending: true });

      if (data && data.length > 0) {
        for (const s of data) {
          this._slotVehicleMap.set(String(s.slot_start), s.vehicle_id);
        }
        const blockedDates = this.computeBlockedDates();
        this._scheduleGrid.set(this.buildScheduleGrid(data, blockedDates));
      }
    } finally {
      this._isLoadingSchedule.set(false);
    }
  }

  /** INSERT o UPDATE en class_b_sessions según si ya existe sesión. */
  async reprogramarClase(payload: ReprogramarClasePayload): Promise<void> {
    const vehicleId = this._slotVehicleMap.get(payload.scheduledAt);
    if (!vehicleId) throw new Error('No se pudo determinar el vehículo para este horario.');

    if (payload.sessionId) {
      const { error } = await this.supabase.client
        .from('class_b_sessions')
        .update({
          instructor_id: payload.instructorId,
          vehicle_id: vehicleId,
          scheduled_at: payload.scheduledAt,
          start_time: null,
          end_time: null,
          status: 'scheduled',
        })
        .eq('id', payload.sessionId);
      if (error) throw error;
    } else {
      const { error } = await this.supabase.client.from('class_b_sessions').insert({
        enrollment_id: payload.enrollmentId,
        class_number: payload.claseNumero,
        instructor_id: payload.instructorId,
        vehicle_id: vehicleId,
        scheduled_at: payload.scheduledAt,
        status: 'scheduled',
      });
      if (error) throw error;
    }

    this.toast.success('Clase reprogramada correctamente.');
    await this.refreshSilently();
  }

  private slotDateFromStart(ts: string | null | undefined): string {
    if (!ts) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date(ts));
  }

  /** Returns dates where the student already has 3+ classes, excluding the one being rescheduled. */
  private computeBlockedDates(): Set<string> {
    const excludeSessionId = this._reprogramarTarget()?.sessionId ?? null;
    const counts = new Map<string, number>();
    for (const clase of this._clasesPracticas()) {
      if (!clase.scheduledDate) continue;
      if (clase.sessionId === excludeSessionId) continue;
      counts.set(clase.scheduledDate, (counts.get(clase.scheduledDate) ?? 0) + 1);
    }
    const blocked = new Set<string>();
    for (const [date, count] of counts) {
      if (count >= 3) blocked.add(date);
    }
    return blocked;
  }

  private buildScheduleGrid(rawSlots: any[], blockedDates: Set<string> = new Set()): ScheduleGrid {
    const dates = [...new Set(rawSlots.map((s) => this.slotDateFromStart(s.slot_start)))].sort();

    const days: WeekDay[] = dates.map((d) => {
      const date = new Date(d + 'T12:00:00Z');
      return {
        date: d,
        dayOfWeek: new Intl.DateTimeFormat('es', { weekday: 'short' }).format(date),
        label: new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(date),
      };
    });

    const week: WeekRange = {
      startDate: dates[0] ?? '',
      endDate: dates[dates.length - 1] ?? '',
      label: `${days[0]?.label ?? ''} – ${days[days.length - 1]?.label ?? ''}`,
      days,
    };

    const slots: TimeSlot[] = rawSlots.map((s) => {
      const date = this.slotDateFromStart(s.slot_start);
      const isBlocked = blockedDates.has(date);
      return {
        id: String(s.slot_start),
        date,
        startTime: to24hTime(s.slot_start),
        endTime: to24hTime(s.slot_end),
        status: (isBlocked || s.slot_status === 'occupied'
          ? 'occupied'
          : 'available') as SlotStatus,
      };
    });

    const timeRows = [...new Set(slots.map((s) => s.startTime))].sort();
    return { week, timeRows, slots };
  }
}
