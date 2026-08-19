// Modelos de UI para el registro de consentimientos (spec 0009-m, Ley 21.719).
//
// Existen dos modelos y no basta el DTO por razones distintas en cada dirección:
//  - `ConsentDraft` OMITE deliberadamente `ip`, `id` y `granted_at`: son del servidor.
//    Si la UI pudiera setearlos, la prueba de consentimiento dejaría de probar nada.
//  - `ConsentRow` agrega campos DERIVADOS que no existen en la tabla (etiqueta
//    traducida, estado legible) para el panel de consulta del admin.

import type { ConsentSource, ConsentType } from '../dto/consent.model';

export type { ConsentSource, ConsentType };

/**
 * Lo que la UI recolecta y manda a persistir.
 *
 * Sin `ip` ni `granted_at`: los pone la base (trigger `trg_consents_set_ip` y
 * DEFAULT NOW()). Un consentimiento cuya IP elige el cliente no sirve como prueba.
 */
export interface ConsentDraft {
  consentType: ConsentType;
  /** `false` = el titular dijo que NO. Se persiste igual (AC-E1). */
  granted: boolean;
  branchId: number;
  source: ConsentSource;

  userId?: number | null;
  subjectRut?: string | null;
  enrollmentId?: number | null;

  /** `true` cuando el titular es menor y quien consiente es su representante legal (AC7). */
  grantedByRepresentative?: boolean;
}

/** Estado de un consentimiento tal como se muestra en la ficha del alumno. */
export type ConsentStatus = 'otorgado' | 'rechazado' | 'revocado';

/** Fila legible para el panel de consulta del admin (AC6). */
export interface ConsentRow {
  id: number;
  consentType: ConsentType;
  /** Etiqueta en español del tipo, ya resuelta en el Facade. */
  typeLabel: string;
  status: ConsentStatus;
  grantedAt: string;
  revokedAt: string | null;
  policyVersion: string;
  source: ConsentSource;
  sourceLabel: string;
  ip: string | null;
  /** `true` si lo otorgó el representante legal de un menor. */
  grantedByRepresentative: boolean;
}

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  matricula_datos: 'Tratamiento de datos de matrícula',
  certificado_medico: 'Certificado médico (dato de salud)',
  preinscripcion: 'Preinscripción y contacto',
  test_psicologico: 'Test psicométrico EPQ (dato de salud psíquica)',
};

export const CONSENT_SOURCE_LABELS: Record<ConsentSource, string> = {
  public: 'En línea',
  secretaria: 'En secretaría',
};
