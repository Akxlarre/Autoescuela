export interface Course {
  id: number;
  code?: string | null;
  name: string;
  type?: string | null;
  duration_weeks?: number | null;
  practical_hours?: number | null;
  theory_hours?: number | null;
  base_price?: number | null;
  license_class?: string | null;
  branch_id?: number | null;
  active: boolean;
  /** true = curso CONV A3/A4. No seleccionable en wizard; solo contenedor de sesiones. */
  is_convalidation?: boolean | null;
  schedule_days?: number[] | null;
  schedule_blocks?: { from: string; to: string }[] | null;
}
