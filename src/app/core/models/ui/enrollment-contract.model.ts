// Enrollment Step 5 — Contract generation, printing, signed upload

import type { StudentSummaryBanner } from './enrollment-assignment.model';

// ─── Contract Generation ───

export type ContractStatus = 'pending' | 'generating' | 'generated' | 'error';

export interface ContractGeneration {
  status: ContractStatus;
  /** URL or blob reference of the generated PDF draft */
  pdfUrl: string | null;
  /** Timestamp of last generation */
  generatedAt: string | null;
  errorMessage: string | null;
}

// ─── Signed Contract Upload ───

export type UploadStatus = 'empty' | 'uploading' | 'uploaded' | 'error';

export interface SignedContractUpload {
  status: UploadStatus;
  file: File | null;
  fileName: string | null;
  /** Size in bytes */
  fileSize: number | null;
  errorMessage: string | null;
  // Metadata for digital signature
  signatureHash?: string | null;
  signedAt?: string | null;
  signerName?: string | null;
  ipAddress?: string | null;
}

export const CONTRACT_ACCEPTED_FORMATS = '.pdf,.jpg,.png';
export const CONTRACT_MAX_SIZE_MB = 10;

// ─── Step 5 Composite Model ───

export interface EnrollmentContractData {
  studentSummary: StudentSummaryBanner;
  contractGeneration: ContractGeneration;
  signedContract: SignedContractUpload | null;
  isMinor: boolean;
  /** true si el curso matriculado es de categoría Profesional (A2-A5) */
  isProfessional: boolean;
  /** Upload or signature is required to advance to step 6 */
  canAdvance: boolean;

  // ── Consentimiento (spec 0009-m, Ley 21.719 Art. 12) ───────────────────────
  /**
   * Texto literal de la casilla de declaración de lectura de la política.
   * Sale de `PRIVACY_POLICIES[slug].policyCheckboxLabel` — nombra a la sociedad
   * responsable, que no es la misma en las dos sedes.
   */
  privacyPolicyLabel: string;
  /** `/politica-privacidad/:branchSlug` de la sede en que se matricula (AC2). */
  privacyPolicyUrl: string;
}

/**
 * Lo que emite el paso de contrato al firmar (AC3/AC5).
 *
 * El estado de las casillas viaja JUNTO con la firma y no por un output aparte:
 * así es imposible persistir una matrícula sin su registro de consentimiento,
 * porque para el consumidor son un solo evento.
 */
export interface PublicContractSignedPayload {
  signatureBase64: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}
