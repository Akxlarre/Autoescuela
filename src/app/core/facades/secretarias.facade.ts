import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';
import type { SecretariaTableRow } from '@core/models/ui/secretaria-table.model';
import { getInitialsFromDisplayName } from '@core/models/ui/user.model';

export interface CrearSecretariaPayload {
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  rut: string;
  email: string;
  telefono: string;
  branchId: number;
}

export interface EditarSecretariaPayload {
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  phone: string;
  branchId: number;
  active: boolean;
  email: string;
  currentEmail: string;
}

interface BranchOption {
  id: number;
  name: string;
}

// ── DTO interno de Supabase ─────────────────────────────────────────────────

interface RoleRow {
  name: string;
}

interface BranchRow {
  name: string;
}

interface SecretariaRow {
  id: number;
  rut: string;
  first_names: string;
  paternal_last_name: string;
  maternal_last_name: string | null;
  email: string;
  phone: string | null;
  active: boolean;
  updated_at: string | null;
  branch_id: number | null;
  roles: RoleRow | null;
  branches: BranchRow | null;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class SecretariasFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly branchFacade = inject(BranchFacade);

  // ── Estado privado ─────────────────────────────────────────────────────────
  private readonly _secretarias = signal<SecretariaTableRow[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;

  private readonly _branches = signal<BranchOption[]>([]);
  private _branchesLoaded = false;
  private readonly _isSubmitting = signal(false);

  private readonly _selectedSecretaria = signal<SecretariaTableRow | null>(null);

  // ── Estado público ─────────────────────────────────────────────────────────
  readonly secretarias = this._secretarias.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly branches = this._branches.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly selectedSecretaria = this._selectedSecretaria.asReadonly();

  // ── KPIs computed ──────────────────────────────────────────────────────────
  readonly totalSecretarias = computed<number>(() => this._secretarias().length);
  readonly activas = computed<number>(
    () => this._secretarias().filter((s) => s.estado === 'activa').length,
  );
  readonly inactivas = computed<number>(
    () => this._secretarias().filter((s) => s.estado === 'inactiva').length,
  );

  // ── Acciones ───────────────────────────────────────────────────────────────

  selectSecretaria(sec: SecretariaTableRow): void {
    this._selectedSecretaria.set(sec);
  }

  async initialize(): Promise<void> {
    const currentBranchId = this.branchFacade.selectedBranchId();
    // SWR: si ya está inicializado Y la sede no cambió, refrescar silenciosamente
    if (this._initialized && currentBranchId === this._lastBranchId) {
      this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._lastBranchId = currentBranchId;
    this._isLoading.set(true);
    try {
      await this.fetchData();
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchData();
    } catch {
      // Fail silencioso — datos stale siguen visibles
    }
  }

  private async fetchData(): Promise<void> {
    const branchId = this.branchFacade.selectedBranchId();

    let query = this.supabase.client
      .from('users')
      .select(
        `
        id,
        rut,
        first_names,
        paternal_last_name,
        maternal_last_name,
        email,
        phone,
        active,
        updated_at,
        branch_id,
        roles!inner ( name ),
        branches ( name )
      `,
      )
      .eq('roles.name', 'secretary')
      .order('first_names', { ascending: true });

    if (branchId !== null) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) {
      this._error.set(error.message);
      throw error;
    }

    const rows = (data as unknown as SecretariaRow[]) ?? [];
    this._secretarias.set(rows.map((r) => this.mapRow(r)));
  }

  async loadBranches(): Promise<void> {
    if (this._branchesLoaded) return;
    const { data, error } = await this.supabase.client
      .from('branches')
      .select('id, name')
      .order('name');
    if (!error) {
      this._branches.set((data as BranchOption[]) ?? []);
      this._branchesLoaded = true;
    }
  }

  async crearSecretaria(payload: CrearSecretariaPayload): Promise<boolean> {
    this._isSubmitting.set(true);
    try {
      const { error } = await this.supabase.client.functions.invoke('create-secretary', {
        body: payload,
      });
      if (error) throw new Error(error.message ?? 'Error al crear secretaria');
      this.toast.success('Secretaria creada', 'La cuenta ha sido creada correctamente.');
      await this.refreshSilently();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear secretaria';
      this.toast.error('Error', msg);
      return false;
    } finally {
      this._isSubmitting.set(false);
    }
  }

  async editarSecretaria(id: number, payload: EditarSecretariaPayload): Promise<boolean> {
    this._isSubmitting.set(true);
    try {
      const { error } = await this.supabase.client.functions.invoke('update-secretary', {
        body: {
          userId: id,
          firstNames: payload.firstNames,
          paternalLastName: payload.paternalLastName,
          maternalLastName: payload.maternalLastName,
          phone: payload.phone,
          branchId: payload.branchId,
          active: payload.active,
          email: payload.email.trim().toLowerCase(),
          currentEmail: payload.currentEmail.trim().toLowerCase(),
        },
      });

      if (error) throw new Error(error.message ?? 'Error al actualizar secretaria');

      this._initialized = false;
      await this.refreshSilently();
      this.toast.success(
        'Secretaria actualizada',
        'Los datos han sido actualizados correctamente.',
      );
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar secretaria';
      this.toast.error('Error', msg);
      return false;
    } finally {
      this._isSubmitting.set(false);
    }
  }

  private mapRow(r: SecretariaRow): SecretariaTableRow {
    const nombre = [r.first_names, r.paternal_last_name, r.maternal_last_name ?? '']
      .filter((s) => s.trim().length > 0)
      .join(' ');

    return {
      id: r.id,
      rut: r.rut,
      nombre,
      initials: getInitialsFromDisplayName(nombre),
      email: r.email,
      sede: r.branches?.name ?? '—',
      estado: r.active ? 'activa' : 'inactiva',
      ultimoAcceso: r.updated_at,
      aliasPublico: r.email,
      firstName: r.first_names,
      paternalLastName: r.paternal_last_name,
      maternalLastName: r.maternal_last_name ?? '',
      branchId: r.branch_id,
      phone: r.phone ?? '',
    };
  }
}
