import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import type { AuditLogRow } from '@core/models/ui/audit-log-row.model';
import {
  ACTION_LABEL_MAP,
  ENTITY_MODULE_MAP,
  KNOWN_ENTITIES,
} from '@core/models/ui/audit-log-row.model';

export interface AuditFilters {
  fechaDesde: string | null;
  fechaHasta: string | null;
  secretariaId: number | null;
  accion: string | null;
  modulo: string | null;
}

export interface SecretariaOption {
  id: number;
  nombre: string;
  email: string;
}

const PAGE_SIZE = 25;

@Injectable({ providedIn: 'root' })
export class AuditoriaFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  // ── Estado privado ──────────────────────────────────────────────────────────
  private _logs = signal<AuditLogRow[]>([]);
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);
  private _secretarias = signal<SecretariaOption[]>([]);
  private _totalCount = signal(0);
  private _currentPage = signal(1);
  private _filters = signal<AuditFilters>({
    fechaDesde: null,
    fechaHasta: null,
    secretariaId: null,
    accion: null,
    modulo: null,
  });

  private _initialized = false;

  // ── Estado público ──────────────────────────────────────────────────────────
  readonly logs = this._logs.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly secretarias = this._secretarias.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();
  readonly filters = this._filters.asReadonly();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this._totalCount() / PAGE_SIZE)));

  readonly paginationStart = computed(() => (this._currentPage() - 1) * PAGE_SIZE + 1);
  readonly paginationEnd = computed(() =>
    Math.min(this._currentPage() * PAGE_SIZE, this._totalCount()),
  );

  // ── Inicialización ──────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._initialized) {
      await this.fetchLogs();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await Promise.all([this.fetchSecretarias(), this.fetchLogs()]);
    } finally {
      this._isLoading.set(false);
    }
  }

  // ── Filtros ─────────────────────────────────────────────────────────────────

  setFilters(filters: Partial<AuditFilters>): void {
    this._filters.update((prev) => ({ ...prev, ...filters }));
    this._currentPage.set(1);
    void this.fetchLogs();
  }

  clearFilters(): void {
    this._filters.set({
      fechaDesde: null,
      fechaHasta: null,
      secretariaId: null,
      accion: null,
      modulo: null,
    });
    this._currentPage.set(1);
    void this.fetchLogs();
  }

  setPage(page: number): void {
    this._currentPage.set(page);
    void this.fetchLogs();
  }

  // ── Fetch privado ───────────────────────────────────────────────────────────

  private async fetchLogs(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const f = this._filters();
      const offset = (this._currentPage() - 1) * PAGE_SIZE;

      // Construir query base: audit_log JOIN users (solo secretarias)
      let query = this.supabase.client
        .from('audit_log')
        .select(
          `
          id,
          action,
          entity,
          entity_id,
          detail,
          ip,
          created_at,
          users!inner (
            id,
            first_names,
            paternal_last_name,
            email,
            roles!inner ( name )
          )
        `,
          { count: 'exact' },
        )
        .eq('users.roles.name', 'secretary')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      // Filtros opcionales
      if (f.fechaDesde) {
        query = query.gte('created_at', `${f.fechaDesde}T00:00:00`);
      }
      if (f.fechaHasta) {
        query = query.lte('created_at', `${f.fechaHasta}T23:59:59`);
      }
      if (f.secretariaId) {
        query = query.eq('user_id', f.secretariaId);
      }
      if (f.accion) {
        // "Crear"→INSERT, "Actualizar"→UPDATE, "Eliminar"→DELETE
        const pgOp = Object.entries(ACTION_LABEL_MAP).find(([, v]) => v === f.accion)?.[0];
        if (pgOp) query = query.eq('action', pgOp);
      }
      if (f.modulo) {
        if (f.modulo === 'Otros') {
          // "Otros" = entidades con trigger pero sin módulo mapeado
          query = query.not('entity', 'in', `(${KNOWN_ENTITIES.join(',')})`);
        } else {
          const entities = Object.entries(ENTITY_MODULE_MAP)
            .filter(([, mod]) => mod === f.modulo)
            .map(([entity]) => entity);
          if (entities.length > 0) query = query.in('entity', entities);
        }
      }

      const { data, error, count } = await query;

      if (error) throw error;

      this._totalCount.set(count ?? 0);
      this._logs.set((data ?? []).map((row) => this.mapToRow(row)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar el log de auditoría';
      this._error.set(msg);
      this.toast.error(msg);
    } finally {
      this._isLoading.set(false);
    }
  }

  private async fetchSecretarias(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('users')
      .select('id, first_names, paternal_last_name, email, roles!inner(name)')
      .eq('roles.name', 'secretary')
      .order('first_names');

    if (error || !data) return;

    this._secretarias.set(
      data.map((u) => ({
        id: u.id,
        nombre: `${u.first_names} ${u.paternal_last_name}`,
        email: u.email,
      })),
    );
  }

  // ── Mapeo DTO → UI ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToRow(raw: any): AuditLogRow {
    const user = raw.users;
    return {
      id: raw.id,
      fechaHora: raw.created_at,
      usuarioNombre: user ? `${user.first_names} ${user.paternal_last_name}` : '—',
      usuarioEmail: user?.email ?? '—',
      accion: ACTION_LABEL_MAP[raw.action] ?? raw.action,
      modulo: ENTITY_MODULE_MAP[raw.entity] ?? raw.entity ?? '—',
      detalle: raw.detail ?? '—',
      ip: raw.ip ?? '—',
    };
  }
}
