export interface Branch {
  id: number;
  name: string;
  slug: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  active: boolean;
  has_professional: boolean;
  created_at: string;
}
