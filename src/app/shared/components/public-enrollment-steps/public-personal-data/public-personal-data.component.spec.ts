import { describe, it, expect } from 'vitest';
import { canAdvanceFn, getAgeStatus } from './public-personal-data.component';
import type { EnrollmentPersonalData } from '@core/models/ui/enrollment-personal-data.model';

const VALID_DATA: EnrollmentPersonalData = {
  rut: '12.345.678-5',
  firstNames: 'María José',
  paternalLastName: 'González',
  maternalLastName: '',
  email: 'test@test.com',
  phone: '+56912345678',
  birthDate: '1998-05-15',
  gender: 'F',
  address: '',
  courseCategory: 'non-professional',
  courseType: 'class_b',
  singularCourseCode: null,
  senceCode: null,
  currentLicense: null,
  licenseDate: null,
  convalidatesSimultaneously: false,
  historicalPromotionId: null,
  validationBook: null,
  courses: [],
  honeypot: '',
};

function buildBirthDate(yearsAgo: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  return d.toISOString().split('T')[0];
}

describe('canAdvanceFn()', () => {
  it('es true con todos los campos válidos y edad >= 18 (AC-datos-1..6)', () => {
    expect(canAdvanceFn(VALID_DATA, 'class_b')).toBe(true);
  });

  it('es false con RUT inválido (AC-datos-1)', () => {
    expect(canAdvanceFn({ ...VALID_DATA, rut: '12.345.678-0' }, 'class_b')).toBe(false);
  });

  it('es false con RUT vacío (AC-datos-1)', () => {
    expect(canAdvanceFn({ ...VALID_DATA, rut: '' }, 'class_b')).toBe(false);
  });

  it('es false con email inválido (AC-datos-2)', () => {
    expect(canAdvanceFn({ ...VALID_DATA, email: 'no-es-email' }, 'class_b')).toBe(false);
  });

  it('es false con email vacío (AC-datos-2)', () => {
    expect(canAdvanceFn({ ...VALID_DATA, email: '' }, 'class_b')).toBe(false);
  });

  it('es false con birthDate vacío (AC-datos-6)', () => {
    expect(canAdvanceFn({ ...VALID_DATA, birthDate: '' }, 'class_b')).toBe(false);
  });

  it('es false con teléfono corto < 8 chars (AC-datos-6)', () => {
    expect(canAdvanceFn({ ...VALID_DATA, phone: '12345' }, 'class_b')).toBe(false);
  });

  it('es false con género no seleccionado (AC-datos-5)', () => {
    expect(canAdvanceFn({ ...VALID_DATA, gender: '' as any }, 'class_b')).toBe(false);
  });

  it('es false con nombre muy corto', () => {
    expect(canAdvanceFn({ ...VALID_DATA, firstNames: 'A' }, 'class_b')).toBe(false);
  });

  it('es false con apellido muy corto', () => {
    expect(canAdvanceFn({ ...VALID_DATA, paternalLastName: 'B' }, 'class_b')).toBe(false);
  });

  it('es false con alumno menor de 17 años (AC-datos-3)', () => {
    expect(canAdvanceFn({ ...VALID_DATA, birthDate: buildBirthDate(15) }, 'class_b')).toBe(false);
  });

  it('es false con alumno de 17 años — bloqueado, debe ir a sucursal (fix-010)', () => {
    expect(canAdvanceFn({ ...VALID_DATA, birthDate: buildBirthDate(17) }, 'class_b')).toBe(false);
  });

  it('es true con alumno de 18 años recién cumplidos (Clase B)', () => {
    expect(canAdvanceFn({ ...VALID_DATA, birthDate: buildBirthDate(18) }, 'class_b')).toBe(true);
  });

  it('es false con alumno < 20 años en flujo profesional (AC-datos-4)', () => {
    expect(canAdvanceFn({ ...VALID_DATA, birthDate: buildBirthDate(19) }, 'professional_a2')).toBe(
      false,
    );
  });

  it('es true con alumno de 20+ en flujo profesional', () => {
    expect(canAdvanceFn({ ...VALID_DATA, birthDate: buildBirthDate(21) }, 'professional_a2')).toBe(
      true,
    );
  });
});

describe('getAgeStatus()', () => {
  it('retorna "none" con fecha vacía', () => {
    expect(getAgeStatus('', 'class_b')).toBe('none');
  });

  it('retorna "under-17" con alumno de 15 años', () => {
    expect(getAgeStatus(buildBirthDate(15), 'class_b')).toBe('under-17');
  });

  it('retorna "requires-authorization" con alumno de 17 años', () => {
    expect(getAgeStatus(buildBirthDate(17), 'class_b')).toBe('requires-authorization');
  });

  it('retorna "ok" con alumno de 18+ en clase B', () => {
    expect(getAgeStatus(buildBirthDate(20), 'class_b')).toBe('ok');
  });

  it('retorna "under-20-professional" con alumno de 17 años en profesional (fix-013)', () => {
    expect(getAgeStatus(buildBirthDate(17), 'professional_a2')).toBe('under-20-professional');
  });

  it('retorna "under-20-professional" con alumno de 19 en profesional', () => {
    expect(getAgeStatus(buildBirthDate(19), 'professional_a2')).toBe('under-20-professional');
  });

  it('retorna "ok" con alumno de 20+ en profesional', () => {
    expect(getAgeStatus(buildBirthDate(21), 'professional_a3')).toBe('ok');
  });
});
