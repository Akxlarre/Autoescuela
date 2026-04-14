import { Injectable, computed, signal } from '@angular/core';
import {
  computeDateRange,
  type FiltrosReporte,
  type ReporteContable,
} from '@core/models/ui/reportes-contables.model';

// ── Mock data (RF-030 / RF-031) — reemplazar con query Supabase real ──────────
const MOCK_REPORTE: ReporteContable = {
  kpis: {
    totalIngresos: 8_475_000,
    totalGastos: 2_210_000,
    totalNeto: 6_265_000,
    operacionesIngresos: 71,
    operacionesGastos: 79,
    margenGanancia: 73.9,
  },
  ingresosCategoria: [
    {
      nombre: 'Clase B (A. Chillán)',
      monto: 5_040_000,
      operaciones: 18,
      porcentaje: 59.5,
      barColor: 'var(--state-info)',
    },
    {
      nombre: 'Profesional (C. Chillán)',
      monto: 2_280_000,
      operaciones: 6,
      porcentaje: 26.9,
      barColor: '#7c3aed',
    },
    {
      nombre: 'Psicotécnico',
      monto: 480_000,
      operaciones: 12,
      porcentaje: 5.7,
      barColor: 'var(--state-success)',
    },
    {
      nombre: 'Clases Extra',
      monto: 375_000,
      operaciones: 15,
      porcentaje: 4.4,
      barColor: 'var(--state-success)',
    },
    {
      nombre: 'Certificados',
      monto: 300_000,
      operaciones: 20,
      porcentaje: 3.5,
      barColor: 'var(--state-success)',
    },
  ],
  gastosCategoria: [
    { nombre: 'Bencina', monto: 850_000, registros: 45, porcentaje: 38.5 },
    { nombre: 'Arriendo', monto: 600_000, registros: 2, porcentaje: 27.1 },
    { nombre: 'Sueldos', monto: 380_000, registros: 2, porcentaje: 17.2 },
    { nombre: 'Mantención', monto: 195_000, registros: 8, porcentaje: 8.8 },
    { nombre: 'Materiales', monto: 105_000, registros: 12, porcentaje: 4.8 },
    { nombre: 'Aseo', monto: 42_000, registros: 6, porcentaje: 1.9 },
    { nombre: 'Otros', monto: 38_000, registros: 4, porcentaje: 1.7 },
  ],
  evolucionMensual: [
    { mes: 'Enero 2026', ingresos: 4_850_000, gastos: 1_230_000, neto: 3_620_000, margen: 74.6 },
    { mes: 'Febrero 2026', ingresos: 3_620_000, gastos: 980_000, neto: 2_640_000, margen: 72.9 },
  ],
  detalleDiario: [
    { fecha: '2026-01-02', operaciones: 4, ingresos: 560_000, gastos: 85_000, neto: 475_000 },
    { fecha: '2026-01-03', operaciones: 3, ingresos: 310_000, gastos: 62_000, neto: 248_000 },
    { fecha: '2026-01-06', operaciones: 6, ingresos: 680_000, gastos: 95_000, neto: 585_000 },
    { fecha: '2026-01-07', operaciones: 2, ingresos: 280_000, gastos: 43_000, neto: 237_000 },
    { fecha: '2026-01-08', operaciones: 5, ingresos: 420_000, gastos: 78_000, neto: 342_000 },
    { fecha: '2026-01-09', operaciones: 3, ingresos: 380_000, gastos: 55_000, neto: 325_000 },
    { fecha: '2026-01-10', operaciones: 4, ingresos: 290_000, gastos: 120_000, neto: 170_000 },
    { fecha: '2026-01-13', operaciones: 5, ingresos: 510_000, gastos: 68_000, neto: 442_000 },
    { fecha: '2026-01-14', operaciones: 3, ingresos: 340_000, gastos: 92_000, neto: 248_000 },
    { fecha: '2026-01-15', operaciones: 7, ingresos: 600_000, gastos: 45_000, neto: 555_000 },
    { fecha: '2026-01-16', operaciones: 4, ingresos: 480_000, gastos: 87_000, neto: 393_000 },
  ],
  diasConMovimientos: 11,
  escuela: 'Ambas escuelas',
};

@Injectable({ providedIn: 'root' })
export class ReportesContablesFacade {
  // ── 1. Estado privado ──────────────────────────────────────────────────────
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _reporte = signal<ReporteContable | null>(null);
  private readonly _filtros = signal<FiltrosReporte>(
    (() => {
      const [desde, hasta] = computeDateRange('mes_anterior');
      return { rango: 'mes_anterior', desde, hasta };
    })(),
  );
  private _initialized = false;

  // ── 2. Estado público (readonly) ───────────────────────────────────────────
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly error = this._error.asReadonly();
  public readonly filtros = this._filtros.asReadonly();

  public readonly kpis = computed(() => this._reporte()?.kpis ?? null);
  public readonly ingresosCategoria = computed(() => this._reporte()?.ingresosCategoria ?? []);
  public readonly gastosCategoria = computed(() => this._reporte()?.gastosCategoria ?? []);
  public readonly evolucionMensual = computed(() => this._reporte()?.evolucionMensual ?? []);
  public readonly detalleDiario = computed(() => this._reporte()?.detalleDiario ?? []);
  public readonly diasConMovimientos = computed(() => this._reporte()?.diasConMovimientos ?? 0);
  public readonly escuela = computed(() => this._reporte()?.escuela ?? '');

  // ── 3. Acciones ───────────────────────────────────────────────────────────

  /** SWR: primera carga con skeleton; revisitas refrescan en background. */
  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.fetchReporte();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await this.fetchReporte();
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Aplica nuevos filtros y recarga el reporte mostrando skeleton. */
  async aplicarFiltros(filtros: FiltrosReporte): Promise<void> {
    this._filtros.set(filtros);
    this._isLoading.set(true);
    try {
      await this.fetchReporte();
    } finally {
      this._isLoading.set(false);
    }
  }

  exportarExcel(): void {
    // TODO: implementar exportación a Excel (Edge Function o librería cliente)
  }

  exportarPDF(): void {
    // TODO: implementar exportación a PDF (Edge Function o librería cliente)
  }

  // ── Privado ───────────────────────────────────────────────────────────────

  private async fetchReporte(): Promise<void> {
    try {
      // TODO: reemplazar con query real a Supabase usando this._filtros()
      await new Promise<void>((r) => setTimeout(r, 600));
      this._reporte.set(MOCK_REPORTE);
      this._error.set(null);
    } catch {
      this._error.set('Error al cargar el reporte contable.');
    }
  }
}
