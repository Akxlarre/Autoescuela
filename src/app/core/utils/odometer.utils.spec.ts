import { odometerDigitCount, odometerFontTier } from './odometer.utils';

describe('odometerDigitCount', () => {
  it('cuenta los dígitos enteros de un número', () => {
    expect(odometerDigitCount(0)).toBe(1);
    expect(odometerDigitCount(45)).toBe(2);
    expect(odometerDigitCount(45000)).toBe(5);
    expect(odometerDigitCount(999999)).toBe(6);
    expect(odometerDigitCount(1000000)).toBe(7);
  });

  it('acepta strings numéricos (valor crudo del input number)', () => {
    expect(odometerDigitCount('450000')).toBe(6);
  });

  it('devuelve 0 para vacío / null / no numérico', () => {
    expect(odometerDigitCount(null)).toBe(0);
    expect(odometerDigitCount(undefined)).toBe(0);
    expect(odometerDigitCount('')).toBe(0);
    expect(odometerDigitCount('abc' as unknown as string)).toBe(0);
  });

  it('ignora el signo (usa el valor absoluto)', () => {
    expect(odometerDigitCount(-45000)).toBe(5);
  });
});

describe('odometerFontTier', () => {
  it('usa el tamaño grande (5xl) hasta 5 dígitos', () => {
    expect(odometerFontTier(null)).toBe('5xl'); // placeholder
    expect(odometerFontTier(0)).toBe('5xl');
    expect(odometerFontTier(45)).toBe('5xl');
    expect(odometerFontTier(45000)).toBe('5xl'); // 5 díg, límite que cabe
  });

  it('achica a 4xl con 6 dígitos (el caso del bug: 999.999 se cortaba)', () => {
    expect(odometerFontTier(450000)).toBe('4xl');
    expect(odometerFontTier(999999)).toBe('4xl');
  });

  it('achica a 3xl con 7+ dígitos (fuera de rango pero legible)', () => {
    expect(odometerFontTier(1000000)).toBe('3xl');
  });
});
