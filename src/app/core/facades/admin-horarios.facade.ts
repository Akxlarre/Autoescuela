import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import type { Course } from '@core/models/dto/course.model';

export type HorarioCourseItem = Pick<Course, 'id' | 'name' | 'license_class' | 'schedule_blocks'>;

@Injectable({ providedIn: 'root' })
export class AdminHorariosFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  private readonly _courses = signal<HorarioCourseItem[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);

  readonly courses = this._courses.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();

  async loadCourses(branchId: number | null): Promise<void> {
    this._isLoading.set(true);
    try {
      let query = this.supabase.client
        .from('courses')
        .select('id, name, license_class, schedule_blocks')
        .eq('license_class', 'B')
        .eq('active', true);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (error) throw error;
      this._courses.set((data ?? []) as HorarioCourseItem[]);
    } catch (err: any) {
      this.toast.error('Error al cargar cursos para horarios', err?.message);
      this._courses.set([]);
    } finally {
      this._isLoading.set(false);
    }
  }

  async updateScheduleBlocks(courseIds: number[], blocks: {from: string, to: string}[]): Promise<boolean> {
    if (courseIds.length === 0) return false;
    this._isSaving.set(true);
    try {
      const { error } = await this.supabase.client
        .from('courses')
        .update({ schedule_blocks: blocks })
        .in('id', courseIds);

      if (error) throw error;
      this.toast.success('Horarios base actualizados correctamente');
      
      // Actualizar estado local
      this._courses.update(courses => courses.map(c => 
        courseIds.includes(c.id) ? { ...c, schedule_blocks: blocks } : c
      ));
      return true;
    } catch (err: any) {
      this.toast.error('Error al actualizar bloques horarios', err?.message);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }
}
