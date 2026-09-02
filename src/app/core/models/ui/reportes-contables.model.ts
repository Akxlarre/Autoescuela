// Modelos UI para Reportes Contables (RF-030 / RF-031)
// Resumen financiero y Total Neto por rango de fechas

export type RangoReporte =
  'mes_actual' | 'mes_anterior' | 'trimestre' | 'anio_actual' | 'personalizado';

export interface RangoOption {
  label: string;
  value: RangoReporte;
}

export const RANGOS_REPORTE: RangoOption[] = [
  { label: 'Mes actual', value: 'mes_actual' },
  { label: 'Mes anterior', value: 'mes_anterior' },
  { label: 'Último trimestre', value: 'trimestre' },
  { label: 'Año actual', value: 'anio_actual' },
  { label: 'Personalizado', value: 'personalizado' },
];

export interface FiltrosReporte {
  rango: RangoReporte;
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
}

export interface ReporteKpis {
  totalIngresos: number;
  totalGastos: number;
  totalNeto: number;
  operacionesIngresos: number;
  operacionesGastos: number;
  margenGanancia: number; // porcentaje 0–100
}

export interface CategoriaIngreso {
  nombre: string;
  monto: number;
  operaciones: number;
  porcentaje: number; // 0–100
  barColor: string; // token CSS o color de dataviz (ej: 'var(--state-success)', '#7c3aed')
}

export interface CategoriaGasto {
  nombre: string;
  monto: number;
  registros: number;
  porcentaje: number; // 0–100
}

export interface EvolucionMensual {
  mes: string; // "Enero 2026"
  ingresos: number;
  gastos: number;
  neto: number;
  margen: number; // porcentaje 0–100
}

export interface DetalleDiario {
  fecha: string; // "2026-01-02"
  operaciones: number;
  ingresos: number;
  gastos: number;
  neto: number;
}

/**
 * Fila de la tabla "Rentabilidad Estimada por Tipo de Curso".
 * `gastosDirectos` es una ESTIMACIÓN por prorrateo (fuel+repair por nº de clases
 * prácticas del tipo, materials por participación en ingresos) — no un dato exacto:
 * `expenses` no atribuye el gasto a un tipo de curso. Ver fix-237-m.
 */
export interface RentabilidadCurso {
  tipoCurso: string;
  ingresos: number;
  gastosDirectos: number;
  margenNeto: number;
  rentabilidadPorcentaje: number; // 0–100
  /** CSS custom property o color de dataviz, ej: 'var(--state-info)', '#7c3aed' */
  colorVisual: string;
}

export interface ReporteContable {
  kpis: ReporteKpis;
  ingresosCategoria: CategoriaIngreso[];
  gastosCategoria: CategoriaGasto[];
  evolucionMensual: EvolucionMensual[];
  detalleDiario: DetalleDiario[];
  rentabilidadCursos: RentabilidadCurso[];
  diasConMovimientos: number;
  escuela: string;
}

/** Nº de clases prácticas realizadas por tipo de curso (license_group) en un rango. */
export type ClassCountsByGroup = Partial<Record<string, number>>;

// ── Gastos Fijos (admin-only, tabla fixed_expenses) ───────────────────────────

export const GASTO_FIJO_CATEGORIES = [
  { label: 'Arriendo', value: 'rent' },
  { label: 'Sueldos', value: 'salary' },
  { label: 'Servicios Básicos', value: 'utility' },
  { label: 'Seguros', value: 'insurance' },
  { label: 'Reparaciones', value: 'repair' },
  { label: 'Otros', value: 'other' },
] as const;

export type GastoFijoCategory = (typeof GASTO_FIJO_CATEGORIES)[number]['value'];

export interface GastoFijoRow {
  id: number;
  category: GastoFijoCategory;
  categoryLabel: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
}

export interface RegistrarGastoFijoPayload {
  category: GastoFijoCategory;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
}

/**
 * Calcula el par [desde, hasta] en formato YYYY-MM-DD para un rango predefinido.
 * Función pura — usada tanto en el Facade como en el componente de filtros.
 */
export function computeDateRange(
  rango: RangoReporte,
  customDesde?: string,
  customHasta?: string,
): [string, string] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (rango) {
    case 'mes_actual': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return [fmt(from), fmt(to)];
    }
    case 'mes_anterior': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return [fmt(from), fmt(to)];
    }
    case 'trimestre': {
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return [fmt(from), fmt(now)];
    }
    case 'anio_actual': {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear(), 11, 31);
      return [fmt(from), fmt(to)];
    }
    case 'personalizado':
      return [customDesde ?? fmt(now), customHasta ?? fmt(now)];
  }
}
