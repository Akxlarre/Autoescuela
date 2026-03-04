// Enrollment Step 4 — Pricing, discounts, payment method, totals

import type { StudentSummaryBanner } from './enrollment-assignment.model';

// ─── Payment Method ───

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'pendiente';

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon: string;
  description: string;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: 'efectivo', label: 'Efectivo', icon: 'banknote', description: 'Pago en caja' },
  {
    value: 'transferencia',
    label: 'Transferencia',
    icon: 'landmark',
    description: 'Upload comprobante',
  },
  { value: 'tarjeta', label: 'Débito/Crédito', icon: 'credit-card', description: 'Terminal POS' },
  {
    value: 'pendiente',
    label: 'Dejar pago pendiente',
    icon: 'clock',
    description: 'Cobrar después (RF-010: payment_status = pending)',
  },
];

// ─── Pricing Breakdown ───

export interface PricingBreakdown {
  courseLabel: string;
  practicalClassesIncluded: number;
  basePrice: number;
  /** Whether the student chose deposit mode in step 2 (Class B only) */
  isDeposit: boolean;
  /** Amount due now: basePrice if full, basePrice / 2 if deposit */
  amountDue: number;
}

// ─── Discount ───

export interface DiscountData {
  enabled: boolean;
  amount: number | null;
  reason: string;
}

// ─── Singular Course Alert ───

export interface SingularPaymentAlert {
  visible: boolean;
  message: string;
}

// ─── Step 4 Composite Model ───

export interface EnrollmentPaymentData {
  studentSummary: StudentSummaryBanner;
  pricing: PricingBreakdown;
  discount: DiscountData;
  /** basePrice (or amountDue) minus discount */
  totalToPay: number;
  paymentMethod: PaymentMethod | null;
  /** Singular courses require full payment — disables "pendiente" option */
  isSingularCourse: boolean;
  singularAlert: SingularPaymentAlert;
}
