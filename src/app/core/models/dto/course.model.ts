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
  schedule_days?: number[] | null;
  schedule_blocks?: { from: string; to: string }[] | null;
}
