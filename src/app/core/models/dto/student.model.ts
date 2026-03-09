export interface Student {
  id: number;
  user_id: number;
  birth_date: string;
  gender?: string | null;
  address?: string | null;
  is_minor?: boolean | null;
  has_notarial_auth: boolean;
  current_license_class?: string | null;
  license_obtained_date?: string | null;
  status?: string | null;
  created_at: string;
}
