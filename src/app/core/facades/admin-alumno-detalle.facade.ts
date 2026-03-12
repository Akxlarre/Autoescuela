import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type {
  AlumnoDetalleUI,
  InasistenciaUI,
  ProgresoUI,
} from '@core/models/ui/alumno-detalle.model';

/** Status de la BD que representa asistencia */
const STATUS_PRESENTE = 'presente';

/** Clases requeridas por defecto para Clase B.
 *  TODO: derivar de enrollments.course_id → courses config cuando esté disponible. */
const PRACTICAS_REQUERIDAS_B = 12;
const TEORICAS_REQUERIDAS_B = 8;

@Injectable({ providedIn: 'root' })
export class AdminAlumnoDetalleFacade {
  private readonly supabase = inject(SupabaseService);

  // ── 1. ESTADO REACTIVO (Privado) ────────────────────────────────────────────
  private readonly _alumno = signal<AlumnoDetalleUI | null>(null);
  private readonly _inasistencias = signal<InasistenciaUI[]>([]);
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

  // ── 2. ESTADO EXPUESTO (Público, solo lectura) ───────────────────────────────
  readonly alumno = this._alumno.asReadonly();
  readonly inasistencias = this._inasistencias.asReadonly();
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
   * Carga el detalle completo de un alumno.
   * Lanza 3 queries en paralelo: info personal, asistencia práctica, asistencia teórica.
   */
  async loadDetalle(studentId: number): Promise<void> {
    // Resetea estado para evitar flash de datos anteriores
    this._alumno.set(null);
    this._inasistencias.set([]);
    this._progresoPractico.set({ completadas: 0, requeridas: PRACTICAS_REQUERIDAS_B });
    this._progresoTeorico.set({ completadas: 0, requeridas: TEORICAS_REQUERIDAS_B });
    this._error.set(null);
    this._isLoading.set(true);

    try {
      // ── Step 1: Info personal (necesitamos enrollmentId para las queries de evidence) ──
      const { data: s, error: studentError } = await this.supabase.client
        .from('students')
        .select(
          `
          id, status, created_at,
          users!inner(
            id, rut, first_names, paternal_last_name, maternal_last_name, email, phone
          ),
          enrollments(
            id, number, created_at,
            courses!inner(name)
          )
        `,
        )
        .eq('id', studentId)
        .single();

      if (studentError) throw studentError;

      // ── Mapeo: Info Personal ──

      // Supabase devuelve los joins como arrays — extraemos el primer elemento con cast explícito
      type UserRow = {
        rut: string;
        first_names: string;
        paternal_last_name: string;
        maternal_last_name: string;
        email: string;
        phone?: string | null;
      };
      type CourseRow = { name: string };
      type EnrollmentRow = {
        id: number;
        number?: string | null;
        created_at: string;
        courses?: CourseRow | CourseRow[] | null;
      };

      const usersRaw = s.users as unknown;
      const u: UserRow = (Array.isArray(usersRaw) ? usersRaw[0] : usersRaw) as UserRow;

      const enrollments: EnrollmentRow[] = Array.isArray(s.enrollments)
        ? (s.enrollments as unknown as EnrollmentRow[])
        : [];
      const lastEnrollment =
        enrollments.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0] ?? null;

      // courses también puede llegar como array según la relación PostgREST
      const coursesRaw = lastEnrollment?.courses;
      const courseName: string | null =
        coursesRaw == null
          ? null
          : Array.isArray(coursesRaw)
            ? ((coursesRaw[0] as CourseRow)?.name ?? null)
            : ((coursesRaw as CourseRow).name ?? null);

      this._alumno.set({
        id: s.id,
        enrollmentId: lastEnrollment?.id ?? null,
        nombre: `${u.first_names} ${u.paternal_last_name} ${u.maternal_last_name}`
          .replace(/\s+/g, ' ')
          .trim(),
        rut: u.rut,
        matricula: lastEnrollment?.number ? `#${lastEnrollment.number}` : '—',
        curso: courseName ?? '—',
        email: u.email,
        telefono: u.phone ?? '—',
        fechaIngreso: s.created_at.slice(0, 10),
        estado: this.formatStatus(s.status),
      });

      // ── Step 2: Queries en paralelo ──────────────────────────────────────────
      const enrollmentId = lastEnrollment?.id ?? null;

      type EvidenceRow = {
        id: number;
        document_date: string | null;
        document_type: string | null;
        description: string | null;
        file_url: string | null;
        status: string | null;
      };

      const [practiceResult, theoryResult, evidenceResult] = await Promise.all([
        this.supabase.client
          .from('class_b_practice_attendance')
          .select('status')
          .eq('student_id', studentId),

        this.supabase.client
          .from('class_b_theory_attendance')
          .select('status')
          .eq('student_id', studentId),

        enrollmentId != null
          ? this.supabase.client
              .from('absence_evidence')
              .select('id, document_date, document_type, description, file_url, status')
              .eq('enrollment_id', enrollmentId)
              .order('document_date', { ascending: false })
          : Promise.resolve({ data: [] as EvidenceRow[], error: null }),
      ]);

      // ── Mapeo: Progreso Práctico ──
      const practiceRows = practiceResult.data ?? [];
      this._progresoPractico.set({
        completadas: practiceRows.filter((r: { status: string }) => r.status === STATUS_PRESENTE)
          .length,
        requeridas: PRACTICAS_REQUERIDAS_B,
      });

      // ── Mapeo: Progreso Teórico ──
      const theoryRows = theoryResult.data ?? [];
      this._progresoTeorico.set({
        completadas: theoryRows.filter((r: { status: string }) => r.status === STATUS_PRESENTE)
          .length,
        requeridas: TEORICAS_REQUERIDAS_B,
      });

      // ── Mapeo: Evidencias de Inasistencia (desde absence_evidence) ──
      const evidenceRows: EvidenceRow[] = (evidenceResult.data as EvidenceRow[]) ?? [];
      this._inasistencias.set(
        evidenceRows.map((e) => ({
          id: e.id,
          fecha: this.formatDate(e.document_date),
          documentType: e.document_type ?? '—',
          description: e.description ?? null,
          fileUrl: e.file_url ?? null,
          status: e.status ?? 'pending',
        })),
      );
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al cargar la ficha del alumno');
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Inserta un registro en `absence_evidence` para justificar una inasistencia.
   * Lanza un error si la operación falla — el componente llamador maneja el estado de carga.
   */
  async insertAbsenceEvidence(payload: {
    enrollmentId: number;
    documentType: string;
    description: string;
    fileUrl: string | null;
    documentDate: string;
  }): Promise<void> {
    const { error } = await this.supabase.client.from('absence_evidence').insert({
      enrollment_id: payload.enrollmentId,
      document_type: payload.documentType,
      description: payload.description,
      file_url: payload.fileUrl,
      document_date: payload.documentDate,
      status: 'pending',
    });
    if (error) throw error;
  }

  // ── Helpers privados ─────────────────────────────────────────────────────────

  private formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private formatStatus(status: string | null | undefined): string {
    const map: Record<string, string> = {
      active: 'Activo',
      inactive: 'Inactivo',
      withdrawn: 'Retirado',
      completed: 'Finalizado',
      activo: 'Activo',
      inactivo: 'Inactivo',
      retirado: 'Retirado',
    };
    return map[status?.toLowerCase() ?? ''] ?? status ?? 'Sin estado';
  }
}
