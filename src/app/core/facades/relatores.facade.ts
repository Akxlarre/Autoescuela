import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import type { Lecturer } from '@core/models/dto/lecturer.model';
import type { RelatorCursoAsignado, RelatorTableRow } from '@core/models/ui/relator-table.model';

export interface CrearRelatorPayload {
  rut: string;
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  email: string;
  phone: string;
  specializations: string[];
}

export interface EditarRelatorPayload {
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  email: string;
  phone: string;
  specializations: string[];
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class RelatoresFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  // ── Estado privado ──────────────────────────────────────────────────────────
  private readonly _relatores = signal<RelatorTableRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _isSubmitting = signal(false);
  private readonly _selectedRelator = signal<RelatorTableRow | null>(null);
  private readonly _cursosAsignados = signal<RelatorCursoAsignado[]>([]);
  private readonly _isLoadingCursos = signal(false);
  private _initialized = false;

  // ── Estado público ──────────────────────────────────────────────────────────
  readonly relatores = this._relatores.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly selectedRelator = this._selectedRelator.asReadonly();
  readonly cursosAsignados = this._cursosAsignados.asReadonly();
  readonly isLoadingCursos = this._isLoadingCursos.asReadonly();

  // ── KPIs ────────────────────────────────────────────────────────────────────
  readonly totalRelatores = computed(() => this._relatores().length);
  readonly activos = computed(() => this._relatores().filter((r) => r.estado === 'activo').length);
  readonly inactivos = computed(
    () => this._relatores().filter((r) => r.estado === 'inactivo').length,
  );

  // ── SWR: initialize ─────────────────────────────────────────────────────────
  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await this.fetchData();
    } finally {
      this._isLoading.set(false);
    }
  }

  private async fetchData(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('lecturers')
      .select('*')
      .order('paternal_last_name', { ascending: true });

    if (error) throw error;
    this._relatores.set((data as Lecturer[]).map((l) => this.mapToRow(l)));
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchData();
    } catch {
      // datos stale siguen visibles
    }
  }

  // ── Selección para drawers ──────────────────────────────────────────────────
  selectRelator(relator: RelatorTableRow): void {
    this._selectedRelator.set(relator);
    this._cursosAsignados.set([]);
    void this.loadCursosAsignados(relator.id);
  }

  async loadCursosAsignados(lecturerId: number): Promise<void> {
    this._isLoadingCursos.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('promotion_course_lecturers')
        .select(
          `id, role,
           promotion_courses!inner (
             id, max_students,
             professional_promotions!inner ( name, code, status ),
             courses!inner ( name, code, is_convalidation )
           )`,
        )
        .eq('lecturer_id', lecturerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Count enrolled students per promotion_course from enrollments
      const pcIds = (data as any[]).map((r: any) => r.promotion_courses.id);
      let enrolledCounts: Record<number, number> = {};
      if (pcIds.length > 0) {
        const { data: enrollData } = await this.supabase.client
          .from('enrollments')
          .select('promotion_course_id')
          .in('promotion_course_id', pcIds)
          .not('status', 'in', '("cancelled","draft")');
        if (enrollData) {
          enrolledCounts = enrollData.reduce((acc: Record<number, number>, e: any) => {
            acc[e.promotion_course_id] = (acc[e.promotion_course_id] ?? 0) + 1;
            return acc;
          }, {});
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._cursosAsignados.set(
        (data as any[]).map((row) => ({
          id: row.id,
          role: row.role ?? null,
          promotionCourseId: row.promotion_courses.id,
          promotionName: row.promotion_courses.professional_promotions.name,
          promotionCode: row.promotion_courses.professional_promotions.code,
          courseName: row.promotion_courses.courses.name,
          courseCode: this.extractLicenseCode(
            row.promotion_courses.courses.code,
            row.promotion_courses.courses.is_convalidation,
          ),
          status: row.promotion_courses.professional_promotions.status ?? null,
          enrolledStudents: enrolledCounts[row.promotion_courses.id] ?? 0,
          maxStudents: row.promotion_courses.max_students ?? 25,
        })),
      );
    } catch {
      this._cursosAsignados.set([]);
    } finally {
      this._isLoadingCursos.set(false);
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────
  async crearRelator(payload: CrearRelatorPayload): Promise<boolean> {
    this._isSubmitting.set(true);
    try {
      const { error } = await this.supabase.client.from('lecturers').insert({
        rut: payload.rut,
        first_names: payload.firstNames,
        paternal_last_name: payload.paternalLastName,
        maternal_last_name: payload.maternalLastName || null,
        email: payload.email || null,
        phone: payload.phone || null,
        specializations: payload.specializations,
        active: true,
        registration_date: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;

      this.toast.success('Relator registrado correctamente');
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar relator';
      this.toast.error(msg);
      return false;
    } finally {
      this._isSubmitting.set(false);
    }
  }

  async editarRelator(id: number, payload: EditarRelatorPayload): Promise<boolean> {
    this._isSubmitting.set(true);
    try {
      const { error } = await this.supabase.client
        .from('lecturers')
        .update({
          first_names: payload.firstNames,
          paternal_last_name: payload.paternalLastName,
          maternal_last_name: payload.maternalLastName || null,
          email: payload.email || null,
          phone: payload.phone || null,
          specializations: payload.specializations,
          active: payload.active,
        })
        .eq('id', id);

      if (error) throw error;

      this.toast.success('Relator actualizado correctamente');
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar relator';
      this.toast.error(msg);
      return false;
    } finally {
      this._isSubmitting.set(false);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private extractLicenseCode(code: string, isConvalidation: boolean): string {
    const m = code.match(/[Aa]([2-5])/);
    if (m) {
      const cls = `A${m[1]}`;
      return isConvalidation ? `Conv. ${cls}` : cls;
    }
    return code.slice(0, 4).toUpperCase();
  }

  // ── Mapeador DTO → UI ───────────────────────────────────────────────────────
  private mapToRow(l: Lecturer): RelatorTableRow {
    const nombre = [l.first_names, l.paternal_last_name, l.maternal_last_name]
      .filter(Boolean)
      .join(' ');
    const parts = nombre.trim().split(' ');
    const initials = parts
      .filter((_, i) => i === 0 || i === parts.length - 1)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');

    return {
      id: l.id,
      rut: l.rut,
      nombre,
      firstName: l.first_names,
      paternalLastName: l.paternal_last_name,
      maternalLastName: l.maternal_last_name ?? '',
      email: l.email ?? '',
      phone: l.phone ?? '',
      specializations: l.specializations ?? [],
      estado: l.active ? 'activo' : 'inactivo',
      registrationDate: l.registration_date ?? null,
      initials: initials || '?',
    };
  }
}
