// Enrollment Step 6 — Confirmation: enrollment summary, next steps, pending docs

import type { PaymentMethod } from './enrollment-payment.model';
import type { CourseCategory } from './enrollment-personal-data.model';

// ─── Enrollment Summary ───

export interface EnrollmentStudentSummary {
  fullName: string;
  rut: string;
  email: string;
  phone: string;
}

export interface EnrollmentCourseSummary {
  courseLabel: string;
  paymentMethodLabel: string;
  paymentMethod: PaymentMethod;
  enrollmentDate: string;
  discountAmount: number | null;
  totalPaid: number;
}

// ─── Next Steps ───

export interface NextStep {
  text: string;
  /** Segments marked as bold in the template */
  highlights: string[];
}

export type NextStepsVariant = 'regular' | 'singular';

// ─── Pending Documents ───

export interface PendingDocumentsAlert {
  visible: boolean;
  message: string;
}

// ─── Step 6 Composite Model ───

export interface EnrollmentConfirmationData {
  /** Generated enrollment number (e.g. "2026-1016") */
  enrollmentNumber: string;
  courseCategory: CourseCategory;
  student: EnrollmentStudentSummary;
  course: EnrollmentCourseSummary;
  nextStepsVariant: NextStepsVariant;
  nextSteps: NextStep[];
  pendingDocuments: PendingDocumentsAlert;
}
