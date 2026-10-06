import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import type { BranchAbsencePenaltyConfig } from '@core/models/dto/branch-absence-penalty-config.model';
import type { AbsencePenaltyConfigRow } from '@core/models/ui/absence-penalty-config.model';

type ConfigWithBranch = Pick<
  BranchAbsencePenaltyConfig,
  'branch_id' | 'auto_cancel_enabled' | 'enabled_since'
> & { branches: { name: string } | null };

const SELECT_COLUMNS = 'branch_id, auto_cancel_enabled, enabled_since, branches(name)';

function toRow(r: ConfigWithBranch): AbsencePenaltyConfigRow {
  return {
    branchId: r.branch_id,
    branchName: r.branches?.name ?? `Sede ${r.branch_id}`,
    enabled: r.auto_cancel_enabled,
    enabledSince: r.enabled_since,
  };
}

/**
 * AbsencePenaltyConfigFacade — spec 0048-b.
 *
 * Punto único para leer/escribir `branch_absence_penalty_config`: si la penalización RF-053
 * (`apply_class_b_absence_penalty`) cancela la agenda tras 2 faltas consecutivas, por sede.
 *
 * NO es branch-scoped al estilo `facades.md` §7: el admin ve y edita todas las sedes; la secretaria
 * ve solo la suya, en solo lectura (la RLS además impide que escriba). `enabled_since` y
 * `updated_by` los fija un trigger en la BD, por eso `setEnabled()` relee la fila guardada.
 */
@Injectable({ providedIn: 'root' })
export class AbsencePenaltyConfigFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly toast = inject(ToastService);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _allRows = signal<AbsencePenaltyConfigRow[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _savingBranchId = signal<number | null>(null);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;

  // ── Estado expuesto (readonly) ────────────────────────────────────────────
  readonly isLoading = this._isLoading.asReadonly();
  readonly savingBranchId = this._savingBranchId.asReadonly();
  readonly error = this._error.asReadonly();

  readonly canEdit = computed(() => this.auth.currentUser()?.role === 'admin');

  /** Admin: todas las sedes. Secretaria: solo la suya. Otros roles: ninguna. */
  readonly rows = computed(() => {
    const user = this.auth.currentUser();
    if (user?.role === 'admin') return this._allRows();
    if (user?.role === 'secretaria') {
      return this._allRows().filter((r) => r.branchId === user.branchId);
    }
    return [];
  });

  // ── Carga ─────────────────────────────────────────────────────────────────

  /** SWR: primera carga con skeleton; re-entradas refrescan en silencio. */
  async load(): Promise<void> {
    if (this._initialized) {
      await this.fetchConfig();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await this.fetchConfig();
    } finally {
      this._isLoading.set(false);
    }
  }

  private async fetchConfig(): Promise<void> {
    this._error.set(null);
    const { data, error } = await this.supabase.client
      .from('branch_absence_penalty_config')
      .select(SELECT_COLUMNS)
      .order('branch_id');

    if (error) {
      this._error.set(error.message ?? 'Error al cargar la configuración.');
      this._allRows.set([]);
      this.toast.error('No se pudo cargar la regla de inasistencias', error.message);
      return;
    }
    this._allRows.set(((data ?? []) as unknown as ConfigWithBranch[]).map(toRow));
  }

  // ── Mutación ──────────────────────────────────────────────────────────────

  /** Activa o desactiva la cancelación automática de una sede. Devuelve `true` si se guardó. */
  async setEnabled(branchId: number, enabled: boolean): Promise<boolean> {
    if (!this.canEdit()) return false;

    this._savingBranchId.set(branchId);
    this._error.set(null);
    try {
      const { data, error } = await this.supabase.client
        .from('branch_absence_penalty_config')
        .update({ auto_cancel_enabled: enabled })
        .eq('branch_id', branchId)
        .select(SELECT_COLUMNS)
        .single();

      if (error) throw error;

      const saved = toRow(data as unknown as ConfigWithBranch);
      this._allRows.update((rows) => rows.map((r) => (r.branchId === branchId ? saved : r)));
      this.toast.success(
        enabled
          ? `Cancelación automática activada en ${saved.branchName}`
          : `Cancelación automática desactivada en ${saved.branchName}`,
      );
      return true;
    } catch (err: any) {
      this._error.set(err?.message ?? 'Error al guardar la configuración.');
      this.toast.error('No se pudo guardar la regla de inasistencias', err?.message);
      return false;
    } finally {
      this._savingBranchId.set(null);
    }
  }
}
