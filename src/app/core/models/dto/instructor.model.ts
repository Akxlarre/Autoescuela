export interface Instructor {
  id: number;
  user_id: number;
  type?: string | null;
  license_number?: string | null;
  license_class?: string | null;
  license_expiry?: string | null;
  license_status?: string | null;
  active_classes_count: number;
  active: boolean;
  registration_date?: string | null;
}
