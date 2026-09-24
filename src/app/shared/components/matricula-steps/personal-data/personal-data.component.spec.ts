import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  earlyLicenseWarningFn,
  hasRequiredProfessionalLicenseFn,
  hasRequiredSenceCodeFn,
  PersonalDataComponent,
} from './personal-data.component';
import { todayIso } from '@core/utils/date.utils';
import type { EnrollmentPersonalData } from '@core/models/ui/enrollment-personal-data.model';

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

// ── fix-038-i: emitField no pisa birthDate/licenseDate entre sí ──
// Nota: el bug real de fix-038 (colisión de id="date" duplicado en el DOM entre
// <app-date-input> de Fecha de nacimiento y Fecha de obtención de licencia previa)
// no es reproducible en Vitest — el renderizado de template está excluido de este
// proyecto (ver date-input.component.spec.ts:1-3, requiere @analogjs/vite-plugin-angular
// no configurado). El test de DOM real (ids únicos, ambos valores seleccionables) se
// verifica manualmente con Playwright (`/verify`) contra `ng serve`, documentado en la
// Evidencia de Verificación del fix. Este test cubre la parte sí testeable en Vitest:
// que el estado (`data()`/`emitField`) nunca pisó un campo con el otro — no era la causa
// raíz, pero confirma que no hay regresión en esa capa tras el cambio de `[id]`.
describe('PersonalDataComponent — emitField() no pisa birthDate/licenseDate (fix-038-i)', () => {
  let component: PersonalDataComponent;

  function baseData(): EnrollmentPersonalData {
    return {
      rut: '',
      firstNames: '',
      paternalLastName: '',
      maternalLastName: '',
      email: '',
      phone: '',
      birthDate: '',
      gender: '',
      address: '',
      courseCategory: 'professional',
      courseType: 'professional_a2',
      singularCourseCode: null,
      senceCode: null,
      currentLicense: null,
      licenseDate: null,
      convalidatesSimultaneously: false,
      historicalPromotionId: null,
      validationBook: null,
      courses: [],
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    component = TestBed.runInInjectionContext(() => new PersonalDataComponent());
    (component as unknown as { data: unknown }).data = signal(baseData());
  });

  it('emitField("birthDate", ...) y emitField("licenseDate", ...) con valores distintos no se pisan', () => {
    let lastEmitted: EnrollmentPersonalData | null = null;
    component.dataChange.subscribe((d) => (lastEmitted = d));

    component.emitField('birthDate', '1995-03-10');
    expect(lastEmitted!.birthDate).toBe('1995-03-10');
    expect(lastEmitted!.licenseDate).toBeNull();

    // Simula que el smart component re-inyecta el data() actualizado (flujo real del wizard).
    (component as unknown as { data: unknown }).data = signal(lastEmitted!);

    component.emitField('licenseDate', '2020-06-01');
    expect(lastEmitted!.licenseDate).toBe('2020-06-01');
    expect(lastEmitted!.birthDate).toBe('1995-03-10');
  });
});
