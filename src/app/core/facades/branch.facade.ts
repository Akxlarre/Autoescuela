import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type { BranchOption } from '@core/models/ui/branch.model';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

const SELECTED_BRANCH_STORAGE_KEY = 'autoescuela:selectedBranchId';

interface PersistedBranch {
  id: number;
  name: string;
}

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
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly platformId = inject(PLATFORM_ID);

  // ── 1. ESTADO REACTIVO (Privado) ──────────────────────────────────────────
  /**
   * Se inicializa con un "stub" de una sola sede leído de `localStorage` de
   * forma síncrona (id + nombre), para que `selectedLabel` en
   * `BranchSelectorComponent` encuentre un match desde el primer render y
   * pinte el nombre real — sin fallback ni skeleton — mientras `loadBranches()`
   * resuelve el fetch async. `loadBranches()` reemplaza este stub por la
   * lista real y corrige/limpia la selección si la sede ya no existe.
   */
  private readonly _branches = signal<BranchOption[]>(this.seedBranchesFromPersisted());
  private readonly _selectedBranchId = signal<number | null>(
    this.readPersistedBranch()?.id ?? null,
  );
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
      this.validatePersistedBranch();
    } catch (err: any) {
      this._error.set(this.sanitizer.sanitize(err).message ?? 'Error al cargar sedes');
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Lee `{id, name}` de sede persistidos en `localStorage`, sin validar. */
  private readPersistedBranch(): PersistedBranch | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const raw = localStorage.getItem(SELECTED_BRANCH_STORAGE_KEY);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.id === 'number' && typeof parsed?.name === 'string') {
        return { id: parsed.id, name: parsed.name };
      }
    } catch {
      // Valor corrupto o formato legacy (id numérico plano) — se descarta.
    }
    return null;
  }

  /**
   * Sede persistida como "stub" de una sola entrada (id + nombre), para que
   * `selectedLabel` (en `BranchSelectorComponent`) encuentre un match real
   * desde el primer render, sin depender de `loadBranches()`.
   */
  private seedBranchesFromPersisted(): BranchOption[] {
    const persisted = this.readPersistedBranch();
    if (!persisted) return [];
    return [{ id: persisted.id, name: persisted.name, slug: '', hasProfessional: false }];
  }

  /**
   * Valida la sede persistida contra la lista real recién cargada de la BD.
   * Si ya no existe (sede eliminada, o storage manipulado), limpia la
   * selección y el `localStorage`.
   */
  private validatePersistedBranch(): void {
    const persisted = this.readPersistedBranch();
    if (!persisted) return;

    const isValid = this._branches().some((b) => b.id === persisted.id);
    if (!isValid) {
      this._selectedBranchId.set(null);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.removeItem(SELECTED_BRANCH_STORAGE_KEY);
      }
    }
  }

  /**
   * Establece la sede activa.
   * Pasar `null` para ver "Todas las escuelas" (sin filtro).
   */
  selectBranch(id: number | null): void {
    this._selectedBranchId.set(id);
    this.persistSelectedBranch(id);
  }

  /** Vuelve a "Todas las escuelas" (quita el filtro de sede). */
  reset(): void {
    this._selectedBranchId.set(null);
    this.persistSelectedBranch(null);
  }

  private persistSelectedBranch(id: number | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (id === null) {
      localStorage.removeItem(SELECTED_BRANCH_STORAGE_KEY);
      return;
    }
    const name = this._branches().find((b) => b.id === id)?.name ?? '';
    localStorage.setItem(SELECTED_BRANCH_STORAGE_KEY, JSON.stringify({ id, name }));
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
