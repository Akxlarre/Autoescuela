import { describe, it, expect } from 'vitest';
import {
  earlyLicenseWarningFn,
  hasRequiredProfessionalLicenseFn,
  hasRequiredSenceCodeFn,
} from './personal-data.component';
import { todayIso } from '@core/utils/date.utils';

function yearsAgoIso(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().split('T')[0];
}

describe('earlyLicenseWarningFn()', () => {
  it('es null si la categoría no es profesional', () => {
    expect(earlyLicenseWarningFn('non-professional', yearsAgoIso(1))).toBeNull();
  });

  it('es null si la categoría es null (aún no se eligió)', () => {
    expect(earlyLicenseWarningFn(null, yearsAgoIso(1))).toBeNull();
  });

  it('es válido sin advertencia si no se ingresó la fecha de licencia', () => {
    expect(earlyLicenseWarningFn('professional', null)).toEqual({
      valid: true,
      message: '',
      seniorityYears: null,
    });
  });

  it('advierte (no bloquea) cuando la licencia tiene menos de 2 años a la fecha de hoy', () => {
    const warning = earlyLicenseWarningFn('professional', yearsAgoIso(1));
    expect(warning?.valid).toBe(false);
    expect(warning?.message).toContain('2 años');
  });

  it('no advierte cuando la licencia ya supera los 2 años a la fecha de hoy', () => {
    const warning = earlyLicenseWarningFn('professional', yearsAgoIso(3));
    expect(warning?.valid).toBe(true);
  });

  it('el mensaje nombra la fecha de hoy como referencia', () => {
    const warning = earlyLicenseWarningFn('professional', yearsAgoIso(1));
    const today = new Date(todayIso() + 'T12:00:00').toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    expect(warning?.message).toContain(today);
  });

  it('sin courseType, cae por defecto a "clase B" (compatibilidad previa a fix-033-i)', () => {
    const warning = earlyLicenseWarningFn('professional', yearsAgoIso(1));
    expect(warning?.message).toContain('licencia clase B');
  });

  it('courseType professional_a2/a4 exige "clase B" en el mensaje (fix-033-i)', () => {
    expect(
      earlyLicenseWarningFn('professional', yearsAgoIso(1), 'professional_a2')?.message,
    ).toContain('licencia clase B');
    expect(
      earlyLicenseWarningFn('professional', yearsAgoIso(1), 'professional_a4')?.message,
    ).toContain('licencia clase B');
  });

  it('courseType professional_a5/a3 exige "A2 o A4" en el mensaje, no "clase B" (fix-033-i)', () => {
    const a5 = earlyLicenseWarningFn('professional', yearsAgoIso(1), 'professional_a5');
    expect(a5?.message).toContain('licencia A2 o A4');
    expect(a5?.message).not.toContain('clase B');

    const a3 = earlyLicenseWarningFn('professional', yearsAgoIso(1), 'professional_a3');
    expect(a3?.message).toContain('licencia A2 o A4');
  });
});

describe('hasRequiredProfessionalLicenseFn()', () => {
  it('canAdvance es false en categoría profesional sin licencia previa ni fecha', () => {
    expect(hasRequiredProfessionalLicenseFn('professional', null, null)).toBe(false);
  });

  it('es false si solo falta la licencia previa', () => {
    expect(hasRequiredProfessionalLicenseFn('professional', null, '2020-01-01')).toBe(false);
  });

  it('es false si solo falta la fecha de licencia B', () => {
    expect(hasRequiredProfessionalLicenseFn('professional', 'B', null)).toBe(false);
  });

  it('es false si la licencia previa es "none"', () => {
    expect(hasRequiredProfessionalLicenseFn('professional', 'none', '2020-01-01')).toBe(false);
  });

  it('es true cuando ambos campos están completos en categoría profesional', () => {
    expect(hasRequiredProfessionalLicenseFn('professional', 'B', '2020-01-01')).toBe(true);
  });

  it('es true en categorías no profesionales sin exigir los campos', () => {
    expect(hasRequiredProfessionalLicenseFn('non-professional', null, null)).toBe(true);
    expect(hasRequiredProfessionalLicenseFn('singular', null, null)).toBe(true);
    expect(hasRequiredProfessionalLicenseFn(null, null, null)).toBe(true);
  });
});

describe('hasRequiredSenceCodeFn()', () => {
  it('requiere senceCode cuando courseType es class_b_sence y no bloquea otros cursos', () => {
    expect(hasRequiredSenceCodeFn('class_b_sence', null)).toBe(false);
    expect(hasRequiredSenceCodeFn('class_b_sence', '')).toBe(false);
    expect(hasRequiredSenceCodeFn('class_b_sence', '   ')).toBe(false);
    expect(hasRequiredSenceCodeFn('class_b_sence', '12-3456-78')).toBe(true);

    expect(hasRequiredSenceCodeFn('class_b', null)).toBe(true);
    expect(hasRequiredSenceCodeFn('class_b_reinforcement', null)).toBe(true);
    expect(hasRequiredSenceCodeFn('professional_a2', null)).toBe(true);
    expect(hasRequiredSenceCodeFn('singular', null)).toBe(true);
  });
});
