import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import type { Course } from '@core/models/dto/course.model';

/**
 * Subset del catálogo operacional usado por `CoursesFacade` para alimentar
 * el dropdown del admin de Configuración Web y la resolución en memoria
 * de `WebsiteConfigFacade.resolvedCourses`.
 *
 * No es necesario traer schedule_days/blocks/duration_weeks/etc. — solo lo
 * que la UI editorial necesita.
 */
export type CourseCatalogItem = Pick<
  Course,
  'id' | 'name' | 'license_class' | 'base_price' | 'active'
> & { branch_id?: number | null };

/**
 * CoursesFacade — Lectura del catálogo operacional `courses` para uso
 * editorial (Configuración Web, futuros pickers de curso).
 *
 * Spec 0004 — refactor-website-config-courses-fk.
 *
 * Branch-scoped según `facades.md` sec. 7:
 *   - Admin: scope = `BranchFacade.selectedBranchId()` (puede ser null = todas)
 *   - Secretaria: scope = `AuthFacade.currentUser().branchId` (ancla a su sede)
 *
 * SWR: primera carga muestra skeleton; re-llamadas con el mismo branchId
 * refrescan silenciosamente.
 */
@Injectable({ providedIn: 'root' })
export class CoursesFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly toast = inject(ToastService);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _availableCourses = signal<CourseCatalogItem[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _initialized = signal<boolean>(false);
  private _lastBranchId: number | null = null;

  // ── Estado expuesto (readonly) ────────────────────────────────────────────
  readonly availableCourses = this._availableCourses.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Map id → catalog item, derivado del array. Útil para JOINs en memoria. */
  readonly availableById = computed(() => {
    const map = new Map<number, CourseCatalogItem>();
    for (const c of this._availableCourses()) map.set(c.id, c);
    return map;
  });

  /**
   * Carga el catálogo operacional activo del branch indicado.
   *
   * SWR: si ya cargamos para este branch antes, refresca en silencio
   * (sin prender el skeleton). Si cambia el branchId, invalida cache.
   */
  async loadAvailableCourses(branchId: number): Promise<void> {
    const isDifferentBranch = this._lastBranchId !== branchId;

    if (!this._initialized() || isDifferentBranch) {
      this._isLoading.set(true);
    }

    this._error.set(null);
    this._lastBranchId = branchId;

    try {
      const { data, error } = await this.supabase.client
        .from('courses')
        .select('id, name, license_class, base_price, active')
        .eq('branch_id', branchId)
        .eq('active', true);

      if (error) throw error;

      this._availableCourses.set((data ?? []) as CourseCatalogItem[]);
      this._initialized.set(true);
    } catch (err: any) {
      const errMsg = err?.message || 'Error desconocido';
      this._error.set(errMsg);
      this._availableCourses.set([]);
      this.toast.error('Error al cargar cursos del catálogo', errMsg);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Resuelve el branchId efectivo según el rol del usuario, siguiendo
   * facades.md sec. 7. Útil cuando el Smart component no pasa el branch
   * explícitamente.
   *
   * @returns número de branch si hay scope, null si admin con "Todas las escuelas"
   */
  getActiveBranchId(): number | null {
    const user = this.authFacade.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }
}
