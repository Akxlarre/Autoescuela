/**
 * Fila de `branch_absence_penalty_config` (spec 0048-b).
 * Por sede: si la penalización RF-053 cancela la agenda tras 2 faltas consecutivas.
 */
export interface BranchAbsencePenaltyConfig {
  branch_id: number;
  auto_cancel_enabled: boolean;
  /** Desde cuándo cuentan las faltas. Lo fija el trigger al activar; NULL si está desactivada. */
  enabled_since: string | null;
  updated_at: string;
  updated_by: number | null;
}
