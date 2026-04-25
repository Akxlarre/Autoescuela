import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ToastService } from '@core/services/ui/toast.service';
import type { HistorialCierre } from '@core/models/ui/historial-cuadraturas.model';
import type { CashClosing } from '@core/models/dto/cash-closing.model';

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
    fecha: row.date,
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

/** Genera y descarga un archivo CSV con los cierres del historial. */
export function exportarHistorialCSV(cierres: HistorialCierre[]): void {
  const cabecera = [
    'Fecha de Cierre',
    'Fondo Inicial',
    'Saldo Sistema',
    'Saldo Físico',
    'Diferencia',
    'Estado',
    'Cajero',
  ];

  const estadoLabel: Record<HistorialCierre['estadoDiferencia'], string> = {
    balanced: 'Cuadrado',
    surplus: 'Sobrante',
    shortage: 'Faltante',
  };

  const filas = cierres.map((c) => [
    c.fecha,
    c.fondoInicial.toString(),
    c.saldoSistema.toString(),
    c.saldoFisico.toString(),
    c.diferencia.toString(),
    estadoLabel[c.estadoDiferencia],
    c.cajero,
  ]);

  const contenidoCsv = [cabecera, ...filas]
    .map((fila) => fila.map((celda) => `"${celda.replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + contenidoCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `historial_cuadraturas_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Facade ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class HistorialCuadraturasFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _historialCierres = signal<HistorialCierre[]>([]);
  private readonly _cierreSeleccionado = signal<HistorialCierre | null>(null);
  private readonly _isLoadingHistorial = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

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
  readonly error = this._error.asReadonly();
  readonly mesActual = this._mesActual.asReadonly();
  readonly anioActual = this._anioActual.asReadonly();

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    if (user?.role === 'admin') return this.branchFacade.selectedBranchId();
    return user?.branchId ?? null;
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
      const msg = err instanceof Error ? err.message : 'Error al cargar el historial.';
      this._error.set(msg);
      this.toast.error(msg);
    } finally {
      this._isLoadingHistorial.set(false);
    }
  }

  /** Exporta los cierres actualmente cargados a un archivo CSV descargable. */
  exportarCSV(): void {
    const cierres = this._historialCierres();
    if (cierres.length === 0) {
      this.toast.warning('No hay datos para exportar.');
      return;
    }
    exportarHistorialCSV(cierres);
    this.toast.success('Archivo CSV generado correctamente.');
  }
}
