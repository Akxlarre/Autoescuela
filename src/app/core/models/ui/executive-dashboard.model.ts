// Modelos UI del Dashboard Ejecutivo de Admin (spec 0044-b).
// El Facade mapea los DTOs de `dto/executive-dashboard.model.ts` a estas formas.

/** Presets del filtro de período (AC1). */
export type ExecPeriodPreset = 'this_month' | 'last_month' | 'this_year' | 'custom';

export interface ExecPeriodOption {
  label: string;
  value: ExecPeriodPreset;
}

export const EXEC_PERIOD_OPTIONS: ExecPeriodOption[] = [
  { label: 'Este mes', value: 'this_month' },
  { label: 'Mes anterior', value: 'last_month' },
  { label: 'Este año', value: 'this_year' },
  { label: 'Personalizado', value: 'custom' },
];

/** Rango de fechas local (Chile), inclusivo, en formato ISO `YYYY-MM-DD`. */
export interface ExecDateRange {
  from: string;
  to: string;
}

/** Dirección de una variación porcentual (AC11/AC12). */
export type DeltaKind = 'up' | 'down' | 'new' | 'none';

export interface ExecDelta {
  /** Variación en %, redondeada a 1 decimal. `null` cuando no es calculable (base 0). */
  pct: number | null;
  kind: DeltaKind;
}

/** Tono semántico para pintar un delta (tokens de estado del DS). */
export type DeltaTone = 'success' | 'error' | 'muted';

/** Un KPI con su valor y las dos comparaciones (período anterior y año anterior). */
export interface ExecKpi {
  value: number;
  deltaPrev: ExecDelta;
  deltaYoy: ExecDelta;
}

/** Desglose de gastos (AC4). */
export interface ExecExpenseBreakdown {
  variables: number;
  fijos: number;
  instructores: number;
}

/** Bloque de KPIs financieros y operativos ya mapeado para la vista. */
export interface ExecKpiSummary {
  ingresos: ExecKpi;
  gastos: ExecKpi;
  gastosDesglose: ExecExpenseBreakdown;
  resultado: ExecKpi;
  /** Margen % (resultado / ingresos). `null` si ingresos = 0 (AC5). */
  margenPct: number | null;
  nuevasMatriculas: ExecKpi;
  alumnosActivos: number;
  clasesRealizadas: number;
  clasesEnAgenda: number;
  /** (canceladas + inasistencias) / (realizadas + canceladas + inasistencias). `null` sin datos. */
  tasaCancelacionPct: number | null;
  /** Aprobados / total de ensayos del período. `null` sin ensayos (AC18). */
  aprobacionEnsayosPct: number | null;
}

/** Punto mensual de los gráficos comparativos (AC13/AC14). */
export interface ExecMonthlyPoint {
  /** 1–12 */
  month: number;
  label: string;
  current: number | null;
  previous: number;
}

export interface ExecMonthlySeries {
  currentYear: number;
  ingresos: ExecMonthlyPoint[];
  matriculas: ExecMonthlyPoint[];
}

/** Fila del panel de horas por instructor (AC16). */
export interface InstructorHoursRow {
  instructorId: number;
  nombre: string;
  clases: number;
  minutos: number;
  horasLabel: string;
}

/** Etapas del alumno Clase B (AC17). */
export interface StudentStageCounts {
  nuevos: number;
  enCurso: number;
  pendienteExamen: number;
  finalizados: number;
  conSaldo: number;
}

/** Tramo de la cartera por cobrar (AC6). */
export interface ReceivableAgingBucket {
  bucket: '0-30' | '31-60' | '61-90' | '90+';
  label: string;
  monto: number;
  alumnos: number;
}

export interface ReceivablesSummary {
  total: number;
  alumnos: number;
  buckets: ReceivableAgingBucket[];
}

/** Operación de hoy (AC19). */
export interface TodayOpsSummary {
  clasesProgramadas: number;
  clasesRealizadas: number;
  clasesCanceladas: number;
  instructoresActivos: number;
  vehiculosDisponibles: number;
  vehiculosMantencion: number;
}

/** Secciones del dashboard que pueden fallar de forma independiente (AC-E2). */
export type ExecSection = 'kpis' | 'series' | 'instructores' | 'cartera' | 'hoy';
