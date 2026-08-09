/**
 * DMS — UI Models
 * Tipos e interfaces para el módulo Repositorio de Documentos.
 */

export type DmsTab = 'students' | 'school' | 'templates' | 'instructors';
export type TemplateCategory = 'clase_b' | 'clase_profesional' | 'administrativo' | 'general';
export type TemplateCategoryFilter = 'all' | TemplateCategory;

export interface StudentWithDocsRow {
  studentId: number;
  /** Matrícula a la que pertenece esta fila (spec 0007-m: 1 fila por matrícula, no por alumno). */
  enrollmentId: number;
  /** Orden paterno - materno - nombre (buildStudentDisplayName), igual que Base de Alumnos */
  name: string;
  rut: string;
  /** Formateado '#NNNN' (de esta matrícula, no de la última del alumno) */
  matriculaNumber: string;
  /** Nombre de la sede de esta matrícula (enrollments.branch_id → branches.name). Null si no tiene sede asignada. */
  branchName: string | null;
  docCount: number;
}

/** Opción del segundo selector de "Subir documento" (AC-E2) — todas las matrículas del alumno, no solo las que ya tienen documentos. */
export interface StudentEnrollmentOption {
  enrollmentId: number;
  /** `"{course.name} · #{number}"` */
  label: string;
  branchName: string | null;
}

export interface DmsStudentDocRow {
  id: string; // TEXT desde la vista
  /** 'enrollment_license' = fila sintética derivada de enrollments.license_*_url (sin fila propia que borrar) */
  source: 'student_document' | 'digital_contract' | 'enrollment_license';
  studentId: number;
  enrollmentId: number;
  type: string;
  fileName: string;
  fileUrl: string | null;
  status: string;
  documentAt: string; // fecha ISO
  managedBy: number | null;
  // Campos derivados en el facade
  studentName: string;
  studentRut: string;
  typeLabel: string;
}

export interface InstructorWithDocsRow {
  instructorId: number;
  name: string;
  licenseNumber: string;
  /** Nombre de la sede (users.branch_id → branches.name). Null si no tiene sede asignada. */
  branchName: string | null;
  docCount: number;
}

export interface DmsInstructorDocRow {
  id: number;
  instructorId: number;
  type: string;
  fileName: string;
  fileUrl: string | null;
  status: string;
  documentAt: string; // fecha ISO
  // Campos derivados en el facade
  instructorName: string;
  typeLabel: string;
}

export interface SchoolDocRow {
  id: number;
  type: string;
  fileName: string;
  storageUrl: string;
  description: string | null;
  branchId: number;
  createdAt: string;
  uploaderName: string; // derivado del JOIN con users
  typeLabel: string; // derivado del type
}

export interface TemplateCard {
  id: number;
  name: string;
  description: string | null;
  category: TemplateCategory;
  format: 'pdf' | 'docx' | 'xlsx';
  version: string;
  fileUrl: string;
  downloadCount: number;
  categoryLabel: string; // derivado
  formatColor: string; // derivado del format
}

export interface DmsKpis {
  totalStudentDocs: number;
  totalSchoolDocs: number;
  totalTemplates: number;
  recentUploads: number;
}

export interface UploadStudentDocPayload {
  file: File;
  type: string;
  studentId: number;
  enrollmentId?: number;
}

export interface UploadSchoolDocPayload {
  file: File;
  type: string;
  description?: string;
}

export interface UploadInstructorDocPayload {
  file: File;
  type: string;
  instructorId: number;
}

export interface UploadTemplatePayload {
  file: File;
  name: string;
  description?: string;
  category: TemplateCategory;
}
export interface DmsViewerDocument {
  url: string;
  name: string;
  type: 'pdf' | 'image' | 'other';
}
