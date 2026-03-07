// Enrollment Step 3 — Document reception: carnet photo, professional docs, minor authorization

import type { StudentSummaryBanner } from './enrollment-assignment.model';

// ─── Carnet Photo ───

export type PhotoSource = 'camera' | 'upload';

export type PhotoTab = 'camera' | 'upload';

export type CameraState = 'idle' | 'active' | 'captured';

export interface CarnetPhoto {
  source: PhotoSource;
  capturedDataUrl: string;
  fileName: string;
}

// ─── Document Upload ───

export type DocumentType =
  | 'hoja_vida_conductor'
  | 'cedula_identidad'
  | 'licencia_conducir'
  | 'autorizacion_notarial';

export interface UploadedDocument {
  type: DocumentType;
  file: File;
  fileName: string;
  /** Only for hoja_vida_conductor */
  issueDate: string | null;
}

export interface HvcValidation {
  expired: boolean;
  daysSinceIssue: number | null;
  message: string;
}

// ─── Document Requirements Config ───

export interface DocumentRequirement {
  type: DocumentType;
  label: string;
  hint: string;
  required: boolean;
  acceptedFormats: string;
  maxSizeMb: number;
  /** Whether this doc requires an issue date input */
  hasIssueDate: boolean;
}

/** Documents required for professional classes (A2–A5) */
export const PROFESSIONAL_DOCUMENTS: DocumentRequirement[] = [
  {
    type: 'hoja_vida_conductor',
    label: 'Hoja de Vida del Conductor',
    hint: 'emitida por el Registro Civil',
    required: true,
    acceptedFormats: '.pdf,.jpg,.png',
    maxSizeMb: 5,
    hasIssueDate: true,
  },
  {
    type: 'cedula_identidad',
    label: 'Cédula de Identidad',
    hint: '',
    required: false,
    acceptedFormats: '.pdf,.jpg,.png',
    maxSizeMb: 5,
    hasIssueDate: false,
  },
  {
    type: 'licencia_conducir',
    label: 'Licencia de Conducir',
    hint: '',
    required: false,
    acceptedFormats: '.pdf,.jpg,.png',
    maxSizeMb: 5,
    hasIssueDate: false,
  },
];

// ─── Document View (conditional by course + age) ───

export type DocumentsView = 'class-b' | 'professional';

// ─── Step 3 Composite Model ───

export interface EnrollmentDocumentsData {
  view: DocumentsView;
  studentSummary: StudentSummaryBanner;
  isMinor: boolean;
  // Carnet photo (always required)
  photoTab: PhotoTab;
  cameraState: CameraState;
  carnetPhoto: CarnetPhoto | null;
  // Professional documents (only when view === 'professional')
  uploadedDocuments: Map<DocumentType, UploadedDocument>;
  requiredDocuments: DocumentRequirement[];
  hvcValidation: HvcValidation | null;
  // Minor authorization (only when isMinor === true)
  notarialAuthorization: UploadedDocument | null;
}

/** Max days since HVC issue date before showing expiry warning (RF-082.3) */
export const HVC_MAX_DAYS = 30;
