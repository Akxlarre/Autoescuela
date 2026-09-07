import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import type { BranchPayrollConfig } from '@core/models/dto/branch-payroll-config.model';

/**
 * Tarifa CLP por hora equivalente usada cuando una sede no tiene fila en
 * `branch_payroll_config` (sede creada después del seed, o config no cargada).
 * Es el mismo valor que el seed de la migración `20260907120000`.
 */
export const PAYROLL_RATE_FALLBACK = 5000;

/**
 * PayrollConfigFacade — spec 0014-m.
 *
 * Punto único para leer/escribir `branch_payroll_config`: la tarifa por hora
 * equivalente de instructor, **global por sede** (no por instructor).
 *
 * NO es branch-scoped al estilo `facades.md` §7: no filtra por la sede activa,
 * trae **todas** las sedes para poder editarlas desde Ajustes y para que
 * `LiquidacionesFacade` resuelva cada instructor por su propia sede.
 *
 * SWR: la primera `load()` prende `isLoading`; las re-entradas refrescan en
 * silencio.
 */
@Injectable({ providedIn: 'root' })
export class PayrollConfigFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly toast = inject(ToastService);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _config = signal<BranchPayrollConfig[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;

  // ── Estado expuesto (readonly) ────────────────────────────────────────────
  readonly config = this._config.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();

  /** Map `branch_id` → fila de config, derivado del array. */
  readonly configByBranch = computed(() => {
    const map = new Map<number, BranchPayrollConfig>();
    for (const row of this._config()) map.set(row.branch_id, row);
    return map;
  });

  /**
   * Tarifa por hora vigente de una sede. `PAYROLL_RATE_FALLBACK` si la sede
   * no tiene fila o si la config todavía no se cargó.
   */
  rateForBranch(branchId: number | null | undefined): number {
    if (branchId == null) return PAYROLL_RATE_FALLBACK;
    return this.configByBranch().get(branchId)?.amount_per_hour ?? PAYROLL_RATE_FALLBACK;
  }

  // ── Carga ─────────────────────────────────────────────────────────────────

  /** SWR: primera carga con skeleton; re-entradas refrescan en silencio. */
  async load(): Promise<void> {
    if (this._initialized) {
      await this.fetchConfig();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchConfig();
    } finally {
      this._isLoading.set(false);
    }
  }

  private async fetchConfig(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('branch_payroll_config')
      .select('branch_id, amount_per_hour, updated_at, updated_by');

    if (error) {
      this._error.set(error.message ?? 'Error al cargar la configuración de nómina.');
      this._config.set([]);
      this.toast.error('No se pudo cargar la tarifa de instructores', error.message);
      return;
    }
    this._config.set((data ?? []) as BranchPayrollConfig[]);
  }

  // ── Mutación ──────────────────────────────────────────────────────────────

  /**
   * Upsert de la tarifa de una sede. Devuelve `true` si se persistió.
   * Actualiza el estado en memoria sin re-fetch.
   */
  async updateRate(branchId: number, amountPerHour: number): Promise<boolean> {
    this._isSaving.set(true);
    this._error.set(null);
    try {
      const record = {
        branch_id: branchId,
        amount_per_hour: amountPerHour,
        updated_by: this.auth.currentUser()?.dbId ?? null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.supabase.client
        .from('branch_payroll_config')
        .upsert(record, { onConflict: 'branch_id' });

      if (error) throw error;

      this._config.update((rows) => {
        const idx = rows.findIndex((r) => r.branch_id === branchId);
        const next: BranchPayrollConfig = { ...record };
        if (idx === -1) return [...rows, next];
        const copy = [...rows];
        copy[idx] = { ...copy[idx], ...next };
        return copy;
      });

      this.toast.success('Tarifa por hora actualizada correctamente.');
      return true;
    } catch (err: any) {
      this._error.set(err?.message ?? 'Error al guardar la tarifa.');
      this.toast.error('No se pudo guardar la tarifa', err?.message);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }
}
