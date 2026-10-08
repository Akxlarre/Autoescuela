import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';
import type {
  SecretariaTableRow,
  UltimoAccesoEstado,
} from '@core/models/ui/secretaria-table.model';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import { getInitialsFromDisplayName } from '@core/models/ui/user.model';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { edgeFunctionUserMessage } from '@core/utils/edge-function-error.utils';

export interface CrearSecretariaPayload {
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  rut: string;
  email: string;
  telefono: string;
  branchId: number;
  /** Grant multi-sede (spec 0017). */
  canAccessBothBranches?: boolean;
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
  /** Grant multi-sede (spec 0017). Opcional: si se omite, el flag se preserva (el toggle llega en T3.2). */
  canAccessBothBranches?: boolean;
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
  branch_id: number | null;
  can_access_both_branches: boolean;
  roles: RoleRow | null;
  branches: BranchRow | null;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class SecretariasFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly branchFacade = inject(BranchFacade);

  // ── Estado privado ─────────────────────────────────────────────────────────
  private readonly _secretarias = signal<SecretariaTableRow[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly listGuard = createRequestGuard();
  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;

  private readonly _branches = signal<BranchOption[]>([]);
  private _branchesLoaded = false;
  private readonly _isSubmitting = signal(false);

  private readonly _selectedSecretaria = signal<SecretariaTableRow | null>(null);
  private readonly _ultimoAccesoSeleccionada = signal<UltimoAccesoEstado>({
    estado: 'cargando',
    fecha: null,
  });
  private readonly ultimoAccesoGuard = createRequestGuard();

  // ── Estado público ─────────────────────────────────────────────────────────
  readonly secretarias = this._secretarias.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly branches = this._branches.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly selectedSecretaria = this._selectedSecretaria.asReadonly();
  readonly ultimoAccesoSeleccionada = this._ultimoAccesoSeleccionada.asReadonly();

  // ── KPIs computed ──────────────────────────────────────────────────────────
  readonly totalSecretarias = computed<number>(() => this._secretarias().length);
  readonly activas = computed<number>(
    () => this._secretarias().filter((s) => s.estado === 'activa').length,
  );
  readonly inactivas = computed<number>(
    () => this._secretarias().filter((s) => s.estado === 'inactiva').length,
  );
  readonly sedesConPersonal = computed<number>(() => {
    const sedes = this._secretarias()
      .map((s) => s.sede)
      .filter((s) => s && s !== '—');
    return new Set(sedes).size;
  });

  // ── Acciones ───────────────────────────────────────────────────────────────

  selectSecretaria(sec: SecretariaTableRow): void {
    this._selectedSecretaria.set(sec);
  }

  /**
   * Último inicio de sesión real (fix-212-b, S14 de ASG-i-034): `auth.users.last_sign_in_at` vía
   * `secretary_last_sign_in()` (solo admin). Antes la ficha mostraba `users.updated_at`, que sin
   * trigger es la fecha de creación de la cuenta.
   */
  async cargarUltimoAcceso(userId: number): Promise<void> {
    const requestToken = this.ultimoAccesoGuard.next();
    this._ultimoAccesoSeleccionada.set({ estado: 'cargando', fecha: null });
    const { data, error } = await this.supabase.client.rpc('secretary_last_sign_in', {
      p_user_ids: [userId],
    });
    if (!this.ultimoAccesoGuard.isCurrent(requestToken)) return;
    if (error) {
      this._ultimoAccesoSeleccionada.set({ estado: 'error', fecha: null });
      return;
    }
    const row = ((data ?? []) as { user_id: number; last_sign_in_at: string | null }[])[0];
    this._ultimoAccesoSeleccionada.set({ estado: 'ok', fecha: row?.last_sign_in_at ?? null });
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
    } catch {
      // fix-209-b: el error ya quedó en `error` (lo muestra la tabla); no relanzar.
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
    const requestToken = this.listGuard.next();
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
        branch_id,
        can_access_both_branches,
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
      if (this.listGuard.isCurrent(requestToken)) {
        this._error.set(this.sanitizer.sanitize(error).message);
      }
      throw error;
    }
    // fix-209-b (S19): una respuesta de otra sede (más vieja) no pisa la vigente.
    if (!this.listGuard.isCurrent(requestToken)) return;

    const rows = (data as unknown as SecretariaRow[]) ?? [];
    this._error.set(null);
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
      const { data, error } = await this.supabase.client.functions.invoke('create-secretary', {
        body: payload,
      });
      // fix-200-b (generaliza lo de fix-182-b): el motivo real de la función (4xx), no un texto
      // genérico (DG-085).
      if (error) {
        this.toast.error(
          'Error',
          await edgeFunctionUserMessage(error, 'Error al crear secretaria'),
        );
        return false;
      }
      // fix-182-b: la cuenta se crea sin contraseña; la secretaria la crea desde el correo.
      this.toast.success(
        'Secretaria creada',
        data?.inviteSent === false
          ? `No pudimos enviar el correo de activación. Pídele que use "¿Olvidaste tu contraseña?" con ${payload.email}.`
          : `Le enviamos un correo a ${payload.email} para que active su cuenta y cree su contraseña.`,
      );
      await this.refreshSilently();
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error al crear secretaria';
      this.toast.error('Error', msg);
      return false;
    } finally {
      this._isSubmitting.set(false);
    }
  }

  /**
   * fix-217-b (O04 de ASG-i-034): el admin le manda a la secretaria el mismo correo de
   * "¿Olvidaste tu contraseña?" (redirige a /recuperar-contrasena, fix-181-b). El admin nunca ve
   * ni fija la clave.
   */
  async enviarRestablecimientoClave(email: string): Promise<boolean> {
    const { error } = await this.supabase.resetPasswordForEmail(
      email,
      `${window.location.origin}/recuperar-contrasena`,
    );
    if (error) {
      this.toast.error('Error', 'No se pudo enviar el correo. Intenta de nuevo en unos minutos.');
      return false;
    }
    this.toast.success(
      'Correo enviado',
      `Se envió a ${email} un enlace para restablecer la contraseña.`,
    );
    return true;
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
          canAccessBothBranches: payload.canAccessBothBranches,
        },
      });

      // fix-200-b: el motivo real de la función (4xx), no un texto genérico (DG-085).
      if (error) {
        this.toast.error(
          'Error',
          await edgeFunctionUserMessage(error, 'Error al actualizar secretaria'),
        );
        return false;
      }

      this._initialized = false;
      await this.refreshSilently();
      this.toast.success(
        'Secretaria actualizada',
        'Los datos han sido actualizados correctamente.',
      );
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al actualizar secretaria';
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
      aliasPublico: r.email,
      firstName: r.first_names,
      paternalLastName: r.paternal_last_name,
      maternalLastName: r.maternal_last_name ?? '',
      branchId: r.branch_id,
      phone: r.phone ?? '',
      canAccessBothBranches: r.can_access_both_branches ?? false,
    };
  }
}
