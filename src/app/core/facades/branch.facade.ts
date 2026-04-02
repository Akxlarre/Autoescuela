import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type { BranchOption } from '@core/models/ui/branch.model';

/**
 * BranchFacade — Fuente única de verdad para la sede activa en el panel admin.
 *
 * Responsabilidades:
 * - Cargar la lista de sedes disponibles desde `branches`.
 * - Mantener `selectedBranchId` (null = "Todas las escuelas").
 *
 * Ciclo de vida:
 * - `loadBranches()` se llama en `AppShellComponent.ngOnInit()` solo para rol admin.
 * - Las secretarias NO usan este Facade; su branchId viene de `AuthFacade.currentUser().branchId`.
 *
 * Consumidores:
 * - `TopbarComponent` → muestra el selector de sede.
 * - Facades multi-sede (AdminAlumnosFacade, DashboardFacade, FlotaFacade…) →
 *   leen `selectedBranchId()` para filtrar sus queries (ver regla 7 en facades.md).
 */
@Injectable({ providedIn: 'root' })
export class BranchFacade {
  private readonly supabase = inject(SupabaseService);

  // ── 1. ESTADO REACTIVO (Privado) ──────────────────────────────────────────
  private readonly _branches = signal<BranchOption[]>([]);
  private readonly _selectedBranchId = signal<number | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ── 2. ESTADO EXPUESTO (Público, solo lectura) ────────────────────────────
  readonly branches = this._branches.asReadonly();
  readonly selectedBranchId = this._selectedBranchId.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Etiqueta de la sede activa; "Todas las escuelas" cuando no hay filtro. */
  readonly selectedBranchLabel = computed(() => {
    const id = this._selectedBranchId();
    if (id === null) return 'Todas las escuelas';
    return this._branches().find((b) => b.id === id)?.name ?? '—';
  });

  // ── 3. MÉTODOS DE ACCIÓN ──────────────────────────────────────────────────

  /**
   * Carga todas las sedes desde la BD.
   * Llamar una sola vez desde AppShellComponent cuando el rol es admin.
   */
  async loadBranches(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const { data, error } = await this.supabase.client
        .from('branches')
        .select('id, name, slug')
        .order('id');

      if (error) throw error;
      this._branches.set((data ?? []) as BranchOption[]);
    } catch (err: any) {
      this._error.set(err.message ?? 'Error al cargar sedes');
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Establece la sede activa.
   * Pasar `null` para ver "Todas las escuelas" (sin filtro).
   */
  selectBranch(id: number | null): void {
    this._selectedBranchId.set(id);
  }

  /** Vuelve a "Todas las escuelas" (quita el filtro de sede). */
  reset(): void {
    this._selectedBranchId.set(null);
  }
}
