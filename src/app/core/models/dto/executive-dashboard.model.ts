// DTOs de las funciones SQL del Dashboard Ejecutivo (spec 0044-b).
// Reflejan exactamente lo que devuelve cada RPC de
// `supabase/migrations/20260927120000_executive_dashboard_rpcs.sql`.

/** `exec_dashboard_kpis(p_from, p_to, p_branch_id)` → JSONB. */
export interface ExecKpisDto {
  ingresos: number;
  gastos_variables: number;
  gastos_fijos: number;
  costo_instructores: number;
  nuevas_matriculas: number;
  alumnos_activos: number;
  clases_realizadas: number;
  clases_en_agenda: number;
  clases_canceladas: number;
  inasistencias: number;
  ensayos_total: number;
  ensayos_aprobados: number;
  etapa_en_curso: number;
  etapa_pendiente_examen: number;
  etapa_finalizados: number;
}

/** `exec_dashboard_monthly_series(p_year, p_branch_id)` → 24 filas. */
export interface ExecMonthlySeriesRowDto {
  year: number;
  month: number;
  ingresos: number;
  matriculas: number;
}

/** `exec_dashboard_instructor_hours(p_from, p_to, p_branch_id)`. */
export interface ExecInstructorHoursRowDto {
  instructor_id: number;
  nombre: string;
  clases: number;
  minutos: number;
}

/** `exec_dashboard_receivables(p_branch_id)` → 4 filas (buckets fijos). */
export interface ExecReceivablesRowDto {
  bucket: '0-30' | '31-60' | '61-90' | '90+';
  monto: number;
  alumnos: number;
}

/** `exec_dashboard_today_ops(p_branch_id)` → JSONB. */
export interface ExecTodayOpsDto {
  clases_programadas: number;
  clases_realizadas: number;
  clases_canceladas: number;
  instructores_activos: number;
  vehiculos_disponibles: number;
  vehiculos_mantencion: number;
}
