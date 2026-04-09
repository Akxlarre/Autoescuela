export interface SpecialServiceSale {
  id: number;
  student_id: number | null;
  service_id: number;
  sale_date: string;
  price: number;
  metadata: Record<string, unknown> | null;
  registered_by: number | null;
  created_at: string;
  // Patch: 20260407100000 — soporte clientes externos + estado de cobro
  is_student: boolean;
  client_name: string | null;
  client_rut: string | null;
  status: 'completed' | 'pending';
  paid: boolean;
}
