// Enrollment Wizard — Global wizard state, current step, sidebar summary

export type EnrollmentWizardStep = 1 | 2 | 3 | 4 | 5 | 6;

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

export const ENROLLMENT_STEPS: StepConfig[] = [
  { step: 1, label: 'Personal data', status: 'active' },
  { step: 2, label: 'Assignment', status: 'pending' },
  { step: 3, label: 'Documents', status: 'pending' },
  { step: 4, label: 'Payment', status: 'pending' },
  { step: 5, label: 'Contract', status: 'pending' },
  { step: 6, label: 'Confirmation', status: 'pending' },
];
