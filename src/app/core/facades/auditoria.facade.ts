import { Injectable, computed, inject, signal } from '@angular/core';
import { chileDayRange } from '@core/utils/chile-time.utils';
import { todayIso } from '@core/utils/date.utils';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from './auth.facade';
import { BranchFacade } from './branch.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { downloadExcel } from '@core/utils/excel.utils';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import type {
  AuditActor,
  AuditLogRow,
  AuditUsuarioOption,
} from '@core/models/ui/audit-log-row.model';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import {
  ACTION_LABEL_MAP,
  ENTITY_MODULE_MAP,
  KNOWN_ENTITIES,
} from '@core/models/ui/audit-log-row.model';
import { auditActorPlan, auditUserLabel } from '@core/utils/audit-actor.utils';

export interface AuditFilters {
  fechaDesde: string | null;
  fechaHasta: string | null;
  /** fix-069-i: quién hizo la acción. Antes la pantalla mostraba solo secretarias. */
  quien: AuditActor;
  usuarioId: number | null;
  accion: string | null;
  modulo: string | null;
}

const EMPTY_FILTERS: AuditFilters = {
  fechaDesde: null,
  fechaHasta: null,
  quien: 'todos',
  usuarioId: null,
  accion: null,
  modulo: null,
};

const PAGE_SIZE = 25;

@Injectable({ providedIn: 'root' })
export class AuditoriaFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);

  // ── Estado privado ──────────────────────────────────────────────────────────
  private _logs = signal<AuditLogRow[]>([]);
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);
  private _usuarios = signal<AuditUsuarioOption[]>([]);
  private _totalCount = signal(0);
  private _currentPage = signal(1);
  private _filters = signal<AuditFilters>({ ...EMPTY_FILTERS });

  private _isExporting = signal(false);
  readonly isExporting = this._isExporting.asReadonly();

  private _selectedLog = signal<AuditLogRow | null>(null);
  readonly selectedLog = this._selectedLog.asReadonly();

  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;

  // ── Estado público ──────────────────────────────────────────────────────────
  readonly logs = this._logs.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  /** Secretarias y administradores, para el filtro de usuario (fix-069-i). */
  readonly usuarios = this._usuarios.asReadonly();
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
    const branchId = this.getActiveBranchId();

    if (this._initialized && branchId === this._lastBranchId) {
      await this.fetchLogs();
      return;
    }

    this._initialized = true;
    this._lastBranchId = branchId;
    this._currentPage.set(1);
    this._isLoading.set(true);
    try {
      await Promise.all([this.fetchUsuarios(), this.fetchLogs()]);
    } finally {
      this._isLoading.set(false);
    }
  }

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  // ── Filtros ─────────────────────────────────────────────────────────────────

  setFilters(filters: Partial<AuditFilters>): void {
    this._filters.update((prev) => ({ ...prev, ...filters }));
    this._currentPage.set(1);
    void this.fetchLogs();
  }

  clearFilters(): void {
    this._filters.set({ ...EMPTY_FILTERS });
    this._currentPage.set(1);
    void this.fetchLogs();
  }

  setPage(page: number): void {
    this._currentPage.set(page);
    void this.fetchLogs();
  }

  selectLog(log: AuditLogRow): void {
    this._selectedLog.set(log);
  }

  // ── Fetch privado ───────────────────────────────────────────────────────────

  private async fetchLogs(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const f = this._filters();
      const offset = (this._currentPage() - 1) * PAGE_SIZE;

      const branchId = this.getActiveBranchId();
      // fix-069-i: hasta acá la consulta era siempre `users!inner` + rol secretaria. Lo que hacía
      // el admin (anular un pago) y la limpieza automática (sin usuario) no aparecía nunca.
      const plan = auditActorPlan(f.quien);

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
          branch_id,
          ${plan.innerUsers ? 'users!inner' : 'users'} (
            id,
            first_names,
            paternal_last_name,
            email,
            branch_id,
            ${plan.roleName ? 'roles!inner' : 'roles'} ( name ),
            branches ( name )
          )
        `,
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (plan.roleName) query = query.eq('users.roles.name', plan.roleName);
      if (plan.onlySystem) query = query.is('user_id', null);
      if (branchId !== null) query = query.eq(plan.branchColumn, branchId);

      // Filtros opcionales
      if (f.fechaDesde) {
        query = query.gte('created_at', chileDayRange(f.fechaDesde).start);
      }
      if (f.fechaHasta) {
        query = query.lt('created_at', chileDayRange(f.fechaHasta).endExclusive);
      }
      if (f.usuarioId && !plan.onlySystem) {
        query = query.eq('user_id', f.usuarioId);
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
      this._logs.set((data ?? []).map((row: any) => this.mapToRow(row)));
    } catch (err) {
      const msg =
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al cargar el log de auditoría';
      this._error.set(msg);
      this.toast.error(msg);
    } finally {
      this._isLoading.set(false);
    }
  }

  private async fetchUsuarios(): Promise<void> {
    const branchId = this.getActiveBranchId();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = this.supabase.client
      .from('users')
      .select('id, first_names, paternal_last_name, email, branch_id, roles!inner(name)')
      .in('roles.name', ['secretary', 'admin'])
      .order('first_names');

    const { data, error } = await query;

    if (error || !data) return;

    this._usuarios.set(
      data
        // Las secretarias, de la sede elegida; los admin no tienen sede propia y van siempre.
        .filter(
          (u: any) => branchId === null || u.roles?.name === 'admin' || u.branch_id === branchId,
        )
        .map((u: any) => ({
          id: u.id,
          nombre: `${u.first_names} ${u.paternal_last_name}`,
          email: u.email,
          rol: u.roles?.name ?? '',
        })),
    );
  }

  // ── Exportación ─────────────────────────────────────────────────────────────

  async exportar(format: 'excel' | 'pdf'): Promise<void> {
    this._isExporting.set(true);
    try {
      const f = this._filters();
      const branchId = this.getActiveBranchId();
      const { data, error } = await this.supabase.client.functions.invoke('generate-audit-report', {
        body: {
          format,
          branch_id: branchId,
          fecha_desde: f.fechaDesde,
          fecha_hasta: f.fechaHasta,
          quien: f.quien,
          usuario_id: f.usuarioId,
          accion: f.accion,
          modulo: f.modulo,
        },
      });
      if (error) throw error;

      const today = todayIso().replace(/-/g, '');
      if (format === 'excel') {
        const { sheetName, rows, filename } = data as {
          sheetName: string;
          rows: (string | number)[][];
          filename: string;
        };
        downloadExcel(sheetName, [], rows, filename ?? `Auditoria_${today}`);
      } else {
        const rawBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
        const blob = new Blob([rawBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Auditoria_${today}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
      this.toast.success('Reporte de auditoría generado correctamente.');
    } catch {
      this.toast.error('No se pudo generar el reporte. Inténtalo de nuevo.');
    } finally {
      this._isExporting.set(false);
    }
  }

  // ── Mapeo DTO → UI ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToRow(raw: any): AuditLogRow {
    const user = raw.users;
    return {
      id: raw.id,
      fechaHora: raw.created_at,
      // fix-069-i: sin usuario = lo hizo la limpieza automática (log_change ya no lo atribuye a
      // quien registró la fila).
      usuarioNombre: user ? `${user.first_names} ${user.paternal_last_name}` : 'Sistema',
      usuarioRol: user ? (user.roles?.name ? auditUserLabel(user.roles.name) : '—') : 'Sistema',
      usuarioEmail: user?.email ?? '—',
      // fix-069-i: el admin no tiene sede propia y el Sistema no tiene usuario: se muestra la sede
      // de la acción.
      sedeNombre:
        user?.branches?.name ??
        this.branchFacade.branches().find((b) => b.id === raw.branch_id)?.name ??
        '—',
      accion: ACTION_LABEL_MAP[raw.action] ?? raw.action,
      modulo: ENTITY_MODULE_MAP[raw.entity] ?? raw.entity ?? '—',
      detalle: raw.detail ?? '—',
      ip: raw.ip ?? '—',
    };
  }
}
