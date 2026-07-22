import { licenseClassToSuffix } from './license-suffix.utils';

// fix-053-m — AC1
describe('licenseClassToSuffix', () => {
  it('AC1 — A2 → "2"', () => {
    expect(licenseClassToSuffix('A2')).toBe('2');
  });

  it('AC1 — A3 → "3"', () => {
    expect(licenseClassToSuffix('A3')).toBe('3');
  });

  it('AC1 — A4 → "4"', () => {
    expect(licenseClassToSuffix('A4')).toBe('4');
  });

  it('AC1 — A5 → "5"', () => {
    expect(licenseClassToSuffix('A5')).toBe('5');
  });

  it('AC1 — valor inesperado sin dígito 2-5 → cadena vacía', () => {
    expect(licenseClassToSuffix('B')).toBe('');
  });
});
