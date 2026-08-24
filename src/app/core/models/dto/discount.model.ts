export interface Discount {
  id: number;
  name: string;
  discount_type: 'percentage' | 'fixed_amount' | null;
  value: number;
  valid_from: string;
  valid_until: string | null;
  applicable_to: 'all' | 'class_b' | 'professional' | null;
  status: 'active' | 'inactive' | 'expired' | null;
  referral_code: string | null;
  created_by: number | null;
  created_at: string;
  /** NULL = aplica a todas las sedes. */
  branch_id: number | null;
  /** NULL = usa el balde applicable_to; con valor = solo ese curso puntual (incl. CONV). */
  course_id: number | null;
}
