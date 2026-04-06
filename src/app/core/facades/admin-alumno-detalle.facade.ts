import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type {
  AlumnoDetalleUI,
  ClasePracticaUI,
  InasistenciaUI,
  PagoUI,
  ProgresoUI,
} from '@core/models/ui/alumno-detalle.model';
import { formatChileanDate } from '@core/utils/date.utils';

/** Status de la BD que representa asistencia */
const STATUS_PRESENTE = 'presente';

/** Clases requeridas por defecto para Clase B. */
const PRACTICAS_REQUERIDAS_B = 12;
const TEORICAS_REQUERIDAS_B = 8;

@Injectable({ providedIn: 'root' })
export class AdminAlumnoDetalleFacade {
  private readonly supabase = inject(SupabaseService);

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
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

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
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed: porcentajes
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
   */
  setupRealtime(studentId: number): void {
    // Si ya hay un canal, lo cerramos para abrir uno con el nuevo studentId si fuera necesario
    // Pero como el canal es compartido por tablas, solo nos aseguramos de tener uno activo.
    if (this._realtimeChannel) return;

    this._realtimeChannel = this.supabase.client
      .channel(`alumno-detalle-${studentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'absence_evidence' }, () => void this.refreshSilently())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_b_sessions' }, () => void this.refreshSilently())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => void this.refreshSilently())
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

  /** Legacy wrapper */
  async loadDetalle(studentId: number): Promise<void> {
    return this.initialize(studentId);
  }

  private async fetchDetalleData(studentId: number): Promise<void> {
    try {
      // ── Step 1: Info personal ──
      const { data: s, error: studentError } = await this.supabase.client
        .from('students')
        .select(`
          id, status, created_at,
          users!inner(id, rut, first_names, paternal_last_name, maternal_last_name, email, phone),
          enrollments(id, number, created_at, total_paid, pending_balance, courses!inner(name))
        `)
        .eq('id', studentId)
        .single();

      if (studentError) throw studentError;

      const rawU = s.users as any;
      const u = Array.isArray(rawU) ? rawU[0] : rawU;
      const enrollments = (s.enrollments ?? []) as any[];
      const lastEnrollment = enrollments.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0] ?? null;

      const courseName = Array.isArray(lastEnrollment?.courses) 
        ? lastEnrollment.courses[0]?.name 
        : lastEnrollment?.courses?.name;
      
      const enrollmentId = lastEnrollment?.id ?? null;

      this._alumno.set({
        id: s.id,
        userId: u.id,
        enrollmentId,
        nombre: `${u.first_names} ${u.paternal_last_name} ${u.maternal_last_name}`.replace(/\s+/g, ' ').trim(),
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
        totalPagado: lastEnrollment?.total_paid ?? 0,
        saldoPendiente: lastEnrollment?.pending_balance ?? 0,
      });

      // ── Step 2: Queries en paralelo ──
      const [practiceResult, theoryResult, evidenceResult, sessionResult, paymentsResult] = await Promise.all([
        this.supabase.client.from('class_b_practice_attendance').select('status').eq('student_id', studentId),
        this.supabase.client.from('class_b_theory_attendance').select('status').eq('student_id', studentId),
        enrollmentId ? this.supabase.client.from('absence_evidence').select('*').eq('enrollment_id', enrollmentId).order('document_date', { ascending: false }) : Promise.resolve({ data: [] }),
        enrollmentId ? this.supabase.client.from('class_b_sessions').select('*, instructors!class_b_sessions_instructor_id_fkey(users(first_names, paternal_last_name))').eq('enrollment_id', enrollmentId).order('class_number', { ascending: true }) : Promise.resolve({ data: [] }),
        enrollmentId ? this.supabase.client.from('payments').select('*').eq('enrollment_id', enrollmentId).order('payment_date', { ascending: true }) : Promise.resolve({ data: [] }),
      ]);

      this._progresoPractico.set({
        completadas: (practiceResult.data ?? []).filter((r: any) => r.status === STATUS_PRESENTE).length,
        requeridas: PRACTICAS_REQUERIDAS_B,
      });

      this._progresoTeorico.set({
        completadas: (theoryResult.data ?? []).filter((r: any) => r.status === STATUS_PRESENTE).length,
        requeridas: TEORICAS_REQUERIDAS_B,
      });

      this._inasistencias.set((evidenceResult.data ?? []).map((e: any) => ({
        id: e.id,
        fecha: this.formatDate(e.document_date),
        documentType: e.document_type ?? '—',
        description: e.description ?? null,
        fileUrl: e.file_url ?? null,
        status: e.status ?? 'pending',
      })));

      const sessionMap = new Map<number, any>((sessionResult.data ?? []).map((s: any) => [Number(s.class_number), s]));
      this._clasesPracticas.set(Array.from({ length: PRACTICAS_REQUERIDAS_B }, (_, i) => {
        const num = i + 1;
        const ses = sessionMap.get(num);
        if (!ses) return { numero: num, fecha: null, hora: null, instructor: null, kmInicio: null, kmFin: null, observaciones: null, completada: false, alumnoFirmo: false, instructorFirmo: false };
        
        const instRaw = ses.instructors as any;
        const inst = Array.isArray(instRaw) ? instRaw[0] : instRaw;
        const uRaw = inst?.users as any;
        const uInst = Array.isArray(uRaw) ? uRaw[0] : uRaw;
        const instructor = uInst ? `${uInst.first_names} ${uInst.paternal_last_name}`.trim() : null;

        return {
          numero: num,
          fecha: this.formatClassDate(ses.scheduled_at),
          hora: this.formatHour(ses.start_time, ses.end_time),
          instructor,
          kmInicio: ses.km_start,
          kmFin: ses.km_end,
          observaciones: ses.performance_notes ?? ses.notes ?? null,
          completada: !!(ses.student_signature && ses.instructor_signature),
          alumnoFirmo: !!ses.student_signature,
          instructorFirmo: !!ses.instructor_signature,
        };
      }));

      this._historialPagos.set((paymentsResult.data ?? []).map((p: any, idx: number) => ({
        id: p.id,
        fecha: this.formatDate(p.payment_date),
        concepto: p.type?.trim() || `Pago #${idx + 1}`,
        monto: p.total_amount ?? 0,
        metodo: this.derivePaymentMethod(p),
        estado: this.formatPaymentStatus(p.status),
      })));

    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al cargar la ficha del alumno');
      throw err;
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
    const { error } = await this.supabase.client.from('users').update({
      first_names: data.first_names.trim(),
      paternal_last_name: data.paternal_last_name.trim(),
      maternal_last_name: data.maternal_last_name.trim(),
      email: data.email.trim(),
      phone: data.phone.trim() || null,
    }).eq('id', userId);
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

  private formatHour(start: string | null | undefined, end: string | null | undefined): string | null {
    if (!start || !end) return null;
    return `${start.slice(0, 5)}-${end.slice(0, 5)}`;
  }

  private formatPaymentStatus(status: string | null | undefined): string {
    const map: Record<string, string> = { paid: 'Pagado', pending: 'Pendiente', refunded: 'Reembolsado', cancelled: 'Cancelado' };
    return map[status?.toLowerCase() ?? ''] ?? 'Pagado';
  }

  private derivePaymentMethod(p: any): string | null {
    if ((p.cash_amount ?? 0) > 0) return 'Efectivo';
    if ((p.transfer_amount ?? 0) > 0) return 'Transferencia';
    if ((p.card_amount ?? 0) > 0) return 'Tarjeta';
    return null;
  }

  private formatStatus(status: string | null | undefined): string {
    const map: Record<string, string> = { active: 'Activo', inactive: 'Inactivo', withdrawn: 'Retirado', completed: 'Finalizado' };
    return map[status?.toLowerCase() ?? ''] ?? status ?? 'Sin estado';
  }
}
