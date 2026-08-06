import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { downloadExcel } from '@core/utils/excel.utils';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import type { HistorialCierre } from '@core/models/ui/historial-cuadraturas.model';
import type {
  AjusteFormData,
  CuadraturaAdjustmentRow,
} from '@core/models/ui/cuadratura-adjustment.model';
import type { CashClosing } from '@core/models/dto/cash-closing.model';
import type { CuadraturaAdjustment } from '@core/models/dto/cuadratura-adjustment.model';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

const TIPO_AJUSTE_LABEL: Record<CuadraturaAdjustment['tipo'], string> = {
  gasto_olvidado: 'Gasto olvidado',
  correccion_manual: 'Corrección manual',
};

function mapAdjustmentToRow(
  row: CuadraturaAdjustment & {
    users?: { first_names: string; paternal_last_name: string } | null;
  },
): CuadraturaAdjustmentRow {
  const autorNombre = row.users
    ? `${row.users.first_names} ${row.users.paternal_last_name}`.trim()
    : '—';

  const fecha = new Date(row.created_at);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const yyyy = fecha.getFullYear();
  const hh = String(fecha.getHours()).padStart(2, '0');
  const min = String(fecha.getMinutes()).padStart(2, '0');

  return {
    id: row.id,
    tipo: row.tipo,
    tipoLabel: TIPO_AJUSTE_LABEL[row.tipo],
    monto: row.monto,
    motivo: row.motivo,
    autorNombre,
    fecha: `${dd}/${mm}/${yyyy} ${hh}:${min}`,
  };
}

// ─── Helpers puros ────────────────────────────────────────────────────────────

function mapCierreToHistorial(
  row: CashClosing & { users?: { first_names: string; paternal_last_name: string } | null },
): HistorialCierre {
  const saldoSistema = row.balance ?? 0;
  const saldoFisico = row.arqueo_amount ?? 0;
  const diferencia = row.difference ?? saldoFisico - saldoSistema;

  const cajero = row.users
    ? `${row.users.first_names} ${row.users.paternal_last_name}`.trim()
    : '—';

  let estadoDiferencia: HistorialCierre['estadoDiferencia'];
  if (diferencia === 0) estadoDiferencia = 'balanced';
  else if (diferencia > 0) estadoDiferencia = 'surplus';
  else estadoDiferencia = 'shortage';

  return {
    id: row.id,
    branchId: row.branch_id ?? null,
    fecha: row.date,
    // El historial solo trae `.eq('closed', true)` — este campo documenta esa garantía
    // en vez de asumirla implícitamente (spec 0002-i, AC-E1).
    closed: row.closed ?? true,
    fondoInicial: 50_000,
    saldoSistema,
    saldoFisico,
    diferencia,
    cajero,
    totalIngresos: row.total_income ?? 0,
    totalEgresos: row.total_expenses ?? 0,
    estadoDiferencia,
    qtyBill20000: row.qty_bill_20000 ?? 0,
    qtyBill10000: row.qty_bill_10000 ?? 0,
    qtyBill5000: row.qty_bill_5000 ?? 0,
    qtyBill2000: row.qty_bill_2000 ?? 0,
    qtyBill1000: row.qty_bill_1000 ?? 0,
    qtyCoin500: row.qty_coin_500 ?? 0,
    qtyCoin100: row.qty_coin_100 ?? 0,
    qtyCoin50: row.qty_coin_50 ?? 0,
    qtyCoin10: row.qty_coin_10 ?? 0,
    notes: row.notes ?? null,
  };
}

const ESTADO_LABEL: Record<HistorialCierre['estadoDiferencia'], string> = {
  balanced: 'Cuadrado',
  surplus: 'Sobrante',
  shortage: 'Faltante',
};

function buildMonthlyExcelRows(cierres: HistorialCierre[]): (string | number)[][] {
  const header = [
    'Fecha',
    'Cajero',
    'Fondo Inicial',
    'Total Ingresos',
    'Total Egresos',
    'Saldo Sistema',
    'Saldo Fisico',
    'Diferencia',
    'Estado',
  ];
  const rows = cierres.map((c) => [
    c.fecha,
    c.cajero,
    c.fondoInicial,
    c.totalIngresos,
    c.totalEgresos,
    c.saldoSistema,
    c.saldoFisico,
    c.diferencia,
    ESTADO_LABEL[c.estadoDiferencia],
  ]);
  return [header, ...rows];
}

// ─── Facade ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class HistorialCuadraturasFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _historialCierres = signal<HistorialCierre[]>([]);
  private readonly _cierreSeleccionado = signal<HistorialCierre | null>(null);
  private readonly _isLoadingHistorial = signal<boolean>(false);
  private readonly _isExporting = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  /** Ajustes del cierre actualmente seleccionado (spec 0002-i). */
  private readonly _ajustesCierre = signal<CuadraturaAdjustmentRow[]>([]);
  private readonly _isLoadingAjustes = signal<boolean>(false);

  // ── SWR State ────────────────────────────────────────────────────────────
  private _initialized = false;
  private _lastMonth: number | null = null;
  private _lastYear: number | null = null;
  private _lastBranchId: number | null = null;

  // ── Navegación de mes ─────────────────────────────────────────────────────
  private readonly _mesActual = signal<number>(new Date().getMonth() + 1);
  private readonly _anioActual = signal<number>(new Date().getFullYear());

  // ── Estado público ────────────────────────────────────────────────────────
  readonly historialCierres = this._historialCierres.asReadonly();
  readonly cierreSeleccionado = this._cierreSeleccionado.asReadonly();
  readonly isLoadingHistorial = this._isLoadingHistorial.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();
  readonly error = this._error.asReadonly();
  readonly mesActual = this._mesActual.asReadonly();
  readonly anioActual = this._anioActual.asReadonly();

  /**
   * Guard client-side para el botón "Registrar ajuste" (AC7, spec 0002-i). La RLS de
   * `cuadratura_adjustments` es el guard real — esto solo evita mostrar la acción a
   * quien no puede usarla. Vive acá (no en el componente) para que
   * `DetalleCuadraturaModalComponent` (shared/) no necesite inyectar `AuthFacade`.
   */
  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  readonly ajustesCierre = this._ajustesCierre.asReadonly();
  readonly isLoadingAjustes = this._isLoadingAjustes.asReadonly();

  /**
   * Total vigente del cierre seleccionado (spec 0002-i, AC4): el arqueo original
   * (`saldoFisico`, inmutable) + la suma de todos sus ajustes (con signo). Nunca
   * recalcula ni sobrescribe el snapshot original — es una cifra derivada aparte.
   */
  readonly totalVigente = computed(() => {
    const cierre = this._cierreSeleccionado();
    if (!cierre) return 0;
    const sumaAjustes = this._ajustesCierre().reduce((acc, a) => acc + a.monto, 0);
    return cierre.saldoFisico + sumaAjustes;
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  // ── Navegación ────────────────────────────────────────────────────────────

  mesAnterior(): void {
    let mes = this._mesActual();
    let anio = this._anioActual();
    if (mes === 1) {
      mes = 12;
      anio--;
    } else {
      mes--;
    }
    this._mesActual.set(mes);
    this._anioActual.set(anio);
    this.initialize();
  }

  mesSiguiente(): void {
    let mes = this._mesActual();
    let anio = this._anioActual();
    if (mes === 12) {
      mes = 1;
      anio++;
    } else {
      mes++;
    }
    this._mesActual.set(mes);
    this._anioActual.set(anio);
    this.initialize();
  }

  volverAHoy(): void {
    const now = new Date();
    this._mesActual.set(now.getMonth() + 1);
    this._anioActual.set(now.getFullYear());
    this.initialize();
  }

  seleccionarCierre(cierre: HistorialCierre | null): void {
    this._cierreSeleccionado.set(cierre);
    // Reset inmediato (spec 0002-i): nunca mostrar los ajustes del cierre anterior
    // mientras se cargan los del nuevo — evita el riesgo de "arrastre" identificado
    // en plan.md §8.
    this._ajustesCierre.set([]);
    if (cierre) void this.fetchAjustes(cierre.id);
  }

  // ── Ajustes de cuadratura (spec 0002-i) ───────────────────────────────────

  /**
   * Abre el drawer de registro de ajuste. Import dinámico (mismo patrón que
   * `ServiciosEspecialesFacade.openAgregarServicioDrawer()`) para que el Facade
   * pueda orquestar la apertura sin que `DetalleCuadraturaModalComponent`
   * (shared/, Dumb) necesite inyectar `LayoutDrawerFacadeService` directamente.
   */
  abrirRegistrarAjusteDrawer(): void {
    import('../../features/admin/contabilidad-cuadratura/registrar-ajuste-cuadratura-drawer.component').then(
      (m) => {
        this.layoutDrawer.open(
          m.RegistrarAjusteCuadraturaDrawerComponent,
          'Registrar Ajuste',
          'wrench',
        );
      },
    );
  }

  private async fetchAjustes(cuadraturaId: number): Promise<void> {
    this._isLoadingAjustes.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('cuadratura_adjustments')
        .select('*, users(first_names, paternal_last_name)')
        .eq('cuadratura_id', cuadraturaId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      this._ajustesCierre.set((data ?? []).map(mapAdjustmentToRow));
    } catch {
      this.toast.error('Error al cargar los ajustes de esta cuadratura.');
    } finally {
      this._isLoadingAjustes.set(false);
    }
  }

  /**
   * Inserta el gasto real de un ajuste "gasto_olvidado" en `expenses`, con la
   * fecha del CIERRE corregido (AC2) — nunca la de hoy. Retorna el `id` insertado.
   */
  private async insertGastoOlvidado(
    cierre: HistorialCierre,
    datos: AjusteFormData,
    registeredBy: number,
  ): Promise<number> {
    const { data, error } = await this.supabase.client
      .from('expenses')
      .insert({
        date: cierre.fecha,
        amount: Math.abs(datos.monto),
        description: datos.motivo,
        category: datos.categoria ?? null,
        vehicle_id: datos.vehiculoId ?? null,
        branch_id: cierre.branchId,
        registered_by: registeredBy,
      })
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }

  /**
   * Registra un ajuste sobre el cierre actualmente seleccionado (AC1-AC3, AC-E1).
   * `tipo === 'gasto_olvidado'` también inserta en `expenses` (AC2).
   */
  async registrarAjuste(datos: AjusteFormData): Promise<boolean> {
    const cierre = this._cierreSeleccionado();
    if (!cierre || !cierre.closed) {
      this.toast.error('Solo se pueden registrar ajustes sobre cuadraturas cerradas.');
      return false;
    }

    const user = this.auth.currentUser();
    if (!user?.dbId) return false;

    try {
      const expenseId =
        datos.tipo === 'gasto_olvidado'
          ? await this.insertGastoOlvidado(cierre, datos, user.dbId)
          : null;

      const { error } = await this.supabase.client.from('cuadratura_adjustments').insert({
        cuadratura_id: cierre.id,
        tipo: datos.tipo,
        monto: datos.monto,
        motivo: datos.motivo,
        expense_id: expenseId,
        registered_by: user.dbId,
      });
      if (error) throw error;

      this.toast.success('Ajuste registrado correctamente.');
      await this.fetchAjustes(cierre.id);
      return true;
    } catch {
      this.toast.error('Error al registrar el ajuste.');
      return false;
    }
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    const mes = this._mesActual();
    const anio = this._anioActual();
    const branchId = this.getActiveBranchId();

    const isSameContext =
      this._initialized &&
      mes === this._lastMonth &&
      anio === this._lastYear &&
      branchId === this._lastBranchId;

    if (isSameContext) {
      void this.refreshSilently();
      return;
    }

    this._isLoadingHistorial.set(true);
    this._error.set(null);
    try {
      await this.fetchHistorialData(mes, anio, branchId);
      this._initialized = true;
      this._lastMonth = mes;
      this._lastYear = anio;
      this._lastBranchId = branchId;
    } finally {
      this._isLoadingHistorial.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      const mes = this._mesActual();
      const anio = this._anioActual();
      const branchId = this.getActiveBranchId();
      await this.fetchHistorialData(mes, anio, branchId);
      this._lastMonth = mes;
      this._lastYear = anio;
      this._lastBranchId = branchId;
    } catch {
      // Swallowed
    }
  }

  async cargarHistorial(): Promise<void> {
    return this.initialize();
  }

  private async fetchHistorialData(
    mes: number,
    anio: number,
    branchId: number | null,
  ): Promise<void> {
    try {
      const mm = String(mes).padStart(2, '0');
      const yyyy = String(anio);
      const fechaInicio = `${yyyy}-${mm}-01`;
      const lastDay = new Date(anio, mes, 0).getDate();
      const fechaFin = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;

      let query = this.supabase.client
        .from('cash_closings')
        .select('*, users(first_names, paternal_last_name)')
        .eq('closed', true)
        .gte('date', fechaInicio)
        .lte('date', fechaFin)
        .order('date', { ascending: true });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      this._historialCierres.set((data ?? []).map(mapCierreToHistorial as any));
    } catch (err) {
      const msg =
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al cargar el historial.';
      this._error.set(msg);
      this.toast.error(msg);
    } finally {
      this._isLoadingHistorial.set(false);
    }
  }

  // ── Exportación mensual ───────────────────────────────────────────────────

  /** Exporta el resumen mensual de cierres. Excel: client-side. PDF: Edge Function generate-cash-history-report. */
  async exportarMes(format: 'excel' | 'pdf'): Promise<void> {
    const cierres = this._historialCierres();
    if (cierres.length === 0) {
      this.toast.warning('No hay datos para exportar en este mes.');
      return;
    }

    const mes = this._mesActual();
    const anio = this._anioActual();
    const mesStr = String(mes).padStart(2, '0');

    if (format === 'excel') {
      const filename = `Historial_Cuadraturas_${anio}-${mesStr}`;
      const rows = buildMonthlyExcelRows(cierres);
      downloadExcel('Historial', [], rows, filename);
      this.toast.success('Excel mensual generado correctamente.');
      return;
    }

    // PDF via Edge Function
    this._isExporting.set(true);
    try {
      const branchId = this.getActiveBranchId();
      const { data, error } = await this.supabase.client.functions.invoke(
        'generate-cash-history-report',
        { body: { month: mes, year: anio, branch_id: branchId } },
      );
      if (error) throw error;

      const rawBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
      const blob = new Blob([rawBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Historial_Cuadraturas_${anio}-${mesStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast.success('PDF mensual generado correctamente.');
    } catch {
      this.toast.error('No se pudo generar el reporte PDF. Intenta de nuevo.');
    } finally {
      this._isExporting.set(false);
    }
  }

  // ── Exportación de cierre individual ─────────────────────────────────────

  /** Exporta el reporte detallado de un cierre específico usando la Edge Function generate-cash-closing-report. */
  async exportarCierre(format: 'excel' | 'pdf'): Promise<void> {
    const cierre = this._cierreSeleccionado();
    if (!cierre) return;

    this._isExporting.set(true);
    try {
      const branchId = this.getActiveBranchId();
      const { data, error } = await this.supabase.client.functions.invoke(
        'generate-cash-closing-report',
        { body: { format, date: cierre.fecha, branch_id: branchId } },
      );
      if (error) throw error;

      const fechaSlug = cierre.fecha.replace(/-/g, '');
      if (format === 'excel') {
        const { sheetName, rows, filename } = data as {
          sheetName: string;
          rows: (string | number)[][];
          filename: string;
        };
        downloadExcel(sheetName, [], rows, filename ?? `Cuadratura_${fechaSlug}`);
      } else {
        const rawBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
        const blob = new Blob([rawBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Cuadratura_${fechaSlug}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
      this.toast.success('Reporte generado correctamente.');
    } catch {
      this.toast.error('No se pudo generar el reporte. Intenta de nuevo.');
    } finally {
      this._isExporting.set(false);
    }
  }
}
