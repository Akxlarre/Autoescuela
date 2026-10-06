/** Configuración de la cancelación automática por inasistencias de una sede (spec 0048-b). */
export interface AbsencePenaltyConfigRow {
  branchId: number;
  branchName: string;
  enabled: boolean;
  /** ISO. Desde cuándo cuentan las faltas; null si está desactivada. */
  enabledSince: string | null;
}
