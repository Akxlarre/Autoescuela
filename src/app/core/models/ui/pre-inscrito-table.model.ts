import type {
  PreRegistrationStatus,
  PsychTestResult,
} from '@core/models/dto/professional-pre-registration.model';

export type PreInscritoStatusSeverity = 'warn' | 'success' | 'danger' | 'info' | 'secondary';

/** Fila de la tabla de pre-inscritos profesionales (vista admin/secretaria). */
export interface PreInscritoTableRow {
  /** ID de professional_pre_registrations */
  id: number;
  /** FK a users (cuenta temporal creada online) */
  tempUserId: number;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  rut: string;
  email: string;
  telefono: string;
  /** Clase solicitada: A2 | A3 | A4 | A5 */
  licencia: string;
  branchId: number;
  sucursal: string;
  canal: 'online' | 'presencial';
  convalida: boolean;
  fechaPreInscripcion: string;
  fechaVencimiento: string;
  isVencido: boolean;
  diasParaVencer: number | null;
  /** Estado general del proceso */
  status: PreRegistrationStatus;
  statusLabel: string;
  statusSeverity: PreInscritoStatusSeverity;
  /** Resultado del test psicológico (null = no evaluado aún) */
  psychResult: PsychTestResult | null;
  psychResultLabel: string;
  /** Respuestas EPQ: true=Sí, false=No (81 items) */
  psychAnswers: boolean[] | null;
  psychEvaluatedAt: string | null;
  /** Nombre del evaluador (join con users) */
  psychEvaluatedByName: string | null;
  psychRejectionReason: string | null;
  convertedEnrollmentId: number | null;
  /** Número de matrícula (ej: "2026-0007"). Disponible cuando status = pending_contract. */
  enrollmentNumber: string | null;
  notes: string | null;
  /** Datos personales capturados en el form público */
  birthDate: string | null;
  gender: 'M' | 'F' | null;
  address: string | null;
}

/** Payload para evaluar el test psicológico de forma independiente */
export interface EvaluarTestPayload {
  preInscritoId: number;
  result: PsychTestResult;
  rejectionReason?: string;
}

import type { PaymentMethod } from '@core/models/ui/enrollment-payment.model';

/** Payload para completar la matrícula presencial */
export interface CompletarMatriculaPayload {
  preInscritoId: number;
  promotionCourseId: number;
  courseId: number;
  basePrice: number;
  discountAmount: number;
  discountReason: string;
  totalPaid: number;
  paymentMethod: PaymentMethod;
  currentLicenseClass: string | null;
  licenseObtainedDate: string | null;
  // Documentos requeridos
  carnetPhotoFile: File | null;
  hvcFile: File | null;
  hvcIssueDate: string | null;
  // Documentos opcionales
  cedulaFile: File | null;
  licenciaFile: File | null;
  contractFile: File | null;
}

/** Opción de promoción disponible para asignar al completar matrícula */
export interface PromocionOption {
  id: number;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'planned' | 'in_progress';
  courses: PromocionCourseOption[];
}

export interface PromocionCourseOption {
  promotionCourseId: number;
  courseId: number;
  courseCode: string; // A2 | A3 | A4 | A5
  courseName: string;
  enrolledStudents: number;
  maxStudents: number;
  available: number;
  basePrice: number;
}
