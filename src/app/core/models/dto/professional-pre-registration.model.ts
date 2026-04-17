export type PsychTestStatus = 'not_started' | 'in_progress' | 'completed';
export type PsychTestResult = 'fit' | 'unfit';
export type PreRegistrationStatus =
  | 'pending_review'
  | 'approved'
  | 'pending_contract'
  | 'enrolled'
  | 'expired'
  | 'rejected';
export type RegistrationChannel = 'online' | 'presencial';

export interface ProfessionalPreRegistration {
  id: number;
  temp_user_id: number;
  /** @deprecated Usar `requested_license_class`. Columna original, ahora nullable tras migración 20260320000000. */
  desired_course_class: string | null;
  requested_license_class: string | null;
  branch_id: number | null;
  convalidates_simultaneously: boolean;
  registration_channel: RegistrationChannel;
  notes: string | null;
  psych_test_status: PsychTestStatus;
  psych_test_result: PsychTestResult | null;
  psych_test_answers: boolean[] | null;
  psych_test_completed_at: string | null;
  /** Usuario (admin/secretaria) que evaluó el test. Migración 20260407000001. */
  psych_evaluated_by: number | null;
  /** Timestamp de la evaluación del test. Migración 20260407000001. */
  psych_evaluated_at: string | null;
  /** Motivo de rechazo si psych_test_result = 'unfit'. Migración 20260407000001. */
  psych_rejection_reason: string | null;
  /** Fecha de nacimiento ingresada por el alumno en el form público. Migración 20260408000001. */
  birth_date: string | null;
  /** Género ingresado por el alumno en el form público (M | F). Migración 20260408000001. */
  gender: string | null;
  /** Dirección ingresada por el alumno en el form público. Migración 20260408000001. */
  address: string | null;
  registered_at: string;
  expires_at: string;
  status: PreRegistrationStatus;
  converted_enrollment_id: number | null;
}
