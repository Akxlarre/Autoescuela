export interface CuadraturaAdjustment {
  id: number;
  cuadratura_id: number;
  tipo: 'gasto_olvidado' | 'correccion_manual';
  monto: number;
  motivo: string;
  expense_id: number | null;
  registered_by: number;
  created_at: string;
}
