import { describe, expect, it } from 'vitest';
import { expiredLicenseNotice, licenseStatusFromExpiry } from './license-status.utils';

// fix-202-b (S7 de ASG-i-034): el estado guardado se congelaba; se calcula con la fecha de hoy.
describe('licenseStatusFromExpiry', () => {
  const hoy = '2026-10-07';

  it('vencida si la fecha ya pasó (ayer)', () => {
    expect(licenseStatusFromExpiry('2026-10-06', hoy)).toBe('expired');
  });

  it('vence hoy → todavía no está vencida: por vencer', () => {
    expect(licenseStatusFromExpiry('2026-10-07', hoy)).toBe('expiring_soon');
  });

  it('por vencer hasta 30 días inclusive; 31 días → vigente', () => {
    expect(licenseStatusFromExpiry('2026-11-06', hoy)).toBe('expiring_soon'); // +30
    expect(licenseStatusFromExpiry('2026-11-07', hoy)).toBe('valid'); // +31
  });

  it('acepta timestamps (toma solo la fecha)', () => {
    expect(licenseStatusFromExpiry('2026-10-06T23:00:00Z', hoy)).toBe('expired');
  });

  it('sin fecha → null (no se inventa un estado)', () => {
    expect(licenseStatusFromExpiry(null, hoy)).toBeNull();
    expect(licenseStatusFromExpiry('', hoy)).toBeNull();
  });
});

// fix-202-b (opción B): la Agenda sigue ofreciendo al instructor, con aviso.
describe('expiredLicenseNotice', () => {
  const juan = { id: 1, name: 'Juan Pérez', licenseExpiry: '2026-10-01', licenseExpired: true };
  const ana = { id: 2, name: 'Ana Soto', licenseExpiry: '2026-09-15', licenseExpired: true };
  const luis = { id: 3, name: 'Luis Mora', licenseExpiry: '2027-01-01', licenseExpired: false };

  it('instructor elegido con licencia vencida → su nombre y la fecha', () => {
    expect(expiredLicenseNotice([juan, luis], 1)).toBe(
      'La licencia de Juan Pérez venció el 01-10-2026. Sus horas se siguen ofreciendo.',
    );
  });

  it('instructor elegido con licencia vigente → sin aviso', () => {
    expect(expiredLicenseNotice([juan, luis], 3)).toBeNull();
  });

  it('vista "Todos" → cuántos y quiénes', () => {
    expect(expiredLicenseNotice([juan, ana, luis], null)).toBe(
      '2 instructores con licencia vencida: Juan Pérez, Ana Soto.',
    );
    expect(expiredLicenseNotice([juan, luis], null)).toBe(
      '1 instructor con licencia vencida: Juan Pérez.',
    );
  });

  it('nadie vencido → sin aviso', () => {
    expect(expiredLicenseNotice([luis], null)).toBeNull();
    expect(expiredLicenseNotice([], null)).toBeNull();
  });
});
