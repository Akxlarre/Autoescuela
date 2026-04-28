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
  /**
   * Cuando es true, la opción "Todas las escuelas" del topbar queda deshabilitada.
   * Usado por vistas que requieren una sede concreta (ej: wizard de Nueva Matrícula).
   */
  private readonly _requiresSpecificBranch = signal(false);
  /** Cuando es true, solo las sedes con has_professional=true son seleccionables. */
  private readonly _professionalOnly = signal(false);

  // ── 2. ESTADO EXPUESTO (Público, solo lectura) ────────────────────────────
  readonly branches = this._branches.asReadonly();
  readonly selectedBranchId = this._selectedBranchId.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly requiresSpecificBranch = this._requiresSpecificBranch.asReadonly();
  readonly professionalOnly = this._professionalOnly.asReadonly();

  /** IDs de sedes deshabilitadas en el selector. No vacío solo cuando professionalOnly=true. */
  readonly disabledBranchIds = computed(() =>
    this._professionalOnly()
      ? this._branches()
          .filter((b) => !b.hasProfessional)
          .map((b) => b.id)
      : [],
  );

  /** Etiqueta de la sede activa; "Todas las escuelas" cuando no hay filtro. */
  readonly selectedBranchLabel = computed(() => {
    const id = this._selectedBranchId();
    if (id === null) return 'Todas las escuelas';
    return this._branches().find((b) => b.id === id)?.name ?? '—';
  });

  /**
   * Motivo por el que el selector está restringido.
   * null cuando no hay restricción activa (estado normal).
   */
  readonly lockReason = computed<string | null>(() => {
    if (this._professionalOnly()) return 'Solo sedes con Clase Profesional';
    if (this._requiresSpecificBranch()) return 'Se requiere una sede para esta vista';
    return null;
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
        .select('id, name, slug, has_professional')
        .order('id');

      if (error) throw error;
      this._branches.set(
        (data ?? []).map((b: any) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          hasProfessional: b.has_professional ?? false,
        })),
      );
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

  /**
   * Activa o desactiva el requisito de sede concreta.
   * Cuando es true, el botón "Todas las escuelas" del topbar queda deshabilitado.
   * NO auto-selecciona — el BranchGateComponent delega la elección explícita al usuario.
   */
  setRequiresSpecificBranch(value: boolean): void {
    this._requiresSpecificBranch.set(value);
  }

  /**
   * Activa o desactiva el modo "solo profesional".
   * Cuando es true:
   *  - Deshabilita "Todas las escuelas" (implica requiresSpecificBranch).
   *  - Deshabilita las sedes sin has_professional en el selector.
   *  - Auto-selecciona la primera sede profesional si la activa no lo es.
   */
  setProfessionalOnly(value: boolean): void {
    this._professionalOnly.set(value);
    this._requiresSpecificBranch.set(value);
    if (value) {
      const current = this._selectedBranchId();
      const currentBranch = this._branches().find((b) => b.id === current);
      if (!currentBranch?.hasProfessional) {
        const firstPro = this._branches().find((b) => b.hasProfessional);
        if (firstPro) this._selectedBranchId.set(firstPro.id);
      }
    } else {
      // Al salir de una vista exclusiva de Clase Profesional, volver a "Todas las escuelas"
      this._selectedBranchId.set(null);
    }
  }
}
