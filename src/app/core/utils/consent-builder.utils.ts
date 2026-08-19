// Construcción de los registros de consentimiento (spec 0009-m, Ley 21.719).
//
// Funciones puras: los dos flujos de matrícula y el DMS producen sus drafts acá y no
// cada uno a su manera. La regla que más importa vive en un solo lugar:
//
//   UN CONSENTIMIENTO NO OTORGADO ES UNA FILA CON `granted: false`, NO LA AUSENCIA DE FILA.
//
// Ante la Agencia, "no hay registro" y "el titular dijo que no" son hechos distintos:
// el primero es un incumplimiento, el segundo es cumplimiento correcto (AC-E1).

import type { ConsentDraft, ConsentSource, ConsentType } from '@core/models/ui/consent.model';

export interface ConsentBuilderInput {
  /** Ante qué responsable se otorga. Sin esto el registro no prueba nada. */
  branchId: number;
  source: ConsentSource;

  /** Resultado de la casilla: `false` se registra igual, como negativa expresa. */
  policyAccepted: boolean;

  /** Cuando es menor, el consentimiento lo otorga su representante legal (AC7). */
  isMinor: boolean;

  /** Titular. `userId` puede ser null en un lead que todavía no tiene cuenta. */
  userId?: number | null;
  subjectRut?: string | null;
  enrollmentId?: number | null;

  /** Por defecto `matricula_datos`; `preinscripcion` para leads sin matrícula. */
  consentType?: ConsentType;
}

function assertIdentifiable(input: ConsentBuilderInput): void {
  if (input.branchId === null || input.branchId === undefined) {
    throw new Error(
      'consent-builder: falta branchId — sin sede no se sabe ante qué responsable se otorgó el consentimiento.',
    );
  }
  if (!input.userId && !input.subjectRut) {
    throw new Error(
      'consent-builder: el titular debe ser identificable por userId o subjectRut — un consentimiento sin titular no sirve como prueba.',
    );
  }
}

function toDraft(input: ConsentBuilderInput, consentType: ConsentType): ConsentDraft {
  return {
    consentType,
    granted: input.policyAccepted,
    branchId: input.branchId,
    source: input.source,
    userId: input.userId ?? null,
    subjectRut: input.subjectRut ?? null,
    enrollmentId: input.enrollmentId ?? null,
    // No se guarda quién es el apoderado: eso ya consta en la autorización notarial del
    // expediente, firmada ante notario. Acá solo importa el hecho de que no consintió el menor.
    grantedByRepresentative: input.isMinor,
  };
}

/**
 * Consentimientos que produce un flujo de matrícula o preinscripción.
 *
 * Devuelve un arreglo (y no un objeto) porque es el contrato que consumen la Edge
 * Function y `ConsentsFacade.recordMany()`, y porque deja espacio a que un flujo
 * produzca más de un registro sin cambiar la firma.
 *
 * **Nunca devuelve una lista vacía**: si el titular no aceptó, devuelve la negativa.
 */
export function buildEnrollmentConsents(input: ConsentBuilderInput): ConsentDraft[] {
  assertIdentifiable(input);
  return [toDraft(input, input.consentType ?? 'matricula_datos')];
}

/**
 * Consentimiento del Art. 16 para el certificado médico (dato sensible de salud).
 *
 * Va aparte de `buildEnrollmentConsents()` a propósito: la ley exige que este
 * consentimiento sea expreso y **específico para ese dato**, nunca mezclado con la
 * aceptación del contrato ni con la declaración de lectura de la política.
 *
 * En este proyecto el certificado médico no se pide en la matrícula — solo entra por
 * el DMS cuando un alumno justifica inasistencias — así que el `source` es `'secretaria'`:
 * el documento llega físico y la secretaria lo digitaliza desde el sistema.
 */
export function buildMedicalCertificateConsent(input: ConsentBuilderInput): ConsentDraft {
  assertIdentifiable(input);
  return toDraft(input, 'certificado_medico');
}

/**
 * Consentimiento del Art. 16 para el test psicométrico EPQ (dato sensible de salud
 * psíquica, spec 0010-m). Mismo régimen legal que `buildMedicalCertificateConsent()`,
 * pero acá el dato sí entra por el flujo público — `source` normalmente es `'public'`,
 * a diferencia del certificado médico que solo se digitaliza desde secretaría.
 */
export function buildPsychTestConsent(input: ConsentBuilderInput): ConsentDraft {
  assertIdentifiable(input);
  return toDraft(input, 'test_psicologico');
}
