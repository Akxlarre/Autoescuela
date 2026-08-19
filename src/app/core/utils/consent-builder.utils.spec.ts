import { describe, it, expect } from 'vitest';
import {
  buildEnrollmentConsents,
  buildMedicalCertificateConsent,
  buildPsychTestConsent,
  type ConsentBuilderInput,
} from './consent-builder.utils';

const BASE: ConsentBuilderInput = {
  branchId: 2,
  source: 'public',
  policyAccepted: true,
  isMinor: false,
  userId: 10,
  subjectRut: '18.456.789-0',
  enrollmentId: 55,
};

describe('buildEnrollmentConsents()', () => {
  it('mayor de edad: un consentimiento de matrícula otorgado, sin representante', () => {
    const [consent, ...rest] = buildEnrollmentConsents(BASE);

    expect(rest).toHaveLength(0);
    expect(consent.consentType).toBe('matricula_datos');
    expect(consent.granted).toBe(true);
    expect(consent.grantedByRepresentative).toBe(false);
  });

  it('propaga titular, matrícula, sede y origen', () => {
    const [consent] = buildEnrollmentConsents(BASE);

    expect(consent.userId).toBe(10);
    expect(consent.subjectRut).toBe('18.456.789-0');
    expect(consent.enrollmentId).toBe(55);
    expect(consent.branchId).toBe(2);
    expect(consent.source).toBe('public');
  });

  // AC7 — la trampa que la spec marca en §7: hoy el bloque de aceptación del flujo
  // público vive dentro de `@if (!data().isMinor)`, así que justo los titulares con
  // mayor protección legal quedarían sin registro.
  it('menor de edad: el consentimiento queda marcado como otorgado por el representante', () => {
    const consents = buildEnrollmentConsents({ ...BASE, isMinor: true });

    expect(consents).toHaveLength(1);
    expect(consents[0].granted).toBe(true);
    expect(consents[0].grantedByRepresentative).toBe(true);
    // El titular sigue siendo el alumno: el representante otorga, no sustituye.
    expect(consents[0].subjectRut).toBe('18.456.789-0');
  });

  // No se guarda el nombre ni el RUT del apoderado: ya constan en la autorización
  // notarial del expediente, obligatoria para menores (decisión del 17-08-2026).
  it('menor de edad: NO recolecta datos personales del apoderado', () => {
    const [consent] = buildEnrollmentConsents({ ...BASE, isMinor: true });

    expect(consent).not.toHaveProperty('representativeName');
    expect(consent).not.toHaveProperty('representativeRut');
  });

  it('menor de edad: NUNCA devuelve lista vacía (AC7)', () => {
    const consents = buildEnrollmentConsents({ ...BASE, isMinor: true });
    expect(consents.length).toBeGreaterThan(0);
  });

  // AC-E1 — "no hay registro" y "dijo que no" son hechos distintos ante la Agencia.
  it('política no aceptada: registra la negativa, no la ausencia', () => {
    const consents = buildEnrollmentConsents({ ...BASE, policyAccepted: false });

    expect(consents).toHaveLength(1);
    expect(consents[0].granted).toBe(false);
  });

  it('preinscripción sin matrícula: enrollmentId null y tipo preinscripcion', () => {
    const consents = buildEnrollmentConsents({
      ...BASE,
      enrollmentId: null,
      consentType: 'preinscripcion',
    });

    expect(consents[0].consentType).toBe('preinscripcion');
    expect(consents[0].enrollmentId).toBeNull();
  });

  it('lead sin cuenta: userId null pero subjectRut presente', () => {
    const consents = buildEnrollmentConsents({ ...BASE, userId: null });

    expect(consents[0].userId).toBeNull();
    expect(consents[0].subjectRut).toBe('18.456.789-0');
  });

  it('lanza si el titular no es identificable por ninguna vía', () => {
    expect(() => buildEnrollmentConsents({ ...BASE, userId: null, subjectRut: null })).toThrow();
  });

  it('lanza si falta la sede: no se sabría ante qué responsable se otorgó', () => {
    expect(() =>
      buildEnrollmentConsents({ ...BASE, branchId: null as unknown as number }),
    ).toThrow();
  });
});

describe('buildMedicalCertificateConsent()', () => {
  it('autorizado: consentimiento de certificado médico otorgado desde secretaría', () => {
    const consent = buildMedicalCertificateConsent({
      ...BASE,
      source: 'secretaria',
      policyAccepted: true,
    });

    expect(consent.consentType).toBe('certificado_medico');
    expect(consent.granted).toBe(true);
    expect(consent.source).toBe('secretaria');
  });

  it('no autorizado: se registra la negativa igual (AC-E1)', () => {
    const consent = buildMedicalCertificateConsent({
      ...BASE,
      source: 'secretaria',
      policyAccepted: false,
    });

    expect(consent.granted).toBe(false);
  });

  it('menor de edad: lo otorga el representante', () => {
    const consent = buildMedicalCertificateConsent({
      ...BASE,
      source: 'secretaria',
      isMinor: true,
    });

    expect(consent.grantedByRepresentative).toBe(true);
  });
});

describe('buildPsychTestConsent()', () => {
  // Spec 0010-m (Ley 21.719, Art. 16) — mismo régimen legal que el certificado médico,
  // pero el EPQ sí entra por el flujo público (source 'public'), a diferencia del
  // certificado médico que solo se digitaliza desde secretaría.
  it('casilla marcada: consentimiento otorgado desde el flujo público', () => {
    const consent = buildPsychTestConsent({
      ...BASE,
      source: 'public',
      policyAccepted: true,
    });

    expect(consent.consentType).toBe('test_psicologico');
    expect(consent.granted).toBe(true);
    expect(consent.source).toBe('public');
  });

  // AC3/AC-E1 — la negativa se registra igual, nunca ausencia de draft.
  it('casilla no marcada: se registra la negativa igual', () => {
    const consent = buildPsychTestConsent({
      ...BASE,
      source: 'public',
      policyAccepted: false,
    });

    expect(consent.consentType).toBe('test_psicologico');
    expect(consent.granted).toBe(false);
  });

  it('menor de edad: lo otorga el representante', () => {
    const consent = buildPsychTestConsent({
      ...BASE,
      source: 'public',
      isMinor: true,
    });

    expect(consent.grantedByRepresentative).toBe(true);
  });

  it('lanza si el titular no es identificable por ninguna vía', () => {
    expect(() => buildPsychTestConsent({ ...BASE, userId: null, subjectRut: null })).toThrow();
  });
});
