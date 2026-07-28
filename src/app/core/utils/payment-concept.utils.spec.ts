import { describe, it, expect } from 'vitest';
import { mapConcepto } from './payment-concept.utils';

describe('mapConcepto', () => {
  it('mapea "enrollment" a "Matrícula"', () => {
    expect(mapConcepto('enrollment')).toBe('Matrícula');
  });

  it('mapea "online" a "Online"', () => {
    expect(mapConcepto('online')).toBe('Online');
  });

  it('es case-insensitive', () => {
    expect(mapConcepto('ENROLLMENT')).toBe('Matrícula');
  });

  it('devuelve el valor crudo tal cual para un tipo desconocido', () => {
    expect(mapConcepto('monthly_fee')).toBe('monthly_fee');
  });

  it('devuelve null para null', () => {
    expect(mapConcepto(null)).toBeNull();
  });
});
