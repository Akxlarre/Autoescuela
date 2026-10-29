import { describe, it, expect } from 'vitest';
import { contrastRatio } from './color-contrast.utils';

describe('contrastRatio()', () => {
  it('negro sobre blanco es 21:1 y es simétrico', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('un color consigo mismo es 1:1', () => {
    expect(contrastRatio('#0369a1', '#0369a1')).toBeCloseTo(1, 5);
  });

  it('acepta la forma corta #rgb', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('coincide con los valores que reporta axe', () => {
    expect(contrastRatio('#ffffff', '#f59e0b')).toBeCloseTo(2.15, 1);
    expect(contrastRatio('#6b6b74', '#e4e4e7')).toBeCloseTo(4.16, 1);
  });
});
