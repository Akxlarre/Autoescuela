export interface Enrollment {
  id: number;
  number?: string | null;
  student_id: number;
  course_id: number;
  branch_id?: number | null;
  sence_code_id?: number | null;
  promotion_course_id?: number | null;
  base_price?: number | null;
  discount: number;
  total_paid: number;
  pending_balance?: number | null;
  payment_status?: string | null;
  status?: string | null;
  expires_at?: string | null;
  docs_complete: boolean;
  contract_accepted: boolean;
  certificate_enabled: boolean;
  current_step: number;
  payment_mode?: 'total' | 'partial' | null;
  license_group?: 'class_b' | 'professional' | null;
  certificate_b_pdf_url?: string | null;
  registration_channel?: string | null;
  registered_by?: number | null;
  created_at: string;
  updated_at: string;
}
