import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { formatCycleLabel } from '@core/utils/theory-cycle';
import { buildDayLabel, formatChileanDate, monthsAgoIso } from '@core/utils/date.utils';
import { buildStudentDisplayName, sortByPaternalLastNameAsc } from '@core/utils/student-name.util';
import type {
  CicloAlumno,
  CicloAlumnoMovible,
  CicloClaseRow,
  CicloOption,
  CicloStatus,
  ZoomEmailResult,
} from '@core/models/ui/ciclos-teoricos.model';

/**
 * CiclosTeoricosFacade — Spec 0001.
 *
 * Gestiona los Ciclos Teóricos de Clase B (cohortes de 2 semanas, 6 clases L/X/V).
 * - RF-11: selector de ciclos.
 * - RF-12: roster de la cohorte.
 * - RF-14/15/16: enlace Zoom por clase + envío masivo (EF `send-zoom-email`).
 * - Override: mover/traer alumnos entre ciclos.
 *
 * Branch-scoped (facades.md §7): el Smart Component fija el filtro de sede vía
 * `setBranchFilter()` y dispara `loadCycles()`. No usa `effect()` interno.
 */
@Injectable({ providedIn: 'root' })
export class CiclosTeoricosFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly branchFacade = inject(BranchFacade);

  // ── 1. Estado privado ──────────────────────────────────────────────────────
  private readonly _branchFilter = signal<number | null>(null);
  private readonly _cycles = signal<CicloOption[]>([]);
  private readonly _selectedCycleId = signal<number | null>(null);
  private readonly _clases = signal<CicloClaseRow[]>([]);
  private readonly _roster = signal<CicloAlumno[]>([]);
  private readonly _addableStudents = signal<CicloAlumnoMovible[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isLoadingCycle = signal(false);
  private readonly _isSaving = signal(false);
  private readonly _sendingClassId = signal<number | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _emailResult = signal<ZoomEmailResult | null>(null);

  // ── 2. Estado público ──────────────────────────────────────────────────────
  readonly cycles = this._cycles.asReadonly();
  readonly selectedCycleId = this._selectedCycleId.asReadonly();
  readonly clases = this._clases.asReadonly();
  readonly roster = this._roster.asReadonly();
  readonly addableStudents = this._addableStudents.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isLoadingCycle = this._isLoadingCycle.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  /** Id de la clase cuyo envío de Zoom está en curso (null si ninguna). */
  readonly sendingClassId = this._sendingClassId.asReadonly();
  readonly error = this._error.asReadonly();
  readonly emailResult = this._emailResult.asReadonly();

  readonly selectedCycle = computed(
    () => this._cycles().find((c) => c.id === this._selectedCycleId()) ?? null,
  );

  // ── 3. Métodos de acción ───────────────────────────────────────────────────

  setBranchFilter(branchId: number | null): void {
    this._branchFilter.set(branchId);
  }

  /** Carga los ciclos de la sede (RF-11) y autoselecciona el más reciente. */
  async loadCycles(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const branchId = this._branchFilter();
      const branchMap = new Map<number, string>();
      for (const b of this.branchFacade.branches()) branchMap.set(b.id, b.name);

      // Solo ciclos de los últimos 3 meses — evita que el selector crezca sin límite con el historial.
      let query = this.supabase.client
        .from('class_b_theory_cycles')
        .select('id, branch_id, start_date, end_date, status')
        .gte('start_date', monthsAgoIso(3))
        .order('start_date', { ascending: false });

      if (branchId !== null) query = query.eq('branch_id', branchId);

      const { data, error } = await query;
      if (error) throw error;

      // Con "Todas las escuelas" (branchId null) distintas sedes pueden compartir el
      // mismo lunes de inicio → se agrega el nombre de sede al label para diferenciarlos.
      const cycles: CicloOption[] = (data ?? []).map((row: any) => {
        const branchName = branchMap.get(row.branch_id) ?? 'Sin sede';
        return {
          id: row.id,
          label: formatCycleLabel(row.start_date, branchId === null ? branchName : undefined),
          startDate: row.start_date,
          endDate: row.end_date,
          status: (row.status as CicloStatus) ?? 'active',
          branchId: row.branch_id,
          branchName,
        };
      });

      this._cycles.set(cycles);

      // Mantener selección si sigue existiendo; si no, tomar el primer activo o el más reciente.
      const current = this._selectedCycleId();
      const stillThere = current !== null && cycles.some((c) => c.id === current);
      if (!stillThere) {
        const firstActive = cycles.find((c) => c.status === 'active') ?? cycles[0] ?? null;
        if (firstActive) {
          await this.selectCycle(firstActive.id);
        } else {
          this._selectedCycleId.set(null);
          this._clases.set([]);
          this._roster.set([]);
        }
      }
    } catch {
      this._error.set('Error al cargar los ciclos teóricos');
      this._cycles.set([]);
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Selecciona un ciclo y carga sus 6 clases + roster (RF-12). */
  async selectCycle(cycleId: number): Promise<void> {
    this._selectedCycleId.set(cycleId);
    this._isLoadingCycle.set(true);
    try {
      const [clases, roster] = await Promise.all([
        this.fetchClases(cycleId),
        this.fetchRoster(cycleId),
      ]);
      this._clases.set(clases);
      this._roster.set(roster);
    } catch {
      this._clases.set([]);
      this._roster.set([]);
      this.toast.error('Error al cargar el ciclo');
    } finally {
      this._isLoadingCycle.set(false);
    }
  }

  /** Guarda el enlace Zoom de una clase (RF-14). */
  async saveZoomLink(classId: number, zoomLink: string): Promise<void> {
    this._isSaving.set(true);
    try {
      const link = zoomLink.trim() || null;
      const { error } = await this.supabase.client
        .from('class_b_theory_sessions')
        .update({ zoom_link: link })
        .eq('id', classId);
      if (error) throw error;

      this._clases.update((rows) =>
        rows.map((r) => (r.id === classId ? { ...r, zoomLink: link } : r)),
      );
      this.toast.success('Enlace Zoom guardado');
    } catch {
      this.toast.error('Error al guardar el enlace Zoom');
    } finally {
      this._isSaving.set(false);
    }
  }

  /** Guarda el tema opcional de una clase. */
  async updateTopic(classId: number, tema: string): Promise<void> {
    this._isSaving.set(true);
    try {
      const topic = tema.trim() || null;
      const { error } = await this.supabase.client
        .from('class_b_theory_sessions')
        .update({ topic })
        .eq('id', classId);
      if (error) throw error;

      this._clases.update((rows) =>
        rows.map((r) => (r.id === classId ? { ...r, tema: topic } : r)),
      );
      this.toast.success('Tema guardado');
    } catch {
      this.toast.error('Error al guardar el tema');
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Envía el enlace Zoom de una clase por correo (RF-15/16) a los destinatarios
   * seleccionados (subconjunto del roster). Marca `zoom_sent_at`.
   */
  async sendZoomEmail(classId: number, recipientEnrollmentIds: number[]): Promise<void> {
    const clase = this._clases().find((c) => c.id === classId);
    if (!clase) return;
    if (!clase.zoomLink) {
      this.toast.error('Agrega un enlace Zoom antes de enviar');
      return;
    }

    const idSet = new Set(recipientEnrollmentIds);
    const recipients = this._roster()
      .filter((a) => idSet.has(a.enrollmentId) && a.email)
      .map((a) => ({ name: a.nombre, email: a.email }));

    if (recipients.length === 0) {
      this.toast.error('Selecciona al menos un destinatario con correo');
      return;
    }

    this._isSaving.set(true);
    this._sendingClassId.set(classId);
    this._emailResult.set(null);
    try {
      const sessionTopic = clase.tema?.trim()
        ? `Clase ${clase.claseNumero} — ${clase.tema.trim()}`
        : `Clase Teórica ${clase.claseNumero}`;
      const sessionDate = formatChileanDate(clase.fecha, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      const { data, error } = await this.supabase.client.functions.invoke('send-zoom-email', {
        body: { zoomLink: clase.zoomLink, sessionTopic, sessionDate, recipients },
      });
      if (error) throw error;

      const result = data as ZoomEmailResult;
      this._emailResult.set(result);

      const { error: stampError } = await this.supabase.client
        .from('class_b_theory_sessions')
        .update({ zoom_sent_at: new Date().toISOString() })
        .eq('id', classId);
      if (!stampError) {
        const nowIso = new Date().toISOString();
        this._clases.update((rows) =>
          rows.map((r) => (r.id === classId ? { ...r, zoomSentAt: nowIso } : r)),
        );
      }

      if (result.errors.length === 0) {
        this.toast.success(
          'Enlace enviado',
          `Correo enviado a ${result.sent} alumno${result.sent !== 1 ? 's' : ''}.`,
        );
      } else {
        this.toast.warning(
          'Envío parcial',
          `${result.sent} enviado(s), ${result.errors.length} fallido(s).`,
        );
      }
    } catch {
      this._emailResult.set({ sent: 0, errors: recipients.map((r) => r.email) });
      this.toast.error('Error al enviar los correos');
    } finally {
      this._isSaving.set(false);
      this._sendingClassId.set(null);
    }
  }

  /** Override: mueve un alumno (su matrícula) a otro ciclo (RF override). */
  async moveStudentToCycle(enrollmentId: number, targetCycleId: number): Promise<void> {
    this._isSaving.set(true);
    try {
      const { error } = await this.supabase.client
        .from('enrollments')
        .update({ theory_cycle_id: targetCycleId })
        .eq('id', enrollmentId);
      if (error) throw error;

      // Si el alumno sale del ciclo en curso, refrescar el roster visible.
      const selected = this._selectedCycleId();
      if (selected !== null) await this.selectCycle(selected);
      this.toast.success('Alumno reasignado de ciclo');
    } catch {
      this.toast.error('Error al reasignar el alumno');
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Carga alumnos Clase B activos de la MISMA sede del ciclo en curso que
   * pertenecen a OTRO ciclo, candidatos a ser traídos (override). Se filtra
   * por la sede del ciclo seleccionado, no por el filtro global del
   * dashboard — un alumno nunca debe poder incorporarse a un ciclo de otra
   * sede.
   */
  async loadAddableStudents(): Promise<void> {
    const currentCycleId = this._selectedCycleId();
    const branchId = this.selectedCycle()?.branchId ?? null;
    if (currentCycleId === null) return;

    try {
      let query = this.supabase.client
        .from('enrollments')
        .select(
          `
          id,
          theory_cycle_id,
          students!inner(id, users!inner(first_names, paternal_last_name, maternal_last_name, email)),
          class_b_theory_cycles!enrollments_theory_cycle_id_fkey(id, start_date)
        `,
        )
        .eq('status', 'active')
        .eq('license_group', 'class_b')
        .not('theory_cycle_id', 'is', null)
        .neq('theory_cycle_id', currentCycleId);

      if (branchId !== null) query = query.eq('branch_id', branchId);

      const { data, error } = await query;
      if (error) throw error;

      const movibles: CicloAlumnoMovible[] = (data ?? []).map((row: any) => {
        const u = row.students?.users;
        const ciclo = row.class_b_theory_cycles;
        return {
          studentId: row.students?.id ?? 0,
          enrollmentId: row.id,
          nombre: buildStudentDisplayName({
            firstNames: u?.first_names,
            paternalLastName: u?.paternal_last_name,
            maternalLastName: u?.maternal_last_name,
          }),
          email: u?.email ?? '',
          cicloActualId: row.theory_cycle_id,
          cicloActualLabel: ciclo?.start_date ? formatCycleLabel(ciclo.start_date) : 'Otro ciclo',
        };
      });

      this._addableStudents.set(sortByPaternalLastNameAsc(movibles, (m) => m.nombre));
    } catch {
      this._addableStudents.set([]);
      this.toast.error('Error al cargar alumnos de otros ciclos');
    }
  }

  clearEmailResult(): void {
    this._emailResult.set(null);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async fetchClases(cycleId: number): Promise<CicloClaseRow[]> {
    const { data, error } = await this.supabase.client
      .from('class_b_theory_sessions')
      .select('id, class_number, class_date, topic, zoom_link, zoom_sent_at')
      .eq('cycle_id', cycleId)
      .order('class_number', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: row.id,
      claseNumero: row.class_number ?? 0,
      fecha: row.class_date ?? '',
      label: `Clase ${row.class_number ?? '?'} — ${row.class_date ? buildDayLabel(row.class_date) : 'Sin fecha'}`,
      tema: row.topic ?? null,
      zoomLink: row.zoom_link ?? null,
      zoomSentAt: row.zoom_sent_at ?? null,
    }));
  }

  private async fetchRoster(cycleId: number): Promise<CicloAlumno[]> {
    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select(
        `
        id,
        students!inner(id, users!inner(first_names, paternal_last_name, maternal_last_name, email))
      `,
      )
      .eq('theory_cycle_id', cycleId)
      .eq('status', 'active');
    if (error) throw error;

    const roster: CicloAlumno[] = (data ?? []).map((row: any) => {
      const u = row.students?.users;
      return {
        studentId: row.students?.id ?? 0,
        enrollmentId: row.id,
        nombre: buildStudentDisplayName({
          firstNames: u?.first_names,
          paternalLastName: u?.paternal_last_name,
          maternalLastName: u?.maternal_last_name,
        }),
        email: u?.email ?? '',
      };
    });

    return sortByPaternalLastNameAsc(roster, (r) => r.nombre);
  }
}
