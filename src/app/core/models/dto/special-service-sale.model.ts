export interface SpecialServiceSale {
  id: number;
  student_id: number | null;
  // fix-024-i: nullable — se desvincula (no se borra) tras un borrado definitivo del catálogo.
  service_id: number | null;
  /** Snapshot del nombre del servicio al momento de la venta (fix-024-i, migración
   *  20260813060000). Sobrevive aunque service_catalog.id se borre definitivamente. */
  service_name: string | null;
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
  branch_id: number | null;
}
