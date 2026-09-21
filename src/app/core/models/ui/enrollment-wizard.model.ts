// Enrollment Wizard — Global wizard state, current step, sidebar summary

export type EnrollmentWizardStep = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Fuente única de verdad del significado de cada número de paso (fix-034-i, ASG-m-002).
 * Antes, el número de cada paso vivía repetido a mano en `enrollment.facade.ts`
 * (`goToStep(5)`, `if (currentStep >= 4)`, etc.) — un reordenamiento de pasos (como el que
 * motivó este fix, Pago antes de Firma) obligaba a rastrear cada aparición suelta del
 * número, sin garantía de encontrarlas todas. Usar estas constantes en vez del número
 * pelado hace que un futuro reordenamiento sea cambiar esta tabla, no cazar literales.
 *
 * Orden vigente (solo flujo presencial — Admin/Secretaria, `EnrollmentFacade`): Pago va
 * antes que Contrato. La matrícula pública online (`PublicEnrollmentFacade`) no comparte
 * este facade y no se toca acá.
 */
export const ENROLLMENT_STEP = {
  PERSONAL_DATA: 1,
  ASSIGNMENT: 2,
  DOCUMENTS: 3,
  PAYMENT: 4,
  CONTRACT: 5,
  CONFIRMATION: 6,
} as const satisfies Record<string, EnrollmentWizardStep>;

export type StepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface StepConfig {
  step: EnrollmentWizardStep;
  label: string;
  status: StepStatus;
}

export interface CourseSummary {
  type: string;
  duration: string;
  practicalHours: string;
  theoreticalHours: string;
  totalPrice: number;
}

export interface Requirement {
  label: string;
  fulfilled: boolean;
}

export interface SidebarSummary {
  course: CourseSummary | null;
  requirements: Requirement[];
}

export interface EnrollmentWizardState {
  currentStep: EnrollmentWizardStep;
  steps: StepConfig[];
  summary: SidebarSummary;
  isSubmitting: boolean;
  canAdvance: boolean;
}

/** Summary of a pending draft enrollment for the draft list view. */
export interface DraftSummary {
  enrollmentId: number;
  studentName: string;
  studentRut: string;
  courseLabel: string;
  currentStep: EnrollmentWizardStep;
  stepLabel: string;
  createdAt: string;
  expiresAt: string;
}

export const ENROLLMENT_STEPS: StepConfig[] = [
  { step: 1, label: 'Personal data', status: 'active' },
  { step: 2, label: 'Assignment', status: 'pending' },
  { step: 3, label: 'Documents', status: 'pending' },
  { step: 4, label: 'Payment', status: 'pending' },
  { step: 5, label: 'Contract', status: 'pending' },
  { step: 6, label: 'Confirmation', status: 'pending' },
];
