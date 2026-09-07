/**
 * Mapea 1:1 la tabla `branch_payroll_config` (spec 0014-m).
 *
 * Tarifa CLP por hora equivalente de instructor, global por sede
 * (no por instructor). Una fila por sede; seed = 5000.
 */
export interface BranchPayrollConfig {
  /** PK — FK a `branches.id`. */
  branch_id: number;
  /** CLP por hora equivalente. NOT NULL, CHECK >= 0, default 5000 en BD. */
  amount_per_hour: number;
  updated_at: string;
  updated_by: number | null;
}
