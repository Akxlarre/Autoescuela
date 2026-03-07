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
  /** Upload or signature is required to advance to step 6 */
  canAdvance: boolean;
}
