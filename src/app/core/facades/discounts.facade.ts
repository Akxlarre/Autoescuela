import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import type { Discount } from '@core/models/dto/discount.model';
import type { DiscountFormValue, DiscountUi } from '@core/models/ui/discount.model';

export interface ProfessionalCourseOption {
  id: number;
  name: string;
}

type DiscountRow = Discount & {
  branches: { name: string } | null;
  courses: { name: string } | null;
};

function toUi(row: DiscountRow): DiscountUi {
  return {
    id: row.id,
    name: row.name,
    discountType: row.discount_type ?? 'fixed_amount',
    value: row.value,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    applicableTo: row.applicable_to ?? 'all',
    status: row.status ?? 'active',
    branchId: row.branch_id,
    branchName: row.branches?.name ?? null,
    courseId: row.course_id,
    courseName: row.courses?.name ?? null,
  };
}

@Injectable({ providedIn: 'root' })
export class DiscountsFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  private readonly _discounts = signal<DiscountUi[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _professionalCourses = signal<ProfessionalCourseOption[]>([]);

  readonly discounts = this._discounts.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly professionalCourses = this._professionalCourses.asReadonly();

  async loadDiscounts(): Promise<void> {
    this._isLoading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('discounts')
        .select(
          'id, name, discount_type, value, valid_from, valid_until, applicable_to, status, branch_id, course_id, branches(name), courses(name)',
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      this._discounts.set((data ?? []).map((row) => toUi(row as unknown as DiscountRow)));
    } catch (err: any) {
      this.toast.error('Error al cargar descuentos', err?.message);
      this._discounts.set([]);
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Cursos de Clase Profesional (incl. CONV) de una sede, para el picker de "curso específico". */
  async loadProfessionalCourses(branchId: number | null): Promise<void> {
    try {
      let query = this.supabase.client
        .from('courses')
        .select('id, name')
        .eq('type', 'professional')
        .eq('active', true);

      if (branchId !== null) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      this._professionalCourses.set((data ?? []) as ProfessionalCourseOption[]);
    } catch (err: any) {
      this.toast.error('Error al cargar cursos profesionales', err?.message);
      this._professionalCourses.set([]);
    }
  }

  async createDiscount(payload: DiscountFormValue): Promise<boolean> {
    this._isSaving.set(true);
    try {
      const { error } = await this.supabase.client.from('discounts').insert({
        name: payload.name,
        discount_type: payload.discountType,
        value: payload.value,
        valid_from: payload.validFrom,
        valid_until: payload.validUntil,
        applicable_to: payload.applicableTo,
        branch_id: payload.branchId,
        course_id: payload.courseId,
        status: 'active',
      });

      if (error) throw error;
      this.toast.success('Descuento creado correctamente');
      await this.loadDiscounts();
      return true;
    } catch (err: any) {
      this.toast.error('Error al crear descuento', err?.message);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async updateDiscount(id: number, payload: DiscountFormValue): Promise<boolean> {
    this._isSaving.set(true);
    try {
      const { error } = await this.supabase.client
        .from('discounts')
        .update({
          name: payload.name,
          discount_type: payload.discountType,
          value: payload.value,
          valid_from: payload.validFrom,
          valid_until: payload.validUntil,
          applicable_to: payload.applicableTo,
          branch_id: payload.branchId,
          course_id: payload.courseId,
        })
        .eq('id', id);

      if (error) throw error;
      this.toast.success('Descuento actualizado correctamente');
      await this.loadDiscounts();
      return true;
    } catch (err: any) {
      this.toast.error('Error al actualizar descuento', err?.message);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async toggleStatus(id: number, currentStatus: DiscountUi['status']): Promise<boolean> {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const { error } = await this.supabase.client
        .from('discounts')
        .update({ status: nextStatus })
        .eq('id', id);

      if (error) throw error;
      this._discounts.update((list) =>
        list.map((d) => (d.id === id ? { ...d, status: nextStatus } : d)),
      );
      this.toast.success(
        nextStatus === 'active' ? 'Descuento reactivado' : 'Descuento desactivado',
      );
      return true;
    } catch (err: any) {
      this.toast.error('Error al cambiar el estado del descuento', err?.message);
      return false;
    }
  }
}
