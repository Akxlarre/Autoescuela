export type DiscountType = 'percentage' | 'fixed_amount';
export type DiscountApplicableTo = 'all' | 'class_b' | 'professional';
export type DiscountStatus = 'active' | 'inactive' | 'expired';

export interface DiscountUi {
  id: number;
  name: string;
  discountType: DiscountType;
  value: number;
  validFrom: string;
  validUntil: string | null;
  applicableTo: DiscountApplicableTo;
  status: DiscountStatus;
  /** null = aplica a todas las sedes. */
  branchId: number | null;
  branchName: string | null;
  /** null = usa el balde applicableTo; con valor = solo ese curso puntual (incl. CONV). */
  courseId: number | null;
  courseName: string | null;
}

/** Payload para crear/editar un descuento desde el formulario de Ajustes. */
export interface DiscountFormValue {
  name: string;
  discountType: DiscountType;
  value: number;
  validFrom: string;
  validUntil: string | null;
  applicableTo: DiscountApplicableTo;
  branchId: number | null;
  courseId: number | null;
}
