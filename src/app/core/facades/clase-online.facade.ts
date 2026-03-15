import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

export interface AlumnoClaseBUI {
  studentId: number;
  enrollmentId: number;
  nombre: string;
  email: string;
}

export interface SesionTeoriaUI {
  id: number;
  scheduledAt: string;
  topic: string | null;
  zoomLink: string | null;
  status: string | null;
}

interface TheorySessionRow {
  id: number;
  scheduled_at: string;
  topic: string | null;
  zoom_link: string | null;
  status: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClaseOnlineFacade {
  private readonly supabase = inject(SupabaseService);

  // ─── Estado privado ───────────────────────────────────────────────────────
  private readonly _sesionHoy = signal<SesionTeoriaUI | null>(null);
  private readonly _alumnos = signal<AlumnoClaseBUI[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _savedOk = signal(false);

  // ─── Estado expuesto (solo lectura) ──────────────────────────────────────
  readonly sesionHoy = this._sesionHoy.asReadonly();
  readonly alumnos = this._alumnos.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly savedOk = this._savedOk.asReadonly();
  readonly totalAlumnos = computed(() => this._alumnos().length);

  // ─── Métodos de acción ───────────────────────────────────────────────────

  /** Carga sesión más próxima Y alumnos activos de Clase B en paralelo. */
  async cargarDatos(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    this._savedOk.set(false);
    await Promise.all([this.cargarSesion(), this.cargarAlumnosClaseB()]);
    this._isLoading.set(false);
  }

  private async cargarSesion(): Promise<void> {
    const ahora = new Date().toISOString();

    const { data, error } = await this.supabase.client
      .from('class_b_theory_sessions')
      .select('id, scheduled_at, topic, zoom_link, status')
      .gte('scheduled_at', ahora)
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      // Fallback: sesión más reciente (ya pasada)
      const { data: fallback } = await this.supabase.client
        .from('class_b_theory_sessions')
        .select('id, scheduled_at, topic, zoom_link, status')
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallback) {
        const row = fallback as unknown as TheorySessionRow;
        this._sesionHoy.set({
          id: row.id,
          scheduledAt: row.scheduled_at,
          topic: row.topic ?? null,
          zoomLink: row.zoom_link ?? null,
          status: row.status ?? null,
        });
      } else {
        this._sesionHoy.set(null);
      }
      return;
    }

    const row = data as unknown as TheorySessionRow;
    this._sesionHoy.set({
      id: row.id,
      scheduledAt: row.scheduled_at,
      topic: row.topic ?? null,
      zoomLink: row.zoom_link ?? null,
      status: row.status ?? null,
    });
  }

  private async cargarAlumnosClaseB(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select(
        `id,
         students!inner(
           id,
           users!inner(first_names, paternal_last_name, email)
         ),
         courses!inner(id, name)`,
      )
      .eq('status', 'active');

    if (error || !data) {
      this._alumnos.set([]);
      return;
    }

    const rows = data as unknown as Array<{
      id: number;
      students: {
        id: number;
        users: { first_names: string; paternal_last_name: string; email: string };
      } | null;
      courses: { id: number; name: string } | null;
    }>;

    const claseB = rows.filter((e) => {
      const courseName = e.courses?.name?.toLowerCase() ?? '';
      return courseName.includes('clase b');
    });

    this._alumnos.set(
      claseB
        .map((e) => ({
          studentId: e.students?.id ?? 0,
          enrollmentId: e.id,
          nombre:
            `${e.students?.users?.first_names ?? ''} ${e.students?.users?.paternal_last_name ?? ''}`.trim(),
          email: e.students?.users?.email ?? '',
        }))
        .filter((a) => a.studentId > 0),
    );
  }

  /** Actualiza zoom_link en la sesión actual. */
  async guardarZoomLink(sessionId: number, zoomLink: string): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    const { error } = await this.supabase.client
      .from('class_b_theory_sessions')
      .update({ zoom_link: zoomLink })
      .eq('id', sessionId);

    if (error) {
      this._error.set(error.message);
    } else {
      this._savedOk.set(true);
      const current = this._sesionHoy();
      if (current) this._sesionHoy.set({ ...current, zoomLink });
    }

    this._isLoading.set(false);
  }

  /**
   * Registra asistencia: borra registros previos de la sesión e inserta
   * los nuevos (delete-before-insert para soportar correcciones).
   */
  async guardarAsistencia(sessionId: number, studentIds: number[]): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    const { error: delError } = await this.supabase.client
      .from('class_b_theory_attendance')
      .delete()
      .eq('theory_session_b_id', sessionId);

    if (delError) {
      this._error.set(delError.message);
      this._isLoading.set(false);
      return;
    }

    if (studentIds.length > 0) {
      const { error: insError } = await this.supabase.client
        .from('class_b_theory_attendance')
        .insert(
          studentIds.map((studentId) => ({
            theory_session_b_id: sessionId,
            student_id: studentId,
            status: 'presente',
          })),
        );

      if (insError) {
        this._error.set(insError.message);
        this._isLoading.set(false);
        return;
      }
    }

    this._savedOk.set(true);
    this._isLoading.set(false);
  }

  resetSavedOk(): void {
    this._savedOk.set(false);
    this._error.set(null);
  }
}
