// Enrollment Step 2 — Payment mode, instructor assignment, schedule slots, promotion cohort

// ─── Student Summary (header banner) ───

export interface StudentSummaryBanner {
  initials: string;
  fullName: string;
  courseLabel: string;
}

// ─── Payment Mode (Class B only) ───

export type PaymentMode = 'total' | 'partial';

export interface PaymentModeOption {
  value: PaymentMode;
  label: string;
  description: string;
  practicalClasses: number;
  badge: string;
}

// ─── Instructor Selection (Class B only) ───

export interface InstructorOption {
  id: number;
  name: string;
  vehicleDescription: string;
  plate: string;
}

// ─── Schedule Grid (Class B only) ───

export type SlotStatus = 'available' | 'selected' | 'occupied';

export interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SlotStatus;
}

export interface WeekDay {
  date: string;
  label: string;
  dayOfWeek: string;
}

export interface WeekRange {
  startDate: string;
  endDate: string;
  label: string;
  days: WeekDay[];
}

export interface ScheduleGrid {
  week: WeekRange;
  timeRows: string[];
  slots: TimeSlot[];
}

export interface SlotSelection {
  selectedSlotIds: string[];
  requiredCount: number;
  currentCount: number;
  isComplete: boolean;
}

// ─── Promotion / Cohort (Professional only) ───

export type PromotionStatus = 'open' | 'finished';

export interface PromotionOption {
  id: number;
  label: string;
  code: string | null;
  courseCode: string;
  enrolledCount: number;
  maxCapacity: number;
  status: PromotionStatus;
}

export interface PromotionGroup {
  label: string;
  options: PromotionOption[];
}

// ─── Singular Info ───

export interface SingularFeature {
  label: string;
  included: boolean;
}

// ─── Step 2 Composite Model ───

export type AssignmentView = 'class-b' | 'professional' | 'singular';

export interface EnrollmentAssignmentData {
  view: AssignmentView;
  studentSummary: StudentSummaryBanner;
  // Class B fields
  paymentMode: PaymentMode | null;
  totalSessions: number;
  instructorId: number | null;
  instructors: InstructorOption[];
  scheduleGrid: ScheduleGrid | null;
  scheduleLoading: boolean;
  slotSelection: SlotSelection;
  // Professional fields
  promotionId: number | null;
  promotionGroups: PromotionGroup[];
  /** true = alumno se matricula convalidando simultáneamente (A2+A4 o A5+A3). */
  convalidatesSimultaneously: boolean;
  /** Licencia que se convalida: 'A4' (cuando madre=A2) o 'A3' (cuando madre=A5). */
  convalidatedLicense: 'A4' | 'A3' | null;
  // Singular has no extra fields (informational only)
}
