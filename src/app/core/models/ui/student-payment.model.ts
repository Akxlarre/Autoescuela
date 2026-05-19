import type { ScheduleGrid } from './enrollment-assignment.model';

// ─── Datos del enrollment con saldo pendiente ───

export interface StudentPaymentEnrollmentInfo {
  id: number;
  number: string;
  courseName: string;
  branchName: string;
  branchId: number;
  basePrice: number;
  pendingBalance: number;
  totalPaid: number;
  licenseGroup: 'class_b' | 'professional';
}

export interface StudentPaymentInstructor {
  id: number;
  name: string;
}

export interface StudentPaymentHistoryItem {
  id: number;
  date: string;
  amount: number;
  type: 'online' | 'cash' | 'transfer' | 'card';
  status: 'paid' | 'pending';
}

/** Respuesta de load-enrollment-status */
export interface StudentPaymentStatus {
  hasPaymentPending: boolean;
  enrollment: StudentPaymentEnrollmentInfo | null;
  instructor: StudentPaymentInstructor | null;
  existingSessionCount: number;
  /** true  → alumno debe seleccionar 6 slots (flujo normal/escenario C)
   *  false → 12 clases ya agendadas, solo pagar (escenario A) */
  needsSlotSelection: boolean;
  studentName: string;
  payments: StudentPaymentHistoryItem[];
}

// ─── Estado del wizard ───

export type StudentPaymentStep = 1 | 2 | 3;

export interface StudentPaymentWizardState {
  step: StudentPaymentStep;
  status: StudentPaymentStatus | null;
  scheduleGrid: ScheduleGrid | null;
  selectedSlotIds: string[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
}

// ─── Resultado del pago confirmado ───

export interface StudentPaymentResult {
  success: boolean;
  rejected?: boolean;
  idempotent?: boolean;
  enrollmentNumber?: string | null;
  courseName?: string | null;
  branchName?: string | null;
  amountPaid?: number;
  pendingBalance?: number;
  sessionCount?: number;
  message?: string;
  error?: string;
}
